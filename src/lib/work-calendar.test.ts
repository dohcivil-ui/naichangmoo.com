import { describe, expect, it } from "vitest";
import {
  buddhistYearOf,
  coveredYears,
  defaultHolidays,
  holidayYear,
  provisionalYears,
  yearsWithoutData
} from "./thai-holidays";
import {
  defaultWorkCalendar,
  endOfWorkingDays,
  isWorkingDay,
  nextWorkingDay,
  nonWorkingDaysBetween,
  nonWorkingReason,
  rainAllowanceDays,
  shiftDays,
  weekdayOf,
  withRainAllowance,
  workingDaysBetween,
  type WorkCalendar
} from "./work-calendar";

const calendar = () => defaultWorkCalendar();

describe("shiftDays และ weekdayOf", () => {
  it("เลื่อนวันข้ามสิ้นเดือนและข้ามปีได้ถูกต้อง", () => {
    expect(shiftDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(shiftDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDays("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("อ่านวันในสัปดาห์ได้ตรง โดยไม่ขึ้นกับเขตเวลาของเครื่อง", () => {
    // 1 สิงหาคม 2569 เป็นวันเสาร์ · 2 สิงหาคมเป็นวันอาทิตย์
    expect(weekdayOf("2026-08-01")).toBe(6);
    expect(weekdayOf("2026-08-02")).toBe(0);
  });

  it("วันที่ใช้ไม่ได้คืนค่าเดิม ไม่โยน error ใส่หน้าจอ", () => {
    expect(shiftDays("ไม่ใช่วันที่", 5)).toBe("ไม่ใช่วันที่");
    expect(weekdayOf("")).toBe(-1);
  });
});

describe("วันไหนทำงานได้", () => {
  it("เสาร์ทำงาน อาทิตย์หยุด — ตรงกับหน้างานก่อสร้างไทย ไม่ใช่ปฏิทินสำนักงานห้าวัน", () => {
    expect(isWorkingDay(calendar(), "2026-08-01")).toBe(true);
    expect(isWorkingDay(calendar(), "2026-08-02")).toBe(false);
  });

  it("วันหยุดราชการหยุด และบอกชื่อวันได้", () => {
    const reason = nonWorkingReason(calendar(), "2026-12-10");
    expect(reason?.kind).toBe("holiday");
    expect(reason?.name).toBe("วันรัฐธรรมนูญ");
  });

  it("วันหยุดที่ตรงกับวันเสาร์ยังต้องหยุด เพราะที่นี่เสาร์เป็นวันทำงาน", () => {
    // 5 ธันวาคม 2569 ตรงกับวันเสาร์ ปฏิทินธนาคารมักตัดออกเพราะเสาร์หยุดอยู่แล้ว
    expect(weekdayOf("2026-12-05")).toBe(6);
    expect(isWorkingDay(calendar(), "2026-12-05")).toBe(false);
    expect(nonWorkingReason(calendar(), "2026-12-05")?.kind).toBe("holiday");
  });

  it("วันชดเชยหยุดด้วย และรู้ว่าเป็นวันชดเชย", () => {
    const reason = nonWorkingReason(calendar(), "2026-12-07");
    expect(reason?.kind).toBe("holiday");
    if (reason?.kind === "holiday") expect(reason.holiday.substitute).toBe(true);
  });

  it("บอกเหตุผลของวันหยุดประจำสัปดาห์เป็นชื่อวัน ไม่ใช่แค่ว่าหยุด", () => {
    expect(nonWorkingReason(calendar(), "2026-08-02")).toEqual({ kind: "weekend", name: "วันอาทิตย์" });
  });
});

describe("ผู้ใช้แก้ปฏิทินเองได้", () => {
  it("เอาวันหยุดที่ชุดตั้งต้นให้มาออกได้ เมื่อโครงการนี้ไม่หยุด", () => {
    const custom: WorkCalendar = { ...calendar(), removed: ["2026-10-16"] };
    expect(isWorkingDay(calendar(), "2026-10-16")).toBe(false);
    expect(isWorkingDay(custom, "2026-10-16")).toBe(true);
  });

  it("เพิ่มวันหยุดของโครงการเองได้ เช่น วันที่หน่วยงานสั่งหยุด", () => {
    const custom: WorkCalendar = {
      ...calendar(),
      holidays: [...calendar().holidays, { date: "2026-09-14", name: "หยุดตามคำสั่งผู้ว่าจ้าง" }]
    };
    expect(isWorkingDay(calendar(), "2026-09-14")).toBe(true);
    expect(nonWorkingReason(custom, "2026-09-14")?.name).toBe("หยุดตามคำสั่งผู้ว่าจ้าง");
  });

  it("สั่งทำงานวันอาทิตย์ได้ เมื่อโครงการเร่ง", () => {
    const custom: WorkCalendar = { ...calendar(), worksSunday: true };
    expect(isWorkingDay(custom, "2026-08-02")).toBe(true);
  });

  it("สั่งหยุดวันเสาร์ได้ สำหรับงานที่ใช้ปฏิทินสำนักงาน", () => {
    const custom: WorkCalendar = { ...calendar(), worksSaturday: false };
    expect(nonWorkingReason(custom, "2026-08-01")).toEqual({ kind: "weekend", name: "วันเสาร์" });
  });
});

describe("แปลงระหว่างวันทำงานกับวันปฏิทิน", () => {
  it("นับวันเริ่มเป็นวันทำงานวันที่หนึ่ง ตามที่ตารางแผนงานก่อสร้างนับกัน", () => {
    // 3 ส.ค. 2569 เป็นวันจันทร์ · ทำงานห้าวันคือจันทร์ถึงศุกร์
    expect(weekdayOf("2026-08-03")).toBe(1);
    expect(endOfWorkingDays(calendar(), "2026-08-03", 5)).toBe("2026-08-07");
  });

  it("ข้ามวันอาทิตย์ให้ แต่ไม่ข้ามวันเสาร์", () => {
    // จันทร์ 3 ส.ค. ทำงานเจ็ดวัน: จ อ พ พฤ ศ ส แล้วข้ามอาทิตย์ ไปจบวันจันทร์ที่ 10
    expect(endOfWorkingDays(calendar(), "2026-08-03", 7)).toBe("2026-08-10");
  });

  it("เริ่มวันที่ทำงานไม่ได้ ให้เลื่อนไปเริ่มวันทำงานถัดไปก่อน", () => {
    expect(nextWorkingDay(calendar(), "2026-08-02")).toBe("2026-08-03");
    expect(endOfWorkingDays(calendar(), "2026-08-02", 1)).toBe("2026-08-03");
  });

  it("หมุดหมายที่ไม่กินเวลา จบวันเดียวกับที่เริ่ม", () => {
    expect(endOfWorkingDays(calendar(), "2026-08-03", 0)).toBe("2026-08-03");
    expect(endOfWorkingDays(calendar(), "2026-08-03", 1)).toBe("2026-08-03");
  });

  it("ข้ามวันหยุดยาวสงกรานต์ได้ถูกต้อง", () => {
    // 13-15 เม.ย. 2569 เป็นวันสงกรานต์ทั้งสามวัน
    for (const date of ["2026-04-13", "2026-04-14", "2026-04-15"]) {
      expect(isWorkingDay(calendar(), date), date).toBe(false);
    }
    // เริ่มศุกร์ 10 เม.ย. ทำงานสามวัน: ศ 10, ส 11, ข้ามอาทิตย์ 12 และสงกรานต์ 13-15 ไปจบพฤหัส 16
    expect(weekdayOf("2026-04-10")).toBe(5);
    expect(endOfWorkingDays(calendar(), "2026-04-10", 3)).toBe("2026-04-16");
  });

  it("นับวันทำงานในช่วงได้ตรง โดยรวมทั้งวันแรกและวันสุดท้าย", () => {
    // 3-9 ส.ค. 2569 คือจันทร์ถึงอาทิตย์ ทำงานหกวันเพราะหยุดอาทิตย์เดียว
    expect(workingDaysBetween(calendar(), "2026-08-03", "2026-08-09")).toBe(6);
  });

  it("ช่วงที่กลับหัวกลับหางคืนศูนย์ ไม่วนไม่จบ", () => {
    expect(workingDaysBetween(calendar(), "2026-08-09", "2026-08-03")).toBe(0);
  });

  it("ปฏิทินที่ไม่เหลือวันทำงานเลย ต้องหยุดเองไม่วนค้าง", () => {
    const closed: WorkCalendar = { ...calendar(), worksSaturday: false, worksSunday: false,
      holidays: Array.from({ length: 420 }, (_unused, index) => ({
        date: shiftDays("2026-08-03", index), name: "ปิดงาน"
      })) };
    expect(() => nextWorkingDay(closed, "2026-08-03")).not.toThrow();
  });
});

describe("บอกได้ว่าวันไหนหายไปเพราะอะไร", () => {
  it("คืนรายการวันที่ทำงานไม่ได้พร้อมเหตุผล — สิ่งที่ระบบคู่แข่งตอบไม่ได้", () => {
    const lost = nonWorkingDaysBetween(calendar(), "2026-12-04", "2026-12-10");
    const byDate = Object.fromEntries(lost.map((entry) => [entry.date, entry.reason.name]));

    expect(byDate["2026-12-05"]).toContain("วันคล้ายวันพระบรมราชสมภพ");
    expect(byDate["2026-12-06"]).toBe("วันอาทิตย์");
    expect(byDate["2026-12-07"]).toBe("ชดเชยวันพ่อแห่งชาติ");
    expect(byDate["2026-12-10"]).toBe("วันรัฐธรรมนูญ");
    expect(byDate["2026-12-08"]).toBeUndefined();
  });
});

describe("เผื่อวันฝน", () => {
  it("เผื่อเป็นเปอร์เซ็นต์ของระยะเวลา ตามที่เจ้าของงานเลือก", () => {
    expect(withRainAllowance(100, 0)).toBe(100);
    expect(withRainAllowance(100, 5)).toBe(105);
    expect(withRainAllowance(100, 10)).toBe(110);
    expect(withRainAllowance(100, 15)).toBe(115);
  });

  it("ปัดขึ้นเสมอ เพราะปัดลงทำให้แผนสั้นกว่าจริงในทางที่ผู้รับเหมาเสียหาย", () => {
    // 30 วันเผื่อ 5% ได้ 31.5 ต้องได้ 32 ไม่ใช่ 31
    expect(withRainAllowance(30, 5)).toBe(32);
    expect(rainAllowanceDays(30, 5)).toBe(2);
  });

  it("ระยะเวลาศูนย์หรือติดลบ ไม่เผื่อและไม่ติดลบ", () => {
    expect(withRainAllowance(0, 15)).toBe(0);
    expect(withRainAllowance(-5, 15)).toBe(0);
  });
});

describe("ชุดข้อมูลวันหยุด", () => {
  it("แปลงปีพุทธศักราชถูกต้อง", () => {
    expect(buddhistYearOf("2026-08-26")).toBe(2569);
    expect(buddhistYearOf("2027-01-01")).toBe(2570);
  });

  it("ครอบคลุมสองปีที่มีประกาศแล้ว", () => {
    expect(coveredYears()).toEqual([2569, 2570]);
  });

  it("ไม่มีวันที่ซ้ำกันในชุดข้อมูล", () => {
    const dates = defaultHolidays().map((holiday) => holiday.date);
    expect(dates.length - new Set(dates).size).toBe(0);
  });

  it("เรียงตามวันที่เสมอ", () => {
    const dates = defaultHolidays().map((holiday) => holiday.date);
    expect([...dates].sort((a, b) => a.localeCompare(b))).toEqual(dates);
  });

  it("ปีที่ยังไม่นิ่ง ต้องบอกผู้ใช้ก่อนเอาไปผูกสัญญา", () => {
    expect(holidayYear(2569)?.status).toBe("confirmed");
    expect(holidayYear(2570)?.status).toBe("provisional");
    expect(holidayYear(2570)?.note).toContain("ยังไม่นิ่ง");
    expect(provisionalYears("2026-08-01", "2027-02-26").map((entry) => entry.buddhistYear)).toEqual([2570]);
  });

  it("ปีที่ไม่มีข้อมูลต้องรายงานออกมา ไม่ใช่เงียบแล้วนับทั้งปีเป็นวันทำงาน", () => {
    expect(yearsWithoutData("2026-08-01", "2027-02-26")).toEqual([]);
    expect(yearsWithoutData("2026-08-01", "2029-01-01")).toEqual([2571, 2572]);
  });
});
