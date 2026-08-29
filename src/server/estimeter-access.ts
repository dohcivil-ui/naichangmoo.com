import { count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appEntitlements, apps, auditEvents, projects, users } from "@/db/schema";
import {
  listCapabilities,
  notActivatedCapabilities,
  resolveEntitlement,
  resolveLimits,
  type Capability,
  type EffectiveEntitlementState,
  type Entitlement
} from "@/lib/entitlement";
import { ensurePersonalOrganization, parseStoredLimits, readEntitlementForApp, readOrganizationOf } from "@/server/app-access";
import {
  ESTIMETR_APP_SLUG,
  ESTIMETR_TRIAL_DAYS,
  ESTIMETR_TRIAL_LIMITS,
  computeTrialWindow,
  trialDaysRemaining
} from "@/lib/estimeter-trial";
import { platformApps } from "@/lib/platform";
import { appRowId } from "@/server/app-registry";

type Database = ReturnType<typeof getDb>;

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

// Identifiers are derived from the member and the app slug so a concurrent or repeated
// activation collides on the primary key instead of issuing a second trial. The app row id comes
// from the registry module rather than being spelled out again here, because two copies of an id
// convention drift the day one of them is changed. `personalOrgId` and the membership id moved to
// `app-access.ts` in IP-163 for that same reason, once PRICEMETR needed gate 1 too.
const entitlementRowId = (organizationId: string, appId: string) => `ent_${organizationId}_${appId}`;
const trialAuditId = (entitlementId: string) => `audit_trial_activated_${entitlementId}`;

// The generic half of this module now lives in `app-access.ts`, because the assistant layer needs
// the same read for every app and this file's version had ESTIMETR welded into the join. It is
// re-exported so callers that only ever wanted the parser keep their import path.
export { parseStoredLimits };

const readEstimeterEntitlement = (db: Database, userId: string) =>
  readEntitlementForApp(db, userId, ESTIMETR_APP_SLUG);

async function countOrganizationProjects(db: Database, organizationId: string): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(projects)
    .where(eq(projects.organizationId, organizationId));
  return rows[0]?.value ?? 0;
}

export type TrialActivation =
  | { ok: true; organizationId: string; startsAt: Date; endsAt: Date }
  | { ok: false; reason: "unknown_member" | "already_activated" };

/**
 * Gate 2 of ADR 0006: the member accepts the trial terms and the seven-day clock starts here,
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
      .values({ id: appRowId(app.slug), slug: app.slug, displayName: app.name, accessModel: app.seededAccess })
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
    const organizationId = await readOrganizationOf(db, userId);
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
