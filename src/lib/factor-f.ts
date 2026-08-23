import dataset from "@/data/factor-f/cgd-w481-be2569.json";

/**
 * Factor F is published by the Comptroller General's Department as a set of tables, one per
 * combination of work type, advance payment and retention, and every set is tied to one announced
 * loan interest rate. A table from the wrong rate produces a number that looks official and is
 * wrong, so nothing here falls back to a near-enough table: a request that does not match the
 * dataset is refused and the caller is told what the dataset actually holds.
 */

export type FactorFWorkType = "building" | "road" | "bridge_box_culvert" | "irrigation";

/** Where a row sits relative to its printed cost of work. */
export type FactorFBound = "at_or_below" | "exact" | "above";

export type FactorFRow = {
  bound: FactorFBound;
  costMillionBaht: number;
  factor: number;
  factorWithVat: number;
  /** Irrigation only: the same work in one or two heavy-rain zones. */
  factorHeavyRain1?: number;
  factorHeavyRain2?: number;
};

export type FactorFTable = {
  workType: string;
  workTypeLabel: string;
  sourcePage: number;
  advancePercent: number;
  retentionPercent: number;
  rows: FactorFRow[];
};

export type FactorFSource = typeof dataset.source;

export type FactorFQuery = {
  workType: FactorFWorkType;
  advancePercent: number;
  retentionPercent: number;
  interestPercent: number;
  vatPercent: number;
};

export type FactorFLookup =
  | { ok: true; table: FactorFTable; source: FactorFSource; reviewedBy: string | null }
  | { ok: false; reason: FactorFRefusal; detail: string };

export type FactorFRefusal =
  | "interest_rate_not_in_dataset"
  | "vat_rate_not_in_dataset"
  | "work_type_not_in_dataset"
  | "conditions_not_in_dataset";

const tables = dataset.tables as FactorFTable[];

export const factorFSource: FactorFSource = dataset.source;
export const factorFInterestPercent: number = dataset.interestPercent;
export const factorFVatPercent: number = dataset.vatPercent;
/** Null until a qualified person has checked the extraction against the circular. */
export const factorFReviewedBy: string | null = dataset.reviewedBy;

export function findFactorFTable(query: FactorFQuery): FactorFLookup {
  if (query.interestPercent !== dataset.interestPercent) {
    return {
      ok: false,
      reason: "interest_rate_not_in_dataset",
      detail: `ชุดข้อมูลนี้เป็นตารางที่อัตราดอกเบี้ยเงินกู้ ${dataset.interestPercent}% ตาม ${dataset.source.documentNumber} ลงวันที่ ${dataset.source.documentDateBE} ใช้กับโครงการที่คิดที่ ${query.interestPercent}% ไม่ได้`,
    };
  }
  if (query.vatPercent !== dataset.vatPercent) {
    return {
      ok: false,
      reason: "vat_rate_not_in_dataset",
      detail: `ชุดข้อมูลนี้คำนวณช่องรวมภาษีที่ VAT ${dataset.vatPercent}% ใช้กับ ${query.vatPercent}% ไม่ได้`,
    };
  }
  const ofType = tables.filter((table) => table.workType === query.workType);
  if (ofType.length === 0) {
    return {
      ok: false,
      reason: "work_type_not_in_dataset",
      detail: `ไม่มีตารางของงานประเภท ${query.workType} ในชุดข้อมูลนี้`,
    };
  }
  const table = ofType.find(
    (candidate) =>
      candidate.advancePercent === query.advancePercent &&
      candidate.retentionPercent === query.retentionPercent
  );
  if (!table) {
    const available = ofType
      .map((candidate) => `${candidate.advancePercent}/${candidate.retentionPercent}`)
      .join(", ");
    return {
      ok: false,
      reason: "conditions_not_in_dataset",
      detail: `ไม่มีตารางสำหรับเงินล่วงหน้า ${query.advancePercent}% และเงินประกันผลงาน ${query.retentionPercent}% ที่มีคือ ${available}`,
    };
  }
  return { ok: true, table, source: dataset.source, reviewedBy: dataset.reviewedBy };
}

export type FactorFSelection = {
  /** The row whose printed cost of work governs this estimate. */
  row: FactorFRow;
  /** The next row up, present only when the cost of work falls between two printed rows. */
  nextRow?: FactorFRow;
  /**
   * True when the cost of work sits between two printed rows. The note under every table says to
   * interpolate, while the real ปร.4 checked against this dataset used the lower row as printed.
   * The difference is real money, so this flag is surfaced rather than resolved here.
   */
  betweenRows: boolean;
};

export function selectFactorFRow(table: FactorFTable, costOfWorkBaht: number): FactorFSelection {
  if (!(costOfWorkBaht > 0)) {
    throw new Error("costOfWorkBaht must be positive");
  }
  const millions = costOfWorkBaht / 1_000_000;
  const rows = table.rows;

  const first = rows[0];
  if (first.bound === "at_or_below" && millions <= first.costMillionBaht) {
    return { row: first, betweenRows: false };
  }
  const last = rows[rows.length - 1];
  if (last.bound === "above" && millions > last.costMillionBaht) {
    return { row: last, betweenRows: false };
  }

  let index = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.bound === "above") continue;
    if (millions >= row.costMillionBaht) index = i;
  }
  // Below the first printed step but above nothing: the lowest row governs.
  if (index < 0) return { row: first, betweenRows: false };

  const row = rows[index];
  const nextRow = rows.slice(index + 1).find((candidate) => candidate.bound !== "above");
  const exact = millions === row.costMillionBaht;
  return { row, ...(nextRow && !exact ? { nextRow } : {}), betweenRows: !exact && Boolean(nextRow) };
}
