import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { and, eq, inArray } from "drizzle-orm";
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
 * local database only:
 *   $env:ESTIMETR_DB_TESTS=1 ; pnpm vitest run src/server/estimeter/takeoff-repository.integration.test.ts
 */
const enabled = process.env.ESTIMETR_DB_TESTS === "1";

const item = { category: "structure", description: "คอนกรีตคาน B1", unit: "cu_m", quantity: "1.92" };
const evidence = { note: "แบบ S-05 ตารางคาน ช่วง A-B", pageNumber: 5 };

describe.skipIf(!enabled)("manual take-off against PostgreSQL", () => {
  loadLocalEnv();

  const userIds: string[] = [];
  const organizationIds: string[] = [];

  afterAll(async () => {
    if (!enabled || userIds.length === 0) return;
    const { getDb } = await import("@/db");
    const { auditEvents, organizations, users } = await import("@/db/schema");
    const db = getDb();

    // audit_events has no cascade; organizations cascades projects, runs, items and evidence.
    await db.delete(auditEvents).where(inArray(auditEvents.organizationId, organizationIds));
    await db.delete(organizations).where(inArray(organizations.id, organizationIds));
    await db.delete(users).where(inArray(users.id, userIds));
  });

  async function createProjectFixture() {
    const { getDb } = await import("@/db");
    const { organizations, projects, users } = await import("@/db/schema");
    const suffix = randomUUID();
    const userId = `test_${suffix}`;
    const organizationId = `org_test_${suffix}`;
    const projectId = randomUUID();
    userIds.push(userId);
    organizationIds.push(organizationId);

    const db = getDb();
    await db.insert(users).values({ id: userId, name: "Take-off Tester", email: `${userId}@integration.invalid` });
    await db.insert(organizations).values({ id: organizationId, kind: "personal", name: "Take-off Test Org" });
    await db.insert(projects).values({
      id: projectId,
      organizationId,
      ownerId: userId,
      name: "อาคารทดสอบถอดปริมาณ",
      workType: "building",
      state: "draft"
    });

    return { userId, organizationId, projectId };
  }

  async function openRunWithItem() {
    const { addManualItem, startManualRun } = await import("@/server/estimeter/takeoff-repository");
    const fixture = await createProjectFixture();
    const run = await startManualRun({
      organizationId: fixture.organizationId,
      projectId: fixture.projectId,
      actorId: fixture.userId
    });
    if (!run.ok) throw new Error("expected the run to open");

    const added = await addManualItem({
      organizationId: fixture.organizationId,
      runId: run.value.id,
      actorId: fixture.userId,
      item
    });
    if (!added.ok) throw new Error("expected the item to be added");

    return { ...fixture, runId: run.value.id, itemId: added.value.itemId };
  }

  it("keeps one open manual run per project however many times it is started", async () => {
    const { getOpenManualRun, listManualRuns, startManualRun } = await import(
      "@/server/estimeter/takeoff-repository"
    );
    const fixture = await createProjectFixture();
    const input = {
      organizationId: fixture.organizationId,
      projectId: fixture.projectId,
      actorId: fixture.userId
    };

    const first = await startManualRun(input);
    const second = await startManualRun(input);
    if (!first.ok || !second.ok) throw new Error("expected both calls to succeed");

    expect(second.value.id).toBe(first.value.id);
    expect(await listManualRuns(fixture.organizationId, fixture.projectId)).toHaveLength(1);
    expect((await getOpenManualRun(fixture.organizationId, fixture.projectId))?.state).toBe("running");
  });

  it("refuses to confirm a quantity that has no evidence, and accepts it once evidence exists", async () => {
    const { addItemEvidence, confirmManualItem, listRunItems } = await import(
      "@/server/estimeter/takeoff-repository"
    );
    const fixture = await openRunWithItem();

    const tooEarly = await confirmManualItem({
      organizationId: fixture.organizationId,
      itemId: fixture.itemId,
      actorId: fixture.userId
    });
    expect(tooEarly).toEqual({ ok: false, reason: "evidence_required" });

    const recorded = await addItemEvidence({
      organizationId: fixture.organizationId,
      itemId: fixture.itemId,
      actorId: fixture.userId,
      evidence
    });
    expect(recorded.ok).toBe(true);

    const confirmed = await confirmManualItem({
      organizationId: fixture.organizationId,
      itemId: fixture.itemId,
      actorId: fixture.userId
    });
    expect(confirmed.ok).toBe(true);

    const items = await listRunItems(fixture.organizationId, fixture.runId);
    expect(items[0]?.reviewState).toBe("confirmed");
    // numeric(18,6) comes back with its full scale; the value must not have been rounded.
    expect(items[0]?.quantity).toBe("1.920000");
  });

  it("locks a confirmed line against evidence changes and deletion", async () => {
    const { addItemEvidence, confirmManualItem, removeManualItem } = await import(
      "@/server/estimeter/takeoff-repository"
    );
    const fixture = await openRunWithItem();
    const scope = { organizationId: fixture.organizationId, itemId: fixture.itemId, actorId: fixture.userId };

    await addItemEvidence({ ...scope, evidence });
    await confirmManualItem(scope);

    expect(await addItemEvidence({ ...scope, evidence })).toEqual({ ok: false, reason: "item_locked" });
    expect(await removeManualItem(scope)).toEqual({ ok: false, reason: "item_locked" });
    expect(await confirmManualItem(scope)).toEqual({ ok: false, reason: "already_confirmed" });
  });

  /**
   * Two confirmations that merely start together can be serialized by chance, so this test
   * holds the item lock open, confirms inside the holding transaction, and requires the second
   * confirmation to observe that. Removing the row lock makes it confirm twice and write two
   * audit events for one quantity.
   */
  it("makes a second confirmation wait for the item lock instead of reading a stale state", async () => {
    const { addItemEvidence, confirmManualItem } = await import("@/server/estimeter/takeoff-repository");
    const { getDb } = await import("@/db");
    const { auditEvents, takeoffItems } = await import("@/db/schema");
    const fixture = await openRunWithItem();
    const scope = { organizationId: fixture.organizationId, itemId: fixture.itemId, actorId: fixture.userId };
    await addItemEvidence({ ...scope, evidence });

    let lockAcquired: () => void;
    let releaseHolder: () => void;
    const acquired = new Promise<void>((resolve) => (lockAcquired = resolve));
    const released = new Promise<void>((resolve) => (releaseHolder = resolve));

    const holder = getDb().transaction(async (tx) => {
      await tx
        .select({ id: takeoffItems.id })
        .from(takeoffItems)
        .where(eq(takeoffItems.id, fixture.itemId))
        .for("update");
      lockAcquired();
      await released;
      await tx.update(takeoffItems).set({ reviewState: "confirmed" }).where(eq(takeoffItems.id, fixture.itemId));
    });

    await acquired;
    const contender = confirmManualItem(scope);
    const early = await Promise.race([
      contender.then(() => "finished"),
      new Promise((resolve) => setTimeout(() => resolve("still waiting"), 300))
    ]);
    expect(early).toBe("still waiting");

    releaseHolder!();
    await holder;

    expect(await contender).toEqual({ ok: false, reason: "already_confirmed" });
    const audits = await getDb()
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.organizationId, fixture.organizationId),
          eq(auditEvents.eventType, "takeoff.item_confirmed")
        )
      );
    expect(audits).toHaveLength(0);
  });

  it("hides another organization's run and items instead of reporting them", async () => {
    const { addManualItem, confirmManualItem, listRunItems, removeManualItem } = await import(
      "@/server/estimeter/takeoff-repository"
    );
    const owner = await openRunWithItem();
    const outsider = await createProjectFixture();
    const asOutsider = { organizationId: outsider.organizationId, actorId: outsider.userId };

    expect(await listRunItems(outsider.organizationId, owner.runId)).toEqual([]);
    expect(await addManualItem({ ...asOutsider, runId: owner.runId, item })).toEqual({
      ok: false,
      reason: "run_not_found"
    });
    expect(await confirmManualItem({ ...asOutsider, itemId: owner.itemId })).toEqual({
      ok: false,
      reason: "item_not_found"
    });
    expect(await removeManualItem({ ...asOutsider, itemId: owner.itemId })).toEqual({
      ok: false,
      reason: "item_not_found"
    });
  });

  it("closes a run with a fingerprint of the confirmed lines only", async () => {
    const { addItemEvidence, addManualItem, closeManualRun, confirmManualItem, getOpenManualRun } = await import(
      "@/server/estimeter/takeoff-repository"
    );
    const { getDb } = await import("@/db");
    const { auditEvents } = await import("@/db/schema");
    const fixture = await openRunWithItem();
    const scope = { organizationId: fixture.organizationId, actorId: fixture.userId };

    const tooEarly = await closeManualRun({ ...scope, runId: fixture.runId });
    expect(tooEarly).toEqual({ ok: false, reason: "no_confirmed_items" });

    await addItemEvidence({ ...scope, itemId: fixture.itemId, evidence });
    await confirmManualItem({ ...scope, itemId: fixture.itemId });
    // A second, unconfirmed line must not enter the fingerprint.
    await addManualItem({ ...scope, runId: fixture.runId, item: { ...item, description: "คาน B2 ยังไม่ยืนยัน" } });

    const closed = await closeManualRun({ ...scope, runId: fixture.runId });
    if (!closed.ok) throw new Error("expected the run to close");

    expect(closed.value.confirmedCount).toBe(1);
    expect(closed.value.unconfirmedCount).toBe(1);
    expect(closed.value.outputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(await getOpenManualRun(fixture.organizationId, fixture.projectId)).toBeNull();

    const audits = await getDb()
      .select({ eventType: auditEvents.eventType })
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, fixture.organizationId));
    expect(audits.map((row) => row.eventType).sort()).toEqual([
      "takeoff.evidence_added",
      "takeoff.item_added",
      "takeoff.item_added",
      "takeoff.item_confirmed",
      "takeoff.run_closed",
      "takeoff.run_started"
    ]);
  });

  it("refuses every write once the project is locked", async () => {
    const { addItemEvidence, addManualItem, closeManualRun, confirmManualItem, startManualRun } = await import(
      "@/server/estimeter/takeoff-repository"
    );
    const { getDb } = await import("@/db");
    const { projects } = await import("@/db/schema");
    const fixture = await openRunWithItem();

    await getDb().update(projects).set({ state: "locked" }).where(eq(projects.id, fixture.projectId));
    const scope = { organizationId: fixture.organizationId, actorId: fixture.userId };

    expect(await addManualItem({ ...scope, runId: fixture.runId, item })).toEqual({
      ok: false,
      reason: "project_not_writable"
    });
    expect(await addItemEvidence({ ...scope, itemId: fixture.itemId, evidence })).toEqual({
      ok: false,
      reason: "project_not_writable"
    });
    expect(await confirmManualItem({ ...scope, itemId: fixture.itemId })).toEqual({
      ok: false,
      reason: "project_not_writable"
    });
    expect(await closeManualRun({ ...scope, runId: fixture.runId })).toEqual({
      ok: false,
      reason: "project_not_writable"
    });
    expect(await startManualRun({ ...scope, projectId: fixture.projectId })).toEqual({
      ok: false,
      reason: "project_not_writable"
    });
  });

  it("records the measured value in the audit trail when a quantity is confirmed", async () => {
    const { addItemEvidence, confirmManualItem } = await import("@/server/estimeter/takeoff-repository");
    const { getDb } = await import("@/db");
    const { auditEvents } = await import("@/db/schema");
    const fixture = await openRunWithItem();
    const scope = { organizationId: fixture.organizationId, itemId: fixture.itemId, actorId: fixture.userId };

    await addItemEvidence({ ...scope, evidence });
    await confirmManualItem(scope);

    const rows = await getDb()
      .select({ metadata: auditEvents.metadata, actorId: auditEvents.actorId })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.organizationId, fixture.organizationId),
          eq(auditEvents.eventType, "takeoff.item_confirmed")
        )
      );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.actorId).toBe(fixture.userId);
    expect(rows[0]?.metadata).toMatchObject({ unit: "cu_m", quantity: "1.920000", evidenceCount: 1 });
  });
});
