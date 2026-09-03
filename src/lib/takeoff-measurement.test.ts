import { describe, expect, it } from "vitest";
import {
  DIMENSION_RANK,
  grossQuantity,
  measurementMatchesUnit,
  measurementSubtotal,
  netQuantity,
  parseMeasurementForm,
  parseWasteForm
} from "@/lib/takeoff-measurement";

type MeasurementField =
  | "label"
  | "count"
  | "dimension1"
  | "dimension2"
  | "dimension3"
  | "conversionFactor"
  | "conversionNote";

function measurementForm(values: Partial<Record<MeasurementField, string>>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) if (value !== undefined) data.set(key, value);
  return data;
}

function wasteForm(values: Partial<Record<"wastePercent" | "wasteSourceNote", string>>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) if (value !== undefined) data.set(key, value);
  return data;
}

/**
 * The worked example from the take-off reference: one isolated footing F1, 1.50 x 1.50 x 0.35 m,
 * DB12 at 0.15 both ways, 0.075 cover, 0.15 hook each end, 7% allowance on steel.
 *
 * These figures are checkable against a published document rather than against numbers we chose
 * ourselves, which is the only reason they are worth asserting.
 */
describe("reference footing F1", () => {
  it("computes the concrete volume the reference states", () => {
    const concrete = measurementSubtotal({ count: 1, dimensions: ["1.50", "1.50", "0.35"], conversionFactor: null });

    // The reference prints 0.788 cu.m, rounded for display. The stored figure stays exact.
    expect(concrete).toBe("0.7875");
  });

  it("computes the formwork area the reference states", () => {
    // Four faces of a square footing: 2(B + L) x t is 4 faces of 1.50 x 0.35.
    const formwork = measurementSubtotal({ count: 4, dimensions: ["1.50", "0.35"], conversionFactor: null });

    expect(formwork).toBe("2.1");
  });

  it("computes the rebar weight the reference states, allowance included", () => {
    // 10 bars each way, 1.50 - 2(0.075) + 2(0.15) = 1.65 m per bar, DB12 at 0.888 kg/m.
    const eachWay = { count: 10, dimensions: ["1.65"], conversionFactor: "0.888" };
    const gross = grossQuantity([eachWay, eachWay]);

    expect(gross).toBe("29.304");
    // The reference prints 31.36 kg, rounded for display.
    expect(netQuantity(gross, "7")).toBe("31.35528");
  });
});

describe("dimension rank", () => {
  it("ties the number of measured lengths to what the unit means", () => {
    expect(DIMENSION_RANK.volume).toBe(3);
    expect(DIMENSION_RANK.area).toBe(2);
    expect(DIMENSION_RANK.length).toBe(1);
    expect(DIMENSION_RANK.count).toBe(0);
    // Mass measures a length and converts through a cited weight per metre.
    expect(DIMENSION_RANK.mass).toBe(1);
  });

  it("refuses a cubic metre measured with two dimensions", () => {
    const parsed = parseMeasurementForm(
      measurementForm({ label: "F1 ฐานราก", count: "1", dimension1: "1.50", dimension2: "1.50" }),
      "cu_m"
    );

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.dimension3).toBeTruthy();
  });

  it("ignores dimensions the unit does not ask for", () => {
    const parsed = parseMeasurementForm(
      measurementForm({ label: "พื้นชั้น 2", count: "1", dimension1: "4", dimension2: "5", dimension3: "99" }),
      "sq_m"
    );

    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.dimensions).toEqual(["4", "5"]);
  });

  it("asks for no dimensions at all when the unit is a count", () => {
    const parsed = parseMeasurementForm(measurementForm({ label: "เสาเข็ม I-22", count: "48" }), "each");

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.dimensions).toEqual([]);
      expect(measurementSubtotal({ ...parsed.value, conversionFactor: null })).toBe("48");
    }
  });
});

describe("measurement line validation", () => {
  const validVolume = { label: "F1 ฐานรากมุมอาคาร", count: "6", dimension1: "1.5", dimension2: "1.5", dimension3: "0.35" };

  it("accepts a complete line and trims the label", () => {
    const parsed = parseMeasurementForm(measurementForm({ ...validVolume, label: "  F1  " }), "cu_m");

    expect(parsed).toEqual({
      ok: true,
      value: { label: "F1", count: 6, dimensions: ["1.5", "1.5", "0.35"], conversionFactor: null, conversionNote: null }
    });
  });

  it("refuses a dimension that measures nothing", () => {
    for (const bad of ["0", "-2", ""]) {
      const parsed = parseMeasurementForm(measurementForm({ ...validVolume, dimension2: bad }), "cu_m");
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.errors.dimension2).toBeTruthy();
    }
  });

  it("refuses a count that is not a whole number of elements", () => {
    for (const bad of ["0", "2.5", "-1", "", "10000"]) {
      const parsed = parseMeasurementForm(measurementForm({ ...validVolume, count: bad }), "cu_m");
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.errors.count).toBeTruthy();
    }
  });

  it("refuses a line with no element named, because a reviewer cannot find it on the drawing", () => {
    const parsed = parseMeasurementForm(measurementForm({ ...validVolume, label: "F" }), "cu_m");

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.label).toBeTruthy();
  });

  it("refuses a unit outside the closed set", () => {
    const parsed = parseMeasurementForm(measurementForm(validVolume), "ลบ.ม.");

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.unit).toBeTruthy();
  });
});

describe("mass conversion", () => {
  const rebar = { label: "F1 เหล็กล่างทิศ X", count: "10", dimension1: "1.65" };

  it("requires the weight per metre and where it came from", () => {
    const missing = parseMeasurementForm(measurementForm(rebar), "kg");

    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.errors.conversionFactor).toBeTruthy();
      expect(missing.errors.conversionNote).toBeTruthy();
    }
  });

  it("refuses a conversion factor with no stated source", () => {
    const parsed = parseMeasurementForm(
      measurementForm({ ...rebar, conversionFactor: "0.888", conversionNote: "ดู" }),
      "kg"
    );

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.conversionNote).toBeTruthy();
  });

  it("accepts a cited conversion factor", () => {
    const parsed = parseMeasurementForm(
      measurementForm({ ...rebar, conversionFactor: "0.888", conversionNote: "DB12 = 0.888 กก./ม. ตารางน้ำหนักเหล็กเสริม" }),
      "kg"
    );

    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(measurementSubtotal(parsed.value)).toBe("14.652");
  });

  it("does not accept a conversion factor on a unit that measures geometry", () => {
    const parsed = parseMeasurementForm(
      measurementForm({ label: "พื้น", count: "1", dimension1: "4", dimension2: "5", conversionFactor: "0.888" }),
      "sq_m"
    );

    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.conversionFactor).toBeNull();
  });
});

describe("material allowance", () => {
  it("needs no source when it claims nothing", () => {
    expect(parseWasteForm(wasteForm({}))).toEqual({ ok: true, percent: "0", sourceNote: null });
    expect(parseWasteForm(wasteForm({ wastePercent: "0" }))).toEqual({ ok: true, percent: "0", sourceNote: null });
  });

  it("refuses a non-zero allowance with no stated source", () => {
    const parsed = parseWasteForm(wasteForm({ wastePercent: "7" }));

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.wasteSourceNote).toBeTruthy();
  });

  it("accepts an allowance that cites where it comes from", () => {
    expect(parseWasteForm(wasteForm({ wastePercent: "7", wasteSourceNote: "หลักเกณฑ์การเผื่อวัสดุมวลรวม งานเหล็กเสริม 7%" }))).toEqual({
      ok: true,
      percent: "7",
      sourceNote: "หลักเกณฑ์การเผื่อวัสดุมวลรวม งานเหล็กเสริม 7%"
    });
  });

  it("refuses an allowance large enough to mean the unit was misread", () => {
    const parsed = parseWasteForm(wasteForm({ wastePercent: "700", wasteSourceNote: "เผื่อเยอะมาก" }));

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.wastePercent).toBeTruthy();
  });

  it("refuses an allowance that is not a number", () => {
    const parsed = parseWasteForm(wasteForm({ wastePercent: "7%", wasteSourceNote: "อ้างอิงเอกสาร" }));

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.wastePercent).toBeTruthy();
  });
});

describe("item totals", () => {
  it("totals nothing when nothing has been measured", () => {
    expect(grossQuantity([])).toBe("0");
    expect(netQuantity("0", "7")).toBe("0");
  });

  it("leaves the measured total alone when no allowance is claimed", () => {
    expect(netQuantity("29.304", "0")).toBe("29.304");
  });
});

describe("units the real sheet uses", () => {
  it("counts a bar without asking for a length, because ปร.4 prices reinforcement by the bar", () => {
    const parsed = parseMeasurementForm(measurementForm({ label: "เหล็ก DB 16 mm.", count: "344" }), "bar");

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.dimensions).toEqual([]);
      expect(measurementSubtotal({ ...parsed.value, conversionFactor: null })).toBe("344");
    }
  });

  it("counts rolls, tanks and sheets the same way", () => {
    for (const unit of ["roll", "tank", "sheet", "set", "each"]) {
      const parsed = parseMeasurementForm(measurementForm({ label: "รายการ", count: "6" }), unit);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) expect(measurementSubtotal({ ...parsed.value, conversionFactor: null })).toBe("6");
    }
  });
});

describe("lump sum", () => {
  it("is always exactly one, whatever the form sends", () => {
    const blank = parseMeasurementForm(measurementForm({ label: "ระบบกำจัดปลวก" }), "lump");
    const explicit = parseMeasurementForm(measurementForm({ label: "ระบบกำจัดปลวก", count: "1" }), "lump");

    expect(blank.ok).toBe(true);
    if (blank.ok) {
      expect(blank.value.count).toBe(1);
      expect(blank.value.dimensions).toEqual([]);
      expect(measurementSubtotal({ ...blank.value, conversionFactor: null })).toBe("1");
    }
    expect(explicit.ok).toBe(true);
  });

  it("refuses more than one, because that is a second line nobody wrote", () => {
    const parsed = parseMeasurementForm(measurementForm({ label: "งานตัวอักษรป้าย", count: "3" }), "lump");

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.count).toBeTruthy();
  });

  it("is refused on the write path too when the count is not one", () => {
    expect(measurementMatchesUnit({ count: 2, dimensions: [], conversionFactor: null }, "lump")).toBe(false);
    expect(measurementMatchesUnit({ count: 1, dimensions: [], conversionFactor: null }, "lump")).toBe(true);
  });

  /**
   * IP-234 ADR 0024 ข้อ 7 — พื้นที่ที่ได้จากการชี้บนแบบส่งมาเป็นตัวประกอบเดียว เพราะห้องที่ไล่ขอบ
   * ไม่มีกว้างกับยาว มีแต่รูปหลายเหลี่ยม · ค่าตั้งต้น typed ต้องเข้มเท่าเดิมทุกบรรทัด
   */
  it("พื้นที่จากการชี้บนแบบยอมรับตัวประกอบเดียว แต่แถวที่คนพิมพ์ยังต้องกว้างคูณยาว", () => {
    const area1 = { count: 1, dimensions: ["24.5"], conversionFactor: null };
    const area2 = { count: 1, dimensions: ["5", "4.9"], conversionFactor: null };
    expect(measurementMatchesUnit(area1, "sq_m")).toBe(false);
    expect(measurementMatchesUnit(area1, "sq_m", "typed")).toBe(false);
    expect(measurementMatchesUnit(area1, "sq_m", "pointer")).toBe(true);
    expect(measurementMatchesUnit(area1, "sq_m", "region_trace")).toBe(true);
    expect(measurementMatchesUnit(area2, "sq_m", "pointer")).toBe(true);
    expect(measurementMatchesUnit(area1, "cu_m", "pointer")).toBe(false);
    expect(measurementMatchesUnit({ count: 1, dimensions: ["5"], conversionFactor: null }, "m", "typed")).toBe(true);
    expect(measurementMatchesUnit(area1, "sq_m", "pointer_count")).toBe(false);
  });
});
