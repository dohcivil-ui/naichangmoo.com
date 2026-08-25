import { and, desc, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { appEntitlements, apps, organizationMembers, organizations, sessions } from "@/db/schema";
import { resolveEntitlement, type EffectiveEntitlementState } from "@/lib/entitlement";
import { trialDaysRemaining } from "@/lib/estimeter-trial";

/**
 * What a member can see about their own access, for the account panel in the site header.
 *
 * This is the member reading themselves, so ADR 0013 does not apply — that boundary is about the
 * platform reading a customer's work, not about a customer reading their own entitlements. What it
 * still will not do is name anything the member produced: apps and states, never projects.
 *
 * It reads the effective state rather than the stored one. A trial whose end date has passed is
 * `expired_read_only` to the policy that enforces it, and a panel that still said "ทดลองใช้งาน"
 * would be describing a permission the member no longer has.
 */

export type MemberAppAccess = {
  slug: string;
  name: string;
  state: EffectiveEntitlementState;
  endsAtIso: string | null;
  daysRemaining: number | null;
};

/** Ranked worst-last, so an organization that still grants access wins over one that has lapsed. */
const STATE_PREFERENCE: EffectiveEntitlementState[] = [
  "active",
  "member_free",
  "doh_staff_only",
  "trial",
  "not_started",
  "expired_read_only",
  "suspended",
  "not_activated"
];

/**
 * Returns one row per app, never one per organization. A member who belongs to two organizations
 * that both hold ESTIMETR would otherwise see it listed twice with different states, which reads
 * as a bug rather than as the two grants it is.
 *
 * A database it cannot read returns an empty list rather than throwing: this feeds a header that
 * renders on every page, and a failed read here must not take a whole page down with it. The panel
 * says it found nothing, which is honest — it did not find anything.
 */
export async function readMemberAppAccess(userId: string, now = new Date()): Promise<MemberAppAccess[]> {
  let rows;
  try {
    rows = await getDb()
      .select({
        slug: apps.slug,
        name: apps.displayName,
        enabled: apps.enabled,
        state: appEntitlements.state,
        startsAt: appEntitlements.startsAt,
        endsAt: appEntitlements.endsAt
      })
      .from(organizationMembers)
      .innerJoin(appEntitlements, eq(appEntitlements.organizationId, organizationMembers.organizationId))
      .innerJoin(apps, eq(apps.id, appEntitlements.appId))
      .where(eq(organizationMembers.userId, userId));
  } catch {
    return [];
  }

  const best = new Map<string, MemberAppAccess>();
  for (const row of rows) {
    if (!row.enabled) continue;

    const access: MemberAppAccess = {
      slug: row.slug,
      name: row.name,
      state: resolveEntitlement({ state: row.state, startsAt: row.startsAt, endsAt: row.endsAt, limits: {} }, now),
      endsAtIso: row.endsAt?.toISOString() ?? null,
      daysRemaining: trialDaysRemaining(row.endsAt, now)
    };

    const existing = best.get(row.slug);
    if (!existing || STATE_PREFERENCE.indexOf(access.state) < STATE_PREFERENCE.indexOf(existing.state)) {
      best.set(row.slug, access);
    }
  }

  return [...best.values()].sort((a, b) => a.name.localeCompare(b.name, "th"));
}

export type MemberOrganization = {
  id: string;
  name: string;
  kind: string;
  role: string;
};

/**
 * The organizations a member belongs to. Most members have exactly one — the personal organization
 * the platform creates for them at sign-in — and until now nothing told them it existed. An
 * entitlement is held by an organization, not by a person, so a member who cannot see their
 * organizations cannot understand why they hold what they hold.
 */
export async function readMemberOrganizations(userId: string): Promise<MemberOrganization[]> {
  try {
    return await getDb()
      .select({
        id: organizations.id,
        name: organizations.name,
        kind: organizations.kind,
        role: organizationMembers.role
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
      .where(eq(organizationMembers.userId, userId));
  } catch {
    return [];
  }
}

export type MemberSession = {
  id: string;
  createdAtIso: string;
  expiresAtIso: string;
  userAgent: string | null;
};

/**
 * Sessions that have not expired, newest first. Shown so a member can see how many places they are
 * signed in from — the answer is often "more than I thought", because every sign-in opens another
 * one and nothing has ever closed them.
 *
 * Deliberately does not return the token or the IP address. The point is to let someone recognise
 * that other sessions exist and end them, not to build a surveillance panel out of their own data.
 */
export async function readMemberSessions(userId: string, now = new Date()): Promise<MemberSession[]> {
  try {
    const rows = await getDb()
      .select({
        id: sessions.id,
        createdAt: sessions.createdAt,
        expiresAt: sessions.expiresAt,
        userAgent: sessions.userAgent
      })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now)))
      .orderBy(desc(sessions.createdAt));

    return rows.map((row) => ({
      id: row.id,
      createdAtIso: row.createdAt.toISOString(),
      expiresAtIso: row.expiresAt.toISOString(),
      userAgent: row.userAgent
    }));
  } catch {
    return [];
  }
}
