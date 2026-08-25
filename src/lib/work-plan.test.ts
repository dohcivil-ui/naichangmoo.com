import { describe, expect, it } from "vitest";
import {
  WEIGHT_SCALE,
  activityWeights,
  buildPlanCurve,
  formatPercent,
  planPeriodCount,
  sumCost,
  type PlanActivity
} from "./work-plan";

/**
 * ตัวอย่างโครงการจากหนังสือหลักสูตร วางแผนงานและบริหารโครงการด้วย Bar Chart และ S-Curve
 * (ยุทธนา เกาะกิ่ง, วสท.) หน้า 92-96 — ค่างานรวม 65,000,000 บาท
 *
 * ใช้ตัวเลขจากเอกสารจริงเป็น fixture แทนที่จะคิดเลขสวย ๆ ขึ้นเอง เพราะเปอร์เซ็นต์ที่หนังสือ
 * พิมพ์ไว้เป็นคำตอบที่ตรวจได้ ถ้าโค้ดเราให้ค่าต่างจากนี้แปลว่าเราผิด ไม่ใช่หนังสือผิด
 */
const baht = (amount: number) => BigInt(amount) * 100n;

const structureFloors: PlanActivity[] = Array.from({ length: 10 }, (_unused, index) => ({
  id: `1.${index + 5}`,
  number: `1.${index + 5}`,
  title: `งานโครงสร้างชั้นที่ ${index + 1}`,
  startOffsetDays: 120 + index * 15,
  durationDays: 15,
  costSatang: baht(2_000_000)
}));

const bookProject: PlanActivity[] = [
  { id: "1.1", number: "1.1", title: "งานเตรียมการ", startOffsetDays: 0, durationDays: 30, costSatang: baht(1_500_000) },
  { id: "1.2", number: "1.2", title: "งานเสาเข็ม", startOffsetDays: 30, durationDays: 60, costSatang: baht(2_000_000) },
  { id: "1.3", number: "1.3", title: "งานขุดและตัดหัวเข็ม", startOffsetDays: 60, durationDays: 30, costSatang: baht(500_000) },
  { id: "1.4", number: "1.4", title: "งานฐานราก", startOffsetDays: 60, durationDays: 60, costSatang: baht(2_000_000) },
  ...structureFloors,
  { id: "1.15", number: "1.15", title: "งานโครงสร้างหลังคา", startOffsetDays: 270, durationDays: 15, costSatang: baht(1_000_000) },
  { id: "2.1", number: "2.1", title: "งานผนังสำเร็จรูป", startOffsetDays: 0, durationDays: 150, costSatang: baht(7_000_000) },
  { id: "2.2", number: "2.2", title: "งานผนังก่ออิฐ", startOffsetDays: 120, durationDays: 120, costSatang: baht(3_000_000) },
  { id: "2.3", number: "2.3", title: "งานฉาบปูน", startOffsetDays: 135, durationDays: 120, costSatang: baht(4_500_000) },
  { id: "2.4", number: "2.4", title: "งานปูกระเบื้องพื้นและผนัง", startOffsetDays: 150, durationDays: 120, costSatang: baht(5_000_000) },
  { id: "2.5", number: "2.5", title: "งานฝ้าเพดาน", startOffsetDays: 180, durationDays: 90, costSatang: baht(1_500_000) },
  { id: "2.6", number: "2.6", title: "งานติดตั้งประตูหน้าต่าง", startOffsetDays: 270, durationDays: 30, costSatang: baht(3_500_000) },
  { id: "2.7", number: "2.7", title: "งานทาสี", startOffsetDays: 300, durationDays: 60, costSatang: baht(1_800_000) },
  { id: "2.8", number: "2.8", title: "งานติดตั้งสุขภัณฑ์", startOffsetDays: 345, durationDays: 30, costSatang: baht(2_000_000) },
  { id: "3.1", number: "3.1", title: "งานระบบสุขาภิบาล", startOffsetDays: 240, durationDays: 120, costSatang: baht(4_800_000) },
  { id: "3.2", number: "3.2", title: "งานระบบไฟฟ้า", startOffsetDays: 240, durationDays: 120, costSatang: baht(4_400_000) },
  { id: "3.3", number: "3.3", title: "งานลิฟต์", startOffsetDays: 345, durationDays: 60, costSatang: baht(500_000) }
];

const weightOf = (activityId: string) => {
  const weight = activityWeights(bookProject).find((entry) => entry.activityId === activityId);
  if (!weight) throw new Error(`ไม่พบกิจกรรม ${activityId}`);
  return weight.weightPpm;
};

describe("fixture ตรงกับหนังสือ", () => {
  it("ค่างานรวมเท่ากับ 65,000,000 บาท", () => {
    expect(sumCost(bookProject)).toBe(baht(65_000_000));
  });
});

describe("activityWeights", () => {
  it("น้ำหนักทุกกิจกรรมรวมกันได้ 1,000,000 ppm พอดี", () => {
    const total = activityWeights(bookProject).reduce((sum, weight) => sum + weight.weightPpm, 0n);
    expect(total).toBe(WEIGHT_SCALE);
  });

  it("ให้เปอร์เซ็นต์ตรงกับที่หนังสือพิมพ์ไว้ทุกบรรทัด", () => {
    expect(formatPercent(weightOf("1.1"))).toBe("2.31");
    expect(formatPercent(weightOf("1.2"))).toBe("3.08");
    expect(formatPercent(weightOf("1.3"))).toBe("0.77");
    expect(formatPercent(weightOf("2.1"))).toBe("10.77");
    expect(formatPercent(weightOf("2.2"))).toBe("4.62");
    expect(formatPercent(weightOf("2.3"))).toBe("6.92");
    expect(formatPercent(weightOf("2.4"))).toBe("7.69");
    expect(formatPercent(weightOf("2.5"))).toBe("2.31");
    expect(formatPercent(weightOf("2.6"))).toBe("5.38");
    expect(formatPercent(weightOf("2.7"))).toBe("2.77");
    expect(formatPercent(weightOf("2.8"))).toBe("3.08");
    expect(formatPercent(weightOf("3.1"))).toBe("7.38");
    expect(formatPercent(weightOf("3.2"))).toBe("6.77");
    expect(formatPercent(weightOf("3.3"))).toBe("0.77");
  });

  it("น้ำหนักมาจากเงิน ไม่ใช่เวลา", () => {
    // งานเตรียมการ 30 วัน กับงานฝ้าเพดาน 90 วัน ค่างานเท่ากันที่ 1,500,000 จึงต้องได้น้ำหนักเท่ากัน
    expect(weightOf("1.1")).toBe(weightOf("2.5"));
  });

  it("แบ่งเศษให้กิจกรรมที่เศษมากที่สุด ไม่กองไว้ที่ตัวสุดท้าย", () => {
    const threeWays: PlanActivity[] = ["a", "b", "c"].map((id) => ({
      id,
      number: id,
      title: id,
      startOffsetDays: 0,
      durationDays: 15,
      costSatang: baht(1)
    }));
    const weights = activityWeights(threeWays).map((weight) => weight.weightPpm);
    expect(weights.reduce((sum, weight) => sum + weight, 0n)).toBe(WEIGHT_SCALE);
    expect(weights).toEqual([333334n, 333333n, 333333n]);
  });
});

describe("buildPlanCurve", () => {
  const curve = buildPlanCurve(bookProject, 420);

  it("กระจายน้ำหนักเท่ากันทุกช่อง ตรงกับตัวอย่างงานผนังสำเร็จรูปในหนังสือ", () => {
    // 10.77% ตลอด 150 วัน = 10 ช่อง หนังสือพิมพ์ช่องละ 1.08%
    const row = curve.rows.find((entry) => entry.activityId === "2.1");
    const working = row!.perPeriodPpm.filter((amount) => amount > 0n);
    expect(working).toHaveLength(10);
    expect(working.map(formatPercent)).toEqual(Array.from({ length: 10 }, () => "1.08"));
    expect(working.reduce((sum, amount) => sum + amount, 0n)).toBe(row!.weightPpm);
  });

  it("เส้นสะสมช่องสุดท้ายได้ 100.00% พอดี ไม่ใช่ 99.99%", () => {
    const last = curve.cumulativePpm[curve.cumulativePpm.length - 1];
    expect(last).toBe(WEIGHT_SCALE);
    expect(formatPercent(last!)).toBe("100.00");
  });

  it("เส้นสะสมไม่ลดลงเลย", () => {
    for (let index = 1; index < curve.cumulativePpm.length; index += 1) {
      expect(curve.cumulativePpm[index]! >= curve.cumulativePpm[index - 1]!).toBe(true);
    }
  });

  it("ขึ้นรูปตัว S คือช่วงกลางชันกว่าหัวและท้าย", () => {
    const third = Math.floor(curve.periodCount / 3);
    const rate = (from: number, to: number) =>
      curve.perPeriodPpm.slice(from, to).reduce((sum, amount) => sum + amount, 0n) / BigInt(Math.max(to - from, 1));
    expect(rate(third, third * 2) > rate(0, third)).toBe(true);
    expect(rate(third, third * 2) > rate(third * 2, curve.periodCount)).toBe(true);
  });

  it("กิจกรรมที่สั้นกว่าครึ่งเดือนยังได้หนึ่งช่อง ไม่หายไปจากเส้น", () => {
    const single: PlanActivity[] = [
      { id: "a", number: "1", title: "งานสั้น", startOffsetDays: 0, durationDays: 3, costSatang: baht(1_000) },
      { id: "b", number: "2", title: "งานยาว", startOffsetDays: 0, durationDays: 60, costSatang: baht(1_000) }
    ];
    const short = buildPlanCurve(single, 60).rows.find((row) => row.activityId === "a");
    expect(short!.perPeriodPpm.filter((amount) => amount > 0n)).toHaveLength(1);
  });

  it("กิจกรรมที่ค่างานเป็นศูนย์ไม่ทำให้เส้นพัง", () => {
    const withZero: PlanActivity[] = [
      { id: "a", number: "1", title: "งานมีค่า", startOffsetDays: 0, durationDays: 30, costSatang: baht(1_000) },
      { id: "b", number: "2", title: "งานไม่มีค่า", startOffsetDays: 0, durationDays: 30, costSatang: 0n }
    ];
    const zeroCurve = buildPlanCurve(withZero, 30);
    expect(zeroCurve.cumulativePpm[zeroCurve.cumulativePpm.length - 1]).toBe(WEIGHT_SCALE);
  });
});

describe("planPeriodCount", () => {
  it("นับเป็นช่องครึ่งเดือน", () => {
    expect(planPeriodCount([], 420)).toBe(28);
    expect(planPeriodCount([], 1)).toBe(1);
  });

  it("กว้างพอสำหรับกิจกรรมที่ยาวเลยระยะเวลาโครงการ", () => {
    const overrun: PlanActivity[] = [
      { id: "a", number: "1", title: "งานเลยแผน", startOffsetDays: 0, durationDays: 90, costSatang: baht(1) }
    ];
    expect(planPeriodCount(overrun, 30)).toBe(6);
  });
});
