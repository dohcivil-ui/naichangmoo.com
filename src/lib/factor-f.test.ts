import { describe, expect, it } from "vitest";
import {
  factorFInterestPercent,
  factorFReviewedBy,
  factorFSource,
  factorFVatPercent,
  findFactorFTable,
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

  it("reproduces the real ปร.4 of the ปุญโญภาส dialysis building", () => {
    // ราคากลาง 20 มิถุนายน 2569: cost of work 2,529,230.20 priced at Factor F 1.3034,
    // giving 3,296,598.64 and a net of 3,296,500 after flooring to the hundred.
    const costOfWork = 2_529_230.2;
    const selection = selectFactorFRow(buildingZeroZero(), costOfWork);
    expect(selection.row.costMillionBaht).toBe(2);
    expect(selection.row.factorWithVat).toBe(1.3034);
    expect(costOfWork * selection.row.factorWithVat).toBeCloseTo(3_296_598.64, 2);
    expect(Math.floor((costOfWork * selection.row.factorWithVat) / 100) * 100).toBe(3_296_500);
  });

  it("flags that the same cost of work sits between two printed rows", () => {
    const selection = selectFactorFRow(buildingZeroZero(), 2_529_230.2);
    expect(selection.betweenRows).toBe(true);
    expect(selection.nextRow?.costMillionBaht).toBe(5);
    // Interpolating as the table note directs gives a different, smaller answer. Which rule the
    // product follows is not decided here; the caller is handed both rows and told they differ.
    const { row, nextRow } = selection;
    const interpolated =
      row.factorWithVat +
      ((nextRow!.factorWithVat - row.factorWithVat) * (2_529_230.2 / 1e6 - row.costMillionBaht)) /
        (nextRow!.costMillionBaht - row.costMillionBaht);
    expect(interpolated).toBeLessThan(row.factorWithVat);
    expect(Math.floor((2_529_230.2 * interpolated) / 100) * 100).toBe(3_295_100);
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
