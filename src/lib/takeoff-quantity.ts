/**
 * Quantity arithmetic for take-off items.
 *
 * Quantities are handled as decimal strings and summed as scaled integers, never as
 * JavaScript numbers: 0.1 + 0.2 must not turn a bill of quantities into 0.30000000000000004.
 * The scale matches takeoff_items.quantity, which is numeric(18, 6).
 */

export const QUANTITY_SCALE = 6;
const MAX_INTEGER_DIGITS = 18 - QUANTITY_SCALE;
const SCALE_FACTOR = 10n ** BigInt(QUANTITY_SCALE);

export type QuantityRejection = "empty" | "not_a_number" | "not_positive" | "too_many_decimals" | "too_large";

export type QuantityParseResult = { ok: true; canonical: string } | { ok: false; reason: QuantityRejection };

/**
 * Accepts what a person types (thousand separators, spaces, a leading plus) and returns a
 * canonical decimal string, or the reason it was refused. Zero and negative quantities are
 * refused: a take-off line that measures nothing is a mistake, not a measurement.
 */
export function parseQuantity(raw: string): QuantityParseResult {
  const cleaned = raw.trim().replace(/,/g, "").replace(/^\+/, "");
  if (cleaned === "") return { ok: false, reason: "empty" };
  if (!/^\d*(\.\d*)?$/.test(cleaned) || cleaned === "." ) {
    return { ok: false, reason: /^-/.test(cleaned) ? "not_positive" : "not_a_number" };
  }

  const [integerPart = "", decimalPart = ""] = cleaned.split(".");
  if (decimalPart.length > QUANTITY_SCALE) return { ok: false, reason: "too_many_decimals" };

  const integerDigits = integerPart.replace(/^0+/, "");
  if (integerDigits.length > MAX_INTEGER_DIGITS) return { ok: false, reason: "too_large" };

  const canonical = `${integerDigits === "" ? "0" : integerDigits}${decimalPart ? `.${decimalPart}` : ""}`;
  if (toScaledUnits(canonical) <= 0n) return { ok: false, reason: "not_positive" };

  return { ok: true, canonical };
}

/** Decimal string to integer units of 1e-6. Throws on anything the parser would refuse. */
export function toScaledUnits(value: string): bigint {
  const [integerPart = "0", decimalPart = ""] = value.trim().split(".");
  if (!/^\d+$/.test(integerPart) || (decimalPart !== "" && !/^\d+$/.test(decimalPart))) {
    throw new Error(`quantity is not a plain decimal string: ${value}`);
  }
  const padded = decimalPart.padEnd(QUANTITY_SCALE, "0").slice(0, QUANTITY_SCALE);
  return BigInt(integerPart) * SCALE_FACTOR + BigInt(padded === "" ? "0" : padded);
}

export function fromScaledUnits(units: bigint): string {
  const integerPart = units / SCALE_FACTOR;
  const fraction = (units % SCALE_FACTOR).toString().padStart(QUANTITY_SCALE, "0").replace(/0+$/, "");
  return fraction === "" ? integerPart.toString() : `${integerPart}.${fraction}`;
}

/** Exact sum. Values must share a dimension; that check belongs to the caller. */
export function sumQuantities(values: readonly string[]): string {
  return fromScaledUnits(values.reduce((total, value) => total + toScaledUnits(value), 0n));
}

/** Half-up division for non-negative integers. Quantities are never negative here. */
function divideRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  return (numerator % denominator) * 2n >= denominator ? quotient + 1n : quotient;
}

/**
 * Exact product, rounded half-up to QUANTITY_SCALE once at the very end.
 *
 * A take-off line is a product of factors read off a drawing: count x width x length x
 * thickness. Rounding after each multiplication would let the error compound with the number
 * of factors, so the product is carried at full integer precision and rounded a single time.
 * The factors carry different physical meanings; whether their product lands in the item's
 * unit is the caller's responsibility.
 */
export function multiplyQuantities(values: readonly string[]): string {
  if (values.length === 0) throw new Error("multiplyQuantities needs at least one factor");
  const product = values.reduce((total, value) => total * toScaledUnits(value), 1n);
  // Every factor contributed one SCALE_FACTOR. Keep one and divide the surplus away.
  return fromScaledUnits(divideRoundHalfUp(product, SCALE_FACTOR ** BigInt(values.length - 1)));
}

/**
 * Adds a percentage of a quantity to itself, for material allowance (ค่าเผื่อ).
 *
 * Waste is applied to the measured total rather than to each line, because the allowance is a
 * property of the material and the work, not of any one element that was measured.
 */
export function increaseByPercent(value: string, percent: string): string {
  const hundred = 100n * SCALE_FACTOR;
  const multiplier = hundred + toScaledUnits(percent);
  return fromScaledUnits(divideRoundHalfUp(toScaledUnits(value) * multiplier, hundred));
}

/**
 * Display form: thousand separators, no rounding. Nothing is rounded at this stage because
 * no money is derived from it yet; when pricing arrives, rounding happens once, on the money.
 */
export function formatQuantity(value: string): string {
  const [integerPart = "0", decimalPart] = fromScaledUnits(toScaledUnits(value)).split(".");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimalPart ? `${grouped}.${decimalPart}` : grouped;
}

/** ทศนิยมของปริมาณที่ขึ้นใบราคา สองตำแหน่งเท่ากับที่ใบ ปร.4 พิมพ์ */
export const PRICED_QUANTITY_SCALE = 2;
const PRICED_FACTOR = 10n ** BigInt(QUANTITY_SCALE - PRICED_QUANTITY_SCALE);

/**
 * ปัดปริมาณเหลือสองตำแหน่งแบบครึ่งขึ้น สำหรับตอนที่ปริมาณกลายเป็นบรรทัดที่มีราคา
 *
 * หน้าถอดปริมาณคิดละเอียดถึงหกตำแหน่ง เพราะบรรทัดหนึ่งคือ จำนวน คูณ กว้าง คูณ ยาว คูณ หนา
 * ที่ปัดครั้งเดียวตอนจบ แต่ **ใบที่มีราคาต้องบวกตรงกับที่ตาเห็น** ถ้าใบพิมพ์ 10.80 แล้วระบบ
 * คิดด้วย 10.804 คนที่เอาราคาต่อหน่วยคูณเลขที่เห็นจะได้ยอดไม่ตรงกับที่ระบบขึ้น และนั่นคือ
 * ความผิดพลาดชนิดที่ทุกตัวเลขยังดูสมเหตุสมผล จุดปัดจึงอยู่ตรงที่ปริมาณเข้าสู่บรรทัดราคา
 * ไม่ใช่ตอนแสดงผล
 */
export function roundPricedQuantity(value: string): string {
  return fromScaledUnits(divideRoundHalfUp(toScaledUnits(value), PRICED_FACTOR) * PRICED_FACTOR);
}

/** ปริมาณบนใบที่มีราคา สองตำแหน่งเสมอ แม้ลงตัวพอดี เพื่อให้คอลัมน์อ่านเป็นแนวเดียวกัน */
export function formatPricedQuantity(value: string): string {
  const [integerPart = "0", decimalPart = ""] = roundPricedQuantity(value).split(".");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${grouped}.${decimalPart.padEnd(PRICED_QUANTITY_SCALE, "0")}`;
}
