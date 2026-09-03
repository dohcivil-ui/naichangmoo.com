"use server";

import { isCalibrationMethod } from "@/lib/drawing-calibration-method";
import type { DraftedGridLine } from "@/lib/drawing-grid";
import type { StatedDimension } from "@/lib/drawing-scale";
import {
  parseCalibrationReference,
  parseDimensionsPayload,
  parseGridPayload,
  parseViewPayload
} from "@/lib/drawing-state";
import { requireEditAccess } from "@/server/estimeter/edit-access";
import {
  loadDrawingState,
  registerDrawingDocument,
  saveCalibration,
  saveViewState,
  type DrawingStateView,
  type DrawingWriteRejection
} from "@/server/estimeter/drawing-repository";

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
