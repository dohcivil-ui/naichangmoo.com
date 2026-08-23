/**
 * How a baht figure is presented on a Thai government construction estimate.
 *
 * Every rule here was read off a complete priced set, never inferred.
 *
 * โครงการ สตง. ภูมิภาคที่ 12 (เพชรบุรี), `km/4.แบบ ปร.4 ปร.5 ปร.6.pdf`, is the reference set.
 * ปร.5(ก) prints รวมค่าก่อสร้าง 9,534,946.00 and ปร.5(ข) prints รวมค่างาน 5,613,930.48, both as
 * computed and neither rounded. ปร.6 adds those to ค่าใช้จ่ายพิเศษ 65,000.00 for 15,213,876.48
 * and prints คิดเป็น 15,213,000.00 underneath.
 *
 * So a ราคากลาง is floored once, at the last line of ปร.6, down to the thousand baht, and the
 * remainder is dropped rather than rounded. Nothing before that line is adjusted.
 *
 * Money is handled as satang in bigint, never as a JavaScript number. A price is the one figure
 * in this system nobody will forgive being off by a rounding error.
 */

const DIGIT_WORDS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"] as const;
const PLACE_WORDS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"] as const;

export const SATANG_SCALE = 2;
const SATANG_FACTOR = 100n;
/** ปร.6 prints คิดเป็น floored to the thousand baht; the remainder is dropped, not rounded. */
const THOUSAND_BAHT_SATANG = 1000n * SATANG_FACTOR;

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
 * The ราคากลาง as ปร.6 prints it on its คิดเป็น line, floored to the thousand baht.
 *
 * This is the only place a ราคากลาง is rounded. ปร.4 and ปร.5 carry their figures as computed,
 * satang included, and the floor applies once to their sum. It is presentation, not arithmetic:
 * the summed figure stays printed above so a reader can see what was given up — 876.48 baht on
 * the reference set. Putting the floored value in its place would hide the adjustment the form
 * exists to show, and it is the figure a procurement notice quotes, so the difference is real.
 */
export function floorToThousandBaht(satang: bigint): bigint {
  return (satang / THOUSAND_BAHT_SATANG) * THOUSAND_BAHT_SATANG;
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
