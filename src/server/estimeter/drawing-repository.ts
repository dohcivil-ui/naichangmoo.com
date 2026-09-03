import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, drawingCalibrations, drawingDocuments, drawingViewStates, projects } from "@/db/schema";
import { isCalibrationMethod, type CalibrationMethod } from "@/lib/drawing-calibration-method";
import type { DraftedGridLine } from "@/lib/drawing-grid";
import type { StatedDimension } from "@/lib/drawing-scale";
import {
  parseCalibrationReference,
  parseDimensionsPayload,
  parseGridPayload,
  parseViewPayload,
  type CalibrationReference,
  type ViewPayload
} from "@/lib/drawing-state";

/**
 * States in which a project still accepts drawing writes. Same pair, and the same reason, as
 * the take-off repository: a locked or archived project must not gain a new scale either.
 */
const WRITABLE_PROJECT_STATES = new Set(["draft", "active"]);

export type DrawingWriteRejection =
  | "project_not_found"
  | "project_not_writable"
  | "document_not_found"
  | "invalid_payload";

export type WriteResult<T = void> = { ok: true; value: T } | { ok: false; reason: DrawingWriteRejection };

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

  return { calibrations, view };
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
