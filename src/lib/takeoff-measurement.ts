import { increaseByPercent, multiplyQuantities, parseQuantity, sumQuantities } from "@/lib/takeoff-quantity";
import { findUnit, type QuantityDimension } from "@/lib/takeoff-units";

export const LABEL_MIN = 2;
export const LABEL_MAX = 120;
export const CONVERSION_NOTE_MIN = 5;
export const CONVERSION_NOTE_MAX = 300;
export const WASTE_SOURCE_MIN = 5;
export const WASTE_SOURCE_MAX = 300;
export const MAX_COUNT = 9999;
export const MAX_WASTE_PERCENT = 100;

/**
 * How many length factors a measurement line must carry, decided by the unit's dimension.
 *
 * This is the check that stops a cubic metre from being "measured" with two numbers. Mass sits
 * at one because steel weight is not read off the drawing as a volume: the drawing gives a
 * length, and the weight follows from a published weight-per-metre figure that the line has to
 * cite. Deriving mass from a volume and a density is a different method and is not offered
 * here, so a mass line always measures a length.
 */
export const DIMENSION_RANK: Record<QuantityDimension, number> = {
  volume: 3,
  area: 2,
  length: 1,
  mass: 1,
  count: 0
};

export const DIMENSION_LABELS: Record<QuantityDimension, readonly string[]> = {
  volume: ["กว้าง (ม.)", "ยาว (ม.)", "หนา/สูง (ม.)"],
  area: ["กว้าง (ม.)", "ยาว (ม.)"],
  length: ["ยาว (ม.)"],
  mass: ["ความยาวรวม (ม.)"],
  count: []
};

export type MeasurementInput = {
  label: string;
  count: number;
  dimensions: string[];
  conversionFactor: string | null;
  conversionNote: string | null;
};

export type MeasurementFieldErrors = Partial<
  Record<"label" | "count" | "dimension1" | "dimension2" | "dimension3" | "conversionFactor" | "conversionNote" | "unit", string>
>;

export type MeasurementParseResult =
  | { ok: true; value: MeasurementInput }
  | { ok: false; errors: MeasurementFieldErrors };

const dimensionFields = ["dimension1", "dimension2", "dimension3"] as const;

function dimensionMessage(reason: string, label: string): string {
  switch (reason) {
    case "empty":
      return `กรอก${label}`;
    case "not_positive":
      return `${label} ต้องมากกว่าศูนย์ ระยะที่วัดได้ศูนย์คือความผิดพลาด ไม่ใช่การวัด`;
    case "too_many_decimals":
      return `${label} เก็บทศนิยมได้ไม่เกิน 6 ตำแหน่ง`;
    case "too_large":
      return `${label} เกินค่าที่ระบบเก็บได้ ตรวจหน่วยที่ใช้อีกครั้ง`;
    default:
      return `${label} ต้องเป็นตัวเลข เช่น 1.50`;
  }
}

/**
 * Reads one measurement line for an item whose unit is already known.
 *
 * The unit is passed in rather than read from the form because it belongs to the item: letting
 * a line declare its own unit would allow two lines measuring different things to be summed.
 */
export function parseMeasurementForm(formData: FormData, unitCode: string): MeasurementParseResult {
  const errors: MeasurementFieldErrors = {};

  const unit = findUnit(unitCode);
  if (!unit) return { ok: false, errors: { unit: "หน่วยของรายการนี้ไม่อยู่ในรายการที่ระบบรู้จัก" } };

  const rank = DIMENSION_RANK[unit.dimension];
  const labels = DIMENSION_LABELS[unit.dimension];

  const label = String(formData.get("label") ?? "").trim();
  if (label.length < LABEL_MIN) {
    errors.label = "ระบุชิ้นงานที่วัด เช่น F1 ฐานรากมุมอาคาร";
  } else if (label.length > LABEL_MAX) {
    errors.label = `ชื่อชิ้นงานยาวได้ไม่เกิน ${LABEL_MAX} ตัวอักษร`;
  } else if (/[\u0000-\u001f\u007f]/.test(label)) {
    errors.label = "ชื่อชิ้นงานต้องเป็นข้อความบรรทัดเดียว";
  }

  const countRaw = String(formData.get("count") ?? "").trim();
  const count = Number(countRaw);
  if (countRaw === "" || !Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    errors.count = `จำนวนต้องเป็นจำนวนเต็ม 1 ถึง ${MAX_COUNT}`;
  }

  const dimensions: string[] = [];
  for (let index = 0; index < rank; index += 1) {
    const field = dimensionFields[index];
    const parsed = parseQuantity(String(formData.get(field) ?? ""));
    if (parsed.ok) dimensions.push(parsed.canonical);
    else errors[field] = dimensionMessage(parsed.reason, labels[index] ?? "ระยะ");
  }

  let conversionFactor: string | null = null;
  let conversionNote: string | null = null;
  if (unit.dimension === "mass") {
    const parsed = parseQuantity(String(formData.get("conversionFactor") ?? ""));
    if (parsed.ok) conversionFactor = parsed.canonical;
    else errors.conversionFactor = dimensionMessage(parsed.reason, `น้ำหนักต่อเมตร (${unit.label}/ม.)`);

    const note = String(formData.get("conversionNote") ?? "").trim();
    if (note.length < CONVERSION_NOTE_MIN) {
      errors.conversionNote = "ระบุที่มาของน้ำหนักต่อเมตร เช่น DB12 = 0.888 กก./ม. จากตารางเหล็กเสริม";
    } else if (note.length > CONVERSION_NOTE_MAX) {
      errors.conversionNote = `ข้อความยาวได้ไม่เกิน ${CONVERSION_NOTE_MAX} ตัวอักษร`;
    } else {
      conversionNote = note;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { label, count, dimensions, conversionFactor, conversionNote } };
}

export type MeasurementFactors = {
  count: number;
  dimensions: readonly string[];
  conversionFactor: string | null;
};

/** The quantity one measured element contributes, in the item's unit. */
export function measurementSubtotal(line: MeasurementFactors): string {
  const factors = [String(line.count), ...line.dimensions];
  if (line.conversionFactor !== null) factors.push(line.conversionFactor);
  return multiplyQuantities(factors);
}

/** The measured total before any material allowance. */
export function grossQuantity(lines: readonly MeasurementFactors[]): string {
  if (lines.length === 0) return "0";
  return sumQuantities(lines.map(measurementSubtotal));
}

/** The quantity that goes on the bill: the measured total plus its stated allowance. */
export function netQuantity(gross: string, wastePercent: string): string {
  return increaseByPercent(gross, wastePercent);
}

export type WasteRejection = "not_a_number" | "negative" | "too_large" | "too_many_decimals";

export type WasteParseResult =
  | { ok: true; percent: string; sourceNote: string | null }
  | { ok: false; errors: Partial<Record<"wastePercent" | "wasteSourceNote", string>> };

/**
 * Reads a material allowance and the source it is claimed from.
 *
 * An allowance silently baked into a quantity is indistinguishable from a measuring error, so
 * any non-zero percentage has to say where it comes from. Zero needs no source: it claims
 * nothing.
 */
export function parseWasteForm(formData: FormData): WasteParseResult {
  const errors: Partial<Record<"wastePercent" | "wasteSourceNote", string>> = {};

  const raw = String(formData.get("wastePercent") ?? "").trim().replace(/,/g, "").replace(/^\+/, "");
  let percent = "0";
  if (raw !== "") {
    if (!/^\d*(\.\d*)?$/.test(raw) || raw === ".") {
      errors.wastePercent = "ค่าเผื่อต้องเป็นตัวเลข เช่น 7 หรือ 2.5";
    } else if ((raw.split(".")[1] ?? "").length > 6) {
      errors.wastePercent = "ค่าเผื่อเก็บทศนิยมได้ไม่เกิน 6 ตำแหน่ง";
    } else if (Number(raw) > MAX_WASTE_PERCENT) {
      errors.wastePercent = `ค่าเผื่อเกิน ${MAX_WASTE_PERCENT}% เกือบทุกครั้งแปลว่ากรอกผิดหน่วย ไม่ใช่เผื่อจริง`;
    } else {
      percent = raw;
    }
  }

  const note = String(formData.get("wasteSourceNote") ?? "").trim();
  const wantsWaste = percent !== "0" && Number(percent) !== 0;
  let sourceNote: string | null = note === "" ? null : note;

  if (wantsWaste) {
    if (note.length < WASTE_SOURCE_MIN) {
      errors.wasteSourceNote = "ระบุที่มาของค่าเผื่อ เช่น หลักเกณฑ์การเผื่อวัสดุมวลรวม งานเหล็กเสริม 7%";
    } else if (note.length > WASTE_SOURCE_MAX) {
      errors.wasteSourceNote = `ข้อความยาวได้ไม่เกิน ${WASTE_SOURCE_MAX} ตัวอักษร`;
    }
  } else {
    sourceNote = null;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, percent, sourceNote };
}

/**
 * Whether a parsed line still matches the unit it is about to be stored against.
 *
 * The form parser already enforces this, but the parser runs on input the browser sent. The
 * write path checks it again against the unit read from the database, so a line can never be
 * stored with the wrong number of factors by posting to the action directly.
 */
export function measurementMatchesUnit(line: MeasurementFactors & { conversionNote?: string | null }, unitCode: string): boolean {
  const unit = findUnit(unitCode);
  if (!unit) return false;
  if (line.dimensions.length !== DIMENSION_RANK[unit.dimension]) return false;
  if (unit.dimension === "mass") return line.conversionFactor !== null;
  return line.conversionFactor === null;
}
