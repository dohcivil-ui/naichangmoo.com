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

describe.skipIf(!enabled)("ESTIMETR trial activation against PostgreSQL", () => {
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

  async function createMember(createdAt = new Date("2026-08-01T00:00:00.000Z")) {
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

  it("reports a member who has not activated as not_activated and writes nothing while reading", async () => {
    const { getEstimeterAccess } = await import("@/server/estimeter-access");
    const { getDb } = await import("@/db");
    const { appEntitlements, auditEvents, organizationMembers } = await import("@/db/schema");
    const userId = await createMember();
    const db = getDb();
    const organizationId = `org_personal_${userId}`;

    const access = await getEstimeterAccess(userId, new Date("2026-08-24T00:00:00.000Z"));

    expect(access.state).toBe("not_activated");
    expect(access.organizationId).toBeNull();
    expect(access.endsAtIso).toBeNull();
    expect(access.daysRemaining).toBeNull();
    expect(access.projectLimit).toBe(0);
    expect(access.capabilities).toEqual({
      read: true,
      create_project: false,
      edit: false,
      run_ai: false,
      export: false,
      print: false
    });

    // Reading twice must not create an organization, a membership, an entitlement or an event.
    await getEstimeterAccess(userId, new Date("2026-08-24T00:00:00.000Z"));
    expect(await db.select().from(appEntitlements).where(eq(appEntitlements.organizationId, organizationId))).toHaveLength(0);
    expect(await db.select().from(organizationMembers).where(eq(organizationMembers.userId, userId))).toHaveLength(0);
    expect(await db.select().from(auditEvents).where(eq(auditEvents.organizationId, organizationId))).toHaveLength(0);
  });

  it("starts the seven days at the moment of activation, not at registration", async () => {
    const { activateEstimeterTrial, getEstimeterAccess } = await import("@/server/estimeter-access");
    const { getDb } = await import("@/db");
    const { appEntitlements, auditEvents } = await import("@/db/schema");
    // Registered on 1 August, activates on 20 August: the old rule would have expired on the 8th.
    const userId = await createMember(new Date("2026-08-01T00:00:00.000Z"));
    const activatedAt = new Date("2026-08-20T10:00:00.000Z");

    const activation = await activateEstimeterTrial(userId, activatedAt);
    if (!activation.ok) throw new Error(`expected activation to succeed, got ${activation.reason}`);

    expect(activation.startsAt.toISOString()).toBe("2026-08-20T10:00:00.000Z");
    expect(activation.endsAt.toISOString()).toBe("2026-08-27T10:00:00.000Z");

    const access = await getEstimeterAccess(userId, new Date("2026-08-21T10:00:00.000Z"));
    expect(access.state).toBe("trial");
    expect(access.daysRemaining).toBe(6);
    expect(access.projectLimit).toBe(1);
    expect(access.capabilities.create_project).toBe(true);
    expect(access.capabilities.export).toBe(false);

    const db = getDb();
    const organizationId = `org_personal_${userId}`;
    const rows = await db.select().from(appEntitlements).where(eq(appEntitlements.organizationId, organizationId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.startsAt.toISOString()).toBe("2026-08-20T10:00:00.000Z");

    const audits = await db.select().from(auditEvents).where(eq(auditEvents.organizationId, organizationId));
    expect(audits).toHaveLength(1);
    expect(audits[0]?.eventType).toBe("entitlement.trial_activated");
    expect(audits[0]?.actorId).toBe(userId);
    expect(audits[0]?.metadata).toMatchObject({ startedBy: "explicit_activation", trialDays: 5, projectLimit: 1 });
  });

  it("refuses a second activation instead of extending the window", async () => {
    const { activateEstimeterTrial, getEstimeterAccess } = await import("@/server/estimeter-access");
    const { getDb } = await import("@/db");
    const { appEntitlements } = await import("@/db/schema");
    const userId = await createMember();

    const first = await activateEstimeterTrial(userId, new Date("2026-08-20T00:00:00.000Z"));
    const second = await activateEstimeterTrial(userId, new Date("2026-08-23T00:00:00.000Z"));

    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, reason: "already_activated" });

    const rows = await getDb()
      .select()
      .from(appEntitlements)
      .where(eq(appEntitlements.organizationId, `org_personal_${userId}`));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.endsAt?.toISOString()).toBe("2026-08-25T00:00:00.000Z");

    // The expiry still counts from the first activation, so pressing again bought nothing.
    const access = await getEstimeterAccess(userId, new Date("2026-08-26T00:00:00.000Z"));
    expect(access.state).toBe("expired_read_only");
  });

  it("issues one entitlement when two activations race", async () => {
    const { activateEstimeterTrial } = await import("@/server/estimeter-access");
    const { getDb } = await import("@/db");
    const { appEntitlements } = await import("@/db/schema");
    const userId = await createMember();
    const now = new Date("2026-08-20T00:00:00.000Z");

    const results = await Promise.all([
      activateEstimeterTrial(userId, now),
      activateEstimeterTrial(userId, now)
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const rows = await getDb()
      .select()
      .from(appEntitlements)
      .where(eq(appEntitlements.organizationId, `org_personal_${userId}`));
    expect(rows).toHaveLength(1);
  });

  it("keeps read access to earlier work when the trial has expired", async () => {
    const { activateEstimeterTrial, getEstimeterAccess } = await import("@/server/estimeter-access");
    const userId = await createMember();

    await activateEstimeterTrial(userId, new Date("2026-08-01T00:00:00.000Z"));
    const access = await getEstimeterAccess(userId, new Date("2026-08-23T00:00:00.000Z"));

    expect(access.state).toBe("expired_read_only");
    expect(access.daysRemaining).toBe(0);
    expect(access.capabilities.read).toBe(true);
    expect(access.capabilities.edit).toBe(false);
    expect(access.capabilities.create_project).toBe(false);
    expect(access.capabilities.run_ai).toBe(false);
  });

  it("still reports the organization when an entitlement row is removed", async () => {
    // Dev resets delete entitlement rows. The member keeps their organization and their work,
    // and lands back on not_activated instead of losing sight of what they already own.
    const { activateEstimeterTrial, getEstimeterAccess } = await import("@/server/estimeter-access");
    const { getDb } = await import("@/db");
    const { appEntitlements } = await import("@/db/schema");
    const userId = await createMember();
    const organizationId = `org_personal_${userId}`;

    await activateEstimeterTrial(userId, new Date("2026-08-20T00:00:00.000Z"));
    await getDb().delete(appEntitlements).where(eq(appEntitlements.organizationId, organizationId));

    const access = await getEstimeterAccess(userId, new Date("2026-08-21T00:00:00.000Z"));
    expect(access.state).toBe("not_activated");
    expect(access.organizationId).toBe(organizationId);
    expect(access.capabilities.read).toBe(true);
    expect(access.capabilities.create_project).toBe(false);
  });

  it("refuses to activate for an unknown member", async () => {
    const { activateEstimeterTrial } = await import("@/server/estimeter-access");

    expect(await activateEstimeterTrial(`missing_${randomUUID()}`)).toEqual({
      ok: false,
      reason: "unknown_member"
    });
  });
});
