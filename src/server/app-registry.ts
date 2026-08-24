import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { apps, auditEvents } from "@/db/schema";
import { platformApps, type AppAccess } from "@/lib/platform";

/**
 * The one way in and out of the app registry. See ADR 0014.
 *
 * What the platform says publicly about an app — that it is free for members, that it is open for
 * use — is a row an administrator announced, never a line somebody typed into `src/lib/platform.ts`.
 * That file still owns the name, the icon and the description, because those are content to render
 * rather than a promise to keep.
 *
 * Every surface goes through this module. No page queries `apps` itself, which is what keeps the
 * fail-closed rule in one place instead of being re-decided per page; it is also the seam a real
 * feature-flag store would slot into later without any page noticing.
 *
 * An announcement is a statement and never a grant. What a member may actually do is decided by
 * `app_entitlements` and the entitlement policy, and nothing here widens that.
 */

/** The registry's row identity. Owned here so two modules cannot drift on the convention. */
export const appRowId = (slug: string) => `app_${slug}`;

const REASON_MIN_LENGTH = 4;

const ACCESS_MODELS: readonly AppAccess[] = ["paid_trial", "member_free", "doh_staff_only", "agent_service"];

export function isAppAccess(value: string): value is AppAccess {
  return (ACCESS_MODELS as readonly string[]).includes(value);
}

/** An app the platform has announced. `open` is the readiness claim, not a permission. */
export type AnnouncedApp = {
  slug: string;
  name: string;
  access: AppAccess;
  open: boolean;
};

export type AnnouncedAppsResult =
  | { ok: true; apps: AnnouncedApp[] }
  | { ok: false; reason: "unavailable" };

/**
 * Fails closed. A database that cannot be read returns a refusal rather than an empty list,
 * because a caller that cannot tell "nothing is announced" from "nothing could be read" will
 * eventually render one as the other. The public page shows the same sentence either way; the
 * distinction exists so it is the page's decision and not an accident of a `catch`.
 */
export async function readAnnouncedApps(): Promise<AnnouncedAppsResult> {
  try {
    const db = getDb();
    const rows = await db
      .select({
        slug: apps.slug,
        accessModel: apps.accessModel,
        enabled: apps.enabled,
        announcedAt: apps.announcedAt
      })
      .from(apps);

    const announced: AnnouncedApp[] = [];
    for (const row of rows) {
      // Filtered here rather than in a WHERE clause on purpose. This is the rule ADR 0014 turns on
      // — a row is not an announcement — and a rule that lives in SQL is a rule no unit test can
      // hold. The table carries one row per app in the catalogue, so reading all of them is free.
      if (!row.announcedAt) continue;
      // A row whose slug left the catalogue is an app that was withdrawn from the product. It has
      // no name to show, so it is dropped rather than rendered as a blank line.
      const app = platformApps.find((item) => item.slug === row.slug);
      if (!app) continue;
      if (!isAppAccess(row.accessModel)) continue;
      announced.push({ slug: row.slug, name: app.name, access: row.accessModel, open: row.enabled });
    }
    return { ok: true, apps: announced };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export type RegistryEntry = {
  slug: string;
  name: string;
  categoryId: string;
  seededAccess: AppAccess;
  announced: boolean;
  access: AppAccess | null;
  open: boolean;
  announcedAt: Date | null;
  announcedByEmail: string | null;
  /** True when the administrator announced something other than what the source seeded. */
  conflictsWithSeed: boolean;
};

export type RegistryResult = { ok: true; entries: RegistryEntry[] } | { ok: false; reason: "unavailable" };

/**
 * Every app in the catalogue with whatever the registry holds for it, so the back office can show
 * what has been announced and what has not in one table. An app with no row is not an error state;
 * it is the normal starting point, because nothing is announced until somebody announces it.
 */
export async function readRegistryForAdmin(): Promise<RegistryResult> {
  try {
    const db = getDb();
    const rows = await db
      .select({
        slug: apps.slug,
        accessModel: apps.accessModel,
        enabled: apps.enabled,
        announcedAt: apps.announcedAt,
        announcedBy: apps.announcedBy
      })
      .from(apps);

    const byslug = new Map(rows.map((row) => [row.slug, row]));

    const entries = platformApps.map((app) => {
      const row = byslug.get(app.slug);
      const announced = Boolean(row?.announcedAt);
      const access = row && isAppAccess(row.accessModel) ? row.accessModel : null;
      return {
        slug: app.slug,
        name: app.name,
        categoryId: app.categoryId,
        seededAccess: app.seededAccess,
        announced,
        access: announced ? access : null,
        open: announced ? Boolean(row?.enabled) : false,
        announcedAt: row?.announcedAt ?? null,
        announcedByEmail: null,
        conflictsWithSeed: announced && access !== null && access !== app.seededAccess
      } satisfies RegistryEntry;
    });

    return { ok: true, entries };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export type AnnouncementInput = {
  slug: string;
  access: AppAccess;
  open: boolean;
  reason: string;
  actorId: string;
};

export type AnnouncementResult =
  | { ok: true }
  | { ok: false; reason: "unknown_app" | "reason_required" | "invalid_access" | "member_free_cannot_be_open" };

/**
 * The reason is mandatory and is checked before the database is touched. ADR 0013 settled that for
 * entitlements and the argument is the same here: a field that accepts empty will be filled empty,
 * and an announcement nobody had to justify cannot be reviewed afterwards.
 *
 * `member_free` may not be marked open. ADR 0014: no path issues a `member_free` entitlement yet,
 * so an app advertised as free and open would be a promise the product refuses at the door. When
 * IP-093 builds that path, this refusal is the thing to delete — deliberately, not by accident.
 */
export async function announceApp(input: AnnouncementInput): Promise<AnnouncementResult> {
  const reason = input.reason.trim();
  if (reason.length < REASON_MIN_LENGTH) return { ok: false, reason: "reason_required" };
  if (!isAppAccess(input.access)) return { ok: false, reason: "invalid_access" };
  if (input.access === "member_free" && input.open) return { ok: false, reason: "member_free_cannot_be_open" };

  const app = platformApps.find((item) => item.slug === input.slug);
  if (!app) return { ok: false, reason: "unknown_app" };

  const db = getDb();
  const now = new Date();

  const [existing] = await db
    .select({
      accessModel: apps.accessModel,
      enabled: apps.enabled,
      announcedAt: apps.announcedAt
    })
    .from(apps)
    .where(eq(apps.slug, input.slug))
    .limit(1);

  await db.transaction(async (tx) => {
    await tx
      .insert(apps)
      .values({
        id: appRowId(app.slug),
        slug: app.slug,
        displayName: app.name,
        accessModel: input.access,
        enabled: input.open,
        announcedAt: now,
        announcedBy: input.actorId
      })
      // A row may already exist from an earlier seed or from a trial activation, so the slug
      // decides and the announcement is written over whatever identity that row was given.
      .onConflictDoUpdate({
        target: apps.slug,
        set: {
          displayName: app.name,
          accessModel: input.access,
          enabled: input.open,
          announcedAt: now,
          announcedBy: input.actorId,
          updatedAt: now
        }
      });

    await tx.insert(auditEvents).values({
      id: randomUUID(),
      // Platform-level: an announcement belongs to the platform, not to any one customer.
      organizationId: null,
      actorId: input.actorId,
      eventType: "app.announced_by_administrator",
      resourceType: "app",
      resourceId: app.slug,
      metadata: {
        reason,
        before: existing
          ? {
              access: existing.accessModel,
              open: existing.enabled,
              announced: Boolean(existing.announcedAt)
            }
          : null,
        after: { access: input.access, open: input.open, announced: true },
        seededAccess: app.seededAccess
      }
    });
  });

  return { ok: true };
}

export type RevocationInput = { slug: string; reason: string; actorId: string };

export type RevocationResult =
  | { ok: true }
  | { ok: false; reason: "unknown_app" | "reason_required" | "not_announced" };

/**
 * Withdrawing a statement, not deleting a registration. `app_entitlements.app_id` cascades, so
 * removing the row would take every customer's right to use that app with it — the one thing
 * ADR 0013 forbids an administrator most firmly. Clearing `announced_at` says what actually
 * happened: the platform stopped saying this, and nobody lost anything they had.
 */
export async function revokeAnnouncement(input: RevocationInput): Promise<RevocationResult> {
  const reason = input.reason.trim();
  if (reason.length < REASON_MIN_LENGTH) return { ok: false, reason: "reason_required" };

  const app = platformApps.find((item) => item.slug === input.slug);
  if (!app) return { ok: false, reason: "unknown_app" };

  const db = getDb();

  const [existing] = await db
    .select({ accessModel: apps.accessModel, enabled: apps.enabled, announcedAt: apps.announcedAt })
    .from(apps)
    .where(eq(apps.slug, input.slug))
    .limit(1);

  if (!existing?.announcedAt) return { ok: false, reason: "not_announced" };

  await db.transaction(async (tx) => {
    await tx
      .update(apps)
      .set({ announcedAt: null, announcedBy: null, enabled: false, updatedAt: new Date() })
      .where(eq(apps.slug, input.slug));

    await tx.insert(auditEvents).values({
      id: randomUUID(),
      organizationId: null,
      actorId: input.actorId,
      eventType: "app.announcement_revoked_by_administrator",
      resourceType: "app",
      resourceId: app.slug,
      metadata: {
        reason,
        before: { access: existing.accessModel, open: existing.enabled, announced: true },
        after: { access: null, open: false, announced: false }
      }
    });
  });

  return { ok: true };
}

/**
 * Readiness for the app entry page, and deliberately three-valued.
 *
 * `unknown` covers both "no row" and "the database could not be read", and means *keep doing what
 * the product did before*. Refusing entry on an unreadable database would turn one outage into
 * every app being shut, and this is not the authorization gate: that is `app_entitlements`, read
 * through `resolveEstimeterContext`, and it is unchanged.
 */
export type AppOpenState = "open" | "preparing" | "unknown";

export async function readAppOpenState(slug: string): Promise<AppOpenState> {
  try {
    const db = getDb();
    const [row] = await db
      .select({ enabled: apps.enabled, announcedAt: apps.announcedAt })
      .from(apps)
      .where(eq(apps.slug, slug))
      .limit(1);

    if (!row?.announcedAt) return "unknown";
    return row.enabled ? "open" : "preparing";
  } catch {
    return "unknown";
  }
}
