import { describe, expect, it } from "vitest";
import {
  parseWorkPlan,
  serialiseWorkPlan,
  WORK_PLAN_SCHEMA_VERSION,
  type WorkPlanSnapshot
} from "./work-plan-storage";
import { defaultDocumentMeta } from "./work-plan-document-meta";
import { defaultWorkCalendar } from "./work-calendar";

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
  dataDate: "2026-08-25",
  document: {
    ...defaultDocumentMeta(),
    logoDataUri: "data:image/png;base64,AAAA",
    showLogo: false,
    employerName: "เทศบาลตำบลหนองแสง",
    contractNumber: "จ.12/2569",
    documentDate: "2026-08-20",
    siteName: "ต.ในเมือง อ.เมือง จ.นครราชสีมา",
    contractor: { name: "นายสมชาย ใจดี", position: "กรรมการผู้จัดการ" },
    employer: { name: "นางสาวมาลี ตรวจการ", position: "นายกเทศมนตรี" }
  },
  calendar: {
    ...defaultWorkCalendar(),
    added: [{ date: "2026-09-14", name: "หยุดตามคำสั่งผู้ว่าจ้าง" }],
    removed: ["2026-10-16"],
    worksSaturday: false
  },
  rainPercent: 10
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

describe("ข้อมูลประกอบเอกสาร", () => {
  it("เขียนแล้วอ่านกลับได้ครบ ทั้งโลโก้ หัวเอกสาร และผู้ลงนาม", () => {
    const restored = parseWorkPlan(serialiseWorkPlan(snapshot))!;

    expect(restored.document.logoDataUri).toBe("data:image/png;base64,AAAA");
    expect(restored.document.showLogo).toBe(false);
    expect(restored.document.contractNumber).toBe("จ.12/2569");
    expect(restored.document.contractor).toEqual({ name: "นายสมชาย ใจดี", position: "กรรมการผู้จัดการ" });
    expect(restored.document.employer.position).toBe("นายกเทศมนตรี");
  });

  it("สั่งซ่อนโลโก้แล้วรูปยังอยู่ ไม่ถูกลบทิ้ง", () => {
    const restored = parseWorkPlan(serialiseWorkPlan(snapshot))!;
    expect(restored.document.showLogo).toBe(false);
    expect(restored.document.logoDataUri).not.toBe("");
  });

  it("ค่าที่ไม่ใช่ data URI ถูกทิ้ง ไม่ปล่อยให้ URL ภายนอกเข้ามาอยู่ในเอกสาร", () => {
    const tampered = JSON.parse(serialiseWorkPlan(snapshot));
    tampered.document.logoDataUri = "https://example.com/logo.png";
    expect(parseWorkPlan(JSON.stringify(tampered))!.document.logoDataUri).toBe("");
  });

  it("ข้อมูลเอกสารที่รูปร่างเพี้ยน ได้ค่าตั้งต้น ไม่ทิ้งงานทั้งใบ", () => {
    const tampered = JSON.parse(serialiseWorkPlan(snapshot));
    tampered.document = "ไม่ใช่ข้อมูลเอกสาร";
    const restored = parseWorkPlan(JSON.stringify(tampered));

    expect(restored).not.toBeNull();
    expect(restored!.activities).toHaveLength(2);
    expect(restored!.document).toEqual(defaultDocumentMeta());
  });
});

describe("ไฟล์รุ่นเก่า", () => {
  /** ไฟล์ที่ผู้ใช้บันทึกไว้ก่อนมีข้อมูลเอกสาร ต้องเปิดได้ ไม่ใช่เจอกระดานเปล่า */
  const versionOne = () => {
    const old = JSON.parse(serialiseWorkPlan(snapshot));
    old.schemaVersion = 1;
    delete old.document;
    return JSON.stringify(old);
  };

  it("อ่านได้ และงานที่กรอกไว้ยังอยู่ครบ", () => {
    const restored = parseWorkPlan(versionOne());

    expect(restored).not.toBeNull();
    expect(restored!.activities).toHaveLength(2);
    expect(restored!.actuals[0]!.received!.satang).toBe(baht(311_100));
    expect(restored!.dataDate).toBe("2026-08-25");
  });

  it("ได้ข้อมูลเอกสารเป็นค่าตั้งต้น แล้วบันทึกครั้งถัดไปเป็นรุ่นปัจจุบัน", () => {
    const restored = parseWorkPlan(versionOne())!;
    expect(restored.document).toEqual(defaultDocumentMeta());
    expect(JSON.parse(serialiseWorkPlan(restored)).schemaVersion).toBe(WORK_PLAN_SCHEMA_VERSION);
  });

  it("รุ่นที่ยังไม่มีอยู่จริงถูกทิ้ง ไม่เดาว่าอ่านได้", () => {
    const future = JSON.parse(serialiseWorkPlan(snapshot));
    future.schemaVersion = WORK_PLAN_SCHEMA_VERSION + 1;
    expect(parseWorkPlan(JSON.stringify(future))).toBeNull();
  });
});

describe("ปฏิทินวันทำงาน", () => {
  it("เขียนแล้วอ่านกลับได้ครบ ทั้งวันที่เพิ่มเอง วันที่เอาออก และการตั้งวันทำงาน", () => {
    const restored = parseWorkPlan(serialiseWorkPlan(snapshot))!;

    expect(restored.calendar.added).toEqual([{ date: "2026-09-14", name: "หยุดตามคำสั่งผู้ว่าจ้าง", substitute: false }]);
    expect(restored.calendar.removed).toEqual(["2026-10-16"]);
    expect(restored.calendar.worksSaturday).toBe(false);
    expect(restored.calendar.worksSunday).toBe(false);
    expect(restored.rainPercent).toBe(10);
  });

  it("ไม่เก็บชุดวันหยุดตั้งต้นซ้ำลงไป เก็บเฉพาะส่วนที่ผู้ใช้แก้", () => {
    const written = JSON.parse(serialiseWorkPlan(snapshot));
    expect(written.calendar.added).toHaveLength(1);
    expect(JSON.stringify(written.calendar)).not.toContain("วันรัฐธรรมนูญ");
  });

  it("วันหยุดที่ไม่มีชื่อถูกทิ้ง เพราะเอาไปบอกผู้ใช้ไม่ได้ว่าหยุดเพราะอะไร", () => {
    const broken = JSON.parse(serialiseWorkPlan(snapshot));
    broken.calendar.added = [{ date: "2026-09-20", name: "" }, { date: "2026-09-21", name: "ตรวจงาน" }];
    const restored = parseWorkPlan(JSON.stringify(broken))!;
    expect(restored.calendar.added.map((one) => one.date)).toEqual(["2026-09-21"]);
  });

  it("เผื่อฝนที่ผิดรูปตกไปเป็นศูนย์ ไม่ปล่อยค่าประหลาดเข้าไปคูณกับระยะเวลา", () => {
    for (const bad of [-5, 150, 7.5, "10", null]) {
      const broken = JSON.parse(serialiseWorkPlan(snapshot));
      broken.rainPercent = bad;
      expect(parseWorkPlan(JSON.stringify(broken))!.rainPercent, String(bad)).toBe(0);
    }
  });

  it("ไฟล์รุ่นก่อนหน้าที่ยังไม่มีปฏิทิน ได้ค่าตั้งต้นและงานยังอยู่ครบ", () => {
    const older = JSON.parse(serialiseWorkPlan(snapshot));
    older.schemaVersion = 2;
    delete older.calendar;
    delete older.rainPercent;
    const restored = parseWorkPlan(JSON.stringify(older))!;

    expect(restored.calendar).toEqual(defaultWorkCalendar());
    expect(restored.rainPercent).toBe(0);
    expect(restored.activities).toHaveLength(2);
  });
});
