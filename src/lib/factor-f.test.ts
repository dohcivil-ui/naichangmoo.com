import { describe, expect, it } from "vitest";
import {
  factorFInterestPercent,
  factorFReviewedBy,
  factorFSource,
  factorFVatPercent,
  findFactorFTable,
  resolveFactorF,
  selectFactorFRow,
  type FactorFWorkType,
} from "@/lib/factor-f";

const WORK_TYPES: FactorFWorkType[] = ["building", "road", "bridge_box_culvert", "irrigation"];
const PAIRS = [
  [0, 0], [0, 5], [0, 10],
  [5, 0], [5, 5], [5, 10],
  [10, 0], [10, 5], [10, 10],
  [15, 0], [15, 5], [15, 10],
];

const query = (over: Partial<Parameters<typeof findFactorFTable>[0]> = {}) => ({
  workType: "building" as FactorFWorkType,
  advancePercent: 0,
  retentionPercent: 0,
  interestPercent: 6,
  vatPercent: 7,
  ...over,
});

describe("Factor F dataset provenance", () => {
  it("names the circular it came from, with the checksum of the file", () => {
    expect(factorFSource.documentNumber).toBe("กค 0433.2/ว 481");
    expect(factorFSource.documentDateBE).toBe("2569-06-26");
    expect(factorFSource.issuer).toBe("กรมบัญชีกลาง");
    expect(factorFSource.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("records how the rate was arrived at, not only the rate", () => {
    expect(factorFSource.rateBasis.averageMlrPercent).toBe(6.38);
    expect(factorFSource.rateBasis.announcedInterestPercent).toBe(6);
    expect(factorFSource.rateBasis.banks).toHaveLength(4);
    expect(factorFInterestPercent).toBe(6);
    expect(factorFVatPercent).toBe(7);
  });

  it("has no reviewer yet, and says so rather than implying one", () => {
    expect(factorFReviewedBy).toBeNull();
  });
});

describe("Factor F table coverage", () => {
  it("carries all twelve advance and retention combinations for every work type", () => {
    for (const workType of WORK_TYPES) {
      for (const [advancePercent, retentionPercent] of PAIRS) {
        const found = findFactorFTable(query({ workType, advancePercent, retentionPercent }));
        expect(found.ok, `${workType} ${advancePercent}/${retentionPercent}`).toBe(true);
      }
    }
  });

  it("keeps the VAT column equal to the factor column plus VAT", () => {
    for (const workType of WORK_TYPES) {
      const found = findFactorFTable(query({ workType }));
      if (!found.ok) throw new Error(found.detail);
      for (const row of found.table.rows) {
        expect(Math.abs(row.factor * 1.07 - row.factorWithVat)).toBeLessThan(0.0002);
      }
    }
  });

  it("gives irrigation two heavy-rain columns above the plain one", () => {
    const found = findFactorFTable(query({ workType: "irrigation" }));
    if (!found.ok) throw new Error(found.detail);
    for (const row of found.table.rows) {
      expect(row.factorHeavyRain1).toBeGreaterThan(row.factorWithVat);
      expect(row.factorHeavyRain2).toBeGreaterThan(row.factorHeavyRain1!);
    }
  });
});

describe("Factor F refuses a table it does not have", () => {
  it("refuses a project priced on a different loan interest rate", () => {
    const found = findFactorFTable(query({ interestPercent: 7 }));
    expect(found.ok).toBe(false);
    if (found.ok) return;
    expect(found.reason).toBe("interest_rate_not_in_dataset");
    expect(found.detail).toContain("ว 481");
  });

  it("refuses a different VAT rate rather than reusing the printed column", () => {
    const found = findFactorFTable(query({ vatPercent: 10 }));
    expect(found.ok).toBe(false);
    if (found.ok) return;
    expect(found.reason).toBe("vat_rate_not_in_dataset");
  });

  it("refuses conditions the circular does not publish, and lists what it has", () => {
    const found = findFactorFTable(query({ advancePercent: 20, retentionPercent: 0 }));
    expect(found.ok).toBe(false);
    if (found.ok) return;
    expect(found.reason).toBe("conditions_not_in_dataset");
    expect(found.detail).toContain("15/10");
  });
});

describe("Selecting the row that governs a cost of work", () => {
  const buildingZeroZero = () => {
    const found = findFactorFTable(query());
    if (!found.ok) throw new Error(found.detail);
    return found.table;
  };

  it("finds the printed rows a cost of work falls between", () => {
    const selection = selectFactorFRow(buildingZeroZero(), 2_529_230.2);
    expect(selection.row.costMillionBaht).toBe(2);
    expect(selection.row.factorWithVat).toBe(1.3034);
    expect(selection.nextRow?.costMillionBaht).toBe(5);
    expect(selection.nextRow?.factorWithVat).toBe(1.3002);
    expect(selection.betweenRows).toBe(true);
  });

  it("does not flag a cost of work that lands exactly on a printed row", () => {
    const selection = selectFactorFRow(buildingZeroZero(), 5_000_000);
    expect(selection.row.costMillionBaht).toBe(5);
    expect(selection.betweenRows).toBe(false);
    expect(selection.nextRow).toBeUndefined();
  });

  it("uses the lowest row at or below its bound, and the open row above the last one", () => {
    const table = buildingZeroZero();
    const small = selectFactorFRow(table, 250_000);
    expect(small.row.bound).toBe("at_or_below");
    expect(small.row.costMillionBaht).toBe(0.5);
    expect(small.betweenRows).toBe(false);

    const huge = selectFactorFRow(table, 900_000_000);
    expect(huge.row.bound).toBe("above");
    expect(huge.row.costMillionBaht).toBe(500);
  });

  it("refuses a cost of work that is not positive", () => {
    expect(() => selectFactorFRow(buildingZeroZero(), 0)).toThrow();
  });
});

/**
 * The two notes printed under every table in ว481.
 *
 * > 1. กรณีค่างานอยู่ระหว่างช่วงของค่างานต้นทุนที่กำหนด ให้เทียบอัตราส่วนเพื่อหาค่า Factor F
 * > 2. ถ้าเป็นงานเงินกู้หรือจากแหล่งอื่นซึ่งไม่ต้องชำระภาษีมูลค่าเพิ่ม ให้ใช้ Factor F ในช่อง "รวมในรูป Factor"
 */
describe("Resolving Factor F the way the circular directs", () => {
  const buildingZeroZero = () => {
    const found = findFactorFTable(query());
    if (!found.ok) throw new Error(found.detail);
    return found.table;
  };

  it("interpolates between the printed steps rather than taking the row below", () => {
    // 2,529,230.20 sits between the 2M step (1.3034) and the 5M step (1.3002).
    const resolved = resolveFactorF(buildingZeroZero(), 2_529_230.2, { paysVat: true });

    expect(resolved.basis).toBe("interpolated");
    expect(resolved.factor).toBe(1.3028);
    expect(resolved.factor).toBeLessThan(resolved.row.factorWithVat);
    expect(resolved.row.costMillionBaht).toBe(2);
    expect(resolved.nextRow?.costMillionBaht).toBe(5);
  });

  it("costs a section less than the row below would, which is the point of note 1", () => {
    const costOfWork = 2_529_230.2;
    const resolved = resolveFactorF(buildingZeroZero(), costOfWork, { paysVat: true });

    const byNote = Math.round(costOfWork * resolved.factor * 100) / 100;
    const byRowBelow = Math.round(costOfWork * resolved.row.factorWithVat * 100) / 100;

    expect(byNote).toBeLessThan(byRowBelow);
    expect(byRowBelow - byNote).toBeGreaterThan(1_000);
  });

  it("reads a printed step as printed, with no interpolation to do", () => {
    const resolved = resolveFactorF(buildingZeroZero(), 5_000_000, { paysVat: true });

    expect(resolved.basis).toBe("printed_row");
    expect(resolved.factor).toBe(1.3002);
    expect(resolved.nextRow).toBeUndefined();
  });

  it("sends work that pays no VAT to the รวมในรูป Factor column", () => {
    const table = buildingZeroZero();
    const withVat = resolveFactorF(table, 5_000_000, { paysVat: true });
    const withoutVat = resolveFactorF(table, 5_000_000, { paysVat: false });

    expect(withVat.column).toBe("with_vat");
    expect(withoutVat.column).toBe("without_vat");
    expect(withoutVat.factor).toBe(1.2152);
    expect(withVat.factor).toBe(1.3002);
    // The two columns are each rounded from a higher-precision source, so one is not the other
    // multiplied and re-rounded: 1.2152 x 1.07 lands on 1.3003, while the table prints 1.3002.
    expect(Math.abs(withoutVat.factor * 1.07 - withVat.factor)).toBeLessThan(0.0002);
  });

  it("interpolates the no-VAT column on its own numbers, not by discounting the other one", () => {
    const resolved = resolveFactorF(buildingZeroZero(), 2_529_230.2, { paysVat: false });

    expect(resolved.basis).toBe("interpolated");
    expect(resolved.factor).toBe(1.2177);
  });

  it("holds the flat ends flat, above and below the printed range", () => {
    const table = buildingZeroZero();
    const small = resolveFactorF(table, 250_000, { paysVat: true });
    const huge = resolveFactorF(table, 900_000_000, { paysVat: true });

    expect(small.basis).toBe("printed_row");
    expect(small.factor).toBe(1.3073);
    expect(huge.basis).toBe("printed_row");
    expect(huge.factor).toBe(1.1787);
  });

  it("keeps the factor at the four decimals a ปร.5 prints", () => {
    const resolved = resolveFactorF(buildingZeroZero(), 3_333_333.33, { paysVat: true });
    expect(resolved.factor.toString()).toMatch(/^\d\.\d{1,4}$/);
  });

  it("refuses a heavy-rain zone without VAT, because the circular prints no such column", () => {
    const irrigation = findFactorFTable(query({ workType: "irrigation" }));
    if (!irrigation.ok) throw new Error(irrigation.detail);

    expect(() => resolveFactorF(irrigation.table, 20_000_000, { paysVat: false, heavyRainZones: 1 })).toThrow();
    expect(resolveFactorF(irrigation.table, 20_000_000, { paysVat: true, heavyRainZones: 1 }).column).toBe("heavy_rain_1");
  });

  it("refuses a heavy-rain zone on a table that has no such column", () => {
    expect(() => resolveFactorF(buildingZeroZero(), 20_000_000, { paysVat: true, heavyRainZones: 2 })).toThrow();
  });
});
