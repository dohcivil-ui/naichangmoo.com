import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, drawingCalibrations, drawingDocuments, drawingMarks, drawingViewStates, projects } from "@/db/schema";
import { isCalibrationMethod, type CalibrationMethod } from "@/lib/drawing-calibration-method";
import type { DraftedGridLine } from "@/lib/drawing-grid";
import type { StatedDimension } from "@/lib/drawing-scale";
import {
  parseCalibrationReference,
  parseDimensionsPayload,
  parseGridPayload,
  parseMarksPayload,
  parseViewPayload,
  type CalibrationReference,
  type StoredMark,
  type ViewPayload
} from "@/lib/drawing-state";
import { POINTS_PER_METRE, type PageScale } from "@/lib/drawing-scale";
import { toFiledLine, type FiledLineRejection } from "@/lib/takeoff-from-measurement";
import type { TakeoffItemInput } from "@/lib/takeoff-item";
import { findUnit } from "@/lib/takeoff-units";
import {
  fileMarkIntoTakeoffTx,
  WRITABLE_PROJECT_STATES,
  type FiledMarkIds,
  type WriteRejection as TakeoffWriteRejection
} from "@/server/estimeter/takeoff-repository";

export type DrawingWriteRejection =
  | "project_not_found"
  | "project_not_writable"
  | "document_not_found"
  | "invalid_payload";

export type WriteResult<T = void> = { ok: true; value: T } | { ok: false; reason: DrawingWriteRejection };

/**
 * Filing a mark can fail for a drawing reason, a take-off reason, or a reason of its own; the
 * caller maps every one of them to a sentence, so the union is spelled out rather than widened.
 */
export type FileMarkRejection =
  | DrawingWriteRejection
  | TakeoffWriteRejection
  | FiledLineRejection
  | "mark_not_found"
  | "mark_already_filed"
  | "unit_not_allowed";

export type FileMarkResult = { ok: true; value: FiledMarkIds } | { ok: false; reason: FileMarkRejection };

export type PageCalibrationView = {
  id: string;
  pageNumber: number;
  metresPerPoint: number;
  method: CalibrationMethod;
  reference: CalibrationReference | null;
  grid: DraftedGridLine[];
  dimensions: StatedDimension[];
  confirmedAt: Date;
};

export type DrawingStateView = {
  calibrations: PageCalibrationView[];
  /** รอยที่วาดไว้ แยกตามเลขหน้า — หน้าที่ jsonb อ่านไม่ผ่านเป็น [] ไม่ใช่หายไปจาก key */
  marks: Record<number, StoredMark[]>;
  view: { pageNumber: number; view: ViewPayload } | null;
};

/**
 * drawing_documents, drawing_calibrations and drawing_view_states carry no organization column,
 * so every lookup joins back to projects and filters on the organization. Skipping this join
 * anywhere would expose another organization's drawing work to anyone who knows an id.
 */
type ScopedDocument = { documentId: string; projectId: string; projectState: string; pageCount: number | null };

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Registers the drawing a person just opened, identified by the checksum their browser computed.
 *
 * The bytes are still on their machine — `storage_key` says so in words rather than pretending
 * a file exists. Reopening the same PDF produces the same checksum, which is the whole mechanism
 * by which the scale, the grid and the stated dimensions come back.
 *
 * No file name is stored anywhere. A customer's file name can carry personal data, and the
 * checksum is already the identity of a drawing revision.
 */
export async function registerDrawingDocument(input: {
  organizationId: string;
  projectId: string;
  actorId: string;
  checksum: string;
  mimeType: string;
  byteSize: number;
  pageCount: number | null;
}): Promise<WriteResult<{ documentId: string; created: boolean }>> {
  return getDb().transaction(async (tx) => {
    const locked = await tx
      .select({ id: projects.id, state: projects.state })
      .from(projects)
      .where(and(eq(projects.id, input.projectId), eq(projects.organizationId, input.organizationId)))
      .limit(1)
      .for("update");

    const project = locked[0];
    if (!project) return { ok: false, reason: "project_not_found" };
    if (!WRITABLE_PROJECT_STATES.has(project.state)) return { ok: false, reason: "project_not_writable" };

    const existing = await tx
      .select({ id: drawingDocuments.id })
      .from(drawingDocuments)
      .where(and(eq(drawingDocuments.projectId, input.projectId), eq(drawingDocuments.checksum, input.checksum)))
      .limit(1);

    // Opening the same drawing again changes nothing, so it raises no audit event. An audit
    // trail that records every reopen buries the acts somebody would actually review.
    if (existing[0]) return { ok: true, value: { documentId: existing[0].id, created: false } };

    const documentId = randomUUID();
    await tx.insert(drawingDocuments).values({
      id: documentId,
      projectId: input.projectId,
      storageKey: `unstored:${input.checksum}`,
      checksum: input.checksum,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      pageCount: input.pageCount,
      scanState: "pending"
    });

    await tx.insert(auditEvents).values({
      id: randomUUID(),
      organizationId: input.organizationId,
      actorId: input.actorId,
      eventType: "drawing.document_registered",
      resourceType: "drawing_document",
      resourceId: documentId,
      metadata: {
        projectId: input.projectId,
        checksum: input.checksum,
        byteSize: input.byteSize,
        pageCount: input.pageCount
      }
    });

    return { ok: true, value: { documentId, created: true } };
  });
}

async function loadDocumentScoped(
  executor: Db | Tx,
  organizationId: string,
  documentId: string,
  lock: boolean
): Promise<ScopedDocument | null> {
  const base = executor
    .select({
      documentId: drawingDocuments.id,
      projectId: drawingDocuments.projectId,
      projectState: projects.state,
      pageCount: drawingDocuments.pageCount
    })
    .from(drawingDocuments)
    .innerJoin(projects, eq(projects.id, drawingDocuments.projectId))
    .where(and(eq(drawingDocuments.id, documentId), eq(projects.organizationId, organizationId)))
    .limit(1);

  const rows = lock ? await base.for("update", { of: drawingDocuments }) : await base;
  return rows[0] ?? null;
}

/**
 * Writes the confirmed scale of one page, together with the grid and the stated dimensions
 * drawn on it. Insert the first time, update every time after, keyed by (document, page).
 */
export async function saveCalibration(input: {
  organizationId: string;
  documentId: string;
  actorId: string;
  pageNumber: number;
  metresPerPoint: number;
  method: string;
  reference: CalibrationReference;
  grid: DraftedGridLine[];
  dimensions: StatedDimension[];
}): Promise<WriteResult<{ calibrationId: string }>> {
  if (!isCalibrationMethod(input.method)) return { ok: false, reason: "invalid_payload" };
  if (!Number.isFinite(input.metresPerPoint) || input.metresPerPoint <= 0) {
    return { ok: false, reason: "invalid_payload" };
  }
  if (!Number.isInteger(input.pageNumber) || input.pageNumber < 1) return { ok: false, reason: "invalid_payload" };
  // A line filed under the wrong page would come back on a page it was never drawn on, so it is
  // refused here rather than stored and puzzled over later.
  if (input.grid.some((line) => line.page !== input.pageNumber)) return { ok: false, reason: "invalid_payload" };
  if (input.dimensions.some((item) => item.page !== input.pageNumber)) return { ok: false, reason: "invalid_payload" };

  const method = input.method;

  return getDb().transaction(async (tx) => {
    const scoped = await loadDocumentScoped(tx, input.organizationId, input.documentId, true);
    if (!scoped) return { ok: false, reason: "document_not_found" };
    if (!WRITABLE_PROJECT_STATES.has(scoped.projectState)) return { ok: false, reason: "project_not_writable" };
    if (scoped.pageCount !== null && input.pageNumber > scoped.pageCount) {
      return { ok: false, reason: "invalid_payload" };
    }

    const existing = await tx
      .select({ id: drawingCalibrations.id })
      .from(drawingCalibrations)
      .where(
        and(
          eq(drawingCalibrations.documentId, input.documentId),
          eq(drawingCalibrations.pageNumber, input.pageNumber)
        )
      )
      .limit(1);

    const now = new Date();
    // Nothing drafted is not an empty list, it is the absence of a grid. The column says so with
    // NULL, so a page nobody has gridded reads differently from a page whose lines were deleted.
    const grid = input.grid.length > 0 ? { version: 1, lines: input.grid } : null;
    const dimensions = input.dimensions.length > 0 ? { version: 1, items: input.dimensions } : null;
    // numeric(18,12) takes a string: passing the float would hand rounding to the driver.
    const metresPerPoint = String(input.metresPerPoint);

    const replaced = Boolean(existing[0]);
    let calibrationId: string;

    if (existing[0]) {
      calibrationId = existing[0].id;
      await tx
        .update(drawingCalibrations)
        .set({
          metresPerPoint,
          method,
          referenceGeometry: input.reference,
          grid,
          dimensions,
          confirmedBy: input.actorId,
          confirmedAt: now,
          updatedAt: now
        })
        .where(eq(drawingCalibrations.id, calibrationId));
    } else {
      calibrationId = randomUUID();
      await tx.insert(drawingCalibrations).values({
        id: calibrationId,
        documentId: input.documentId,
        pageNumber: input.pageNumber,
        metresPerPoint,
        method,
        referenceGeometry: input.reference,
        grid,
        dimensions,
        confirmedBy: input.actorId,
        confirmedAt: now
      });
    }

    await tx.insert(auditEvents).values({
      id: randomUUID(),
      organizationId: input.organizationId,
      actorId: input.actorId,
      eventType: "drawing.calibration_saved",
      resourceType: "drawing_calibration",
      resourceId: calibrationId,
      metadata: {
        documentId: input.documentId,
        pageNumber: input.pageNumber,
        method,
        metresPerPoint,
        gridLines: input.grid.length,
        dimensions: input.dimensions.length,
        replaced
      }
    });

    return { ok: true, value: { calibrationId } };
  });
}

/**
 * Everything a browser needs to resume: every confirmed page scale of this drawing, plus the
 * page and camera this one person left behind.
 *
 * Returns null — not an empty state — when the drawing is not in this organization. The two
 * answers mean different things and the caller has to be able to tell them apart.
 */
export async function loadDrawingState(input: {
  organizationId: string;
  documentId: string;
  userId: string;
}): Promise<DrawingStateView | null> {
  const db = getDb();
  const scoped = await loadDocumentScoped(db, input.organizationId, input.documentId, false);
  if (!scoped) return null;

  const rows = await db
    .select({
      id: drawingCalibrations.id,
      pageNumber: drawingCalibrations.pageNumber,
      metresPerPoint: drawingCalibrations.metresPerPoint,
      method: drawingCalibrations.method,
      referenceGeometry: drawingCalibrations.referenceGeometry,
      grid: drawingCalibrations.grid,
      dimensions: drawingCalibrations.dimensions,
      confirmedAt: drawingCalibrations.confirmedAt
    })
    .from(drawingCalibrations)
    .where(eq(drawingCalibrations.documentId, input.documentId))
    .orderBy(asc(drawingCalibrations.pageNumber));

  const calibrations: PageCalibrationView[] = [];
  for (const row of rows) {
    // A method outside the registry is a row this build does not understand. Showing it as if it
    // were understood would be worse than leaving it out.
    if (!isCalibrationMethod(row.method)) continue;
    // The scale itself is a column the database keeps correct, so a jsonb payload that fails to
    // parse costs the drawing its grid, not its scale. The row still comes back.
    calibrations.push({
      id: row.id,
      pageNumber: row.pageNumber,
      metresPerPoint: Number(row.metresPerPoint),
      method: row.method,
      reference: parseCalibrationReference(row.referenceGeometry),
      grid: parseGridPayload(row.grid)?.lines ?? [],
      dimensions: parseDimensionsPayload(row.dimensions)?.items ?? [],
      confirmedAt: row.confirmedAt
    });
  }

  const viewRows = await db
    .select({ pageNumber: drawingViewStates.pageNumber, view: drawingViewStates.view })
    .from(drawingViewStates)
    .where(and(eq(drawingViewStates.userId, input.userId), eq(drawingViewStates.documentId, input.documentId)))
    .limit(1);

  const parsedView = viewRows[0] ? parseViewPayload(viewRows[0].view) : null;
  const view = viewRows[0] && parsedView ? { pageNumber: viewRows[0].pageNumber, view: parsedView } : null;

  const markRows = await db
    .select({ pageNumber: drawingMarks.pageNumber, marks: drawingMarks.marks })
    .from(drawingMarks)
    .where(eq(drawingMarks.documentId, input.documentId))
    .orderBy(asc(drawingMarks.pageNumber));

  const marks: Record<number, StoredMark[]> = {};
  for (const row of markRows) {
    // A page whose payload fails to parse comes back empty rather than missing, so the browser
    // can tell "this build cannot read what is stored" from "nothing was ever drawn here".
    marks[row.pageNumber] = parseMarksPayload(row.marks)?.items ?? [];
  }

  return { calibrations, marks, view };
}

/**
 * ความคืบหน้าของขั้น "เปิดแบบและยืนยันสเกล" ของทั้งโครงการ — ใช้บนหน้าแรกของแอป (IP-235)
 *
 * หน้าแรกต้องบอกได้ว่าค้างอยู่ตรงไหน เช่น "ตั้งสเกลแล้ว 1 หน้า จากทั้งหมด 32 หน้า"
 * เลขสองตัวนั้นมีอยู่ในฐานอยู่แล้ว — `drawing_documents.page_count` กับจำนวนแถวใน
 * `drawing_calibrations` — แต่ยังไม่มีใครนับให้ ที่ผ่านมาจึงเดาไม่ได้และต้องเว้นว่างไว้
 *
 * **นับรวมทุกไฟล์แบบในโครงการ ไม่ใช่ไฟล์ล่าสุดไฟล์เดียว** เพราะหนึ่งโครงการเปิดแบบได้หลายไฟล์
 * (สถาปัตย์ โครงสร้าง งานระบบ) และคนที่ถามว่า "เหลืออีกกี่หน้า" หมายถึงงานที่เหลือทั้งโครงการ
 *
 * `pageCount` เป็น null เมื่อไม่มีไฟล์ไหนบอกจำนวนหน้ามาเลย ซึ่งต่างจาก 0 โดยสิ้นเชิง —
 * null คือ "ไม่รู้" ส่วน 0 คือ "รู้ว่าไม่มี" คนอ่านหน้าแรกต้องเห็นความต่างนี้ ไม่ใช่เห็นเลขที่เราเดาให้
 */
export type DrawingProgressView = {
  documentCount: number;
  /** จำนวนหน้ารวมของแบบทุกไฟล์ · null = ยังไม่มีไฟล์ไหนบอกจำนวนหน้ามา */
  pageCount: number | null;
  /** จำนวนหน้าที่ยืนยันสเกลแล้ว นับข้ามทุกไฟล์ */
  calibratedPages: number;
  /** สเกลที่ยืนยันล่าสุด — บอกได้ว่าเพิ่งทำอะไรค้างไว้ตรงไหน */
  latest: { pageNumber: number; scale: PageScale } | null;
};

export async function summarizeDrawingProgress(
  organizationId: string,
  projectId: string
): Promise<DrawingProgressView> {
  const db = getDb();
  // The join to projects is the organization scope, exactly as loadDocumentScoped does it:
  // drawing_documents has no organization column of its own.
  const documents = await db
    .select({ id: drawingDocuments.id, pageCount: drawingDocuments.pageCount })
    .from(drawingDocuments)
    .innerJoin(projects, eq(projects.id, drawingDocuments.projectId))
    .where(and(eq(drawingDocuments.projectId, projectId), eq(projects.organizationId, organizationId)));

  if (documents.length === 0) return { documentCount: 0, pageCount: null, calibratedPages: 0, latest: null };

  const counted = documents.filter((row) => row.pageCount !== null);
  const pageCount = counted.length === 0 ? null : counted.reduce((total, row) => total + (row.pageCount ?? 0), 0);

  const calibrations = await db
    .select({
      pageNumber: drawingCalibrations.pageNumber,
      metresPerPoint: drawingCalibrations.metresPerPoint
    })
    .from(drawingCalibrations)
    .where(inArray(drawingCalibrations.documentId, documents.map((row) => row.id)))
    .orderBy(desc(drawingCalibrations.confirmedAt));

  const newest = calibrations[0];
  const metresPerPoint = newest ? Number(newest.metresPerPoint) : 0;

  return {
    documentCount: documents.length,
    pageCount,
    calibratedPages: calibrations.length,
    // A stored scale is always positive (a CHECK constraint says so), but a row that somehow
    // reads back as zero would make the ratio meaningless rather than merely wrong.
    latest:
      newest && metresPerPoint > 0
        ? { pageNumber: newest.pageNumber, scale: { metresPerPoint, ratio: metresPerPoint * POINTS_PER_METRE } }
        : null
  };
}

/**
 * Writes every mark on one page as a single payload, keyed by (document, page). An empty page
 * deletes the row: the absence of marks is NULL-shaped, not `{items: []}`, for the same reason
 * `saveCalibration` stores an undrafted grid as NULL.
 *
 * No audit event, for the reason the `drawingMarks` table comment gives: drawing a line is not
 * an act anybody reviews. Filing a mark into the take-off is, and that path raises its own.
 */
export async function saveMarks(input: {
  organizationId: string;
  documentId: string;
  actorId: string;
  pageNumber: number;
  marks: StoredMark[];
}): Promise<WriteResult<void>> {
  if (!Number.isInteger(input.pageNumber) || input.pageNumber < 1) return { ok: false, reason: "invalid_payload" };
  // A mark filed under the wrong page would come back on a page it was never drawn on.
  if (input.marks.some((mark) => mark.page !== input.pageNumber)) return { ok: false, reason: "invalid_payload" };

  return getDb().transaction(async (tx) => {
    const scoped = await loadDocumentScoped(tx, input.organizationId, input.documentId, true);
    if (!scoped) return { ok: false, reason: "document_not_found" };
    if (!WRITABLE_PROJECT_STATES.has(scoped.projectState)) return { ok: false, reason: "project_not_writable" };
    if (scoped.pageCount !== null && input.pageNumber > scoped.pageCount) {
      return { ok: false, reason: "invalid_payload" };
    }

    const existing = await tx
      .select({ id: drawingMarks.id, marks: drawingMarks.marks })
      .from(drawingMarks)
      .where(and(eq(drawingMarks.documentId, input.documentId), eq(drawingMarks.pageNumber, input.pageNumber)))
      .limit(1);

    /**
     * `filed` is the server's word, never the browser's. Whatever the page sends, a mark keeps
     * the filing the database already holds, and a filed mark the page left out comes back —
     * otherwise a client could unfile a quantity, or claim one was filed, by editing JSON.
     */
    const stored = existing[0] ? parseMarksPayload(existing[0].marks)?.items ?? [] : [];
    const filedById = new Map(stored.filter((mark) => mark.filed).map((mark) => [mark.id, mark]));
    const items: StoredMark[] = input.marks.map((mark) => ({ ...mark, filed: filedById.get(mark.id)?.filed ?? null }));
    for (const [id, mark] of filedById) {
      if (!items.some((item) => item.id === id)) items.push(mark);
    }

    if (items.length === 0) {
      if (existing[0]) await tx.delete(drawingMarks).where(eq(drawingMarks.id, existing[0].id));
      return { ok: true, value: undefined };
    }

    const payload = { version: 1, items };
    if (existing[0]) {
      await tx
        .update(drawingMarks)
        .set({ marks: payload, updatedBy: input.actorId, updatedAt: new Date() })
        .where(eq(drawingMarks.id, existing[0].id));
    } else {
      await tx.insert(drawingMarks).values({
        id: randomUUID(),
        documentId: input.documentId,
        pageNumber: input.pageNumber,
        marks: payload,
        updatedBy: input.actorId
      });
    }

    return { ok: true, value: undefined };
  });
}

/**
 * Files one stored mark into the take-off and stamps the mark as filed, in ONE transaction.
 *
 * The server reads the mark's points from `drawing_marks` itself — the browser sends only the
 * mark's id and the three words a person chose (category, description, unit). A client that
 * could post its own points could file a quantity that was never drawn, and the evidence row
 * would point at geometry nobody can find on the sheet.
 *
 * The scale is read from the page's calibration row and copied into the evidence at this moment,
 * so a later re-calibration cannot change what this line was multiplied by.
 */
export async function fileDrawingMark(input: {
  organizationId: string;
  actorId: string;
  documentId: string;
  pageNumber: number;
  markId: string;
  item: TakeoffItemInput;
}): Promise<FileMarkResult> {
  if (!Number.isInteger(input.pageNumber) || input.pageNumber < 1) return { ok: false, reason: "invalid_payload" };
  const unit = findUnit(input.item.unit);
  if (!unit) return { ok: false, reason: "invalid_payload" };

  return getDb().transaction(async (tx) => {
    const scoped = await loadDocumentScoped(tx, input.organizationId, input.documentId, true);
    if (!scoped) return { ok: false, reason: "document_not_found" };
    if (!WRITABLE_PROJECT_STATES.has(scoped.projectState)) return { ok: false, reason: "project_not_writable" };

    const rows = await tx
      .select({ id: drawingMarks.id, marks: drawingMarks.marks })
      .from(drawingMarks)
      .where(and(eq(drawingMarks.documentId, input.documentId), eq(drawingMarks.pageNumber, input.pageNumber)))
      .limit(1)
      .for("update");
    const stored = rows[0] ? parseMarksPayload(rows[0].marks) : null;
    const mark = stored?.items.find((item) => item.id === input.markId);
    if (!rows[0] || !stored || !mark) return { ok: false, reason: "mark_not_found" };
    if (mark.filed) return { ok: false, reason: "mark_already_filed" };

    const calibrationRows = await tx
      .select({ id: drawingCalibrations.id, metresPerPoint: drawingCalibrations.metresPerPoint })
      .from(drawingCalibrations)
      .where(and(eq(drawingCalibrations.documentId, input.documentId), eq(drawingCalibrations.pageNumber, input.pageNumber)))
      .limit(1);
    const calibration = calibrationRows[0] ?? null;
    const scale: PageScale | null = calibration
      ? { metresPerPoint: Number(calibration.metresPerPoint), ratio: Number(calibration.metresPerPoint) * POINTS_PER_METRE }
      : null;

    const converted = toFiledLine(mark, scale);
    if (!converted.ok) return { ok: false, reason: converted.reason };
    // The unit a person picked has to be one the mark's kind can carry: a length is metres,
    // an area is square metres, a count is whatever is being counted.
    if (unit.dimension !== converted.line.unitDimension) return { ok: false, reason: "unit_not_allowed" };

    const filed = await fileMarkIntoTakeoffTx(tx, {
      organizationId: input.organizationId,
      projectId: scoped.projectId,
      actorId: input.actorId,
      documentId: input.documentId,
      // A count is not multiplied by anything, so it names no calibration: the context records
      // what the figure was made from, and claiming a scale it never used would be a false trail.
      calibrationId: converted.line.geometry.scale ? (calibration?.id ?? null) : null,
      item: input.item,
      line: converted.line,
      markId: mark.id
    });
    if (!filed.ok) return filed;

    const items = stored.items.map((item) =>
      item.id === mark.id
        ? { ...item, filed: { itemId: filed.value.itemId, measurementId: filed.value.measurementId, evidenceId: filed.value.evidenceId } }
        : item
    );
    await tx
      .update(drawingMarks)
      .set({ marks: { version: 1, items }, updatedBy: input.actorId, updatedAt: new Date() })
      .where(eq(drawingMarks.id, rows[0].id));

    return filed;
  });
}

/**
 * Remembers where one person was looking, so reopening a drawing resumes instead of restarting.
 *
 * This is the one write in the estimeter path that raises no audit event, for the reason the
 * `drawingViewStates` table comment gives: scrolling is not an act anybody needs to review, and
 * recording it would bury the acts that are.
 */
export async function saveViewState(input: {
  organizationId: string;
  userId: string;
  documentId: string;
  pageNumber: number;
  view: ViewPayload;
}): Promise<WriteResult<void>> {
  if (!Number.isInteger(input.pageNumber) || input.pageNumber < 1) return { ok: false, reason: "invalid_payload" };
  const { scale, x, y } = input.view;
  if (![scale, x, y].every((value) => Number.isFinite(value))) return { ok: false, reason: "invalid_payload" };
  if (scale <= 0) return { ok: false, reason: "invalid_payload" };

  const view: ViewPayload = { version: 1, scale, x, y };

  return getDb().transaction(async (tx) => {
    const scoped = await loadDocumentScoped(tx, input.organizationId, input.documentId, false);
    if (!scoped) return { ok: false, reason: "document_not_found" };

    const existing = await tx
      .select({ id: drawingViewStates.id })
      .from(drawingViewStates)
      .where(and(eq(drawingViewStates.userId, input.userId), eq(drawingViewStates.documentId, input.documentId)))
      .limit(1);

    if (existing[0]) {
      await tx
        .update(drawingViewStates)
        .set({ pageNumber: input.pageNumber, view, updatedAt: new Date() })
        .where(eq(drawingViewStates.id, existing[0].id));
    } else {
      await tx.insert(drawingViewStates).values({
        id: randomUUID(),
        userId: input.userId,
        documentId: input.documentId,
        pageNumber: input.pageNumber,
        view
      });
    }

    return { ok: true, value: undefined };
  });
}
