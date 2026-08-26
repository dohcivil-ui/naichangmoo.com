import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { apps, auditEvents, users } from "@/db/schema";
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

/**
 * What the registry says about one app, for the surfaces that render claims about it.
 *
 * `announced` false means every other field is meaningless and the surface must say nothing about
 * access, readiness or dates — not that the app is hidden. See ADR 0015.
 */
export type AppClaim = {
  announced: boolean;
  access: AppAccess | null;
  open: boolean;
  announcedAt: Date | null;
  /** ADR 0018: the pre-entry availability sentence. Null means the platform says nothing. */
  availabilityNote: string | null;
};

/** Keyed by slug, and holding an entry for every app in the catalogue, so no caller handles a miss. */
export type CatalogueClaims = Record<string, AppClaim>;

const UNANNOUNCED: AppClaim = { announced: false, access: null, open: false, announcedAt: null, availabilityNote: null };

/**
 * Reads the registry for the public catalogue surfaces — the landing page cards and the app detail
 * page. Unlike every other reader here it returns no failure case, and that is a decision rather
 * than a swallowed error.
 *
 * ADR 0014 §2 kept "nothing is announced" separate from "nothing could be read" so the page could
 * choose what to do about each. ADR 0015 §3 made that choice, once, for these surfaces: both mean
 * the card renders its introduction and stays silent about every claim. Collapsing it here is what
 * stops the rule from being re-decided per page — the same reason this module is the only door.
 *
 * The catalogue is small enough to read whole; the filtering that matters is the announcement rule
 * below, which stays in code where a test can hold it rather than in a WHERE clause.
 */
export async function readCatalogueClaims(): Promise<CatalogueClaims> {
  const claims: CatalogueClaims = {};
  for (const app of platformApps) claims[app.slug] = UNANNOUNCED;

  try {
    const db = getDb();
    const rows = await db
      .select({
        slug: apps.slug,
        accessModel: apps.accessModel,
        enabled: apps.enabled,
        availabilityNote: apps.availabilityNote,
        announcedAt: apps.announcedAt
      })
      .from(apps);

    for (const row of rows) {
      if (!claims[row.slug]) continue;
      if (!row.announcedAt) continue;
      if (!isAppAccess(row.accessModel)) continue;
      claims[row.slug] = {
        announced: true,
        access: row.accessModel,
        open: row.enabled,
        announcedAt: row.announcedAt,
        availabilityNote: row.availabilityNote ?? null
      };
    }
  } catch {
    // Deliberately the same result as an empty registry. See the note above.
  }

  return claims;
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
  /** What the registry currently says before entry; null when it says nothing. ADR 0018. */
  availabilityNote: string | null;
  /** The source's suggested sentence, shown to the administrator only, like `seededAccess`. */
  seededNote: string;
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
        availabilityNote: apps.availabilityNote,
        announcedAt: apps.announcedAt,
        // Who said it, by the name they are known by here. An announcement with a time but no
        // author is half a record, and the half it is missing is the one worth having.
        announcedByEmail: users.email
      })
      .from(apps)
      .leftJoin(users, eq(users.id, apps.announcedBy));

    const bySlug = new Map(rows.map((row) => [row.slug, row]));

    const entries = platformApps.map((app) => {
      const row = bySlug.get(app.slug);
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
        announcedByEmail: announced ? row?.announcedByEmail ?? null : null,
        availabilityNote: announced ? row?.availabilityNote ?? null : null,
        seededNote: app.marketDetail.availabilityNote,
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
  /**
   * ADR 0018: the pre-entry sentence the platform will say for this app. Empty or omitted means
   * the platform says nothing - silence is a valid announcement, not a validation error.
   */
  availabilityNote?: string;
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
  const availabilityNote = input.availabilityNote?.trim() || null;

  const [existing] = await db
    .select({
      accessModel: apps.accessModel,
      enabled: apps.enabled,
      availabilityNote: apps.availabilityNote,
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
        availabilityNote,
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
          availabilityNote,
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
              availabilityNote: existing.availabilityNote ?? null,
              announced: Boolean(existing.announcedAt)
            }
          : null,
        after: { access: input.access, open: input.open, availabilityNote, announced: true },
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

/**
 * What the back office has said lately, with the reason attached. The overview page shows platform
 * events by type; this shows the same events with the sentence somebody typed, which is the part
 * worth reading when the question is "why is this app free now".
 */
export type RecentAnnouncement = {
  id: string;
  slug: string;
  eventType: string;
  reason: string;
  createdAt: Date;
  actorEmail: string | null;
};

const ANNOUNCEMENT_EVENTS = [
  "app.announced_by_administrator",
  "app.announcement_revoked_by_administrator"
];

export async function readRecentAnnouncements(limit = 8): Promise<RecentAnnouncement[]> {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: auditEvents.id,
        slug: auditEvents.resourceId,
        eventType: auditEvents.eventType,
        metadata: auditEvents.metadata,
        createdAt: auditEvents.createdAt,
        actorEmail: users.email
      })
      .from(auditEvents)
      .leftJoin(users, eq(users.id, auditEvents.actorId))
      .where(inArray(auditEvents.eventType, ANNOUNCEMENT_EVENTS))
      .orderBy(sql`${auditEvents.createdAt} desc`)
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      eventType: row.eventType,
      reason: readReason(row.metadata),
      createdAt: row.createdAt,
      actorEmail: row.actorEmail ?? null
    }));
  } catch {
    return [];
  }
}

function readReason(metadata: unknown): string {
  if (metadata && typeof metadata === "object" && "reason" in metadata) {
    const reason = (metadata as { reason?: unknown }).reason;
    if (typeof reason === "string") return reason;
  }
  return "";
}
