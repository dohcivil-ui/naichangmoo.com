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

/**
 * Display form: thousand separators, no rounding. Nothing is rounded at this stage because
 * no money is derived from it yet; when pricing arrives, rounding happens once, on the money.
 */
export function formatQuantity(value: string): string {
  const [integerPart = "0", decimalPart] = fromScaledUnits(toScaledUnits(value)).split(".");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimalPart ? `${grouped}.${decimalPart}` : grouped;
}
