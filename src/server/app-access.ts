import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { appEntitlements, apps, organizationMembers, organizations, platformAdministrators } from "@/db/schema";
import {
  canUseCapability,
  resolveEntitlement,
  type Capability,
  type EffectiveEntitlementState,
  type Entitlement,
  type EntitlementLimits,
  type EntitlementState
} from "@/lib/entitlement";

/**
 * Reading what a member may do in *any* app.
 *
 * This used to live inside `estimeter-access.ts` with `ESTIMETR_APP_SLUG` welded into the join, so
 * the only app whose entitlement could be read was the one app that had entitlement rows. The
 * moment a second app needed the same question answered — the assistant layer asks it before every
 * model call — that welded slug became the thing standing in the way.
 *
 * ESTIMETR keeps its own module for everything specific to it: the trial clock, the project count,
 * the activation gates of ADR 0006. What moved here is only the part that was never specific to
 * any app.
 */

type Database = ReturnType<typeof getDb>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** A query runs the same inside a transaction or outside one; callers decide which they need. */
export type Executor = Database | Transaction;

export type AppEntitlementRecord = {
  id: string;
  organizationId: string;
  entitlement: Entitlement;
  /** The registry's kill switch for the whole app. It outranks whatever the entitlement row says. */
  appEnabled: boolean;
};

function readNumber(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBoolean(source: Record<string, unknown>, key: string): boolean | undefined {
  const value = source[key];
  return typeof value === "boolean" ? value : undefined;
}

/** The limits column is jsonb, so it is treated as untrusted input rather than cast. */
export function parseStoredLimits(value: unknown): EntitlementLimits {
  if (typeof value !== "object" || value === null) return {};
  const source = value as Record<string, unknown>;
  return {
    projectLimit: readNumber(source, "projectLimit"),
    exportEnabled: readBoolean(source, "exportEnabled"),
    printEnabled: readBoolean(source, "printEnabled"),
    aiEnabled: readBoolean(source, "aiEnabled")
  };
}

export async function readEntitlementForApp(
  db: Database,
  userId: string,
  slug: string
): Promise<AppEntitlementRecord | null> {
  const rows = await db
    .select({
      id: appEntitlements.id,
      organizationId: appEntitlements.organizationId,
      state: appEntitlements.state,
      startsAt: appEntitlements.startsAt,
      endsAt: appEntitlements.endsAt,
      limits: appEntitlements.limits,
      appEnabled: apps.enabled
    })
    .from(appEntitlements)
    .innerJoin(
      organizationMembers,
      and(eq(organizationMembers.organizationId, appEntitlements.organizationId), eq(organizationMembers.userId, userId))
    )
    .innerJoin(apps, and(eq(apps.id, appEntitlements.appId), eq(apps.slug, slug)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    organizationId: row.organizationId,
    appEnabled: row.appEnabled,
    entitlement: {
      state: row.state as EntitlementState,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      limits: parseStoredLimits(row.limits)
    }
  };
}

/**
 * Gate 1 of ADR 0006: the personal organization that owns a member's work.
 *
 * It moved here from `estimeter-access.ts` for the same reason the entitlement read did — PRICEMETR
 * needs it too (IP-163), and a second copy of an id convention drifts the day one of them changes.
 * It is written lazily on the first write that needs it, never while reading, and is safe to call
 * again: both inserts collide on the primary key rather than issuing a second organization.
 */
export const personalOrgId = (userId: string) => `org_personal_${userId}`;
const membershipId = (organizationId: string, userId: string) => `member_${organizationId}_${userId}`;

export async function ensurePersonalOrganization(
  tx: Executor,
  userId: string,
  memberName: string
): Promise<string> {
  const existing = await readOrganizationOf(tx, userId);
  if (existing) return existing;

  const organizationId = personalOrgId(userId);
  await tx
    .insert(organizations)
    .values({ id: organizationId, kind: "personal", name: memberName })
    .onConflictDoNothing();
  await tx
    .insert(organizationMembers)
    .values({ id: membershipId(organizationId, userId), organizationId, userId, role: "owner" })
    .onConflictDoNothing();
  return organizationId;
}

/** Works inside a transaction too, which `readMembershipOrganization` cannot. */
export async function readOrganizationOf(tx: Executor, userId: string): Promise<string | null> {
  const rows = await tx
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
    .limit(1);
  return rows[0]?.organizationId ?? null;
}

export async function readMembershipOrganization(db: Database, userId: string): Promise<string | null> {
  const rows = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
    .limit(1);
  return rows[0]?.organizationId ?? null;
}

/** True only for an unrevoked grant. See ADR 0012: administration is a row, never a flag. */
export async function isPlatformAdministrator(db: Database, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: platformAdministrators.id })
    .from(platformAdministrators)
    .where(and(eq(platformAdministrators.userId, userId), isNull(platformAdministrators.revokedAt)))
    .limit(1);
  return rows.length > 0;
}

export type AppCapabilityDecision =
  | {
      allowed: true;
      organizationId: string | null;
      state: EffectiveEntitlementState;
      /**
       * True when the only thing letting this through is a platform administration grant, because
       * the app has not been opened yet. Anything that acts on it must say so in its audit record:
       * an administrator exercising a feature nobody else can reach is a different event from a
       * member using the thing they were sold.
       */
      viaAdministrator: boolean;
    }
  | {
      allowed: false;
      reason: "app_not_open" | "not_entitled";
      organizationId: string | null;
      state: EffectiveEntitlementState;
    };

/**
 * Whether this member may exercise one capability in one app right now.
 *
 * The administrator override is deliberately narrow: it applies only where there is nothing to be
 * entitled *to* yet — no entitlement row, or an app the registry has switched off. It never
 * overrides a real entitlement that says no, because an expired administrator is still expired
 * (ADR 0003), and an override that widened as it went would quietly become a second permission
 * system nobody audits.
 */
export async function decideAppCapability(
  userId: string,
  slug: string,
  capability: Capability,
  now = new Date()
): Promise<AppCapabilityDecision> {
  const db = getDb();
  const record = await readEntitlementForApp(db, userId, slug);

  if (!record || !record.appEnabled) {
    const organizationId = record?.organizationId ?? (await readMembershipOrganization(db, userId));
    const state: EffectiveEntitlementState = record ? "suspended" : "not_activated";
    if (await isPlatformAdministrator(db, userId)) {
      return { allowed: true, organizationId, state, viaAdministrator: true };
    }
    return { allowed: false, reason: "app_not_open", organizationId, state };
  }

  const state = resolveEntitlement(record.entitlement, now);
  if (!canUseCapability(record.entitlement, capability, now)) {
    return { allowed: false, reason: "not_entitled", organizationId: record.organizationId, state };
  }

  return { allowed: true, organizationId: record.organizationId, state, viaAdministrator: false };
}
