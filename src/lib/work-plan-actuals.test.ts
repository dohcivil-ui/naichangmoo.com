import { describe, expect, it } from "vitest";
import { activityWeights, type PlanActivity } from "./work-plan";
import { buildMilestoneSchedule, percentToPpm, type ContractTerms, type Milestone } from "./payment-milestone";
import {
  buildActualSeries,
  cashPosition,
  certifiedPpm,
  checkDeductions,
  countHiddenEvents,
  daysBetween,
  expectedNetForCertified,
  hasHappened,
  latestOf,
  latestRecordedDate,
  milestoneStatuses,
  stageOf,
  type MilestoneActual
} from "./work-plan-actuals";

const baht = (amount: number) => BigInt(amount) * 100n;

/**
 * โจทย์ชุดนี้ถอดมาจากของจริงที่เข้าไปดูเมื่อ 2026-08-26 ตรง ๆ
 * งวดที่ 1 ของโครงการตัวอย่าง: ยื่นเบิก 19 ส.ค. · รับรอง 23 ส.ค. · เงินเข้า 30 ส.ค.
 * เมื่อวันตัดข้อมูลคือ 25 ส.ค. เส้นเงินรับจริงต้องเป็นศูนย์ ขณะที่อีกสองเส้นขึ้นเต็มจำนวน
 */
const milestoneOne: MilestoneActual = {
  milestoneId: "m1",
  requested: { satang: baht(305_000), date: "2026-08-19" },
  certified: { satang: baht(305_000), date: "2026-08-23" },
  received: { satang: baht(311_100), date: "2026-08-30" }
};

describe("daysBetween", () => {
  it("นับวันปฏิทินระหว่างสองวัน และคืนค่าลบเมื่อวันหลังมาก่อน", () => {
    expect(daysBetween("2026-08-19", "2026-08-25")).toBe(6);
    expect(daysBetween("2026-08-30", "2026-08-25")).toBe(-5);
    expect(daysBetween("2026-08-25", "2026-08-25")).toBe(0);
  });

  it("ข้ามสิ้นเดือนและข้ามปีได้ถูกต้อง", () => {
    expect(daysBetween("2026-08-31", "2026-09-01")).toBe(1);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });

  it("คืนศูนย์เมื่อวันที่ใช้ไม่ได้ แทนที่จะโยน error ใส่หน้าจอผู้ใช้", () => {
    expect(daysBetween("", "2026-08-25")).toBe(0);
    expect(daysBetween("ไม่ใช่วันที่", "2026-08-25")).toBe(0);
  });
});

describe("hasHappened", () => {
  it("เหตุการณ์วันเดียวกับวันตัดข้อมูล ถือว่าเกิดขึ้นแล้ว", () => {
    expect(hasHappened({ satang: 1n, date: "2026-08-25" }, "2026-08-25")).toBe(true);
  });

  it("เหตุการณ์หลังวันตัดข้อมูล ยังไม่เกิด", () => {
    expect(hasHappened({ satang: 1n, date: "2026-08-26" }, "2026-08-25")).toBe(false);
  });

  it("ยอดที่ยังไม่มีวัน เอาไปวางบนแกนเวลาไม่ได้", () => {
    expect(hasHappened({ satang: baht(1_000), date: "" }, "2026-08-25")).toBe(false);
    expect(hasHappened(undefined, "2026-08-25")).toBe(false);
  });
});

describe("buildActualSeries — ตัดที่วันตัดข้อมูลทีละเหตุการณ์", () => {
  it("งวดเดียวกันขึ้นยอดขอเบิกและยอดรับรอง แต่เงินเข้ายังไม่ขึ้น เพราะลงวันที่หลังวันตัดข้อมูล", () => {
    const series = buildActualSeries([milestoneOne], "2026-08-25");

    expect(latestOf(series.requested)).toBe(baht(305_000));
    expect(latestOf(series.certified)).toBe(baht(305_000));
    expect(latestOf(series.received)).toBe(0n);
    expect(series.received).toHaveLength(0);
  });

  it("เลื่อนวันตัดข้อมูลไปหลังวันเงินเข้า แล้วเส้นเงินรับจริงจึงขึ้น", () => {
    const series = buildActualSeries([milestoneOne], "2026-08-31");
    expect(latestOf(series.received)).toBe(baht(311_100));
  });

  it("เรียงตามวันของเหตุการณ์ ไม่ใช่ตามลำดับงวด เพราะงวดหลังอาจได้เงินก่อนงวดก่อน", () => {
    const late: MilestoneActual = {
      milestoneId: "m4",
      received: { satang: baht(100_000), date: "2026-09-10" }
    };
    const early: MilestoneActual = {
      milestoneId: "m5",
      received: { satang: baht(40_000), date: "2026-09-01" }
    };

    const series = buildActualSeries([late, early], "2026-09-30");

    expect(series.received.map((point) => point.date)).toEqual(["2026-09-01", "2026-09-10"]);
    expect(series.received[0]!.cumulativeSatang).toBe(baht(40_000));
    expect(series.received[1]!.cumulativeSatang).toBe(baht(140_000));
  });

  it("ยอดสะสมเป็นผลบวกสะสมจริง ไม่ใช่ยอดล่าสุดของแต่ละงวด", () => {
    const actuals: MilestoneActual[] = [
      { milestoneId: "m1", certified: { satang: baht(305_000), date: "2026-08-23" } },
      { milestoneId: "m2", certified: { satang: baht(610_000), date: "2026-09-23" } }
    ];
    const series = buildActualSeries(actuals, "2026-10-01");
    expect(series.certified.map((point) => point.cumulativeSatang)).toEqual([baht(305_000), baht(915_000)]);
  });
});

describe("countHiddenEvents", () => {
  it("นับบันทึกที่ลงวันที่หลังวันตัดข้อมูล เพื่อบอกผู้ใช้ว่าซ่อนไปกี่รายการ", () => {
    expect(countHiddenEvents([milestoneOne], "2026-08-25")).toBe(1);
    expect(countHiddenEvents([milestoneOne], "2026-08-20")).toBe(2);
    expect(countHiddenEvents([milestoneOne], "2026-08-31")).toBe(0);
  });
});

describe("latestRecordedDate", () => {
  it("คืนวันล่าสุดในบรรดาบันทึกทั้งหมด เพื่อใช้เป็นค่าตั้งต้นของวันตัดข้อมูล", () => {
    expect(latestRecordedDate([milestoneOne])).toBe("2026-08-30");
  });

  it("คืน null เมื่อยังไม่มีบันทึกเลย ให้ผู้เรียกไปใช้วันนี้แทน", () => {
    expect(latestRecordedDate([])).toBeNull();
    expect(latestRecordedDate([{ milestoneId: "m1" }])).toBeNull();
  });
});

describe("stageOf และ milestoneStatuses — สถานะอนุมานจากข้อมูล ไม่ใช่ช่องให้เลือกเอง", () => {
  it("สถานะไล่ตามเหตุการณ์ที่เกิดจริง", () => {
    expect(stageOf(undefined)).toBe("planned");
    expect(stageOf({ milestoneId: "m1" })).toBe("planned");
    expect(stageOf({ milestoneId: "m1", requested: { satang: 1n, date: "2026-08-19" } })).toBe("requested");
    expect(stageOf(milestoneOne)).toBe("paid");
  });

  it("สถานะ ณ วันตัดข้อมูล ไม่นับเหตุการณ์ที่ยังไม่เกิด", () => {
    const [status] = milestoneStatuses([milestoneOne], "2026-08-25");
    expect(status!.stage).toBe("certified");
    expect(status!.awaitingPaymentDays).toBe(2);
    expect(status!.certifiedNotPaidSatang).toBe(baht(305_000));
  });

  it("เมื่อเงินเข้าแล้ว ไม่มียอดค้างรับและไม่นับวันรออีก", () => {
    const [status] = milestoneStatuses([milestoneOne], "2026-08-31");
    expect(status!.stage).toBe("paid");
    expect(status!.awaitingPaymentDays).toBeNull();
    expect(status!.certifiedNotPaidSatang).toBe(0n);
  });
});

describe("cashPosition", () => {
  it("บอกยอดที่ทำแล้วยังไม่ได้รับ และยอดที่ยื่นแล้วยังไม่มีใครรับรอง", () => {
    const actuals: MilestoneActual[] = [
      {
        milestoneId: "m1",
        requested: { satang: baht(2_745_000), date: "2026-11-01" },
        certified: { satang: baht(2_470_000), date: "2026-11-10" },
        received: { satang: baht(1_598_000), date: "2026-11-14" }
      }
    ];
    const position = cashPosition(buildActualSeries(actuals, "2026-11-15"));

    expect(position.certifiedNotPaidSatang).toBe(baht(872_000));
    expect(position.requestedNotCertifiedSatang).toBe(baht(275_000));
  });
});

/**
 * โครงการ 6,100,000 บาท 20 กิจกรรมเท่ากัน งวดละ 1 กิจกรรม
 * ชุดเดียวกับที่ `payment-milestone.test.ts` ใช้ เพื่อให้ตรวจย้อนข้ามไฟล์ได้
 */
const activities: PlanActivity[] = Array.from({ length: 20 }, (_unused, index) => ({
  id: `a${index + 1}`,
  number: `1.${index + 1}`,
  title: `งานที่ ${index + 1}`,
  startOffsetDays: index * 15,
  durationDays: 15,
  costSatang: baht(305_000)
}));

const milestones: Milestone[] = Array.from({ length: 20 }, (_unused, index) => ({
  id: `m${index + 1}`,
  ordinal: index + 1,
  title: `งวดที่ ${index + 1}`,
  activityIds: [`a${index + 1}`]
}));

const terms: ContractTerms = {
  contractSatang: baht(6_100_000),
  advancePpm: 0n,
  advanceRecovery: "proportional",
  retentionPpm: percentToPpm("5"),
  retentionMethod: "each",
  vatPpm: percentToPpm("7"),
  withholdingPpm: 0n
};

const schedule = buildMilestoneSchedule(activityWeights(activities), milestones, terms);

describe("expectedNetForCertified", () => {
  it("รับรองเต็มจำนวน ได้ยอดสุทธิเท่ากับที่ระบบคำนวณไว้ทุกสตางค์", () => {
    const row = schedule.rows[0]!;
    expect(row.periodWorkSatang).toBe(baht(305_000));
    expect(row.netSatang).toBe(baht(311_100));
    expect(expectedNetForCertified(row, baht(305_000))).toBe(baht(311_100));
  });

  it("รับรองมาครึ่งเดียว ทุกบรรทัดการหักลดลงครึ่งหนึ่งตาม", () => {
    const row = schedule.rows[0]!;
    // 152,500 + VAT 10,675 − ประกัน 7,625 = 155,550
    expect(expectedNetForCertified(row, baht(152_500))).toBe(baht(155_550));
  });

  it("งวดที่ไม่มีมูลค่างาน คืนศูนย์ ไม่หารด้วยศูนย์", () => {
    const empty = { ...schedule.rows[0]!, periodWorkSatang: 0n };
    expect(expectedNetForCertified(empty, baht(100_000))).toBe(0n);
  });
});

describe("checkDeductions — ทักเมื่อถูกหักเกิน", () => {
  it("เงินเข้าตรงกับที่ควรได้ ไม่ทักอะไรเลย", () => {
    const actuals: MilestoneActual[] = [
      {
        milestoneId: "m1",
        certified: { satang: baht(305_000), date: "2026-08-23" },
        received: { satang: baht(311_100), date: "2026-08-24" }
      }
    ];
    expect(checkDeductions(schedule.rows, actuals, "2026-08-25")).toEqual([]);
  });

  it("ถูกหักเกินไป 12,400 บาท ต้องทักพร้อมบอกยอดที่ควรได้", () => {
    const actuals: MilestoneActual[] = [
      {
        milestoneId: "m1",
        certified: { satang: baht(305_000), date: "2026-08-23" },
        received: { satang: baht(298_700), date: "2026-08-24" }
      }
    ];
    const [finding] = checkDeductions(schedule.rows, actuals, "2026-08-25");

    expect(finding!.milestoneId).toBe("m1");
    expect(finding!.expectedNetSatang).toBe(baht(311_100));
    expect(finding!.shortfallSatang).toBe(baht(12_400));
  });

  it("ได้เงินเกินกว่าที่ควรได้ ก็ต้องทักเหมือนกัน เพราะอาจเป็นการจ่ายซ้ำ", () => {
    const actuals: MilestoneActual[] = [
      {
        milestoneId: "m1",
        certified: { satang: baht(305_000), date: "2026-08-23" },
        received: { satang: baht(320_000), date: "2026-08-24" }
      }
    ];
    const [finding] = checkDeductions(schedule.rows, actuals, "2026-08-25");
    expect(finding!.shortfallSatang).toBe(-baht(8_900));
  });

  it("ต่างกันไม่กี่สตางค์ถือว่าเป็นการปัดเศษของฝ่ายการเงิน ไม่ต้องทัก", () => {
    const actuals: MilestoneActual[] = [
      {
        milestoneId: "m1",
        certified: { satang: baht(305_000), date: "2026-08-23" },
        received: { satang: baht(311_100) - 50n, date: "2026-08-24" }
      }
    ];
    expect(checkDeductions(schedule.rows, actuals, "2026-08-25")).toEqual([]);
  });

  it("เงินยังไม่เข้า ณ วันตัดข้อมูล ยังไม่ตัดสินว่าถูกหักเกิน", () => {
    const actuals: MilestoneActual[] = [
      {
        milestoneId: "m1",
        certified: { satang: baht(305_000), date: "2026-08-23" },
        received: { satang: baht(200_000), date: "2026-08-30" }
      }
    ];
    expect(checkDeductions(schedule.rows, actuals, "2026-08-25")).toEqual([]);
  });
});

describe("certifiedPpm", () => {
  it("คิดสัดส่วนของมูลค่าสัญญาโดยไม่ผ่าน float", () => {
    expect(certifiedPpm(baht(305_000), baht(6_100_000))).toBe(50_000n);
    expect(certifiedPpm(baht(6_100_000), baht(6_100_000))).toBe(1_000_000n);
  });

  it("มูลค่าสัญญาเป็นศูนย์ คืนศูนย์ ไม่หารด้วยศูนย์", () => {
    expect(certifiedPpm(baht(100), 0n)).toBe(0n);
  });
});
