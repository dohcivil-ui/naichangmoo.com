"use server";

import { isCalibrationMethod } from "@/lib/drawing-calibration-method";
import type { DraftedGridLine } from "@/lib/drawing-grid";
import type { StatedDimension } from "@/lib/drawing-scale";
import {
  parseCalibrationReference,
  parseDimensionsPayload,
  parseGridPayload,
  parseMarksPayload,
  parseViewPayload,
  type StoredMark
} from "@/lib/drawing-state";
import { filedLineRejectionMessage } from "@/lib/takeoff-from-measurement";
import { parseTakeoffItemForm } from "@/lib/takeoff-item";
import { requireEditAccess, revalidateTakeoff } from "@/server/estimeter/edit-access";
import {
  fileDrawingMark as fileDrawingMarkInRepository,
  loadDrawingState,
  registerDrawingDocument,
  saveCalibration,
  saveMarks,
  saveViewState,
  type DrawingStateView,
  type DrawingWriteRejection,
  type FileMarkRejection
} from "@/server/estimeter/drawing-repository";
import { getOpenManualRun, listRunItems } from "@/server/estimeter/takeoff-repository";

/**
 * Actions for the markup page, which sends coordinates as objects rather than form fields.
 *
 * Every one of these is a public POST endpoint, so nothing the browser sends is trusted: the
 * session and the organization are resolved here, and every argument is checked again on this
 * side even though the page checked it before sending.
 *
 * There is no `revalidatePath` anywhere in this file. Nothing rendered on the server displays a
 * scale or a grid yet, so revalidating would throw away a cache for no reader.
 */
export type DrawingActionResult<T> = ({ ok: true } & T) | { ok: false; message: string };

const rejectionMessage: Record<DrawingWriteRejection, string> = {
  project_not_found: "ไม่พบโครงการนี้ในองค์กรของคุณ",
  project_not_writable: "โครงการนี้อยู่ในสถานะที่แก้ไขไม่ได้",
  document_not_found: "ไม่พบแบบใบนี้ในโครงการของคุณ",
  invalid_payload: "ข้อมูลที่ส่งมาไม่ครบหรือผิดรูป บันทึกไม่ได้"
};

const MALFORMED = rejectionMessage.invalid_payload;

/** Every way filing a mark can fail, in the words the person on the markup page reads. */
const fileMarkMessage: Record<FileMarkRejection, string> = {
  ...rejectionMessage,
  ...filedLineRejectionMessage,
  run_not_found: "ไม่พบรอบการถอดปริมาณนี้ในโครงการของคุณ",
  item_not_found: "ไม่พบรายการนี้ในโครงการของคุณ",
  run_not_open: "รอบการถอดปริมาณนี้ปิดแล้ว ต้องเปิดรอบใหม่ก่อนส่ง",
  item_locked: "รายการชื่อนี้ยืนยันแล้ว จึงส่งเข้ารวมไม่ได้ ตั้งชื่อรายการใหม่ หรือปลดการยืนยันที่หน้าถอดปริมาณ",
  evidence_required: "ต้องบันทึกหลักฐานอ้างอิงอย่างน้อยหนึ่งรายการก่อนยืนยันปริมาณ",
  measurement_required: "รายการต้องมีบรรทัดวัดอย่างน้อยหนึ่งบรรทัด",
  measurement_shape_mismatch: "ตัวเลขที่วัดได้ไม่ตรงกับหน่วยที่เลือก",
  group_not_found: "ไม่พบหมวดงานนี้",
  group_depth_exceeded: "หมวดงานซ้อนกันลึกเกินกำหนด",
  already_confirmed: "รายการนี้ยืนยันแล้ว",
  no_confirmed_items: "ยังไม่มีรายการที่ยืนยัน",
  mark_not_found: "ไม่พบรอยวัดนี้ในหน้าที่บันทึกไว้ บันทึกหน้านี้ให้เสร็จก่อนแล้วลองใหม่",
  mark_already_filed: "รายการนี้ส่งเข้าถอดปริมาณแล้ว ลบได้จากหน้าถอดปริมาณ",
  unit_not_allowed: "หน่วยที่เลือกใช้กับรายการวัดชนิดนี้ไม่ได้"
};

/** A SHA-256 digest written as lower-case hex, which is what `crypto.subtle.digest` produces. */
const CHECKSUM_PATTERN = /^[a-f0-9]{64}$/;

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

export async function registerDrawing(input: {
  projectId: string;
  checksum: string;
  mimeType: string;
  byteSize: number;
  pageCount: number | null;
}): Promise<DrawingActionResult<{ documentId: string }>> {
  const guard = await requireEditAccess();
  if (!guard.ok) return { ok: false, message: guard.message };

  if (!nonEmpty(input.projectId)) return { ok: false, message: MALFORMED };
  if (typeof input.checksum !== "string" || !CHECKSUM_PATTERN.test(input.checksum)) {
    return { ok: false, message: MALFORMED };
  }
  // Only PDF this round. Accepting a type the viewer cannot open would store an identity for a
  // drawing nobody can ever see again.
  if (input.mimeType !== "application/pdf") return { ok: false, message: MALFORMED };
  if (typeof input.byteSize !== "number" || !Number.isInteger(input.byteSize) || input.byteSize <= 0) {
    return { ok: false, message: MALFORMED };
  }
  if (input.pageCount !== null && !positiveInteger(input.pageCount)) return { ok: false, message: MALFORMED };

  const result = await registerDrawingDocument({
    organizationId: guard.context.organizationId,
    projectId: input.projectId,
    actorId: guard.context.userId,
    checksum: input.checksum,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    pageCount: input.pageCount
  });
  if (!result.ok) return { ok: false, message: rejectionMessage[result.reason] };

  return { ok: true, documentId: result.value.documentId };
}

export async function saveDrawingCalibration(input: {
  documentId: string;
  pageNumber: number;
  metresPerPoint: number;
  method: string;
  reference: unknown;
  grid: DraftedGridLine[];
  dimensions: StatedDimension[];
}): Promise<DrawingActionResult<{ calibrationId: string }>> {
  const guard = await requireEditAccess();
  if (!guard.ok) return { ok: false, message: guard.message };

  if (!nonEmpty(input.documentId)) return { ok: false, message: MALFORMED };
  if (!positiveInteger(input.pageNumber)) return { ok: false, message: MALFORMED };
  if (typeof input.metresPerPoint !== "number" || !Number.isFinite(input.metresPerPoint) || input.metresPerPoint <= 0) {
    return { ok: false, message: MALFORMED };
  }
  if (typeof input.method !== "string" || !isCalibrationMethod(input.method)) {
    return { ok: false, message: MALFORMED };
  }

  const reference = parseCalibrationReference(input.reference);
  const grid = parseGridPayload({ version: 1, lines: input.grid });
  const dimensions = parseDimensionsPayload({ version: 1, items: input.dimensions });
  if (!reference || !grid || !dimensions) return { ok: false, message: MALFORMED };

  const result = await saveCalibration({
    organizationId: guard.context.organizationId,
    documentId: input.documentId,
    actorId: guard.context.userId,
    pageNumber: input.pageNumber,
    metresPerPoint: input.metresPerPoint,
    method: input.method,
    reference,
    grid: grid.lines,
    dimensions: dimensions.items
  });
  if (!result.ok) return { ok: false, message: rejectionMessage[result.reason] };

  return { ok: true, calibrationId: result.value.calibrationId };
}

export async function loadDrawing(input: {
  documentId: string;
}): Promise<DrawingActionResult<{ state: DrawingStateView }>> {
  const guard = await requireEditAccess();
  if (!guard.ok) return { ok: false, message: guard.message };

  if (!nonEmpty(input.documentId)) return { ok: false, message: MALFORMED };

  const state = await loadDrawingState({
    organizationId: guard.context.organizationId,
    documentId: input.documentId,
    userId: guard.context.userId
  });
  if (!state) return { ok: false, message: rejectionMessage.document_not_found };

  return { ok: true, state };
}

/** Every mark on one page, as a single payload. The parser refuses the whole page if one mark is malformed. */
export async function saveDrawingMarks(input: {
  documentId: string;
  pageNumber: number;
  marks: unknown;
}): Promise<DrawingActionResult<Record<never, never>>> {
  const guard = await requireEditAccess();
  if (!guard.ok) return { ok: false, message: guard.message };

  if (!nonEmpty(input.documentId)) return { ok: false, message: MALFORMED };
  if (!positiveInteger(input.pageNumber)) return { ok: false, message: MALFORMED };
  if (!Array.isArray(input.marks)) return { ok: false, message: MALFORMED };

  const parsed = parseMarksPayload({ version: 1, items: input.marks });
  if (!parsed) return { ok: false, message: MALFORMED };

  const result = await saveMarks({
    organizationId: guard.context.organizationId,
    documentId: input.documentId,
    actorId: guard.context.userId,
    pageNumber: input.pageNumber,
    marks: parsed.items
  });
  if (!result.ok) return { ok: false, message: rejectionMessage[result.reason] };

  return { ok: true };
}

/**
 * Files one mark into the take-off. The browser sends the mark's id and three words; the server
 * reads the points and the scale from the database itself (see `fileDrawingMark` in the
 * repository for why). The three words go through the same parser as the take-off form, so the
 * rules for a category, a description and a unit are written once.
 */
export async function fileDrawingMark(input: {
  documentId: string;
  pageNumber: number;
  markId: string;
  category: string;
  description: string;
  unit: string;
}): Promise<DrawingActionResult<{ filed: NonNullable<StoredMark["filed"]>; reused: boolean }>> {
  const guard = await requireEditAccess();
  if (!guard.ok) return { ok: false, message: guard.message };

  if (!nonEmpty(input.documentId) || !nonEmpty(input.markId)) return { ok: false, message: MALFORMED };
  if (!positiveInteger(input.pageNumber)) return { ok: false, message: MALFORMED };

  const form = new FormData();
  form.set("category", String(input.category ?? ""));
  form.set("description", String(input.description ?? ""));
  form.set("unit", String(input.unit ?? ""));
  const item = parseTakeoffItemForm(form);
  if (!item.ok) {
    const first = item.errors.description ?? item.errors.category ?? item.errors.unit ?? MALFORMED;
    return { ok: false, message: first };
  }

  const result = await fileDrawingMarkInRepository({
    organizationId: guard.context.organizationId,
    actorId: guard.context.userId,
    documentId: input.documentId,
    pageNumber: input.pageNumber,
    markId: input.markId,
    item: item.value
  });
  if (!result.ok) return { ok: false, message: fileMarkMessage[result.reason] };

  const state = await loadDrawingState({
    organizationId: guard.context.organizationId,
    documentId: input.documentId,
    userId: guard.context.userId
  });
  // The take-off page renders quantities on the server, so it has to be told the sheet changed.
  const projectId = state ? await projectIdOfDocument(guard.context.organizationId, input.documentId) : null;
  if (projectId) revalidateTakeoff(projectId);

  const { itemId, measurementId, evidenceId } = result.value;
  return { ok: true, filed: { itemId, measurementId, evidenceId }, reused: result.value.reused };
}

async function projectIdOfDocument(organizationId: string, documentId: string): Promise<string | null> {
  const { getDb } = await import("@/db");
  const { drawingDocuments, projects } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const rows = await getDb()
    .select({ projectId: drawingDocuments.projectId })
    .from(drawingDocuments)
    .innerJoin(projects, eq(projects.id, drawingDocuments.projectId))
    .where(and(eq(drawingDocuments.id, documentId), eq(projects.organizationId, organizationId)))
    .limit(1);
  return rows[0]?.projectId ?? null;
}

/**
 * The items already open in this project's manual run, so the filing dialog can offer the
 * existing names and warn that a mark will be added to one of them rather than start a new line.
 */
export async function listOpenRunItems(input: {
  projectId: string;
}): Promise<DrawingActionResult<{ items: { description: string; unit: string; reviewState: string }[] }>> {
  const guard = await requireEditAccess();
  if (!guard.ok) return { ok: false, message: guard.message };
  if (!nonEmpty(input.projectId)) return { ok: false, message: MALFORMED };

  const run = await getOpenManualRun(guard.context.organizationId, input.projectId);
  if (!run) return { ok: true, items: [] };
  const items = await listRunItems(guard.context.organizationId, run.id);
  return { ok: true, items: items.map((item) => ({ description: item.description, unit: item.unit, reviewState: item.reviewState })) };
}

export async function saveDrawingView(input: {
  documentId: string;
  pageNumber: number;
  view: unknown;
}): Promise<DrawingActionResult<Record<never, never>>> {
  const guard = await requireEditAccess();
  if (!guard.ok) return { ok: false, message: guard.message };

  if (!nonEmpty(input.documentId)) return { ok: false, message: MALFORMED };
  if (!positiveInteger(input.pageNumber)) return { ok: false, message: MALFORMED };

  const view = parseViewPayload(input.view);
  if (!view) return { ok: false, message: MALFORMED };

  const result = await saveViewState({
    organizationId: guard.context.organizationId,
    userId: guard.context.userId,
    documentId: input.documentId,
    pageNumber: input.pageNumber,
    view
  });
  if (!result.ok) return { ok: false, message: rejectionMessage[result.reason] };

  return { ok: true };
}
