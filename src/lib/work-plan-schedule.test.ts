import { describe, expect, it } from "vitest";
import { defaultWorkCalendar, isWorkingDay, workingDaysBetween, type WorkCalendar } from "./work-calendar";
import {
  activitiesOnCalendar,
  daysBetween,
  DEFAULT_DURATION_UNIT,
  LEGACY_DURATION_UNIT,
  planEndUnder,
  projectDemand,
  scheduleActivities
} from "./work-plan-schedule";
import type { PlanActivity } from "./work-plan";

const calendar = (): WorkCalendar => defaultWorkCalendar();

const activity = (over: Partial<PlanActivity> = {}): PlanActivity => ({
  id: "a1",
  number: "1.1",
  title: "งานเตรียมการ",
  startOffsetDays: 0,
  durationDays: 20,
  costSatang: 100_000n,
  ...over
});

/** 1 สิงหาคม 2569 ระยะเวลา 210 วัน คือชุดตัวเลขเดียวกับที่หน้าจอปฏิทินถูกตรวจด้วยใน v0.52.0 */
const START = "2026-08-01";
const CONTRACT_DAYS = 210;

describe("daysBetween", () => {
  it("นับระยะห่างเป็นวัน ไม่ใช่จำนวนวัน", () => {
    expect(daysBetween("2026-08-01", "2026-08-01")).toBe(0);
    expect(daysBetween("2026-08-01", "2026-08-02")).toBe(1);
    expect(daysBetween("2026-08-31", "2026-09-01")).toBe(1);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });
});

describe("โหมดวันตามสัญญา คือพฤติกรรมเดิมทุกประการ", () => {
  it("ไม่แปลงกิจกรรมเลย ชั้นคำนวณแผนจึงได้ของชุดเดิม", () => {
    const activities = [activity(), activity({ id: "a2", startOffsetDays: 30, durationDays: 45 })];
    const scheduled = scheduleActivities(activities, { startDate: START, unit: "contract", calendar: calendar() });

    expect(activitiesOnCalendar(scheduled)).toEqual(activities);
    expect(scheduled.every((entry) => entry.shifted === false)).toBe(true);
  });

  it("วางกิจกรรมตามปฏิทินล้วน แม้วันเริ่มจะตกวันอาทิตย์", () => {
    // 2026-08-02 เป็นวันอาทิตย์ โหมดนี้ไม่เลื่อนให้ เพราะแผนที่กรอกแบบนี้ตั้งใจให้เป็นแบบนี้
    const [entry] = scheduleActivities([activity({ startOffsetDays: 1, durationDays: 10 })], {
      startDate: START,
      unit: "contract",
      calendar: calendar()
    });

    expect(isWorkingDay(calendar(), "2026-08-02")).toBe(false);
    expect(entry!.startDate).toBe("2026-08-02");
    expect(entry!.endDate).toBe("2026-08-11");
  });
});

describe("โหมดวันทำงาน", () => {
  it("กิจกรรมไม่เริ่มในวันที่ไม่มีใครมาทำงาน และบอกว่าเลื่อนมาจากวันไหน", () => {
    const [entry] = scheduleActivities([activity({ startOffsetDays: 1, durationDays: 10 })], {
      startDate: START,
      unit: "working",
      calendar: calendar()
    });

    expect(entry!.contractStartDate).toBe("2026-08-02");
    expect(entry!.shifted).toBe(true);
    expect(isWorkingDay(calendar(), entry!.startDate)).toBe(true);
  });

  it("ระยะเวลาที่พิมพ์คือจำนวนวันทำงานจริง ไม่ใช่ช่วงวันบนปฏิทิน", () => {
    const [entry] = scheduleActivities([activity({ durationDays: 20 })], {
      startDate: START,
      unit: "working",
      calendar: calendar()
    });

    expect(workingDaysBetween(calendar(), entry!.startDate, entry!.endDate)).toBe(20);
    // ช่วงบนปฏิทินต้องกว้างกว่ายี่สิบวัน เพราะมีวันหยุดคั่นอยู่
    expect(daysBetween(entry!.startDate, entry!.endDate) + 1).toBeGreaterThan(20);
  });

  it("แปลงกลับเป็นวันตามสัญญาให้ชั้นคำนวณแผน โดยความกว้างตรงกับช่วงจริงบนปฏิทิน", () => {
    const [entry] = scheduleActivities([activity({ startOffsetDays: 5, durationDays: 20 })], {
      startDate: START,
      unit: "working",
      calendar: calendar()
    });

    expect(entry!.onCalendar.startOffsetDays).toBe(daysBetween(START, entry!.startDate));
    expect(entry!.onCalendar.durationDays).toBe(daysBetween(entry!.startDate, entry!.endDate) + 1);
  });

  it("ไม่เขียนทับตัวเลขที่ผู้ใช้พิมพ์ สลับหน่วยกลับไปกลับมากี่รอบก็ได้เลขเดิม", () => {
    const typed = activity({ startOffsetDays: 5, durationDays: 20 });
    const options = { startDate: START, calendar: calendar() };

    const working = scheduleActivities([typed], { ...options, unit: "working" as const })[0]!;
    const back = scheduleActivities([working.typed], { ...options, unit: "contract" as const })[0]!;

    expect(working.typed).toEqual(typed);
    expect(back.typed).toEqual(typed);
    expect(back.onCalendar).toEqual(typed);
  });

  it("หมุดหมายที่ไม่กินเวลายังกินหนึ่งวันทำงานเสมอ ไม่หายไปจากแผน", () => {
    const [entry] = scheduleActivities([activity({ durationDays: 0 })], {
      startDate: START,
      unit: "working",
      calendar: calendar()
    });

    expect(entry!.startDate).toBe(entry!.endDate);
    expect(isWorkingDay(calendar(), entry!.startDate)).toBe(true);
  });
});

describe("planEndUnder ตอบก่อนผู้ใช้ยืนยันการสลับสวิตช์", () => {
  it("เลขชุดเดียวกันให้วันจบคนละวันเมื่ออ่านคนละหน่วย และวันทำงานจบช้ากว่าเสมอ", () => {
    const activities = [activity({ startOffsetDays: 0, durationDays: 60 })];
    const asContract = planEndUnder(activities, { startDate: START, unit: "contract", calendar: calendar() });
    const asWorking = planEndUnder(activities, { startDate: START, unit: "working", calendar: calendar() });

    expect(asContract).not.toBe(asWorking);
    expect(asWorking > asContract).toBe(true);
  });

  it("ไม่มีกิจกรรมก็ไม่มีวันจบ ไม่ใช่วันที่เดาเอา", () => {
    expect(planEndUnder([], { startDate: START, unit: "working", calendar: calendar() })).toBe("");
  });
});

describe("projectDemand เทียบสิ่งที่แผนต้องการกับสิ่งที่สัญญาให้", () => {
  const demandOf = (activities: PlanActivity[], unit: "contract" | "working", rainPercent = 0) =>
    projectDemand({
      scheduled: scheduleActivities(activities, { startDate: START, unit, calendar: calendar() }),
      startDate: START,
      contractDays: CONTRACT_DAYS,
      calendar: calendar(),
      rainPercent
    });

  it("วันทำงานที่สัญญาให้ ตรงกับเลขที่หน้าจอปฏิทินถูกตรวจไว้", () => {
    expect(demandOf([], "working").available).toBe(170);
    expect(demandOf([], "working").contractEndDate).toBe("2027-02-26");
  });

  it("แผนที่พอดีสัญญาไม่มีวันเกิน", () => {
    const demand = demandOf([activity({ startOffsetDays: 0, durationDays: 100 })], "working");
    expect(demand.required).toBe(100);
    expect(demand.overrun).toBe(0);
  });

  it("ค่าเผื่อฝนบวกที่ระดับโครงการ และปัดขึ้นเสมอ", () => {
    const demand = demandOf([activity({ startOffsetDays: 0, durationDays: 100 })], "working", 10);
    expect(demand.required).toBe(100);
    expect(demand.requiredWithRain).toBe(110);
    expect(demand.rainDays).toBe(10);
    expect(demand.overrun).toBe(0);
  });

  it("บอกว่าเกินสัญญาไปกี่วัน แทนที่จะห้ามไว้เฉย ๆ", () => {
    const demand = demandOf([activity({ startOffsetDays: 0, durationDays: 165 })], "working", 15);
    expect(demand.required).toBe(165);
    expect(demand.requiredWithRain).toBe(190);
    expect(demand.overrun).toBe(190 - 170);
  });

  it("ค่าเผื่อฝนไม่แตะตัวเลขของกิจกรรมรายตัว", () => {
    const typed = activity({ durationDays: 100 });
    const scheduled = scheduleActivities([typed], { startDate: START, unit: "working", calendar: calendar() });
    projectDemand({ scheduled, startDate: START, contractDays: CONTRACT_DAYS, calendar: calendar(), rainPercent: 15 });

    expect(scheduled[0]!.typed.durationDays).toBe(100);
    expect(scheduled[0]!.onCalendar.durationDays).toBe(daysBetween(scheduled[0]!.startDate, scheduled[0]!.endDate) + 1);
  });

  it("ยังไม่ได้ตั้งวันเริ่มหรือระยะเวลา ก็ยังไม่ตอบอะไรทั้งนั้น", () => {
    const blank = projectDemand({
      scheduled: [],
      startDate: "",
      contractDays: 0,
      calendar: calendar(),
      rainPercent: 10
    });
    expect(blank).toEqual({
      available: 0,
      required: 0,
      requiredWithRain: 0,
      rainDays: 0,
      overrun: 0,
      planEndDate: "",
      contractEndDate: ""
    });
  });
});

describe("ค่าตั้งต้นของหน่วย", () => {
  it("โครงการใหม่เป็นวันทำงาน แผนที่บันทึกไว้ก่อนมีสวิตช์เป็นวันตามสัญญา", () => {
    expect(DEFAULT_DURATION_UNIT).toBe("working");
    expect(LEGACY_DURATION_UNIT).toBe("contract");
  });
});
