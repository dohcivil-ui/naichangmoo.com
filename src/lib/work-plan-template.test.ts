import { describe, expect, it } from "vitest";
import { buildMilestoneSchedule, percentToPpm, type ContractTerms } from "./payment-milestone";
import { activityWeights, buildPlanCurve, formatPercent, WEIGHT_SCALE } from "./work-plan";
import { draftActivities, draftMilestones, hasTemplate, templateOptions, templateSource } from "./work-plan-template";

const baht = (amount: number) => BigInt(amount) * 100n;
const contract = baht(12_500_000);
const durationDays = 300;

describe("templateOptions", () => {
  it("บอกที่มาของแม่แบบที่มี และบอกตรง ๆ ว่าอันไหนยังไม่มี", () => {
    expect(templateSource("general-building")).toContain("วสท.");
    expect(templateSource("school-building")).toBeNull();
    expect(hasTemplate("general-building")).toBe(true);
    expect(hasTemplate("school-building")).toBe(false);
  });

  it("ประเภทที่ยังไม่มีแม่แบบร่างออกมาเป็นรายการว่าง ไม่ใช่ตัวเลขที่เดาขึ้นมา", () => {
    expect(draftActivities("school-building", contract, durationDays)).toEqual([]);
  });

  it("ทุกตัวเลือกมีป้ายกำกับ", () => {
    for (const option of templateOptions) expect(option.label.length).toBeGreaterThan(0);
  });
});

/**
 * แม่แบบเคยขาดน้ำหนักไป 30,770 ppm เพราะย่อสิบชั้นโครงสร้างเหลือสามบรรทัดแล้วลืมรวมสัดส่วนกลับ
 * ผลคือเศษที่หายไปกองอยู่ที่กิจกรรมสุดท้าย งานเก็บงานจึงขึ้น 3.85% แทนที่จะเป็น 0.77%
 * ยอดรวมยังเท่ามูลค่าสัญญาอยู่ ความผิดจึงไม่โผล่ในเทสต์เดิมเลย ต้องดูรายบรรทัดถึงจะเห็น
 */
describe("สัดส่วนในแม่แบบ", () => {
  const activities = draftActivities("general-building", contract, durationDays);
  const percentOf = (number: string) => {
    const weights = activityWeights(activities);
    const activity = activities.find((entry) => entry.number === number);
    const weight = weights.find((entry) => entry.activityId === activity?.id);
    return formatPercent(weight!.weightPpm);
  };

  it("บรรทัดสุดท้ายไม่กลายเป็นถังรับเศษที่ใหญ่ผิดปกติ", () => {
    expect(percentOf("3.3")).toBe("0.77");
  });

  it("ทุกบรรทัดตรงกับเปอร์เซ็นต์ที่หนังสือพิมพ์ไว้", () => {
    expect(percentOf("1.1")).toBe("2.31");
    expect(percentOf("1.2")).toBe("3.08");
    expect(percentOf("1.3")).toBe("0.77");
    expect(percentOf("1.8")).toBe("1.54");
    expect(percentOf("2.1")).toBe("10.77");
    expect(percentOf("2.4")).toBe("7.69");
    expect(percentOf("2.6")).toBe("5.38");
    expect(percentOf("3.1")).toBe("7.38");
    expect(percentOf("3.2")).toBe("6.77");
  });

  it("สัดส่วนรายหมวดตรงกับหนังสือ คือ 41.54 · 43.54 · 14.92", () => {
    const weights = activityWeights(activities);
    const groupPpm = (prefix: string) =>
      activities
        .filter((activity) => activity.number.startsWith(prefix))
        .reduce((sum, activity) => sum + weights.find((entry) => entry.activityId === activity.id)!.weightPpm, 0n);

    expect(formatPercent(groupPpm("1."))).toBe("41.54");
    expect(formatPercent(groupPpm("2."))).toBe("43.54");
    expect(formatPercent(groupPpm("3."))).toBe("14.92");
  });
});

describe("draftActivities", () => {
  const activities = draftActivities("general-building", contract, durationDays);

  it("ค่างานที่ร่างให้รวมกันเท่ามูลค่าสัญญาเป๊ะตั้งแต่บรรทัดแรก", () => {
    expect(activities.reduce((sum, activity) => sum + activity.costSatang, 0n)).toBe(contract);
  });

  it("น้ำหนักที่ได้รวมกันเป็น 100% พอดี", () => {
    const total = activityWeights(activities).reduce((sum, weight) => sum + weight.weightPpm, 0n);
    expect(total).toBe(WEIGHT_SCALE);
  });

  it("ย่อขยายตามระยะเวลาโครงการ ไม่ยึดติดกับ 420 วันของหนังสือ", () => {
    const short = draftActivities("general-building", contract, 150);
    const long = draftActivities("general-building", contract, 600);
    const span = (list: ReturnType<typeof draftActivities>) =>
      Math.max(...list.map((activity) => activity.startOffsetDays + activity.durationDays));
    expect(span(short)).toBeLessThan(span(long));
    expect(span(short)).toBeLessThanOrEqual(160);
  });

  it("ทุกกิจกรรมมีระยะเวลาอย่างน้อยหนึ่งวัน แม้โครงการจะสั้นมาก", () => {
    for (const activity of draftActivities("general-building", contract, 15)) {
      expect(activity.durationDays).toBeGreaterThanOrEqual(1);
    }
  });

  it("เส้นสะสมของแผนที่ร่างให้จบที่ 100% พอดี", () => {
    const curve = buildPlanCurve(activities, durationDays);
    expect(curve.cumulativePpm[curve.cumulativePpm.length - 1]).toBe(WEIGHT_SCALE);
  });
});

describe("draftMilestones", () => {
  const activities = draftActivities("general-building", contract, durationDays);
  const terms: ContractTerms = {
    contractSatang: contract,
    advancePpm: 0n,
    advanceRecovery: "proportional",
    retentionPpm: percentToPpm("5"),
    retentionMethod: "each",
    vatPpm: percentToPpm("7"),
    withholdingPpm: 0n
  };

  it("ผูกกิจกรรมครบทุกตัว ไม่มีงานตกหล่น", () => {
    const milestones = draftMilestones(activities, 6);
    const assigned = milestones.flatMap((milestone) => milestone.activityIds);
    expect(new Set(assigned).size).toBe(activities.length);
  });

  it("ยอดทุกงวดที่ร่างให้รวมกันเท่ามูลค่าสัญญา", () => {
    const schedule = buildMilestoneSchedule(activityWeights(activities), draftMilestones(activities, 6), terms);
    expect(schedule.totalWorkSatang).toBe(contract);
    expect(schedule.unassignedWeightPpm).toBe(0n);
  });

  it("ไม่มีงวดว่าง", () => {
    for (const milestone of draftMilestones(activities, 12)) {
      expect(milestone.activityIds.length).toBeGreaterThan(0);
    }
  });

  it("ขอจำนวนงวดมากกว่าจำนวนงานก็ไม่พัง", () => {
    const milestones = draftMilestones(activities, 99);
    expect(milestones.length).toBeLessThanOrEqual(activities.length);
    expect(milestones.every((milestone, index) => milestone.ordinal === index + 1)).toBe(true);
  });
});
