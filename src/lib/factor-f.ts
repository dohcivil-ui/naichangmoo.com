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
   * True when the cost of work sits between two printed rows, which is when the note under every
   * table calls for interpolation. `resolveFactorF` acts on it; this function only reports it.
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

/** Factor F is printed to four decimal places, and the printed figure is what a ปร.5 multiplies by. */
const FACTOR_SCALE = 10_000;

function toPrintedFactor(scaledValue: number): number {
  return Math.round(scaledValue) / FACTOR_SCALE;
}

/** Which published column a factor was read from. */
export type FactorFColumn = "with_vat" | "without_vat" | "heavy_rain_1" | "heavy_rain_2";

export type FactorFOptions = {
  /**
   * False for work funded by a loan or another source that pays no VAT, which note 2 under every
   * table sends to the "รวมในรูป Factor" column instead.
   */
  paysVat: boolean;
  /** Irrigation only: how many heavy-rain zones the work sits in. Published with VAT only. */
  heavyRainZones?: 0 | 1 | 2;
};

export type FactorFResolution = {
  /** The multiplier to apply, at the four decimals a sheet prints. */
  factor: number;
  column: FactorFColumn;
  /** Whether the factor was read off a printed step or interpolated between two of them. */
  basis: "printed_row" | "interpolated";
  row: FactorFRow;
  /** The row above, present only when the factor was interpolated. */
  nextRow?: FactorFRow;
};

function columnOf(options: FactorFOptions): FactorFColumn {
  const zones = options.heavyRainZones ?? 0;
  if (zones === 0) return options.paysVat ? "with_vat" : "without_vat";
  if (!options.paysVat) {
    // The circular publishes heavy-rain columns inclusive of VAT and no plain counterpart, so
    // there is no honest figure to return here.
    throw new Error("no heavy-rain column is published without VAT");
  }
  return zones === 1 ? "heavy_rain_1" : "heavy_rain_2";
}

function readColumn(row: FactorFRow, column: FactorFColumn): number {
  const value =
    column === "with_vat"
      ? row.factorWithVat
      : column === "without_vat"
        ? row.factor
        : column === "heavy_rain_1"
          ? row.factorHeavyRain1
          : row.factorHeavyRain2;
  if (value === undefined) throw new Error(`this table has no ${column} column`);
  return value;
}

/**
 * The Factor F that governs a cost of work, following the two notes printed under every table.
 *
 * > 1. กรณีค่างานอยู่ระหว่างช่วงของค่างานต้นทุนที่กำหนด ให้เทียบอัตราส่วนเพื่อหาค่า Factor F
 * > 2. ถ้าเป็นงานเงินกู้หรือจากแหล่งอื่นซึ่งไม่ต้องชำระภาษีมูลค่าเพิ่ม ให้ใช้ Factor F ในช่อง "รวมในรูป Factor"
 *
 * Note 1 is the reason this exists. Reaching for the row below is the easier thing to do and the
 * figure it gives is close enough to look right, which is exactly why it has to be ruled out here
 * rather than left to whoever calls this next.
 *
 * The interpolated value is rounded to the four decimals the tables are published at, because
 * that printed figure is what a ปร.5 prints in its Factor F column and multiplies each line by.
 * Carrying more precision than the sheet shows would make the sheet fail its own arithmetic check.
 *
 * One factor governs a whole section: it is chosen from the section's total cost of work, then
 * applied to every line. Choosing per line would give a total that still looks plausible.
 */
export function resolveFactorF(
  table: FactorFTable,
  costOfWorkBaht: number,
  options: FactorFOptions
): FactorFResolution {
  const column = columnOf(options);
  const { row, nextRow, betweenRows } = selectFactorFRow(table, costOfWorkBaht);

  if (!betweenRows || !nextRow) {
    return { factor: toPrintedFactor(readColumn(row, column) * FACTOR_SCALE), column, basis: "printed_row", row };
  }

  const low = Math.round(readColumn(row, column) * FACTOR_SCALE);
  const high = Math.round(readColumn(nextRow, column) * FACTOR_SCALE);
  const millions = costOfWorkBaht / 1_000_000;
  const ratio = (millions - row.costMillionBaht) / (nextRow.costMillionBaht - row.costMillionBaht);

  return { factor: toPrintedFactor(low + (high - low) * ratio), column, basis: "interpolated", row, nextRow };
}
