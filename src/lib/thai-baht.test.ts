import { describe, expect, it } from "vitest";
import {
  bahtText,
  floorToThousandBaht,
  formatBaht,
  parseBaht
} from "@/lib/thai-baht";

function satang(value: string): bigint {
  const parsed = parseBaht(value);
  if (!parsed.ok) throw new Error(`expected ${value} to parse: ${parsed.reason}`);
  return parsed.satang;
}

describe("reading an amount in Thai", () => {
  it("reads the single digits", () => {
    const expected = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
    expected.forEach((word, value) => expect(bahtText(satang(String(value)))).toBe(`${word}บาทถ้วน`));
  });

  it("reads the tens the way they are spoken, not the way they are written", () => {
    expect(bahtText(satang("10"))).toBe("สิบบาทถ้วน");
    expect(bahtText(satang("11"))).toBe("สิบเอ็ดบาทถ้วน");
    expect(bahtText(satang("20"))).toBe("ยี่สิบบาทถ้วน");
    expect(bahtText(satang("21"))).toBe("ยี่สิบเอ็ดบาทถ้วน");
    expect(bahtText(satang("35"))).toBe("สามสิบห้าบาทถ้วน");
    expect(bahtText(satang("101"))).toBe("หนึ่งร้อยเอ็ดบาทถ้วน");
  });

  it("skips the places that hold nothing", () => {
    expect(bahtText(satang("1000000"))).toBe("หนึ่งล้านบาทถ้วน");
    expect(bahtText(satang("1000001"))).toBe("หนึ่งล้านหนึ่งบาทถ้วน");
    expect(bahtText(satang("2000500"))).toBe("สองล้านห้าร้อยบาทถ้วน");
    expect(bahtText(satang("100000"))).toBe("หนึ่งแสนบาทถ้วน");
  });

  it("stacks millions", () => {
    expect(bahtText(satang("1000000000"))).toBe("หนึ่งพันล้านบาทถ้วน");
    expect(bahtText(satang("12000000"))).toBe("สิบสองล้านบาทถ้วน");
  });

  it("reads satang as their own number", () => {
    expect(bahtText(satang("1.50"))).toBe("หนึ่งบาทห้าสิบสตางค์");
    expect(bahtText(satang("3296598.64"))).toBe("สามล้านสองแสนเก้าหมื่นหกพันห้าร้อยเก้าสิบแปดบาทหกสิบสี่สตางค์");
    expect(bahtText(satang("0.25"))).toBe("ยี่สิบห้าสตางค์");
    expect(bahtText(satang("0"))).toBe("ศูนย์บาทถ้วน");
  });
});

/**
 * The priced set for โครงการ สตง. ภูมิภาคที่ 12 (เพชรบุรี), `km/4.แบบ ปร.4 ปร.5 ปร.6.pdf`. Its ปร.6
 * is the only sheet on hand that prints a คิดเป็น line, so it is the only evidence for the unit
 * the final ราคากลาง is floored to.
 */
describe("reference estimate: สตง. ภูมิภาคที่ 12", () => {
  it("floors the ปร.6 total to the thousand the way the sheet prints it", () => {
    // หมวด 1 อาคาร 9,534,946.00 + หมวด 2 ครุภัณฑ์ 5,613,930.48 + หมวด 3 พิเศษ 65,000.00
    const summed = satang("15213876.48");

    expect(formatBaht(summed)).toBe("15,213,876.48");
    expect(formatBaht(floorToThousandBaht(summed))).toBe("15,213,000.00");
  });

  it("drops the remainder rather than rounding it", () => {
    // 15,213,876.48 rounded to the nearest thousand would be 15,214,000.
    expect(formatBaht(floorToThousandBaht(satang("15213999.99")))).toBe("15,213,000.00");
    expect(formatBaht(floorToThousandBaht(satang("999.99")))).toBe("0.00");
    expect(formatBaht(floorToThousandBaht(satang("15213000")))).toBe("15,213,000.00");
  });

  it("spells the printed ราคากลาง", () => {
    expect(bahtText(satang("15213000"))).toBe("สิบห้าล้านสองแสนหนึ่งหมื่นสามพันบาทถ้วน");
  });

  it("leaves the ปร.5 figures alone, because only ปร.6 floors", () => {
    // ปร.5(ก) รวมค่าก่อสร้าง and ปร.5(ข) รวมค่างาน are printed as computed, satang and all.
    expect(formatBaht(satang("9534946.00"))).toBe("9,534,946.00");
    expect(formatBaht(satang("5613930.48"))).toBe("5,613,930.48");

    // Their sum plus ค่าใช้จ่ายพิเศษ is what ปร.6 floors, and nothing before it.
    const summed = satang("9534946.00") + satang("5613930.48") + satang("65000.00");
    expect(formatBaht(summed)).toBe("15,213,876.48");
    expect(formatBaht(floorToThousandBaht(summed))).toBe("15,213,000.00");
  });
});

describe("parsing a baht amount", () => {
  it("accepts what a person types", () => {
    expect(parseBaht(" 3,296,500.00 ")).toEqual({ ok: true, satang: 329650000n });
    expect(parseBaht("0.05")).toEqual({ ok: true, satang: 5n });
    expect(parseBaht("+12")).toEqual({ ok: true, satang: 1200n });
  });

  it("refuses what a money column cannot hold", () => {
    expect(parseBaht("")).toEqual({ ok: false, reason: "empty" });
    expect(parseBaht("-5")).toEqual({ ok: false, reason: "negative" });
    expect(parseBaht("1.234")).toEqual({ ok: false, reason: "too_many_decimals" });
    expect(parseBaht("12 บาท")).toEqual({ ok: false, reason: "not_a_number" });
    expect(parseBaht("1234567890123456")).toEqual({ ok: false, reason: "too_large" });
  });
});
