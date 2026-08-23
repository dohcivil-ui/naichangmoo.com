import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

/** Minimal .env reader so this file can reach the local database without a runtime dependency. */
function loadLocalEnv() {
  const file = path.join(process.cwd(), ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (process.env[key] !== undefined) continue;
    process.env[key] = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
  }
}

/**
 * Opt-in because it writes to whatever database DATABASE_URL points at. Run it against a
 * local database only:  $env:ESTIMETR_DB_TESTS=1 ; pnpm vitest run src/server/estimeter-access.integration.test.ts
 */
const enabled = process.env.ESTIMETR_DB_TESTS === "1";

describe.skipIf(!enabled)("ESTIMETR entitlement bootstrap against PostgreSQL", () => {
  loadLocalEnv();

  const userIds: string[] = [];

  afterAll(async () => {
    if (!enabled || userIds.length === 0) return;
    const { getDb } = await import("@/db");
    const { auditEvents, organizations, users } = await import("@/db/schema");
    const db = getDb();
    const orgIds = userIds.map((id) => `org_personal_${id}`);

    // audit_events has no cascade to organizations, so it goes first.
    await db.delete(auditEvents).where(inArray(auditEvents.organizationId, orgIds));
    await db.delete(organizations).where(inArray(organizations.id, orgIds));
    await db.delete(users).where(inArray(users.id, userIds));
  });

  async function createMember(createdAt: Date) {
    const { getDb } = await import("@/db");
    const { users } = await import("@/db/schema");
    const id = `test_${randomUUID()}`;
    userIds.push(id);
    await getDb().insert(users).values({
      id,
      name: "Integration Test Member",
      email: `${id}@integration.invalid`,
      createdAt,
      updatedAt: createdAt
    });
    return id;
  }

  it("issues one trial derived from the member record and repeats without duplicating it", async () => {
    const { getEstimeterAccess } = await import("@/server/estimeter-access");
    const { getDb } = await import("@/db");
    const { appEntitlements, auditEvents } = await import("@/db/schema");
    const createdAt = new Date("2026-08-23T09:00:00.000Z");
    const userId = await createMember(createdAt);

    const first = await getEstimeterAccess(userId, new Date("2026-08-24T09:00:00.000Z"));
    expect(first.state).toBe("trial");
    expect(first.daysRemaining).toBe(4);
    expect(first.projectLimit).toBe(1);
    expect(first.projectCount).toBe(0);
    expect(first.capabilities).toEqual({
      read: true,
      create_project: true,
      edit: true,
      run_ai: true,
      export: false,
      print: false
    });

    const second = await getEstimeterAccess(userId, new Date("2026-08-24T09:00:00.000Z"));
    expect(second).toEqual(first);

    const db = getDb();
    const organizationId = `org_personal_${userId}`;
    const entitlements = await db.select().from(appEntitlements).where(eq(appEntitlements.organizationId, organizationId));
    const audits = await db.select().from(auditEvents).where(eq(auditEvents.organizationId, organizationId));
    expect(entitlements).toHaveLength(1);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.eventType).toBe("entitlement.trial_issued");
    expect(entitlements[0]?.endsAt?.toISOString()).toBe("2026-08-28T09:00:00.000Z");
  });

  it("returns read-only capabilities once the five days have passed", async () => {
    const { getEstimeterAccess } = await import("@/server/estimeter-access");
    const userId = await createMember(new Date("2026-08-01T00:00:00.000Z"));

    const access = await getEstimeterAccess(userId, new Date("2026-08-23T00:00:00.000Z"));

    expect(access.state).toBe("expired_read_only");
    expect(access.daysRemaining).toBe(0);
    expect(access.capabilities.read).toBe(true);
    expect(access.capabilities.edit).toBe(false);
    expect(access.capabilities.create_project).toBe(false);
    expect(access.capabilities.run_ai).toBe(false);
  });

  it("survives two concurrent first visits without issuing a second entitlement", async () => {
    const { getEstimeterAccess } = await import("@/server/estimeter-access");
    const { getDb } = await import("@/db");
    const { appEntitlements } = await import("@/db/schema");
    const userId = await createMember(new Date("2026-08-23T00:00:00.000Z"));
    const now = new Date("2026-08-24T00:00:00.000Z");

    const [left, right] = await Promise.all([getEstimeterAccess(userId, now), getEstimeterAccess(userId, now)]);
    expect(left.state).toBe("trial");
    expect(right.state).toBe("trial");

    const rows = await getDb()
      .select()
      .from(appEntitlements)
      .where(eq(appEntitlements.organizationId, `org_personal_${userId}`));
    expect(rows).toHaveLength(1);
  });
});
