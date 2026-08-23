import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appEntitlements, apps, auditEvents, organizationMembers, organizations, projects, users } from "@/db/schema";
import {
  listCapabilities,
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

/** Serializable snapshot for the workspace; every field is decided on the server. */
export type EstimeterAccess = {
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
// bootstrap collides on the primary key instead of issuing a second trial.
const appRowId = (slug: string) => `app_${slug}`;
const personalOrgId = (userId: string) => `org_personal_${userId}`;
const membershipId = (organizationId: string, userId: string) => `member_${organizationId}_${userId}`;
const entitlementRowId = (organizationId: string, appId: string) => `ent_${organizationId}_${appId}`;
const trialAuditId = (entitlementId: string) => `audit_trial_issued_${entitlementId}`;

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

/**
 * ADR 0003 issues the ESTIMETR trial at registration. Members created before this runtime
 * existed have no row, so the first authenticated visit backfills one. The window still
 * comes from users.created_at, which keeps the backfill from handing out extra days.
 */
async function issueEstimeterTrial(db: Database, userId: string): Promise<EntitlementRecord> {
  const app = platformApps.find((item) => item.slug === ESTIMETR_APP_SLUG);
  if (!app) throw new Error(`App registry is missing "${ESTIMETR_APP_SLUG}".`);

  const memberRows = await db
    .select({ name: users.name, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const member = memberRows[0];
  if (!member) throw new Error("Cannot issue an entitlement for an unknown member.");

  const window = computeTrialWindow(member.createdAt);

  await db.transaction(async (tx) => {
    await tx
      .insert(apps)
      .values({ id: appRowId(app.slug), slug: app.slug, displayName: app.name, accessModel: app.access })
      .onConflictDoNothing();

    // A row may already exist under a different id from an earlier seed, so the slug decides.
    const appRows = await tx.select({ id: apps.id }).from(apps).where(eq(apps.slug, app.slug)).limit(1);
    const appId = appRows[0]?.id;
    if (!appId) throw new Error(`Failed to register app "${app.slug}".`);

    const membershipRows = await tx
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId))
      .limit(1);
    const organizationId = membershipRows[0]?.organizationId ?? personalOrgId(userId);

    if (!membershipRows[0]) {
      await tx
        .insert(organizations)
        .values({ id: organizationId, kind: "personal", name: member.name })
        .onConflictDoNothing();
      await tx
        .insert(organizationMembers)
        .values({ id: membershipId(organizationId, userId), organizationId, userId, role: "owner" })
        .onConflictDoNothing();
    }

    const entitlementId = entitlementRowId(organizationId, appId);
    await tx
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
      .onConflictDoNothing();

    await tx
      .insert(auditEvents)
      .values({
        id: trialAuditId(entitlementId),
        organizationId,
        actorId: userId,
        eventType: "entitlement.trial_issued",
        resourceType: "app_entitlement",
        resourceId: entitlementId,
        metadata: {
          appSlug: app.slug,
          trialDays: ESTIMETR_TRIAL_DAYS,
          projectLimit: ESTIMETR_TRIAL_LIMITS.projectLimit,
          startsAt: window.startsAt.toISOString(),
          endsAt: window.endsAt.toISOString(),
          derivedFrom: "users.created_at"
        }
      })
      .onConflictDoNothing();
  });

  const record = await readEstimeterEntitlement(db, userId);
  if (!record) throw new Error("Entitlement bootstrap did not produce a readable record.");
  return record;
}

export async function getEstimeterAccess(userId: string, now = new Date()): Promise<EstimeterAccess> {
  const db = getDb();
  const record = (await readEstimeterEntitlement(db, userId)) ?? (await issueEstimeterTrial(db, userId));

  const projectRows = await db
    .select({ value: count() })
    .from(projects)
    .where(eq(projects.organizationId, record.organizationId));
  const projectCount = projectRows[0]?.value ?? 0;

  // A disabled app row is the platform-level kill switch and outranks the stored state.
  const entitlement: Entitlement = record.appEnabled
    ? record.entitlement
    : { ...record.entitlement, state: "suspended" };

  return {
    state: resolveEntitlement(entitlement, now),
    endsAtIso: entitlement.endsAt ? entitlement.endsAt.toISOString() : null,
    daysRemaining: trialDaysRemaining(entitlement.endsAt, now),
    projectCount,
    projectLimit: resolveLimits(entitlement, now).projectLimit,
    capabilities: listCapabilities(entitlement, projectCount, now)
  };
}
