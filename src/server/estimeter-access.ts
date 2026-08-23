import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appEntitlements, apps, auditEvents, organizationMembers, organizations, projects, users } from "@/db/schema";
import {
  listCapabilities,
  notActivatedCapabilities,
  resolveEntitlement,
  resolveLimits,
  type Capability,
  type EffectiveEntitlementState,
  type Entitlement,
  type EntitlementLimits,
  type EntitlementState
} from "@/lib/entitlement";
import {
  ESTIMETR_APP_SLUG,
  ESTIMETR_TRIAL_DAYS,
  ESTIMETR_TRIAL_LIMITS,
  computeTrialWindow,
  trialDaysRemaining
} from "@/lib/estimeter-trial";
import { platformApps } from "@/lib/platform";

type Database = ReturnType<typeof getDb>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Executor = Database | Transaction;

/**
 * Server-side decision record. `toAccessView` strips it down to what the client may see.
 * `organizationId` is null for a member who has never had a personal organization written,
 * which happens before the trial is activated (ADR 0006).
 */
export type EstimeterAccess = {
  organizationId: string | null;
  state: EffectiveEntitlementState;
  endsAtIso: string | null;
  daysRemaining: number | null;
  projectCount: number;
  projectLimit: number | null;
  capabilities: Record<Capability, boolean>;
};

type EntitlementRecord = {
  id: string;
  organizationId: string;
  entitlement: Entitlement;
  appEnabled: boolean;
};

// Identifiers are derived from the member and the app slug so a concurrent or repeated
// activation collides on the primary key instead of issuing a second trial.
const appRowId = (slug: string) => `app_${slug}`;
const personalOrgId = (userId: string) => `org_personal_${userId}`;
const membershipId = (organizationId: string, userId: string) => `member_${organizationId}_${userId}`;
const entitlementRowId = (organizationId: string, appId: string) => `ent_${organizationId}_${appId}`;
const trialAuditId = (entitlementId: string) => `audit_trial_activated_${entitlementId}`;

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

async function readEstimeterEntitlement(db: Database, userId: string): Promise<EntitlementRecord | null> {
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
    .innerJoin(apps, and(eq(apps.id, appEntitlements.appId), eq(apps.slug, ESTIMETR_APP_SLUG)))
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

async function readMembershipOrganization(db: Executor, userId: string): Promise<string | null> {
  const rows = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
    .limit(1);
  return rows[0]?.organizationId ?? null;
}

async function countOrganizationProjects(db: Database, organizationId: string): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(projects)
    .where(eq(projects.organizationId, organizationId));
  return rows[0]?.value ?? 0;
}

/**
 * Gate 1 of ADR 0006: the personal organization that owns a member's work. It is written
 * lazily on the first write that needs it, never while reading, and is safe to call again.
 */
async function ensurePersonalOrganization(tx: Executor, userId: string, memberName: string): Promise<string> {
  const existing = await readMembershipOrganization(tx, userId);
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

export type TrialActivation =
  | { ok: true; organizationId: string; startsAt: Date; endsAt: Date }
  | { ok: false; reason: "unknown_member" | "already_activated" };

/**
 * Gate 2 of ADR 0006: the member accepts the trial terms and the five-day clock starts here,
 * at the moment of the click. Repeating the click cannot extend or reissue anything, because
 * the unique index on (organization_id, app_id) refuses the second row.
 */
export async function activateEstimeterTrial(userId: string, now = new Date()): Promise<TrialActivation> {
  const db = getDb();
  const app = platformApps.find((item) => item.slug === ESTIMETR_APP_SLUG);
  if (!app) throw new Error(`App registry is missing "${ESTIMETR_APP_SLUG}".`);

  const memberRows = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  const member = memberRows[0];
  if (!member) return { ok: false, reason: "unknown_member" };

  const window = computeTrialWindow(now);

  return db.transaction(async (tx) => {
    await tx
      .insert(apps)
      .values({ id: appRowId(app.slug), slug: app.slug, displayName: app.name, accessModel: app.access })
      .onConflictDoNothing();

    // A row may already exist under a different id from an earlier seed, so the slug decides.
    const appRows = await tx.select({ id: apps.id }).from(apps).where(eq(apps.slug, app.slug)).limit(1);
    const appId = appRows[0]?.id;
    if (!appId) throw new Error(`Failed to register app "${app.slug}".`);

    const organizationId = await ensurePersonalOrganization(tx, userId, member.name);
    const entitlementId = entitlementRowId(organizationId, appId);

    const inserted = await tx
      .insert(appEntitlements)
      .values({
        id: entitlementId,
        organizationId,
        appId,
        state: "trial",
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        limits: ESTIMETR_TRIAL_LIMITS
      })
      .onConflictDoNothing()
      .returning({ id: appEntitlements.id });

    if (inserted.length === 0) return { ok: false, reason: "already_activated" };

    await tx
      .insert(auditEvents)
      .values({
        id: trialAuditId(entitlementId),
        organizationId,
        actorId: userId,
        eventType: "entitlement.trial_activated",
        resourceType: "app_entitlement",
        resourceId: entitlementId,
        metadata: {
          appSlug: app.slug,
          trialDays: ESTIMETR_TRIAL_DAYS,
          projectLimit: ESTIMETR_TRIAL_LIMITS.projectLimit,
          startsAt: window.startsAt.toISOString(),
          endsAt: window.endsAt.toISOString(),
          // The member saw the trial terms next to the control they pressed, so this record is
          // the consent for the entitlement, not just a note that a row appeared.
          acceptedTerms: `${ESTIMETR_TRIAL_DAYS} days, ${ESTIMETR_TRIAL_LIMITS.projectLimit} project, export and print locked`,
          startedBy: "explicit_activation"
        }
      })
      .onConflictDoNothing();

    return { ok: true, organizationId, startsAt: window.startsAt, endsAt: window.endsAt };
  });
}

/**
 * Read path only. A member with no entitlement row has passed gate 1 but not gate 2, and is
 * reported as `not_activated` rather than being handed a trial as a side effect of looking.
 */
export async function getEstimeterAccess(userId: string, now = new Date()): Promise<EstimeterAccess> {
  const db = getDb();
  const record = await readEstimeterEntitlement(db, userId);

  if (!record) {
    const organizationId = await readMembershipOrganization(db, userId);
    return {
      organizationId,
      state: "not_activated",
      endsAtIso: null,
      daysRemaining: null,
      projectCount: organizationId ? await countOrganizationProjects(db, organizationId) : 0,
      projectLimit: 0,
      capabilities: notActivatedCapabilities()
    };
  }

  const projectCount = await countOrganizationProjects(db, record.organizationId);

  // A disabled app row is the platform-level kill switch and outranks the stored state.
  const entitlement: Entitlement = record.appEnabled
    ? record.entitlement
    : { ...record.entitlement, state: "suspended" };

  return {
    organizationId: record.organizationId,
    state: resolveEntitlement(entitlement, now),
    endsAtIso: entitlement.endsAt ? entitlement.endsAt.toISOString() : null,
    daysRemaining: trialDaysRemaining(entitlement.endsAt, now),
    projectCount,
    projectLimit: resolveLimits(entitlement, now).projectLimit,
    capabilities: listCapabilities(entitlement, projectCount, now)
  };
}
