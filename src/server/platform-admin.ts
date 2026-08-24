import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { auditEvents, platformAdministrators, users } from "@/db/schema";
import { getPlatformSessionUser } from "@/lib/auth-session";

/**
 * ADR 0012. The only place a back-office surface may ask whether someone is allowed in.
 *
 * It fails closed at every step. No session, no unrevoked row, or a database that cannot be read
 * all produce a refusal — never an allowance. That last case is the one systems usually get wrong:
 * a lookup that throws is not evidence of permission, and treating it as "let them through for
 * now" turns an outage into an open door.
 *
 * The scope this grants is platform content and aggregate counts. It carries no right to read an
 * organization's projects, drawings, take-off lines or price sets; those stay behind
 * `projects.organization_id`. Widening that is a different decision and a different ADR.
 */

export type PlatformAdmin = {
  userId: string;
  email: string;
  name: string;
  grantedAt: Date;
};

export type PlatformAdminRefusal = "unauthenticated" | "not_an_administrator" | "unavailable";

export type PlatformAdminResult = { ok: true; admin: PlatformAdmin } | { ok: false; reason: PlatformAdminRefusal };

/** Reads the current session and decides. Every admin route starts here. */
export async function resolvePlatformAdmin(): Promise<PlatformAdminResult> {
  const user = await getPlatformSessionUser(await headers());
  if (!user) return { ok: false, reason: "unauthenticated" };

  try {
    const admin = await findActiveAdministrator(user.id);
    if (!admin) return { ok: false, reason: "not_an_administrator" };
    return { ok: true, admin: { userId: user.id, email: user.email, name: user.name, grantedAt: admin.grantedAt } };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

async function findActiveAdministrator(userId: string) {
  const db = getDb();
  const [row] = await db
    .select({ id: platformAdministrators.id, grantedAt: platformAdministrators.grantedAt })
    .from(platformAdministrators)
    .where(and(eq(platformAdministrators.userId, userId), isNull(platformAdministrators.revokedAt)))
    .limit(1);
  return row ?? null;
}

/** True only for an unrevoked grant. Used by the bootstrap script to refuse a second break-glass. */
export async function countActiveAdministrators(): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: platformAdministrators.id })
    .from(platformAdministrators)
    .where(isNull(platformAdministrators.revokedAt));
  return rows.length;
}

export type GrantResult =
  | { ok: true; administratorId: string }
  | { ok: false; reason: "unknown_user" | "already_an_administrator" };

/**
 * `grantedBy` is null only for the break-glass grant, which by definition has no administrator to
 * attribute it to. Every other grant names one, and both paths write an audit event with the
 * granting actor rather than the receiving one — the interesting fact is who decided.
 */
export async function grantPlatformAdministrator(input: {
  email: string;
  grantedBy: string | null;
  note?: string;
}): Promise<GrantResult> {
  const db = getDb();

  const [target] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
  if (!target) return { ok: false, reason: "unknown_user" };
  if (await findActiveAdministrator(target.id)) return { ok: false, reason: "already_an_administrator" };

  const administratorId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(platformAdministrators).values({
      id: administratorId,
      userId: target.id,
      grantedBy: input.grantedBy,
      note: input.note ?? null
    });
    await tx.insert(auditEvents).values({
      id: randomUUID(),
      actorId: input.grantedBy,
      eventType: input.grantedBy ? "platform_admin.granted" : "platform_admin.bootstrapped",
      resourceType: "platform_administrator",
      resourceId: administratorId,
      metadata: { email: input.email, note: input.note ?? null }
    });
  });

  return { ok: true, administratorId };
}

export type RevokeResult = { ok: true } | { ok: false; reason: "not_an_administrator" };

/**
 * Revoking the last administrator is allowed. A rule forbidding it would create an account that
 * cannot be removed, which is worse than returning the system to the state the bootstrap script
 * already handles — and that script needs direct database access anyway.
 */
export async function revokePlatformAdministrator(input: {
  userId: string;
  revokedBy: string;
  note?: string;
}): Promise<RevokeResult> {
  const db = getDb();
  const existing = await findActiveAdministrator(input.userId);
  if (!existing) return { ok: false, reason: "not_an_administrator" };

  await db.transaction(async (tx) => {
    await tx
      .update(platformAdministrators)
      .set({ revokedAt: new Date(), revokedBy: input.revokedBy, updatedAt: new Date() })
      .where(eq(platformAdministrators.id, existing.id));
    await tx.insert(auditEvents).values({
      id: randomUUID(),
      actorId: input.revokedBy,
      eventType: "platform_admin.revoked",
      resourceType: "platform_administrator",
      resourceId: existing.id,
      metadata: { revokedUserId: input.userId, note: input.note ?? null }
    });
  });

  return { ok: true };
}
