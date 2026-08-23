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

const item = { category: "structure", description: "คอนกรีตคาน B1", unit: "cu_m" };
// 0.20 x 0.40 x 24.00 m of beam is 1.92 cu.m, the figure the earlier tests typed in by hand.
const measurement = {
  label: "B1 คานชั้น 2 ช่วง A-B",
  count: 1,
  dimensions: ["0.20", "0.40", "24.00"],
  conversionFactor: null,
  conversionNote: null
};
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

  /** A measured item: the state every take-off line reaches before evidence is even discussed. */
  async function measuredItem() {
    const { addItemMeasurement } = await import("@/server/estimeter/takeoff-repository");
    const fixture = await openRunWithItem();
    const measured = await addItemMeasurement({
      organizationId: fixture.organizationId,
      itemId: fixture.itemId,
      actorId: fixture.userId,
      measurement
    });
    if (!measured.ok) throw new Error("expected the measurement to be recorded");

    return fixture;
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
    const fixture = await measuredItem();

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
    const fixture = await measuredItem();
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
    const fixture = await measuredItem();
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
    const owner = await measuredItem();
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
    const fixture = await measuredItem();
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
      "takeoff.measurement_added",
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
    const fixture = await measuredItem();

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
    const fixture = await measuredItem();
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
  it("recomputes the item quantity from its measurement lines, in the same transaction", async () => {
    const { addItemMeasurement, listMeasurementsForItems, listRunItems, removeItemMeasurement } = await import(
      "@/server/estimeter/takeoff-repository"
    );
    const fixture = await measuredItem();
    const scope = { organizationId: fixture.organizationId, itemId: fixture.itemId, actorId: fixture.userId };

    const second = await addItemMeasurement({
      ...scope,
      measurement: { ...measurement, label: "B1 ช่วง B-C", dimensions: ["0.20", "0.40", "6.00"] }
    });
    if (!second.ok) throw new Error("expected the second line to be recorded");
    expect(second.value.quantity).toBe("2.4");

    const items = await listRunItems(fixture.organizationId, fixture.runId);
    expect(items[0]?.quantity).toBe("2.400000");
    expect(items[0]?.quantityGross).toBe("2.400000");

    const lines = await listMeasurementsForItems([fixture.itemId]);
    expect(lines.map((line) => line.subtotal)).toEqual(["1.92", "0.48"]);

    const removed = await removeItemMeasurement({
      organizationId: fixture.organizationId,
      measurementId: second.value.measurementId,
      actorId: fixture.userId
    });
    if (!removed.ok) throw new Error("expected the line to be removed");
    expect(removed.value.quantity).toBe("1.92");
  });

  it("applies a material allowance on top of the measured total and keeps both figures", async () => {
    const { listRunItems, setItemWaste } = await import("@/server/estimeter/takeoff-repository");
    const fixture = await measuredItem();

    const applied = await setItemWaste({
      organizationId: fixture.organizationId,
      itemId: fixture.itemId,
      actorId: fixture.userId,
      percent: "3",
      sourceNote: "หลักเกณฑ์การเผื่อวัสดุมวลรวม งานคอนกรีต 3%"
    });
    if (!applied.ok) throw new Error("expected the allowance to be recorded");
    expect(applied.value.quantity).toBe("1.9776");

    const items = await listRunItems(fixture.organizationId, fixture.runId);
    expect(items[0]?.quantityGross).toBe("1.920000");
    expect(items[0]?.quantity).toBe("1.977600");
    expect(items[0]?.wasteSourceNote).toBe("หลักเกณฑ์การเผื่อวัสดุมวลรวม งานคอนกรีต 3%");
  });

  it("refuses to confirm a quantity whose arithmetic was never recorded", async () => {
    const { addItemEvidence, confirmManualItem } = await import("@/server/estimeter/takeoff-repository");
    const fixture = await openRunWithItem();
    const scope = { organizationId: fixture.organizationId, itemId: fixture.itemId, actorId: fixture.userId };

    await addItemEvidence({ ...scope, evidence });

    expect(await confirmManualItem(scope)).toEqual({ ok: false, reason: "measurement_required" });
  });

  it("refuses a line whose dimension count does not match the unit stored on the item", async () => {
    const { addItemMeasurement } = await import("@/server/estimeter/takeoff-repository");
    const fixture = await openRunWithItem();

    const flat = await addItemMeasurement({
      organizationId: fixture.organizationId,
      itemId: fixture.itemId,
      actorId: fixture.userId,
      // The item is measured in cubic metres, so two lengths cannot describe it.
      measurement: { ...measurement, dimensions: ["0.20", "0.40"] }
    });

    expect(flat).toEqual({ ok: false, reason: "measurement_shape_mismatch" });
  });

  it("locks the arithmetic behind a confirmed quantity", async () => {
    const { addItemEvidence, addItemMeasurement, confirmManualItem, setItemWaste } = await import(
      "@/server/estimeter/takeoff-repository"
    );
    const fixture = await measuredItem();
    const scope = { organizationId: fixture.organizationId, itemId: fixture.itemId, actorId: fixture.userId };

    await addItemEvidence({ ...scope, evidence });
    const confirmed = await confirmManualItem(scope);
    expect(confirmed.ok).toBe(true);

    expect(await addItemMeasurement({ ...scope, measurement })).toEqual({ ok: false, reason: "item_locked" });
    expect(await setItemWaste({ ...scope, percent: "7", sourceNote: "เผื่อภายหลัง" })).toEqual({
      ok: false,
      reason: "item_locked"
    });
  });

  it("hides another organization's measurement lines from every write", async () => {
    const { addItemMeasurement, listMeasurementsForItems, removeItemMeasurement, setItemWaste } = await import(
      "@/server/estimeter/takeoff-repository"
    );
    const owner = await measuredItem();
    const stranger = await createProjectFixture();
    const lines = await listMeasurementsForItems([owner.itemId]);
    const lineId = lines[0]!.id;

    expect(
      await addItemMeasurement({
        organizationId: stranger.organizationId,
        itemId: owner.itemId,
        actorId: stranger.userId,
        measurement
      })
    ).toEqual({ ok: false, reason: "item_not_found" });

    expect(
      await removeItemMeasurement({
        organizationId: stranger.organizationId,
        measurementId: lineId,
        actorId: stranger.userId
      })
    ).toEqual({ ok: false, reason: "item_not_found" });

    expect(
      await setItemWaste({
        organizationId: stranger.organizationId,
        itemId: owner.itemId,
        actorId: stranger.userId,
        percent: "50",
        sourceNote: "ไม่ควรเขียนได้"
      })
    ).toEqual({ ok: false, reason: "item_not_found" });
  });
  /**
   * Drizzle wraps a failed query, so the constraint name lives on the driver error underneath.
   * Naming it explicitly is the point: the test proves which rule fired, not merely that
   * something went wrong.
   */
  async function refusedBy(write: Promise<unknown>): Promise<string> {
    try {
      await write;
    } catch (error) {
      const cause = (error as { cause?: { constraint?: string; message?: string } }).cause;
      return cause?.constraint ?? cause?.message ?? String(error);
    }
    throw new Error("expected the database to refuse this write");
  }

  /**
   * These write straight through Drizzle, deliberately skipping the repository. The parser and
   * the write path already refuse all of this; the point here is that the database refuses it
   * too, so a future caller that forgets the rule cannot store an undefendable figure.
   */
  it("refuses an allowance with no stated source even when the write path is bypassed", async () => {
    const { getDb } = await import("@/db");
    const { takeoffItems } = await import("@/db/schema");
    const fixture = await measuredItem();
    const update = (values: { wastePercent: string; wasteSourceNote: string | null }) =>
      getDb().update(takeoffItems).set(values).where(eq(takeoffItems.id, fixture.itemId));

    expect(await refusedBy(update({ wastePercent: "7", wasteSourceNote: null }))).toBe(
      "takeoff_items_waste_needs_source"
    );
    expect(await refusedBy(update({ wastePercent: "7", wasteSourceNote: "   " }))).toBe(
      "takeoff_items_waste_needs_source"
    );
    expect(await refusedBy(update({ wastePercent: "150", wasteSourceNote: "เผื่อเกินจริง" }))).toBe(
      "takeoff_items_waste_percent_range"
    );
  });

  it("refuses a measurement line that measures nothing even when the write path is bypassed", async () => {
    const { getDb } = await import("@/db");
    const { takeoffMeasurements } = await import("@/db/schema");
    const fixture = await measuredItem();
    const base = { takeoffItemId: fixture.itemId, label: "ผ่านหลังบ้าน", count: 1, dimension1: "1" };
    const insert = (overrides: Record<string, unknown>) =>
      getDb()
        .insert(takeoffMeasurements)
        .values({ ...base, id: randomUUID(), ...overrides });

    expect(await refusedBy(insert({ count: 0 }))).toBe("takeoff_measurements_count_positive");
    expect(await refusedBy(insert({ dimension1: "0" }))).toBe("takeoff_measurements_dimensions_positive");
    // A conversion factor with no provenance is an unexplained number inside the arithmetic.
    expect(await refusedBy(insert({ conversionFactor: "0.888" }))).toBe(
      "takeoff_measurements_conversion_needs_source"
    );
  });
  it("numbers headings from their position and renumbers when one is removed", async () => {
    const { addRunGroup, listRunGroups, removeRunGroup } = await import("@/server/estimeter/takeoff-repository");
    const { buildOutline, outlineNumber } = await import("@/lib/takeoff-outline");
    const fixture = await measuredItem();
    const scope = { organizationId: fixture.organizationId, runId: fixture.runId, actorId: fixture.userId };

    const section = await addRunGroup({ ...scope, title: "งานส่วนที่ 1", parentId: null });
    if (!section.ok) throw new Error("expected the section to be added");

    const added = [];
    for (const title of ["งานดินขุด-ดินถม", "งานโครงสร้าง คอนกรีตเสริมเหล็ก", "งานโครงหลังคา"]) {
      const group = await addRunGroup({ ...scope, title, parentId: section.value.groupId });
      if (!group.ok) throw new Error(`expected ${title} to be added`);
      added.push(group.value.groupId);
    }

    const before = buildOutline(await listRunGroups(fixture.organizationId, fixture.runId));
    expect(before.map((node) => `${node.number} ${node.title}`)).toEqual([
      "1 งานส่วนที่ 1",
      "1.1 งานดินขุด-ดินถม",
      "1.2 งานโครงสร้าง คอนกรีตเสริมเหล็ก",
      "1.3 งานโครงหลังคา"
    ]);

    const removed = await removeRunGroup({
      organizationId: fixture.organizationId,
      groupId: added[1]!,
      actorId: fixture.userId
    });
    expect(removed.ok).toBe(true);

    const after = buildOutline(await listRunGroups(fixture.organizationId, fixture.runId));
    expect(outlineNumber(after, added[2]!)).toBe("1.2");
  });

  it("refuses a third level, because the sheet has no column for 1.1.1", async () => {
    const { addRunGroup } = await import("@/server/estimeter/takeoff-repository");
    const fixture = await measuredItem();
    const scope = { organizationId: fixture.organizationId, runId: fixture.runId, actorId: fixture.userId };

    const section = await addRunGroup({ ...scope, title: "งานส่วนที่ 1", parentId: null });
    if (!section.ok) throw new Error("expected the section to be added");
    const child = await addRunGroup({ ...scope, title: "งานโครงสร้าง", parentId: section.value.groupId });
    if (!child.ok) throw new Error("expected the child to be added");

    expect(await addRunGroup({ ...scope, title: "ลึกเกินไป", parentId: child.value.groupId })).toEqual({
      ok: false,
      reason: "group_depth_exceeded"
    });
  });

  it("keeps the lines when their heading is removed, rather than taking them with it", async () => {
    const { addRunGroup, assignItemGroup, listRunItems, removeRunGroup } = await import(
      "@/server/estimeter/takeoff-repository"
    );
    const fixture = await measuredItem();
    const group = await addRunGroup({
      organizationId: fixture.organizationId,
      runId: fixture.runId,
      actorId: fixture.userId,
      title: "งานโครงสร้าง",
      parentId: null
    });
    if (!group.ok) throw new Error("expected the group to be added");

    const filed = await assignItemGroup({
      organizationId: fixture.organizationId,
      itemId: fixture.itemId,
      groupId: group.value.groupId,
      actorId: fixture.userId
    });
    expect(filed.ok).toBe(true);
    expect((await listRunItems(fixture.organizationId, fixture.runId))[0]?.groupId).toBe(group.value.groupId);

    await removeRunGroup({
      organizationId: fixture.organizationId,
      groupId: group.value.groupId,
      actorId: fixture.userId
    });

    const survivors = await listRunItems(fixture.organizationId, fixture.runId);
    expect(survivors).toHaveLength(1);
    expect(survivors[0]?.groupId).toBeNull();
    expect(survivors[0]?.quantity).toBe("1.920000");
  });

  it("hides another organization's headings from every write", async () => {
    const { addRunGroup, assignItemGroup, listRunGroups, removeRunGroup } = await import(
      "@/server/estimeter/takeoff-repository"
    );
    const owner = await measuredItem();
    const stranger = await createProjectFixture();
    const group = await addRunGroup({
      organizationId: owner.organizationId,
      runId: owner.runId,
      actorId: owner.userId,
      title: "งานโครงสร้าง",
      parentId: null
    });
    if (!group.ok) throw new Error("expected the group to be added");

    expect(
      await addRunGroup({
        organizationId: stranger.organizationId,
        runId: owner.runId,
        actorId: stranger.userId,
        title: "แทรกข้ามองค์กร",
        parentId: null
      })
    ).toEqual({ ok: false, reason: "run_not_found" });

    expect(
      await removeRunGroup({
        organizationId: stranger.organizationId,
        groupId: group.value.groupId,
        actorId: stranger.userId
      })
    ).toEqual({ ok: false, reason: "group_not_found" });

    expect(
      await assignItemGroup({
        organizationId: stranger.organizationId,
        itemId: owner.itemId,
        groupId: group.value.groupId,
        actorId: stranger.userId
      })
    ).toEqual({ ok: false, reason: "item_not_found" });

    expect(await listRunGroups(stranger.organizationId, owner.runId)).toEqual([]);
  });
});
