/**
 * How a baht figure is presented on a Thai government construction estimate.
 *
 * Both rules here were read off a complete priced set: อาคารฟอกไต ปุญโญภาส, priced 20 มิถุนายน
 * 2569. ปร.5(ก) carries ค่างานต้นทุน 2,529,230.20 × Factor F 1.3034 = 3,296,598.64, prints
 * ยอดสุทธิ 3,296,500.00 beneath it, and spells that figure out as
 * "(สามล้านสองแสนเก้าหมื่นหกพันห้าร้อยบาทถ้วน)". Neither the flooring nor the wording is
 * decoration: the form is read by people who check the words against the digits.
 *
 * Money is handled as satang in bigint, never as a JavaScript number. A price is the one figure
 * in this system nobody will forgive being off by a rounding error.
 */

const DIGIT_WORDS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"] as const;
const PLACE_WORDS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"] as const;

export const SATANG_SCALE = 2;
const SATANG_FACTOR = 100n;
/** ราคากลาง is presented floored to the hundred baht; the remainder is dropped, not rounded. */
const ROUNDING_UNIT_SATANG = 100n * SATANG_FACTOR;

export type BahtRejection = "empty" | "not_a_number" | "negative" | "too_many_decimals" | "too_large";

export type BahtParseResult = { ok: true; satang: bigint } | { ok: false; reason: BahtRejection };

const MAX_BAHT_DIGITS = 15;

/** Reads a baht amount written as a plain decimal string into satang. */
export function parseBaht(raw: string): BahtParseResult {
  const cleaned = raw.trim().replace(/,/g, "").replace(/^\+/, "");
  if (cleaned === "") return { ok: false, reason: "empty" };
  if (/^-/.test(cleaned)) return { ok: false, reason: "negative" };
  if (!/^\d*(\.\d*)?$/.test(cleaned) || cleaned === ".") return { ok: false, reason: "not_a_number" };

  const [integerPart = "", decimalPart = ""] = cleaned.split(".");
  if (decimalPart.length > SATANG_SCALE) return { ok: false, reason: "too_many_decimals" };
  if (integerPart.replace(/^0+/, "").length > MAX_BAHT_DIGITS) return { ok: false, reason: "too_large" };

  const baht = BigInt(integerPart === "" ? "0" : integerPart);
  const satang = BigInt(decimalPart.padEnd(SATANG_SCALE, "0"));
  return { ok: true, satang: baht * SATANG_FACTOR + satang };
}

/** Satang back to a plain decimal string with both places, the form a money column prints. */
export function formatSatang(satang: bigint): string {
  const baht = satang / SATANG_FACTOR;
  const remainder = (satang % SATANG_FACTOR).toString().padStart(SATANG_SCALE, "0");
  return `${baht}.${remainder}`;
}

/** Thousand separators on top of the two decimal places. */
export function formatBaht(satang: bigint): string {
  const [integerPart = "0", decimalPart = "00"] = formatSatang(satang).split(".");
  return `${integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${decimalPart}`;
}

/**
 * Drops everything below the hundred baht.
 *
 * This is a presentation rule of the ราคากลาง sheet, not arithmetic: the computed figure stays
 * on ปร.5 as ค่าก่อสร้าง and the floored one is printed beneath it as ยอดสุทธิ, so a reader can
 * see exactly what was given up. Applying it silently in place of the computed figure would hide
 * the adjustment the form is designed to show.
 */
export function floorToHundredBaht(satang: bigint): bigint {
  return (satang / ROUNDING_UNIT_SATANG) * ROUNDING_UNIT_SATANG;
}

/** Reads a group of at most six digits, the span between one ล้าน and the next. */
function readBelowMillion(value: bigint): string {
  const digits = value.toString().split("").map(Number);
  const width = digits.length;
  let words = "";

  digits.forEach((digit, index) => {
    if (digit === 0) return;
    const place = width - index - 1;
    if (place === 1) {
      words += digit === 1 ? "สิบ" : digit === 2 ? "ยี่สิบ" : `${DIGIT_WORDS[digit]}สิบ`;
      return;
    }
    // A trailing one is เอ็ด, but only when something precedes it: 1 is หนึ่ง, 21 is ยี่สิบเอ็ด.
    if (place === 0 && digit === 1 && width > 1) {
      words += "เอ็ด";
      return;
    }
    words += `${DIGIT_WORDS[digit]}${PLACE_WORDS[place]}`;
  });

  return words;
}

function readWholeNumber(value: bigint): string {
  if (value === 0n) return DIGIT_WORDS[0];
  const million = 1000000n;
  if (value < million) return readBelowMillion(value);
  // Thai stacks millions: 3,296,500 is สาม ล้าน then the rest read on its own.
  return `${readWholeNumber(value / million)}ล้าน${value % million === 0n ? "" : readBelowMillion(value % million)}`;
}

/**
 * The amount in Thai words, as it is printed in parentheses beneath the figure.
 *
 * A whole-baht amount ends in บาทถ้วน; satang are read as their own two-digit number followed by
 * สตางค์. An amount of satang alone omits the baht entirely, which is how a person would say it.
 */
export function bahtText(satang: bigint): string {
  if (satang < 0n) throw new Error("bahtText does not read a negative amount");

  const baht = satang / SATANG_FACTOR;
  const remainder = satang % SATANG_FACTOR;

  if (baht === 0n && remainder === 0n) return "ศูนย์บาทถ้วน";
  if (baht === 0n) return `${readBelowMillion(remainder)}สตางค์`;
  if (remainder === 0n) return `${readWholeNumber(baht)}บาทถ้วน`;
  return `${readWholeNumber(baht)}บาท${readBelowMillion(remainder)}สตางค์`;
}
