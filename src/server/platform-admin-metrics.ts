import { count, eq, isNull, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  appEntitlements,
  auditEvents,
  enterpriseQuotationRequests,
  organizations,
  platformAdministrators,
  projects,
  users
} from "@/db/schema";

/**
 * Counts for the back-office overview. Every figure here is a real count from a real table.
 *
 * The dashboard templates this borrows its shape from ship with numbers like $45,231.89 baked into
 * the markup. A page that looks authoritative and states a figure nobody measured is exactly the
 * fabricated content AGENTS.md forbids, so where there is nothing to count this returns zero and
 * the page says so rather than filling the tile.
 *
 * Nothing here reaches into an organization's work. Counting projects is a count; opening one is
 * not, and ADR 0012 does not grant that.
 */

export type PlatformMetrics = {
  members: number;
  organizations: number;
  projects: number;
  entitlementsByState: { state: string; total: number }[];
  openQuotationRequests: number;
  activeAdministrators: number;
  auditEventsRecorded: number;
};

export type PlatformMetricsResult = { ok: true; metrics: PlatformMetrics } | { ok: false; reason: "unavailable" };

export async function readPlatformMetrics(): Promise<PlatformMetricsResult> {
  try {
    const db = getDb();

    const [
      memberRows,
      organizationRows,
      projectRows,
      entitlementRows,
      quotationRows,
      administratorRows,
      auditRows
    ] = await Promise.all([
      db.select({ total: count() }).from(users),
      db.select({ total: count() }).from(organizations),
      db.select({ total: count() }).from(projects),
      db
        .select({ state: sql<string>`${appEntitlements.state}`, total: count() })
        .from(appEntitlements)
        .groupBy(appEntitlements.state),
      db
        .select({ total: count() })
        .from(enterpriseQuotationRequests)
        .where(ne(enterpriseQuotationRequests.status, "closed")),
      db.select({ total: count() }).from(platformAdministrators).where(isNull(platformAdministrators.revokedAt)),
      db.select({ total: count() }).from(auditEvents)
    ]);

    return {
      ok: true,
      metrics: {
        members: memberRows[0]?.total ?? 0,
        organizations: organizationRows[0]?.total ?? 0,
        projects: projectRows[0]?.total ?? 0,
        entitlementsByState: entitlementRows.map((row) => ({ state: row.state, total: row.total })),
        openQuotationRequests: quotationRows[0]?.total ?? 0,
        activeAdministrators: administratorRows[0]?.total ?? 0,
        auditEventsRecorded: auditRows[0]?.total ?? 0
      }
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/** The most recent platform-level audit events, so a grant or a content change is visible. */
export type RecentAuditEvent = {
  id: string;
  eventType: string;
  resourceType: string;
  resourceId: string;
  createdAt: Date;
};

export async function readRecentPlatformAudit(limit = 8): Promise<RecentAuditEvent[]> {
  try {
    const db = getDb();
    return await db
      .select({
        id: auditEvents.id,
        eventType: auditEvents.eventType,
        resourceType: auditEvents.resourceType,
        resourceId: auditEvents.resourceId,
        createdAt: auditEvents.createdAt
      })
      .from(auditEvents)
      // Platform-level events carry no organization. Anything scoped to one is a customer's work
      // and is not this surface's business, so it is filtered out rather than merely unshown.
      .where(isNull(auditEvents.organizationId))
      .orderBy(sql`${auditEvents.createdAt} desc`)
      .limit(limit);
  } catch {
    return [];
  }
}

/** Kept separate so a caller cannot accidentally widen a count into a read of someone's work. */
export async function readEntitlementStateTotal(state: string): Promise<number> {
  try {
    const db = getDb();
    const rows = await db
      .select({ total: count() })
      .from(appEntitlements)
      .where(eq(sql`${appEntitlements.state}`, state));
    return rows[0]?.total ?? 0;
  } catch {
    return 0;
  }
}
