import { describe, expect, it } from "vitest";
import {
  parseWorkPlan,
  serialiseWorkPlan,
  WORK_PLAN_SCHEMA_VERSION,
  type WorkPlanSnapshot
} from "./work-plan-storage";

const baht = (amount: number) => BigInt(amount) * 100n;

const snapshot: WorkPlanSnapshot = {
  setup: {
    projectName: "อาคารเรียน 4 ชั้น โรงเรียนบ้านหนองแสง",
    contract: "6100000",
    startDate: "2026-08-01",
    duration: "210",
    templateId: "general-building",
    advance: "0",
    advanceRecovery: "proportional",
    retention: "5",
    retentionMethod: "each",
    vat: "7",
    withholding: "0"
  },
  activities: [
    { id: "a1", number: "1.1", title: "งานเตรียมการ", startOffsetDays: 0, durationDays: 30, costSatang: baht(305_000) },
    { id: "a2", number: "1.2", title: "งานเสาเข็ม", startOffsetDays: 30, durationDays: 60, costSatang: baht(610_000) }
  ],
  milestones: [
    { id: "m1", ordinal: 1, title: "งวดที่ 1", activityIds: ["a1"] },
    { id: "m2", ordinal: 2, title: "งวดที่ 2", activityIds: ["a2"] }
  ],
  actuals: [
    {
      milestoneId: "m1",
      requested: { satang: baht(305_000), date: "2026-08-19" },
      certified: { satang: baht(305_000), date: "2026-08-23" },
      received: { satang: baht(311_100), date: "2026-08-30" },
      note: "งวดสัญญาเดิม",
      reference: "สัญญาเลขที่ 12/2569"
    }
  ],
  dataDate: "2026-08-25"
};

describe("serialiseWorkPlan", () => {
  it("แปลงเงิน BigInt เป็นสตริงได้ ไม่โยน TypeError อย่างที่ JSON.stringify ทำเอง", () => {
    expect(() => JSON.stringify({ money: 1n })).toThrow(TypeError);
    expect(() => serialiseWorkPlan(snapshot)).not.toThrow();
  });

  it("เก็บเงินเป็นสตางค์เต็มจำนวน ไม่ใช่บาททศนิยม", () => {
    const parsed = JSON.parse(serialiseWorkPlan(snapshot));
    expect(parsed.activities[0].costSatang).toBe("30500000");
    expect(parsed.actuals[0].received.satang).toBe("31110000");
  });

  it("กำกับรุ่นของรูปร่างข้อมูลไว้เสมอ", () => {
    expect(JSON.parse(serialiseWorkPlan(snapshot)).schemaVersion).toBe(WORK_PLAN_SCHEMA_VERSION);
  });
});

describe("เขียนแล้วอ่านกลับ", () => {
  it("ได้ของเดิมครบทุกช่อง และเงินยังเป็น BigInt", () => {
    const restored = parseWorkPlan(serialiseWorkPlan(snapshot));

    expect(restored).not.toBeNull();
    expect(restored!.setup).toEqual(snapshot.setup);
    expect(restored!.dataDate).toBe("2026-08-25");
    expect(restored!.activities[0]!.costSatang).toBe(baht(305_000));
    expect(typeof restored!.activities[0]!.costSatang).toBe("bigint");
    expect(restored!.actuals[0]!.received!.satang).toBe(baht(311_100));
    expect(restored!.actuals[0]!.reference).toBe("สัญญาเลขที่ 12/2569");
  });

  it("ยอดรวมหลังอ่านกลับเท่าเดิมทุกสตางค์", () => {
    const restored = parseWorkPlan(serialiseWorkPlan(snapshot))!;
    const before = snapshot.activities.reduce((sum, one) => sum + one.costSatang, 0n);
    const after = restored.activities.reduce((sum, one) => sum + one.costSatang, 0n);
    expect(after).toBe(before);
  });
});

describe("parseWorkPlan — อ่านไม่ผ่านต้องทิ้ง ไม่ใช่พังทั้งหน้า", () => {
  it("ค่าว่างหรือข้อความที่ไม่ใช่ JSON คืน null", () => {
    expect(parseWorkPlan(null)).toBeNull();
    expect(parseWorkPlan("")).toBeNull();
    expect(parseWorkPlan("ไม่ใช่ JSON")).toBeNull();
    expect(parseWorkPlan("[]")).toBeNull();
  });

  it("ข้อมูลคนละรุ่นถูกทิ้ง", () => {
    const old = JSON.parse(serialiseWorkPlan(snapshot));
    old.schemaVersion = WORK_PLAN_SCHEMA_VERSION + 1;
    expect(parseWorkPlan(JSON.stringify(old))).toBeNull();
  });

  it("เงินที่ไม่ใช่จำนวนเต็มสตางค์ถูกปฏิเสธ ไม่ใช่ปัดเอาเอง", () => {
    const broken = JSON.parse(serialiseWorkPlan(snapshot));
    broken.activities[0].costSatang = "305000.55";
    expect(parseWorkPlan(JSON.stringify(broken))).toBeNull();
  });

  it("เงินที่กลายเป็นตัวเลขทศนิยมลอย ๆ ถูกปฏิเสธ", () => {
    const broken = JSON.parse(serialiseWorkPlan(snapshot));
    broken.activities[0].costSatang = 30500000;
    expect(parseWorkPlan(JSON.stringify(broken))).toBeNull();
  });

  it("บันทึกจริงที่ชี้ไปยังงวดที่ไม่มีอยู่แล้ว ถูกทิ้งทิ้งไป ไม่ใช่เก็บไว้ให้ยอดเพี้ยน", () => {
    const broken = JSON.parse(serialiseWorkPlan(snapshot));
    broken.actuals[0].milestoneId = "งวดที่ถูกลบไปแล้ว";
    const restored = parseWorkPlan(JSON.stringify(broken));
    expect(restored).not.toBeNull();
    expect(restored!.actuals).toHaveLength(0);
  });

  it("งานที่ถูกลบไปแล้วแต่ยังค้างอยู่ในงวด ถูกตัดออกจากงวด", () => {
    const broken = JSON.parse(serialiseWorkPlan(snapshot));
    broken.milestones[0].activityIds = ["a1", "งานที่ถูกลบไปแล้ว"];
    const restored = parseWorkPlan(JSON.stringify(broken));
    expect(restored!.milestones[0]!.activityIds).toEqual(["a1"]);
  });

  it("ยอดที่ไม่มีวันที่ ถูกทิ้ง เพราะเอาไปวางบนแกนเวลาไม่ได้", () => {
    const broken = JSON.parse(serialiseWorkPlan(snapshot));
    broken.actuals[0].certified = { satang: "30500000", date: "" };
    const restored = parseWorkPlan(JSON.stringify(broken));
    expect(restored!.actuals[0]!.certified).toBeUndefined();
    expect(restored!.actuals[0]!.requested).toBeDefined();
  });

  it("ไฟล์ที่ยังไม่มีช่องบันทึกจริงเลย อ่านได้ตามปกติ", () => {
    const older = JSON.parse(serialiseWorkPlan(snapshot));
    delete older.actuals;
    const restored = parseWorkPlan(JSON.stringify(older));
    expect(restored).not.toBeNull();
    expect(restored!.actuals).toEqual([]);
  });
});
