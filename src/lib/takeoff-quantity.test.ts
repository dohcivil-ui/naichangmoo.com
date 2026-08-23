import { describe, expect, it } from "vitest";
import {
  formatQuantity,
  fromScaledUnits,
  parseQuantity,
  sumQuantities,
  toScaledUnits
} from "@/lib/takeoff-quantity";

describe("quantity parsing", () => {
  it("accepts what a person actually types", () => {
    expect(parseQuantity("12.5")).toEqual({ ok: true, canonical: "12.5" });
    expect(parseQuantity(" 1,250 ")).toEqual({ ok: true, canonical: "1250" });
    expect(parseQuantity("+8")).toEqual({ ok: true, canonical: "8" });
    expect(parseQuantity("0.000001")).toEqual({ ok: true, canonical: "0.000001" });
    expect(parseQuantity("007.50")).toEqual({ ok: true, canonical: "7.50" });
  });

  it("refuses a quantity that measures nothing", () => {
    expect(parseQuantity("0")).toEqual({ ok: false, reason: "not_positive" });
    expect(parseQuantity("0.000000")).toEqual({ ok: false, reason: "not_positive" });
    expect(parseQuantity("-5")).toEqual({ ok: false, reason: "not_positive" });
    expect(parseQuantity("")).toEqual({ ok: false, reason: "empty" });
  });

  it("refuses input the column cannot hold", () => {
    // takeoff_items.quantity is numeric(18, 6): 12 integer digits and 6 decimals.
    expect(parseQuantity("1.1234567")).toEqual({ ok: false, reason: "too_many_decimals" });
    expect(parseQuantity("1234567890123")).toEqual({ ok: false, reason: "too_large" });
    expect(parseQuantity("999999999999.999999").ok).toBe(true);
  });

  it("refuses anything that is not a plain decimal", () => {
    for (const value of ["12.5.5", "1e6", "12 ม.", "abc", "."]) {
      expect(parseQuantity(value).ok).toBe(false);
    }
  });
});

describe("quantity arithmetic", () => {
  it("adds decimals exactly, unlike floating point", () => {
    // 0.1 + 0.2 in IEEE 754 is 0.30000000000000004; a bill of quantities cannot carry that.
    expect(sumQuantities(["0.1", "0.2"])).toBe("0.3");
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it("keeps six decimals through a scale round trip", () => {
    expect(toScaledUnits("12.345678")).toBe(12345678n);
    expect(fromScaledUnits(12345678n)).toBe("12.345678");
    expect(fromScaledUnits(toScaledUnits("1000"))).toBe("1000");
  });

  it("sums a realistic concrete take-off", () => {
    // Beams 0.20 x 0.40 x 6.00 m, four of them: 4 x 0.48 = 1.92 cu.m by hand.
    const beams = ["0.48", "0.48", "0.48", "0.48"];
    expect(sumQuantities(beams)).toBe("1.92");
    expect(sumQuantities([...beams, "18.75", "6.125"])).toBe("26.795");
  });

  it("returns zero for an empty list rather than throwing", () => {
    expect(sumQuantities([])).toBe("0");
  });

  it("formats with thousand separators and no rounding", () => {
    expect(formatQuantity("1234567.5")).toBe("1,234,567.5");
    expect(formatQuantity("0.000001")).toBe("0.000001");
    expect(formatQuantity("1000")).toBe("1,000");
  });
});
