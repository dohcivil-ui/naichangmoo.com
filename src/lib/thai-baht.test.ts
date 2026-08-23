import { describe, expect, it } from "vitest";
import {
  bahtText,
  floorToHundredBaht,
  formatBaht,
  formatSatang,
  parseBaht
} from "@/lib/thai-baht";

function satang(value: string): bigint {
  const parsed = parseBaht(value);
  if (!parsed.ok) throw new Error(`expected ${value} to parse: ${parsed.reason}`);
  return parsed.satang;
}

/**
 * The priced set for อาคารฟอกไต ปุญโญภาส, 20 มิถุนายน 2569. These are figures printed on a real
 * ปร.5(ก) and ปร.6, which is the only reason they are worth asserting.
 */
describe("reference estimate: อาคารฟอกไต ปุญโญภาส", () => {
  it("floors the computed construction cost the way the sheet prints it", () => {
    // ค่างานต้นทุน 2,529,230.20 x Factor F 1.3034 = 3,296,598.64
    const computed = satang("3296598.64");

    expect(formatSatang(floorToHundredBaht(computed))).toBe("3296500.00");
    expect(formatBaht(floorToHundredBaht(computed))).toBe("3,296,500.00");
  });

  it("spells the printed total exactly as the sheet does", () => {
    expect(bahtText(satang("3296500"))).toBe("สามล้านสองแสนเก้าหมื่นหกพันห้าร้อยบาทถ้วน");
  });

  it("keeps the material and labour totals adding to the cost of work", () => {
    const material = satang("2063850.95");
    const labour = satang("465379.25");

    expect(formatSatang(material + labour)).toBe("2529230.20");
  });
});

describe("flooring to the hundred baht", () => {
  it("drops the remainder rather than rounding it", () => {
    expect(formatSatang(floorToHundredBaht(satang("199.99")))).toBe("100.00");
    expect(formatSatang(floorToHundredBaht(satang("150")))).toBe("100.00");
    expect(formatSatang(floorToHundredBaht(satang("99.99")))).toBe("0.00");
  });

  it("leaves a figure that is already a round hundred alone", () => {
    expect(formatSatang(floorToHundredBaht(satang("3296500")))).toBe("3296500.00");
    expect(formatSatang(floorToHundredBaht(satang("0")))).toBe("0.00");
  });
});

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
