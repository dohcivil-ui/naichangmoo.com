import { randomUUID } from "node:crypto";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  appEntitlements,
  apps,
  auditEvents,
  organizationMembers,
  organizations,
  users
} from "@/db/schema";
import type { EntitlementState } from "@/lib/entitlement";

/**
 * The administrator's reach into a customer account, and no further.
 *
 * ADR 0013 draws the line at the right to use. Everything here touches `app_entitlements`, which
 * is the relationship the platform issued and is obliged to repair. Nothing here reads `projects`
 * or anything downstream of it — no query in this file names one of the closed tables, which is
 * the property IP-088 will assert rather than trust.
 *
 * A customer is found by email or organization name because those are the two things a person
 * asking for help can say about themselves. Project names would identify them too and are not
 * available for that reason.
 */

export const ADMIN_SETTABLE_STATES = [
  "trial",
  "active",
  "member_free",
  "doh_staff_only",
  "expired_read_only",
  "suspended"
] as const satisfies readonly EntitlementState[];

export type AdminSettableState = (typeof ADMIN_SETTABLE_STATES)[number];

export type CustomerMatch = {
  organizationId: string;
  organizationName: string;
  organizationKind: string;
  memberEmails: string[];
};

/** Empty query returns nothing rather than everything: a blank search is not a request to browse. */
export async function findCustomers(query: string, limit = 12): Promise<CustomerMatch[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const db = getDb();
  const pattern = `%${trimmed}%`;

  const rows = await db
    .select({
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationKind: sql<string>`${organizations.kind}`,
      email: users.email
    })
    .from(organizations)
    .leftJoin(organizationMembers, eq(organizationMembers.organizationId, organizations.id))
    .leftJoin(users, eq(users.id, organizationMembers.userId))
    .where(or(ilike(organizations.name, pattern), ilike(users.email, pattern)))
    .limit(limit * 4);

  const grouped = new Map<string, CustomerMatch>();
  for (const row of rows) {
    const existing = grouped.get(row.organizationId);
    if (existing) {
      if (row.email && !existing.memberEmails.includes(row.email)) existing.memberEmails.push(row.email);
      continue;
    }
    grouped.set(row.organizationId, {
      organizationId: row.organizationId,
      organizationName: row.organizationName,
      organizationKind: row.organizationKind,
      memberEmails: row.email ? [row.email] : []
    });
    if (grouped.size >= limit) break;
  }

  return [...grouped.values()];
}

export type CustomerEntitlement = {
  entitlementId: string;
  appSlug: string;
  appName: string;
  state: string;
  startsAt: Date;
  endsAt: Date | null;
};

export async function readCustomerEntitlements(organizationId: string): Promise<CustomerEntitlement[]> {
  const db = getDb();
  return await db
    .select({
      entitlementId: appEntitlements.id,
      appSlug: apps.slug,
      appName: apps.displayName,
      state: sql<string>`${appEntitlements.state}`,
      startsAt: appEntitlements.startsAt,
      endsAt: appEntitlements.endsAt
    })
    .from(appEntitlements)
    .innerJoin(apps, eq(apps.id, appEntitlements.appId))
    .where(eq(appEntitlements.organizationId, organizationId));
}

export type EntitlementUpdate = {
  entitlementId: string;
  state: AdminSettableState;
  /** Null clears the expiry, which is what an unlimited state means. */
  endsAt: Date | null;
  reason: string;
  actorId: string;
};

export type EntitlementUpdateResult =
  | { ok: true }
  | { ok: false; reason: "unknown_entitlement" | "reason_required" | "invalid_state" };

/**
 * The reason is mandatory and is checked here, not only in the form. A field that accepts empty
 * will be filled empty, and an extension nobody had to justify is a giveaway that cannot be
 * reviewed. The audit event carries the customer organization, the acting administrator, the
 * before and after state, and that reason.
 */
export async function updateCustomerEntitlement(input: EntitlementUpdate): Promise<EntitlementUpdateResult> {
  const reason = input.reason.trim();
  if (reason.length < 4) return { ok: false, reason: "reason_required" };
  if (!ADMIN_SETTABLE_STATES.includes(input.state)) return { ok: false, reason: "invalid_state" };

  const db = getDb();
  const [existing] = await db
    .select({
      id: appEntitlements.id,
      organizationId: appEntitlements.organizationId,
      state: sql<string>`${appEntitlements.state}`,
      endsAt: appEntitlements.endsAt
    })
    .from(appEntitlements)
    .where(eq(appEntitlements.id, input.entitlementId))
    .limit(1);

  if (!existing) return { ok: false, reason: "unknown_entitlement" };

  await db.transaction(async (tx) => {
    await tx
      .update(appEntitlements)
      .set({ state: input.state, endsAt: input.endsAt, updatedAt: new Date() })
      .where(eq(appEntitlements.id, input.entitlementId));

    await tx.insert(auditEvents).values({
      id: randomUUID(),
      organizationId: existing.organizationId,
      actorId: input.actorId,
      eventType: "entitlement.changed_by_administrator",
      resourceType: "app_entitlement",
      resourceId: input.entitlementId,
      metadata: {
        reason,
        before: { state: existing.state, endsAt: existing.endsAt?.toISOString() ?? null },
        after: { state: input.state, endsAt: input.endsAt?.toISOString() ?? null }
      }
    });
  });

  return { ok: true };
}

/** Recent administrator changes to entitlements, so the surface shows its own history. */
export async function readRecentEntitlementChanges(limit = 10) {
  const db = getDb();
  return await db
    .select({
      id: auditEvents.id,
      resourceId: auditEvents.resourceId,
      metadata: auditEvents.metadata,
      createdAt: auditEvents.createdAt,
      actorEmail: users.email
    })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorId))
    .where(and(eq(auditEvents.eventType, "entitlement.changed_by_administrator")))
    .orderBy(sql`${auditEvents.createdAt} desc`)
    .limit(limit);
}
