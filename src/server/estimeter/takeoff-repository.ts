import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, evidenceReferences, projects, takeoffItems, takeoffMeasurements, takeoffRuns } from "@/db/schema";
import type { EvidenceInput, TakeoffItemInput } from "@/lib/takeoff-item";
import { itemConfirmationBlocker } from "@/lib/takeoff-item";
import type { MeasurementInput } from "@/lib/takeoff-measurement";
import { grossQuantity, measurementMatchesUnit, measurementSubtotal, netQuantity } from "@/lib/takeoff-measurement";

export const MANUAL_RUNNER = "manual";

/** States in which a project still accepts take-off writes. */
const WRITABLE_PROJECT_STATES = new Set(["draft", "active"]);

export type TakeoffRunView = {
  id: string;
  projectId: string;
  runner: string;
  state: string;
  outputHash: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TakeoffItemView = {
  id: string;
  category: string;
  description: string;
  unit: string;
  quantity: string;
  quantityGross: string | null;
  wastePercent: string;
  wasteSourceNote: string | null;
  reviewState: string;
  createdAt: Date;
};

export type MeasurementView = {
  id: string;
  takeoffItemId: string;
  label: string;
  count: number;
  dimensions: string[];
  conversionFactor: string | null;
  conversionNote: string | null;
  subtotal: string;
  createdAt: Date;
};

export type EvidenceView = {
  id: string;
  takeoffItemId: string;
  pageNumber: number | null;
  note: string | null;
  createdAt: Date;
};

export type WriteRejection =
  | "run_not_found"
  | "item_not_found"
  | "project_not_writable"
  | "run_not_open"
  | "item_locked"
  | "evidence_required"
  | "measurement_required"
  | "measurement_shape_mismatch"
  | "already_confirmed"
  | "no_confirmed_items";

export type WriteResult<T = void> = { ok: true; value: T } | { ok: false; reason: WriteRejection };

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

function canonicalHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * takeoff_runs, takeoff_items and evidence_references carry no organization column, so every
 * lookup joins back to projects and filters on the organization. Skipping this join anywhere
 * would expose another organization's take-off to anyone who knows an id.
 */
async function loadRunScoped(
  executor: Db | Tx,
  organizationId: string,
  runId: string
): Promise<{ run: TakeoffRunView; projectState: string } | null> {
  const rows = await executor
    .select({
      id: takeoffRuns.id,
      projectId: takeoffRuns.projectId,
      runner: takeoffRuns.runner,
      state: takeoffRuns.state,
      outputHash: takeoffRuns.outputHash,
      createdAt: takeoffRuns.createdAt,
      updatedAt: takeoffRuns.updatedAt,
      projectState: projects.state
    })
    .from(takeoffRuns)
    .innerJoin(projects, eq(projects.id, takeoffRuns.projectId))
    .where(and(eq(takeoffRuns.id, runId), eq(projects.organizationId, organizationId)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  const { projectState, ...run } = row;
  return { run, projectState };
}

async function loadItemScoped(
  executor: Db | Tx,
  organizationId: string,
  itemId: string
): Promise<{ item: TakeoffItemView; runId: string; runState: string; projectId: string; projectState: string } | null> {
  const rows = await executor
    .select({
      id: takeoffItems.id,
      category: takeoffItems.category,
      description: takeoffItems.description,
      unit: takeoffItems.unit,
      quantity: takeoffItems.quantity,
      quantityGross: takeoffItems.quantityGross,
      wastePercent: takeoffItems.wastePercent,
      wasteSourceNote: takeoffItems.wasteSourceNote,
      reviewState: takeoffItems.reviewState,
      createdAt: takeoffItems.createdAt,
      runId: takeoffRuns.id,
      runState: takeoffRuns.state,
      projectId: projects.id,
      projectState: projects.state
    })
    .from(takeoffItems)
    .innerJoin(takeoffRuns, eq(takeoffRuns.id, takeoffItems.runId))
    .innerJoin(projects, eq(projects.id, takeoffRuns.projectId))
    .where(and(eq(takeoffItems.id, itemId), eq(projects.organizationId, organizationId)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  const { runId, runState, projectId, projectState, ...item } = row;
  return { item, runId, runState, projectId, projectState };
}

export async function getOpenManualRun(organizationId: string, projectId: string): Promise<TakeoffRunView | null> {
  const rows = await getDb()
    .select({
      id: takeoffRuns.id,
      projectId: takeoffRuns.projectId,
      runner: takeoffRuns.runner,
      state: takeoffRuns.state,
      outputHash: takeoffRuns.outputHash,
      createdAt: takeoffRuns.createdAt,
      updatedAt: takeoffRuns.updatedAt
    })
    .from(takeoffRuns)
    .innerJoin(projects, eq(projects.id, takeoffRuns.projectId))
    .where(
      and(
        eq(takeoffRuns.projectId, projectId),
        eq(projects.organizationId, organizationId),
        eq(takeoffRuns.runner, MANUAL_RUNNER),
        eq(takeoffRuns.state, "running")
      )
    )
    .orderBy(asc(takeoffRuns.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function listManualRuns(organizationId: string, projectId: string): Promise<TakeoffRunView[]> {
  return getDb()
    .select({
      id: takeoffRuns.id,
      projectId: takeoffRuns.projectId,
      runner: takeoffRuns.runner,
      state: takeoffRuns.state,
      outputHash: takeoffRuns.outputHash,
      createdAt: takeoffRuns.createdAt,
      updatedAt: takeoffRuns.updatedAt
    })
    .from(takeoffRuns)
    .innerJoin(projects, eq(projects.id, takeoffRuns.projectId))
    .where(and(eq(takeoffRuns.projectId, projectId), eq(projects.organizationId, organizationId)))
    .orderBy(asc(takeoffRuns.createdAt));
}

export async function listRunItems(organizationId: string, runId: string): Promise<TakeoffItemView[]> {
  const scoped = await loadRunScoped(getDb(), organizationId, runId);
  if (!scoped) return [];

  return getDb()
    .select({
      id: takeoffItems.id,
      category: takeoffItems.category,
      description: takeoffItems.description,
      unit: takeoffItems.unit,
      quantity: takeoffItems.quantity,
      quantityGross: takeoffItems.quantityGross,
      wastePercent: takeoffItems.wastePercent,
      wasteSourceNote: takeoffItems.wasteSourceNote,
      reviewState: takeoffItems.reviewState,
      createdAt: takeoffItems.createdAt
    })
    .from(takeoffItems)
    .where(eq(takeoffItems.runId, runId))
    .orderBy(asc(takeoffItems.createdAt));
}

/** One item, scoped to the organization. Used to read the unit a measurement must match. */
export async function getScopedItem(organizationId: string, itemId: string): Promise<TakeoffItemView | null> {
  const scoped = await loadItemScoped(getDb(), organizationId, itemId);
  return scoped?.item ?? null;
}

export async function listEvidenceForItems(itemIds: readonly string[]): Promise<EvidenceView[]> {
  if (itemIds.length === 0) return [];
  return getDb()
    .select({
      id: evidenceReferences.id,
      takeoffItemId: evidenceReferences.takeoffItemId,
      pageNumber: evidenceReferences.pageNumber,
      note: evidenceReferences.note,
      createdAt: evidenceReferences.createdAt
    })
    .from(evidenceReferences)
    .where(inArray(evidenceReferences.takeoffItemId, [...itemIds]))
    .orderBy(asc(evidenceReferences.createdAt));
}

/**
 * Opens the manual take-off run, or returns the one already open. The project row is locked
 * first so two submits cannot create two competing runs for the same project.
 */
export async function startManualRun(input: {
  organizationId: string;
  projectId: string;
  actorId: string;
}): Promise<WriteResult<TakeoffRunView>> {
  return getDb().transaction(async (tx) => {
    const locked = await tx
      .select({ id: projects.id, state: projects.state })
      .from(projects)
      .where(and(eq(projects.id, input.projectId), eq(projects.organizationId, input.organizationId)))
      .limit(1)
      .for("update");

    const project = locked[0];
    if (!project) return { ok: false, reason: "run_not_found" };
    if (!WRITABLE_PROJECT_STATES.has(project.state)) return { ok: false, reason: "project_not_writable" };

    const existing = await tx
      .select({
        id: takeoffRuns.id,
        projectId: takeoffRuns.projectId,
        runner: takeoffRuns.runner,
        state: takeoffRuns.state,
        outputHash: takeoffRuns.outputHash,
        createdAt: takeoffRuns.createdAt,
        updatedAt: takeoffRuns.updatedAt
      })
      .from(takeoffRuns)
      .where(
        and(
          eq(takeoffRuns.projectId, input.projectId),
          eq(takeoffRuns.runner, MANUAL_RUNNER),
          eq(takeoffRuns.state, "running")
        )
      )
      .limit(1);
    if (existing[0]) return { ok: true, value: existing[0] };

    const runId = randomUUID();
    // input_hash is NOT NULL and exists to identify what a run was computed from. A manual run
    // has no machine input, so it records the project and operator that opened it.
    const inputHash = canonicalHash({ projectId: input.projectId, runner: MANUAL_RUNNER, actorId: input.actorId, runId });

    const inserted = await tx
      .insert(takeoffRuns)
      .values({
        id: runId,
        projectId: input.projectId,
        runner: MANUAL_RUNNER,
        state: "running",
        inputHash
      })
      .returning({
        id: takeoffRuns.id,
        projectId: takeoffRuns.projectId,
        runner: takeoffRuns.runner,
        state: takeoffRuns.state,
        outputHash: takeoffRuns.outputHash,
        createdAt: takeoffRuns.createdAt,
        updatedAt: takeoffRuns.updatedAt
      });

    await tx.insert(auditEvents).values({
      id: randomUUID(),
      organizationId: input.organizationId,
      actorId: input.actorId,
      eventType: "takeoff.run_started",
      resourceType: "takeoff_run",
      resourceId: runId,
      metadata: { projectId: input.projectId, runner: MANUAL_RUNNER }
    });

    return { ok: true, value: inserted[0]! };
  });
}

export async function addManualItem(input: {
  organizationId: string;
  runId: string;
  actorId: string;
  item: TakeoffItemInput;
}): Promise<WriteResult<{ itemId: string; projectId: string }>> {
  return getDb().transaction(async (tx) => {
    const scoped = await loadRunScoped(tx, input.organizationId, input.runId);
    if (!scoped) return { ok: false, reason: "run_not_found" };
    if (!WRITABLE_PROJECT_STATES.has(scoped.projectState)) return { ok: false, reason: "project_not_writable" };
    if (scoped.run.state !== "running") return { ok: false, reason: "run_not_open" };

    const itemId = randomUUID();
    await tx.insert(takeoffItems).values({
      id: itemId,
      runId: input.runId,
      category: input.item.category,
      description: input.item.description,
      unit: input.item.unit,
      // A new item has been named but not yet measured. Its quantity is the total of its
      // measurement lines, so it starts at zero and cannot be confirmed until it has some.
      quantity: "0",
      quantityGross: "0",
      reviewState: "proposed"
    });

    await tx.insert(auditEvents).values({
      id: randomUUID(),
      organizationId: input.organizationId,
      actorId: input.actorId,
      eventType: "takeoff.item_added",
      resourceType: "takeoff_item",
      resourceId: itemId,
      metadata: {
        runId: input.runId,
        category: input.item.category,
        unit: input.item.unit
      }
    });

    return { ok: true, value: { itemId, projectId: scoped.run.projectId } };
  });
}

export async function listMeasurementsForItems(itemIds: readonly string[]): Promise<MeasurementView[]> {
  if (itemIds.length === 0) return [];
  const rows = await getDb()
    .select({
      id: takeoffMeasurements.id,
      takeoffItemId: takeoffMeasurements.takeoffItemId,
      label: takeoffMeasurements.label,
      count: takeoffMeasurements.count,
      dimension1: takeoffMeasurements.dimension1,
      dimension2: takeoffMeasurements.dimension2,
      dimension3: takeoffMeasurements.dimension3,
      conversionFactor: takeoffMeasurements.conversionFactor,
      conversionNote: takeoffMeasurements.conversionNote,
      createdAt: takeoffMeasurements.createdAt
    })
    .from(takeoffMeasurements)
    .where(inArray(takeoffMeasurements.takeoffItemId, [...itemIds]))
    .orderBy(asc(takeoffMeasurements.sortOrder), asc(takeoffMeasurements.createdAt));

  return rows.map((row) => {
    const dimensions = [row.dimension1, row.dimension2, row.dimension3].filter(
      (value): value is string => value !== null
    );
    const factors = { count: row.count, dimensions, conversionFactor: row.conversionFactor };
    return {
      id: row.id,
      takeoffItemId: row.takeoffItemId,
      label: row.label,
      count: row.count,
      dimensions,
      conversionFactor: row.conversionFactor,
      conversionNote: row.conversionNote,
      subtotal: measurementSubtotal(factors),
      createdAt: row.createdAt
    };
  });
}

/**
 * Recomputes an item's quantity from the measurement lines that exist right now.
 *
 * Always called inside the transaction that changed those lines, and after the item row has
 * been locked, so the stored quantity can never describe a set of lines that no longer exists.
 */
async function recomputeItemQuantity(tx: Tx, itemId: string, wastePercent: string): Promise<{ gross: string; net: string }> {
  const rows = await tx
    .select({
      count: takeoffMeasurements.count,
      dimension1: takeoffMeasurements.dimension1,
      dimension2: takeoffMeasurements.dimension2,
      dimension3: takeoffMeasurements.dimension3,
      conversionFactor: takeoffMeasurements.conversionFactor
    })
    .from(takeoffMeasurements)
    .where(eq(takeoffMeasurements.takeoffItemId, itemId));

  const gross = grossQuantity(
    rows.map((row) => ({
      count: row.count,
      dimensions: [row.dimension1, row.dimension2, row.dimension3].filter((value): value is string => value !== null),
      conversionFactor: row.conversionFactor
    }))
  );
  const net = netQuantity(gross, wastePercent);

  await tx
    .update(takeoffItems)
    .set({ quantity: net, quantityGross: gross, updatedAt: new Date() })
    .where(eq(takeoffItems.id, itemId));

  return { gross, net };
}

/**
 * Locks the item and refuses the write unless the whole chain still accepts one.
 *
 * The item row lock is what makes the recomputed quantity correct under concurrency: two
 * measurement lines submitted at once are serialised here, so the second one totals a set that
 * already includes the first.
 */
async function lockItemForMeasurement(
  tx: Tx,
  organizationId: string,
  itemId: string
): Promise<
  | { ok: true; item: TakeoffItemView; runId: string; projectId: string }
  | { ok: false; reason: WriteRejection }
> {
  const scoped = await loadItemScoped(tx, organizationId, itemId);
  if (!scoped) return { ok: false, reason: "item_not_found" };
  if (!WRITABLE_PROJECT_STATES.has(scoped.projectState)) return { ok: false, reason: "project_not_writable" };
  if (scoped.runState !== "running") return { ok: false, reason: "run_not_open" };

  const locked = await tx
    .select({ id: takeoffItems.id, reviewState: takeoffItems.reviewState, wastePercent: takeoffItems.wastePercent })
    .from(takeoffItems)
    .where(eq(takeoffItems.id, itemId))
    .limit(1)
    .for("update");
  const current = locked[0];
  if (!current) return { ok: false, reason: "item_not_found" };
  // The arithmetic behind a confirmed quantity must stay as it was when the quantity was accepted.
  if (current.reviewState === "confirmed") return { ok: false, reason: "item_locked" };

  return {
    ok: true,
    item: { ...scoped.item, reviewState: current.reviewState, wastePercent: current.wastePercent },
    runId: scoped.runId,
    projectId: scoped.projectId
  };
}

export async function addItemMeasurement(input: {
  organizationId: string;
  itemId: string;
  actorId: string;
  measurement: MeasurementInput;
}): Promise<WriteResult<{ measurementId: string; projectId: string; quantity: string }>> {
  return getDb().transaction(async (tx) => {
    const locked = await lockItemForMeasurement(tx, input.organizationId, input.itemId);
    if (!locked.ok) return locked;

    // Re-checked against the unit stored on the item, not the one the browser posted.
    if (!measurementMatchesUnit(input.measurement, locked.item.unit)) {
      return { ok: false, reason: "measurement_shape_mismatch" };
    }

    const [dimension1 = null, dimension2 = null, dimension3 = null] = input.measurement.dimensions;
    const measurementId = randomUUID();
    const nextOrder = await tx
      .select({ value: sql<number>`coalesce(max(${takeoffMeasurements.sortOrder}), -1) + 1` })
      .from(takeoffMeasurements)
      .where(eq(takeoffMeasurements.takeoffItemId, input.itemId));

    await tx.insert(takeoffMeasurements).values({
      id: measurementId,
      takeoffItemId: input.itemId,
      label: input.measurement.label,
      count: input.measurement.count,
      dimension1,
      dimension2,
      dimension3,
      conversionFactor: input.measurement.conversionFactor,
      conversionNote: input.measurement.conversionNote,
      sortOrder: Number(nextOrder[0]?.value ?? 0)
    });

    const totals = await recomputeItemQuantity(tx, input.itemId, locked.item.wastePercent);

    await tx.insert(auditEvents).values({
      id: randomUUID(),
      organizationId: input.organizationId,
      actorId: input.actorId,
      eventType: "takeoff.measurement_added",
      resourceType: "takeoff_measurement",
      resourceId: measurementId,
      metadata: {
        itemId: input.itemId,
        label: input.measurement.label,
        count: input.measurement.count,
        dimensions: input.measurement.dimensions,
        conversionFactor: input.measurement.conversionFactor,
        quantityGross: totals.gross,
        quantity: totals.net
      }
    });

    return { ok: true, value: { measurementId, projectId: locked.projectId, quantity: totals.net } };
  });
}

export async function removeItemMeasurement(input: {
  organizationId: string;
  measurementId: string;
  actorId: string;
}): Promise<WriteResult<{ projectId: string; quantity: string }>> {
  return getDb().transaction(async (tx) => {
    // takeoff_measurements carries no organization column either, so the item id is resolved
    // first and every check then runs through the scoped item path.
    const owner = await tx
      .select({ itemId: takeoffMeasurements.takeoffItemId, label: takeoffMeasurements.label })
      .from(takeoffMeasurements)
      .where(eq(takeoffMeasurements.id, input.measurementId))
      .limit(1);
    const found = owner[0];
    if (!found) return { ok: false, reason: "item_not_found" };

    const locked = await lockItemForMeasurement(tx, input.organizationId, found.itemId);
    if (!locked.ok) return locked;

    await tx.delete(takeoffMeasurements).where(eq(takeoffMeasurements.id, input.measurementId));
    const totals = await recomputeItemQuantity(tx, found.itemId, locked.item.wastePercent);

    await tx.insert(auditEvents).values({
      id: randomUUID(),
      organizationId: input.organizationId,
      actorId: input.actorId,
      eventType: "takeoff.measurement_removed",
      resourceType: "takeoff_measurement",
      resourceId: input.measurementId,
      metadata: { itemId: found.itemId, label: found.label, quantityGross: totals.gross, quantity: totals.net }
    });

    return { ok: true, value: { projectId: locked.projectId, quantity: totals.net } };
  });
}

/** Sets the material allowance and the source it is claimed from, then re-totals the item. */
export async function setItemWaste(input: {
  organizationId: string;
  itemId: string;
  actorId: string;
  percent: string;
  sourceNote: string | null;
}): Promise<WriteResult<{ projectId: string; quantity: string }>> {
  return getDb().transaction(async (tx) => {
    const locked = await lockItemForMeasurement(tx, input.organizationId, input.itemId);
    if (!locked.ok) return locked;

    await tx
      .update(takeoffItems)
      .set({ wastePercent: input.percent, wasteSourceNote: input.sourceNote, updatedAt: new Date() })
      .where(eq(takeoffItems.id, input.itemId));

    const totals = await recomputeItemQuantity(tx, input.itemId, input.percent);

    await tx.insert(auditEvents).values({
      id: randomUUID(),
      organizationId: input.organizationId,
      actorId: input.actorId,
      eventType: "takeoff.waste_set",
      resourceType: "takeoff_item",
      resourceId: input.itemId,
      metadata: {
        wastePercent: input.percent,
        wasteSourceNote: input.sourceNote,
        quantityGross: totals.gross,
        quantity: totals.net
      }
    });

    return { ok: true, value: { projectId: locked.projectId, quantity: totals.net } };
  });
}

export async function addItemEvidence(input: {
  organizationId: string;
  itemId: string;
  actorId: string;
  evidence: EvidenceInput;
}): Promise<WriteResult<{ evidenceId: string; projectId: string }>> {
  return getDb().transaction(async (tx) => {
    const scoped = await loadItemScoped(tx, input.organizationId, input.itemId);
    if (!scoped) return { ok: false, reason: "item_not_found" };
    if (!WRITABLE_PROJECT_STATES.has(scoped.projectState)) return { ok: false, reason: "project_not_writable" };
    if (scoped.runState !== "running") return { ok: false, reason: "run_not_open" };
    // Evidence behind a confirmed quantity must stay as it was when the quantity was accepted.
    if (scoped.item.reviewState === "confirmed") return { ok: false, reason: "item_locked" };

    const evidenceId = randomUUID();
    await tx.insert(evidenceReferences).values({
      id: evidenceId,
      takeoffItemId: input.itemId,
      pageNumber: input.evidence.pageNumber,
      note: input.evidence.note
    });

    await tx.insert(auditEvents).values({
      id: randomUUID(),
      organizationId: input.organizationId,
      actorId: input.actorId,
      eventType: "takeoff.evidence_added",
      resourceType: "evidence_reference",
      resourceId: evidenceId,
      metadata: { itemId: input.itemId, pageNumber: input.evidence.pageNumber }
    });

    return { ok: true, value: { evidenceId, projectId: scoped.projectId } };
  });
}

/**
 * Confirming a quantity is the auditable step, so the evidence count is read inside the same
 * transaction that flips the state, behind a row lock on the item. Counting first and updating
 * afterwards would let evidence be removed in between and leave a confirmed quantity with no
 * stated source.
 */
export async function confirmManualItem(input: {
  organizationId: string;
  itemId: string;
  actorId: string;
}): Promise<WriteResult<{ evidenceCount: number; projectId: string }>> {
  return getDb().transaction(async (tx) => {
    const scoped = await loadItemScoped(tx, input.organizationId, input.itemId);
    if (!scoped) return { ok: false, reason: "item_not_found" };
    if (!WRITABLE_PROJECT_STATES.has(scoped.projectState)) return { ok: false, reason: "project_not_writable" };
    if (scoped.runState !== "running") return { ok: false, reason: "run_not_open" };

    const locked = await tx
      .select({ id: takeoffItems.id, reviewState: takeoffItems.reviewState })
      .from(takeoffItems)
      .where(eq(takeoffItems.id, input.itemId))
      .limit(1)
      .for("update");
    const current = locked[0];
    if (!current) return { ok: false, reason: "item_not_found" };
    if (current.reviewState === "confirmed") return { ok: false, reason: "already_confirmed" };

    const countedEvidence = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(evidenceReferences)
      .where(eq(evidenceReferences.takeoffItemId, input.itemId));
    const evidenceCount = countedEvidence[0]?.value ?? 0;

    const countedMeasurements = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(takeoffMeasurements)
      .where(eq(takeoffMeasurements.takeoffItemId, input.itemId));
    const measurementCount = countedMeasurements[0]?.value ?? 0;

    if (itemConfirmationBlocker({ reviewState: current.reviewState, evidenceCount, measurementCount })) {
      return { ok: false, reason: measurementCount < 1 ? "measurement_required" : "evidence_required" };
    }

    await tx
      .update(takeoffItems)
      .set({ reviewState: "confirmed", updatedAt: new Date() })
      .where(eq(takeoffItems.id, input.itemId));

    await tx.insert(auditEvents).values({
      id: randomUUID(),
      organizationId: input.organizationId,
      actorId: input.actorId,
      eventType: "takeoff.item_confirmed",
      resourceType: "takeoff_item",
      resourceId: input.itemId,
      metadata: {
        runId: scoped.runId,
        unit: scoped.item.unit,
        quantity: scoped.item.quantity,
        evidenceCount
      }
    });

    return { ok: true, value: { evidenceCount, projectId: scoped.projectId } };
  });
}

/** Only an unconfirmed line can be removed; a confirmed quantity stays for the record. */
export async function removeManualItem(input: {
  organizationId: string;
  itemId: string;
  actorId: string;
}): Promise<WriteResult<{ projectId: string }>> {
  return getDb().transaction(async (tx) => {
    const scoped = await loadItemScoped(tx, input.organizationId, input.itemId);
    if (!scoped) return { ok: false, reason: "item_not_found" };
    if (!WRITABLE_PROJECT_STATES.has(scoped.projectState)) return { ok: false, reason: "project_not_writable" };
    if (scoped.runState !== "running") return { ok: false, reason: "run_not_open" };
    if (scoped.item.reviewState === "confirmed") return { ok: false, reason: "item_locked" };

    await tx.delete(takeoffItems).where(eq(takeoffItems.id, input.itemId));

    await tx.insert(auditEvents).values({
      id: randomUUID(),
      organizationId: input.organizationId,
      actorId: input.actorId,
      eventType: "takeoff.item_removed",
      resourceType: "takeoff_item",
      resourceId: input.itemId,
      metadata: {
        runId: scoped.runId,
        category: scoped.item.category,
        unit: scoped.item.unit,
        quantity: scoped.item.quantity
      }
    });

    return { ok: true, value: { projectId: scoped.projectId } };
  });
}

/**
 * Closes the run and records a hash of the confirmed lines. The hash is what later stages
 * compare against: if a stored quantity ever differs from the closed run, the estimate that
 * was priced from it is no longer the estimate in the database.
 */
export async function closeManualRun(input: {
  organizationId: string;
  runId: string;
  actorId: string;
}): Promise<WriteResult<{ outputHash: string; confirmedCount: number; unconfirmedCount: number; projectId: string }>> {
  return getDb().transaction(async (tx) => {
    const scoped = await loadRunScoped(tx, input.organizationId, input.runId);
    if (!scoped) return { ok: false, reason: "run_not_found" };
    if (!WRITABLE_PROJECT_STATES.has(scoped.projectState)) return { ok: false, reason: "project_not_writable" };
    if (scoped.run.state !== "running") return { ok: false, reason: "run_not_open" };

    const rows = await tx
      .select({
        id: takeoffItems.id,
        category: takeoffItems.category,
        description: takeoffItems.description,
        unit: takeoffItems.unit,
        quantity: takeoffItems.quantity,
        reviewState: takeoffItems.reviewState
      })
      .from(takeoffItems)
      .where(eq(takeoffItems.runId, input.runId))
      .orderBy(asc(takeoffItems.id))
      .for("update");

    const confirmed = rows.filter((row) => row.reviewState === "confirmed");
    if (confirmed.length === 0) return { ok: false, reason: "no_confirmed_items" };

    const outputHash = canonicalHash(
      confirmed.map((row) => [row.category, row.description, row.unit, row.quantity])
    );

    await tx
      .update(takeoffRuns)
      .set({ state: "succeeded", outputHash, updatedAt: new Date() })
      .where(eq(takeoffRuns.id, input.runId));

    await tx.insert(auditEvents).values({
      id: randomUUID(),
      organizationId: input.organizationId,
      actorId: input.actorId,
      eventType: "takeoff.run_closed",
      resourceType: "takeoff_run",
      resourceId: input.runId,
      metadata: {
        projectId: scoped.run.projectId,
        confirmedCount: confirmed.length,
        unconfirmedCount: rows.length - confirmed.length
      },
      afterHash: outputHash
    });

    return {
      ok: true,
      value: {
        outputHash,
        confirmedCount: confirmed.length,
        unconfirmedCount: rows.length - confirmed.length,
        projectId: scoped.run.projectId
      }
    };
  });
}
