import { describe, expect, it } from "vitest";
import { formatBaht } from "./thai-baht";
import { activityWeights, type PlanActivity } from "./work-plan";
import {
  buildMilestoneSchedule,
  percentToPpm,
  type ContractTerms,
  type Milestone
} from "./payment-milestone";

const baht = (amount: number) => BigInt(amount) * 100n;

/**
 * โครงการ 6,100,000 บาท แบ่งเป็น 20 กิจกรรมเท่า ๆ กัน กิจกรรมละ 5%
 *
 * ตัวเลขชุดนี้เลือกให้ตรงกับงวดที่ 1 ของระบบที่เราไปดูมาจริง ซึ่งพิมพ์สายการคำนวณไว้ครบ:
 * มูลค่างานงวดนี้ 305,000 · หักประกัน 5% เป็น 15,250 · บวก VAT 7% เป็น 21,350 ·
 * เงินรับจริง 311,100 — บันทึกไว้ใน docs/research/changkid-easy-planning-2026-08-25.md
 */
const twentyEqualActivities: PlanActivity[] = Array.from({ length: 20 }, (_unused, index) => ({
  id: `a${index + 1}`,
  number: `1.${index + 1}`,
  title: `งานที่ ${index + 1}`,
  startOffsetDays: index * 15,
  durationDays: 15,
  costSatang: baht(305_000)
}));

const weights = activityWeights(twentyEqualActivities);

const governmentTerms: ContractTerms = {
  contractSatang: baht(6_100_000),
  advancePpm: 0n,
  advanceRecovery: "proportional",
  retentionPpm: percentToPpm("5"),
  retentionMethod: "each",
  vatPpm: percentToPpm("7"),
  withholdingPpm: 0n
};

const milestonesOf = (groups: readonly (readonly string[])[]): Milestone[] =>
  groups.map((activityIds, index) => ({
    id: `m${index + 1}`,
    ordinal: index + 1,
    title: `งวดที่ ${index + 1}`,
    activityIds
  }));

const allTwentyInFour = milestonesOf([
  twentyEqualActivities.slice(0, 1).map((activity) => activity.id),
  twentyEqualActivities.slice(1, 6).map((activity) => activity.id),
  twentyEqualActivities.slice(6, 13).map((activity) => activity.id),
  twentyEqualActivities.slice(13).map((activity) => activity.id)
]);

describe("percentToPpm", () => {
  it("แปลงเปอร์เซ็นต์เป็น ppm โดยไม่ผ่าน float", () => {
    expect(percentToPpm("5")).toBe(50_000n);
    expect(percentToPpm("7")).toBe(70_000n);
    expect(percentToPpm("0.5")).toBe(5_000n);
    expect(percentToPpm("15")).toBe(150_000n);
    expect(percentToPpm("")).toBe(0n);
    expect(percentToPpm("ห้า")).toBe(0n);
  });
});

describe("buildMilestoneSchedule", () => {
  it("คิดสายเงินงวดแรกได้ตรงกับเอกสารทุกบรรทัด", () => {
    const schedule = buildMilestoneSchedule(weights, allTwentyInFour, governmentTerms);
    const first = schedule.rows[0]!;

    expect(formatBaht(first.periodWorkSatang)).toBe("305,000.00");
    expect(formatBaht(first.retentionSatang)).toBe("15,250.00");
    expect(formatBaht(first.vatSatang)).toBe("21,350.00");
    expect(formatBaht(first.netSatang)).toBe("311,100.00");
    expect(first.previousCumulativeSatang).toBe(0n);
  });

  it("ยอดงานทุกงวดรวมกันเท่ามูลค่าสัญญาเป๊ะ", () => {
    const schedule = buildMilestoneSchedule(weights, allTwentyInFour, governmentTerms);
    expect(schedule.totalWorkSatang).toBe(governmentTerms.contractSatang);
    expect(schedule.unassignedWeightPpm).toBe(0n);
  });

  it("แบ่งงวดคนละแบบก็ยังรวมได้เท่ามูลค่าสัญญา", () => {
    const lopsided = milestonesOf([
      twentyEqualActivities.slice(0, 17).map((activity) => activity.id),
      twentyEqualActivities.slice(17, 18).map((activity) => activity.id),
      twentyEqualActivities.slice(18).map((activity) => activity.id)
    ]);
    expect(buildMilestoneSchedule(weights, lopsided, governmentTerms).totalWorkSatang).toBe(
      governmentTerms.contractSatang
    );
  });

  it("ย้ายกิจกรรมข้ามงวดแล้วงวดหลังไม่เพี้ยน", () => {
    const before = buildMilestoneSchedule(weights, allTwentyInFour, governmentTerms);
    const moved = milestonesOf([
      twentyEqualActivities.slice(0, 2).map((activity) => activity.id),
      twentyEqualActivities.slice(2, 6).map((activity) => activity.id),
      twentyEqualActivities.slice(6, 13).map((activity) => activity.id),
      twentyEqualActivities.slice(13).map((activity) => activity.id)
    ]);
    const after = buildMilestoneSchedule(weights, moved, governmentTerms);

    // งวดที่ 1 โตขึ้นหนึ่งกิจกรรม งวดที่ 2 เล็กลงหนึ่ง แต่งวดที่ 3 และ 4 ต้องเท่าเดิมทุกบาท
    expect(after.rows[0]!.periodWorkSatang).toBeGreaterThan(before.rows[0]!.periodWorkSatang);
    expect(after.rows[2]!.periodWorkSatang).toBe(before.rows[2]!.periodWorkSatang);
    expect(after.rows[3]!.periodWorkSatang).toBe(before.rows[3]!.periodWorkSatang);
    expect(after.totalWorkSatang).toBe(before.totalWorkSatang);
  });

  it("บอกน้ำหนักงานที่ยังไม่ได้ผูกเข้างวด แทนที่จะเงียบ", () => {
    const partial = milestonesOf([twentyEqualActivities.slice(0, 5).map((activity) => activity.id)]);
    const schedule = buildMilestoneSchedule(weights, partial, governmentTerms);
    expect(schedule.unassignedWeightPpm).toBe(750_000n);
    expect(schedule.totalWorkSatang).toBeLessThan(governmentTerms.contractSatang);
  });

  it("กิจกรรมเดียวกันอยู่สองงวดถูกนับที่งวดแรกเท่านั้น", () => {
    const duplicated = milestonesOf([["a1", "a2"], ["a2", "a3"]]);
    const schedule = buildMilestoneSchedule(weights, duplicated, governmentTerms);
    expect(schedule.rows[0]!.activityCount).toBe(2);
    expect(schedule.rows[1]!.activityCount).toBe(1);
    expect(schedule.totalWorkSatang).toBe(baht(915_000));
  });

  it("หักประกันรวมในงวดสุดท้ายได้เมื่อสัญญากำหนดแบบนั้น", () => {
    const finalRetention = buildMilestoneSchedule(weights, allTwentyInFour, {
      ...governmentTerms,
      retentionMethod: "final"
    });
    expect(finalRetention.rows[0]!.retentionSatang).toBe(0n);
    expect(formatBaht(finalRetention.rows[3]!.retentionSatang)).toBe("305,000.00");
    expect(finalRetention.totalRetentionSatang).toBe(
      buildMilestoneSchedule(weights, allTwentyInFour, governmentTerms).totalRetentionSatang
    );
  });

  it("หักคืนเงินล่วงหน้าได้ไม่เกินยอดที่รับมา", () => {
    const withAdvance = buildMilestoneSchedule(weights, allTwentyInFour, {
      ...governmentTerms,
      advancePpm: percentToPpm("15")
    });
    const recovered = withAdvance.rows.reduce((sum, row) => sum + row.advanceRecoverySatang, 0n);
    expect(recovered).toBe(withAdvance.advanceSatang);
    expect(formatBaht(withAdvance.advanceSatang)).toBe("915,000.00");
  });

  it("หักภาษี ณ ที่จ่าย 1% สำหรับงานราชการ", () => {
    const withTax = buildMilestoneSchedule(weights, allTwentyInFour, {
      ...governmentTerms,
      withholdingPpm: percentToPpm("1")
    });
    const first = withTax.rows[0]!;
    expect(formatBaht(first.withholdingSatang)).toBe("3,050.00");
    expect(formatBaht(first.netSatang)).toBe("308,050.00");
  });

  it("หน่วยเงินไม่หลุดหลักพันเท่า", () => {
    // ระบบที่ไปดูมาแสดง 305,000 เป็น 305,000,000,000 เพราะถือเงินเป็นตัวเลขลอย
    const schedule = buildMilestoneSchedule(weights, allTwentyInFour, governmentTerms);
    for (const row of schedule.rows) {
      expect(row.periodWorkSatang).toBeLessThanOrEqual(governmentTerms.contractSatang);
      expect(row.netSatang).toBeLessThanOrEqual(governmentTerms.contractSatang * 2n);
    }
  });

  it("ไม่มีงวดเลยก็ไม่พัง และบอกว่ายังไม่ได้ผูกทั้งหมด", () => {
    const schedule = buildMilestoneSchedule(weights, [], governmentTerms);
    expect(schedule.rows).toHaveLength(0);
    expect(schedule.unassignedWeightPpm).toBe(1_000_000n);
    expect(schedule.totalWorkSatang).toBe(0n);
  });
});
