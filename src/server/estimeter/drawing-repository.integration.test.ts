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
 *   $env:ESTIMETR_DB_TESTS=1 ; pnpm vitest run src/server/estimeter/drawing-repository.integration.test.ts
 */
const enabled = process.env.ESTIMETR_DB_TESTS === "1";

const CHECKSUM_A = "a".repeat(64);
const CHECKSUM_B = "b".repeat(64);

const reference = {
  version: 1 as const,
  a: { x: 100, y: 400 },
  b: { x: 500, y: 400 },
  realDistance: 5,
  unit: "m" as const
};

// 400 points of paper standing for 5.00 m is 1:125, the ratio the drawing itself states.
const METRES_PER_POINT = 5 / 400;

const gridLines = [
  { id: "g1", page: 7, a: { x: 100, y: 100 }, b: { x: 100, y: 700 } },
  { id: "g2", page: 7, a: { x: 100, y: 400 }, b: { x: 900, y: 400 }, label: "ก" }
];

const statedDimensions = [{ id: "d1", page: 7, a: { x: 100, y: 400 }, b: { x: 500, y: 400 }, valueM: 5 }];

describe.skipIf(!enabled)("drawing calibration against PostgreSQL", () => {
  loadLocalEnv();

  const userIds: string[] = [];
  const organizationIds: string[] = [];

  afterAll(async () => {
    if (!enabled || userIds.length === 0) return;
    const { getDb } = await import("@/db");
    const { auditEvents, organizations, users } = await import("@/db/schema");
    const db = getDb();

    // audit_events has no cascade; organizations cascades projects, drawing documents, and from
    // there the calibrations and the view states.
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
    await db.insert(users).values({ id: userId, name: "Drawing Tester", email: `${userId}@integration.invalid` });
    await db.insert(organizations).values({ id: organizationId, kind: "personal", name: "Drawing Test Org" });
    await db.insert(projects).values({
      id: projectId,
      organizationId,
      ownerId: userId,
      name: "อาคารทดสอบงานวัดจากแบบ",
      workType: "building",
      state: "draft"
    });

    return { userId, organizationId, projectId };
  }

  async function registeredDocument() {
    const { registerDrawingDocument } = await import("@/server/estimeter/drawing-repository");
    const fixture = await createProjectFixture();
    const registered = await registerDrawingDocument({
      organizationId: fixture.organizationId,
      projectId: fixture.projectId,
      actorId: fixture.userId,
      checksum: CHECKSUM_A,
      mimeType: "application/pdf",
      byteSize: 1_048_576,
      pageCount: 12
    });
    if (!registered.ok) throw new Error("expected the document to register");
    return { ...fixture, documentId: registered.value.documentId };
  }

  async function refusedBy(write: Promise<unknown>): Promise<string> {
    try {
      await write;
    } catch (error) {
      const cause = (error as { cause?: { constraint?: string; message?: string } }).cause;
      return cause?.constraint ?? cause?.message ?? String(error);
    }
    throw new Error("expected the database to refuse this write");
  }

  it("gives the same drawing the same identity on every reopen, and audits only the first", async () => {
    const { registerDrawingDocument } = await import("@/server/estimeter/drawing-repository");
    const { getDb } = await import("@/db");
    const { auditEvents } = await import("@/db/schema");
    const fixture = await createProjectFixture();
    const input = {
      organizationId: fixture.organizationId,
      projectId: fixture.projectId,
      actorId: fixture.userId,
      checksum: CHECKSUM_A,
      mimeType: "application/pdf",
      byteSize: 2048,
      pageCount: 12
    };

    const first = await registerDrawingDocument(input);
    const second = await registerDrawingDocument(input);
    if (!first.ok || !second.ok) throw new Error("expected both registrations to succeed");
    expect(first.value.created).toBe(true);
    expect(second.value.created).toBe(false);
    expect(second.value.documentId).toBe(first.value.documentId);

    const audits = await getDb()
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.organizationId, fixture.organizationId),
          eq(auditEvents.eventType, "drawing.document_registered")
        )
      );
    expect(audits).toHaveLength(1);
  });

  it("treats a different checksum as a different drawing", async () => {
    const { registerDrawingDocument } = await import("@/server/estimeter/drawing-repository");
    const fixture = await createProjectFixture();
    const base = {
      organizationId: fixture.organizationId,
      projectId: fixture.projectId,
      actorId: fixture.userId,
      mimeType: "application/pdf",
      byteSize: 2048,
      pageCount: 12
    };

    const first = await registerDrawingDocument({ ...base, checksum: CHECKSUM_A });
    const second = await registerDrawingDocument({ ...base, checksum: CHECKSUM_B });
    if (!first.ok || !second.ok) throw new Error("expected both registrations to succeed");
    expect(second.value.documentId).not.toBe(first.value.documentId);
    expect(second.value.created).toBe(true);
  });

  it("hides another organization's project instead of registering into it", async () => {
    const { registerDrawingDocument } = await import("@/server/estimeter/drawing-repository");
    const owner = await createProjectFixture();
    const outsider = await createProjectFixture();

    const attempt = await registerDrawingDocument({
      organizationId: outsider.organizationId,
      projectId: owner.projectId,
      actorId: outsider.userId,
      checksum: CHECKSUM_A,
      mimeType: "application/pdf",
      byteSize: 2048,
      pageCount: 12
    });
    expect(attempt).toEqual({ ok: false, reason: "project_not_found" });
  });

  it("keeps one row per page and records who confirmed the scale that stands", async () => {
    const { saveCalibration } = await import("@/server/estimeter/drawing-repository");
    const { getDb } = await import("@/db");
    const { auditEvents, drawingCalibrations, users } = await import("@/db/schema");
    const fixture = await registeredDocument();

    const second = `test_${randomUUID()}`;
    userIds.push(second);
    await getDb()
      .insert(users)
      .values({ id: second, name: "ผู้ตรวจคนที่สอง", email: `${second}@integration.invalid` });

    const base = {
      organizationId: fixture.organizationId,
      documentId: fixture.documentId,
      pageNumber: 7,
      metresPerPoint: METRES_PER_POINT,
      method: "stated_dimension",
      reference,
      grid: gridLines,
      dimensions: statedDimensions
    };

    const inserted = await saveCalibration({ ...base, actorId: fixture.userId });
    const updated = await saveCalibration({ ...base, actorId: second, metresPerPoint: METRES_PER_POINT * 2 });
    if (!inserted.ok || !updated.ok) throw new Error("expected both saves to succeed");
    expect(updated.value.calibrationId).toBe(inserted.value.calibrationId);

    const rows = await getDb()
      .select({ confirmedBy: drawingCalibrations.confirmedBy, metresPerPoint: drawingCalibrations.metresPerPoint })
      .from(drawingCalibrations)
      .where(eq(drawingCalibrations.documentId, fixture.documentId));
    expect(rows).toHaveLength(1);
    expect(rows[0].confirmedBy).toBe(second);
    expect(Number(rows[0].metresPerPoint)).toBeCloseTo(METRES_PER_POINT * 2, 12);

    const audits = await getDb()
      .select({ metadata: auditEvents.metadata })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.organizationId, fixture.organizationId),
          eq(auditEvents.eventType, "drawing.calibration_saved")
        )
      );
    expect(audits).toHaveLength(2);
    const replaced = audits.map((row) => (row.metadata as { replaced?: boolean }).replaced);
    expect(replaced.sort()).toEqual([false, true]);
  });

  it("ล้างสเกลไม่ได้ตราบใดที่หน้ายังมีแนวเสาหรือระยะที่แบบเขียนอยู่ (IP-235)", async () => {
    const { clearCalibration, saveCalibration } = await import("@/server/estimeter/drawing-repository");
    const { getDb } = await import("@/db");
    const { auditEvents, drawingCalibrations } = await import("@/db/schema");
    const fixture = await registeredDocument();

    const base = {
      organizationId: fixture.organizationId,
      documentId: fixture.documentId,
      actorId: fixture.userId,
      pageNumber: 7,
      metresPerPoint: METRES_PER_POINT,
      method: "stated_dimension",
      reference
    };

    // แนวเสากับระยะที่แบบเขียนเก็บเป็น jsonb บนแถวนี้ ล้างสเกลตอนนี้จึงเท่ากับลบงานของผู้ใช้
    const withLines = await saveCalibration({ ...base, grid: gridLines, dimensions: statedDimensions });
    if (!withLines.ok) throw new Error("expected the first save to succeed");
    expect(await clearCalibration({ ...base })).toEqual({ ok: false, reason: "page_has_reference_lines" });
    expect(
      await getDb().select({ id: drawingCalibrations.id }).from(drawingCalibrations).where(eq(drawingCalibrations.documentId, fixture.documentId))
    ).toHaveLength(1);

    // ระยะที่แบบเขียนอย่างเดียวก็ยังกั้น ไม่ใช่กั้นเฉพาะตอนมีครบสองอย่าง
    await saveCalibration({ ...base, grid: [], dimensions: statedDimensions });
    expect(await clearCalibration({ ...base })).toEqual({ ok: false, reason: "page_has_reference_lines" });

    // ลบเส้นจนหมดแล้วจึงล้างได้ และแถวหายไปจริง
    await saveCalibration({ ...base, grid: [], dimensions: [] });
    expect(await clearCalibration({ ...base })).toEqual({ ok: true, value: { cleared: true } });
    expect(
      await getDb().select({ id: drawingCalibrations.id }).from(drawingCalibrations).where(eq(drawingCalibrations.documentId, fixture.documentId))
    ).toHaveLength(0);

    // การเอาสเกลออกต้องตรวจย้อนได้เหมือนตอนตั้ง ไม่ใช่การล้างค่าเงียบ ๆ
    const audits = await getDb()
      .select({ metadata: auditEvents.metadata })
      .from(auditEvents)
      .where(and(eq(auditEvents.organizationId, fixture.organizationId), eq(auditEvents.eventType, "drawing.calibration_cleared")));
    expect(audits).toHaveLength(1);
    expect((audits[0].metadata as { pageNumber?: number }).pageNumber).toBe(7);

    // ล้างซ้ำบนหน้าที่ไม่มีสเกลแล้วไม่ใช่ความผิดพลาด มันคือสภาพที่ผู้เรียกอยากได้อยู่แล้ว
    expect(await clearCalibration({ ...base })).toEqual({ ok: true, value: { cleared: false } });
  });

  it("ล้างสเกลของอีกองค์กรไม่ได้ แม้จะรู้ไอดีของแบบ (IP-235)", async () => {
    const { clearCalibration, saveCalibration } = await import("@/server/estimeter/drawing-repository");
    const owner = await registeredDocument();
    const stranger = await createProjectFixture();
    await saveCalibration({
      organizationId: owner.organizationId,
      documentId: owner.documentId,
      actorId: owner.userId,
      pageNumber: 7,
      metresPerPoint: METRES_PER_POINT,
      method: "stated_dimension",
      reference,
      grid: [],
      dimensions: []
    });

    expect(
      await clearCalibration({
        organizationId: stranger.organizationId,
        documentId: owner.documentId,
        actorId: stranger.userId,
        pageNumber: 7
      })
    ).toEqual({ ok: false, reason: "document_not_found" });
  });

  it("refuses a scale of zero at the repository, and again at the database when bypassed", async () => {
    const { saveCalibration } = await import("@/server/estimeter/drawing-repository");
    const { getDb } = await import("@/db");
    const { drawingCalibrations } = await import("@/db/schema");
    const fixture = await registeredDocument();

    const refused = await saveCalibration({
      organizationId: fixture.organizationId,
      documentId: fixture.documentId,
      actorId: fixture.userId,
      pageNumber: 7,
      metresPerPoint: 0,
      method: "stated_dimension",
      reference,
      grid: [],
      dimensions: []
    });
    expect(refused).toEqual({ ok: false, reason: "invalid_payload" });

    const rows = await getDb()
      .select({ id: drawingCalibrations.id })
      .from(drawingCalibrations)
      .where(eq(drawingCalibrations.documentId, fixture.documentId));
    expect(rows).toHaveLength(0);

    expect(
      await refusedBy(
        getDb()
          .insert(drawingCalibrations)
          .values({
            id: randomUUID(),
            documentId: fixture.documentId,
            pageNumber: 7,
            metresPerPoint: "0",
            method: "stated_dimension",
            referenceGeometry: reference,
            confirmedBy: fixture.userId,
            confirmedAt: new Date()
          })
      )
    ).toBe("drawing_calibrations_metres_per_point_positive");
  });

  it("refuses a method that is not in the registry", async () => {
    const { saveCalibration } = await import("@/server/estimeter/drawing-repository");
    const fixture = await registeredDocument();

    const refused = await saveCalibration({
      organizationId: fixture.organizationId,
      documentId: fixture.documentId,
      actorId: fixture.userId,
      pageNumber: 7,
      metresPerPoint: METRES_PER_POINT,
      method: "guess",
      reference,
      grid: [],
      dimensions: []
    });
    expect(refused).toEqual({ ok: false, reason: "invalid_payload" });
  });

  it("refuses a grid line filed under a page it was not drawn on", async () => {
    const { saveCalibration } = await import("@/server/estimeter/drawing-repository");
    const fixture = await registeredDocument();

    const refused = await saveCalibration({
      organizationId: fixture.organizationId,
      documentId: fixture.documentId,
      actorId: fixture.userId,
      pageNumber: 7,
      metresPerPoint: METRES_PER_POINT,
      method: "stated_dimension",
      reference,
      grid: [{ ...gridLines[0], page: 8 }],
      dimensions: []
    });
    expect(refused).toEqual({ ok: false, reason: "invalid_payload" });
  });

  it("returns the grid and the stated dimensions exactly as they were saved, and nothing at all to an outsider", async () => {
    const { loadDrawingState, saveCalibration } = await import("@/server/estimeter/drawing-repository");
    const fixture = await registeredDocument();
    const outsider = await createProjectFixture();

    await saveCalibration({
      organizationId: fixture.organizationId,
      documentId: fixture.documentId,
      actorId: fixture.userId,
      pageNumber: 7,
      metresPerPoint: METRES_PER_POINT,
      method: "stated_dimension",
      reference,
      grid: gridLines,
      dimensions: statedDimensions
    });

    const state = await loadDrawingState({
      organizationId: fixture.organizationId,
      documentId: fixture.documentId,
      userId: fixture.userId
    });
    expect(state?.calibrations).toHaveLength(1);
    const page = state?.calibrations[0];
    expect(page?.pageNumber).toBe(7);
    expect(page?.method).toBe("stated_dimension");
    expect(page?.metresPerPoint).toBeCloseTo(METRES_PER_POINT, 12);
    expect(page?.reference).toEqual(reference);
    expect(page?.grid).toEqual(gridLines);
    expect(page?.dimensions).toEqual(statedDimensions);
    expect(state?.view).toBeNull();

    const asOutsider = await loadDrawingState({
      organizationId: outsider.organizationId,
      documentId: fixture.documentId,
      userId: outsider.userId
    });
    expect(asOutsider).toBeNull();
  });

  it("keeps one resume point per person and raises no audit event for it", async () => {
    const { loadDrawingState, saveViewState } = await import("@/server/estimeter/drawing-repository");
    const { getDb } = await import("@/db");
    const { auditEvents, drawingViewStates } = await import("@/db/schema");
    const fixture = await registeredDocument();

    const countAudits = async () =>
      (
        await getDb()
          .select({ id: auditEvents.id })
          .from(auditEvents)
          .where(eq(auditEvents.organizationId, fixture.organizationId))
      ).length;

    const before = await countAudits();

    const scope = {
      organizationId: fixture.organizationId,
      userId: fixture.userId,
      documentId: fixture.documentId
    };
    expect(await saveViewState({ ...scope, pageNumber: 3, view: { version: 1, scale: 1, x: 0, y: 0 } })).toEqual({
      ok: true,
      value: undefined
    });
    expect(
      await saveViewState({ ...scope, pageNumber: 7, view: { version: 1, scale: 2.5, x: -120, y: 340 } })
    ).toEqual({ ok: true, value: undefined });

    const rows = await getDb()
      .select({ id: drawingViewStates.id })
      .from(drawingViewStates)
      .where(eq(drawingViewStates.documentId, fixture.documentId));
    expect(rows).toHaveLength(1);

    const state = await loadDrawingState({ ...scope });
    expect(state?.view).toEqual({ pageNumber: 7, view: { version: 1, scale: 2.5, x: -120, y: 340 } });

    expect(await countAudits()).toBe(before);
  });

  /**
   * This writes straight through Drizzle, deliberately skipping the repository. The point is the
   * sentence in the plan: there is no path at all, not even hand-typed SQL, by which a scale
   * reaches the database without the name of the person who stood behind it.
   */
  it("refuses a scale with nobody behind it even when the write path is bypassed", async () => {
    const { getDb } = await import("@/db");
    const { drawingCalibrations } = await import("@/db/schema");
    const fixture = await registeredDocument();

    const message = await refusedBy(
      getDb()
        .insert(drawingCalibrations)
        .values({
          id: randomUUID(),
          documentId: fixture.documentId,
          pageNumber: 7,
          metresPerPoint: String(METRES_PER_POINT),
          method: "stated_dimension",
          referenceGeometry: reference,
          confirmedAt: new Date()
        } as never)
    );
    expect(message).toContain("confirmed_by");
  });

  /**
   * IP-234 — รอยที่วาดไว้ลงฐานแยกจากสเกล และไม่ลง audit
   */
  const marks = [
    {
      id: "m1",
      page: 7,
      kind: "length" as const,
      name: "แนวผนังทิศเหนือ",
      points: [{ x: 100, y: 400 }, { x: 500, y: 400 }],
      colour: "var(--teal)",
      origin: "pointer" as const,
      filed: null,
      layerId: null
    },
    {
      id: "m2",
      page: 7,
      kind: "count" as const,
      name: "",
      points: [{ x: 120, y: 420 }, { x: 140, y: 420 }, { x: 160, y: 420 }],
      colour: "var(--orange)",
      origin: "pointer" as const,
      filed: null,
      layerId: null
    }
  ];

  it("keeps drawn marks per page, replaces them on resave, and raises no audit event", async () => {
    const { loadDrawingState, saveMarks } = await import("@/server/estimeter/drawing-repository");
    const { getDb } = await import("@/db");
    const { auditEvents, drawingMarks } = await import("@/db/schema");
    const fixture = await registeredDocument();
    const scope = { organizationId: fixture.organizationId, documentId: fixture.documentId, actorId: fixture.userId };

    const countAudits = async () =>
      (await getDb().select({ id: auditEvents.id }).from(auditEvents).where(eq(auditEvents.organizationId, fixture.organizationId)))
        .length;
    const before = await countAudits();

    expect(await saveMarks({ ...scope, pageNumber: 7, marks })).toEqual({ ok: true, value: undefined });
    expect(await saveMarks({ ...scope, pageNumber: 7, marks: [marks[0]] })).toEqual({ ok: true, value: undefined });

    const rows = await getDb().select({ id: drawingMarks.id }).from(drawingMarks).where(eq(drawingMarks.documentId, fixture.documentId));
    expect(rows).toHaveLength(1);

    const state = await loadDrawingState({ organizationId: fixture.organizationId, documentId: fixture.documentId, userId: fixture.userId });
    expect(state?.marks[7]).toEqual([marks[0]]);
    expect(await countAudits()).toBe(before);
  });

  it("deletes the page row when the last mark is removed, and refuses marks filed under another page", async () => {
    const { loadDrawingState, saveMarks } = await import("@/server/estimeter/drawing-repository");
    const { getDb } = await import("@/db");
    const { drawingMarks } = await import("@/db/schema");
    const fixture = await registeredDocument();
    const scope = { organizationId: fixture.organizationId, documentId: fixture.documentId, actorId: fixture.userId };

    expect(await saveMarks({ ...scope, pageNumber: 7, marks })).toEqual({ ok: true, value: undefined });
    expect(await saveMarks({ ...scope, pageNumber: 7, marks: [] })).toEqual({ ok: true, value: undefined });
    const rows = await getDb().select({ id: drawingMarks.id }).from(drawingMarks).where(eq(drawingMarks.documentId, fixture.documentId));
    expect(rows).toHaveLength(0);

    const state = await loadDrawingState({ organizationId: fixture.organizationId, documentId: fixture.documentId, userId: fixture.userId });
    expect(state?.marks).toEqual({});

    expect(await saveMarks({ ...scope, pageNumber: 8, marks })).toEqual({ ok: false, reason: "invalid_payload" });
    expect(await saveMarks({ ...scope, pageNumber: 99, marks: marks.map((mark) => ({ ...mark, page: 99 })) })).toEqual({
      ok: false,
      reason: "invalid_payload"
    });
  });

  it("files a stored mark into the take-off and stamps it as filed in the same transaction", async () => {
    const { fileDrawingMark, loadDrawingState, saveCalibration, saveMarks } = await import(
      "@/server/estimeter/drawing-repository"
    );
    const { getDb } = await import("@/db");
    const { takeoffMeasurements } = await import("@/db/schema");
    const fixture = await registeredDocument();
    const scope = { organizationId: fixture.organizationId, documentId: fixture.documentId, actorId: fixture.userId };
    await saveMarks({ ...scope, pageNumber: 7, marks });

    // A length before the page has a scale cannot be filed: there is no number to file.
    expect(
      await fileDrawingMark({ ...scope, pageNumber: 7, markId: "m1", item: { category: "structure", description: "ผนัง", unit: "m" } })
    ).toEqual({ ok: false, reason: "needs_scale" });

    const calibrated = await saveCalibration({
      ...scope,
      pageNumber: 7,
      metresPerPoint: METRES_PER_POINT,
      method: "stated_dimension",
      reference,
      grid: [],
      dimensions: statedDimensions
    });
    if (!calibrated.ok) throw new Error("expected the scale to save");

    expect(
      await fileDrawingMark({ ...scope, pageNumber: 7, markId: "m1", item: { category: "structure", description: "ผนัง", unit: "sq_m" } })
    ).toEqual({ ok: false, reason: "unit_not_allowed" });
    expect(
      await fileDrawingMark({ ...scope, pageNumber: 7, markId: "nope", item: { category: "structure", description: "ผนัง", unit: "m" } })
    ).toEqual({ ok: false, reason: "mark_not_found" });

    const filed = await fileDrawingMark({ ...scope, pageNumber: 7, markId: "m1", item: { category: "structure", description: "ผนัง", unit: "m" } });
    if (!filed.ok) throw new Error(`expected the mark to file: ${filed.reason}`);

    const state = await loadDrawingState({ organizationId: fixture.organizationId, documentId: fixture.documentId, userId: fixture.userId });
    expect(state?.marks[7]?.find((mark) => mark.id === "m1")?.filed).toEqual({
      itemId: filed.value.itemId,
      measurementId: filed.value.measurementId,
      evidenceId: filed.value.evidenceId
    });
    expect(state?.marks[7]?.find((mark) => mark.id === "m2")?.filed).toBeNull();

    // 400 points at 5 m per 400 points is 5.00 m, multiplied by the calibration this test saved.
    const line = await getDb().select().from(takeoffMeasurements).where(eq(takeoffMeasurements.id, filed.value.measurementId));
    expect(Number(line[0]?.dimension1)).toBeCloseTo(5, 5);
    expect(line[0]?.method).toBe("pointer");
    expect(line[0]?.methodContext).toEqual({ version: 1, calibrationId: calibrated.value.calibrationId });

    expect(
      await fileDrawingMark({ ...scope, pageNumber: 7, markId: "m1", item: { category: "structure", description: "ผนัง", unit: "m" } })
    ).toEqual({ ok: false, reason: "mark_already_filed" });

    // A count needs no scale and files under a counting unit.
    const pins = await fileDrawingMark({ ...scope, pageNumber: 7, markId: "m2", item: { category: "electrical", description: "ดวงโคม", unit: "set" } });
    expect(pins.ok).toBe(true);

    // `filed` is the server's word: a page that claims a mark is unfiled, or leaves a filed mark
    // out, changes nothing about the filing. The browser cannot unfile a quantity by editing JSON.
    const forged = marks.map((mark) => ({ ...mark, name: `${mark.name} แก้ชื่อ`, filed: null }));
    expect(await saveMarks({ ...scope, pageNumber: 7, marks: [forged[0]] })).toEqual({ ok: true, value: undefined });
    const after = await loadDrawingState({ organizationId: fixture.organizationId, documentId: fixture.documentId, userId: fixture.userId });
    const m1 = after?.marks[7]?.find((mark) => mark.id === "m1");
    const m2 = after?.marks[7]?.find((mark) => mark.id === "m2");
    expect(m1?.filed?.itemId).toBe(filed.value.itemId);
    expect(m1?.name).toBe("แนวผนังทิศเหนือ แก้ชื่อ");
    expect(m2?.filed).not.toBeNull();
    expect(await saveMarks({ ...scope, pageNumber: 7, marks: [] })).toEqual({ ok: true, value: undefined });
    const emptied = await loadDrawingState({ organizationId: fixture.organizationId, documentId: fixture.documentId, userId: fixture.userId });
    expect(emptied?.marks[7]?.map((mark) => mark.id).sort()).toEqual(["m1", "m2"]);
  });

  it("hides another organization's marks", async () => {
    const { loadDrawingState, saveMarks } = await import("@/server/estimeter/drawing-repository");
    const owner = await registeredDocument();
    const stranger = await createProjectFixture();
    await saveMarks({ organizationId: owner.organizationId, documentId: owner.documentId, actorId: owner.userId, pageNumber: 7, marks });

    expect(
      await saveMarks({ organizationId: stranger.organizationId, documentId: owner.documentId, actorId: stranger.userId, pageNumber: 7, marks })
    ).toEqual({ ok: false, reason: "document_not_found" });
    expect(
      await loadDrawingState({ organizationId: stranger.organizationId, documentId: owner.documentId, userId: stranger.userId })
    ).toBeNull();
  });
});
