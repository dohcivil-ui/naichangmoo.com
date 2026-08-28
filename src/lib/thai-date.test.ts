import { describe, expect, it } from "vitest";
import {
  buildIso,
  daysInMonth,
  formatThaiDateLong,
  formatThaiDateShort,
  monthGrid,
  parseThaiDateInput,
  shiftMonth,
  splitIso,
  toBuddhistYear,
  toChristianYear,
  todayIsoBangkok
} from "./thai-date";

describe("แกนปฏิทินเลือกวันที่แบบไทย (IP-202)", () => {
  it("พ.ศ. ↔ ค.ศ. ต่างกัน 543 ทั้งสองทาง", () => {
    expect(toBuddhistYear(2026)).toBe(2569);
    expect(toChristianYear(2569)).toBe(2026);
    expect(toChristianYear(toBuddhistYear(1999))).toBe(1999);
  });

  it("แสดงผลยาวและสั้นเป็นไทย พ.ศ. เสมอ", () => {
    expect(formatThaiDateLong("2026-12-31")).toBe("31 ธันวาคม 2569");
    expect(formatThaiDateShort("2026-12-31")).toBe("31/12/2569");
    expect(formatThaiDateLong("ไม่ใช่วันที่")).toBeNull();
  });

  it("พิมพ์ วัน/เดือน/ปี พ.ศ. ได้หลายแบบ รวมแบบไม่มีขีด", () => {
    expect(parseThaiDateInput("31/12/2569")).toEqual({ iso: "2026-12-31" });
    expect(parseThaiDateInput("31-12-2569")).toEqual({ iso: "2026-12-31" });
    expect(parseThaiDateInput("1/1/2570")).toEqual({ iso: "2027-01-01" });
    expect(parseThaiDateInput("31122569")).toEqual({ iso: "2026-12-31" });
  });

  it("อธิกสุรทินเช็คจากปี ค.ศ. หลังแปลง: 29/02/2567 จริง 29/02/2568 ไม่จริง", () => {
    expect(parseThaiDateInput("29/02/2567")).toEqual({ iso: "2024-02-29" });
    expect(parseThaiDateInput("29/02/2568")).toMatchObject({ error: expect.stringContaining("กุมภาพันธ์") });
  });

  it("วันเกินเดือนและเดือนไม่มีจริงถูกปฏิเสธพร้อมคำอธิบาย", () => {
    expect(parseThaiDateInput("31/04/2569")).toMatchObject({ error: expect.stringContaining("เมษายน") });
    expect(parseThaiDateInput("5/13/2569")).toMatchObject({ error: expect.stringContaining("13") });
  });

  it("ปี ค.ศ. ถูกปฏิเสธตรง ๆ ไม่เดาใจแปลงให้", () => {
    expect(parseThaiDateInput("31/12/2026")).toMatchObject({ error: expect.stringContaining("พ.ศ.") });
  });

  it("ไป-กลับ format ↔ parse ได้ค่าเดิม", () => {
    const iso = "2026-08-28";
    const typed = formatThaiDateShort(iso);
    expect(typed).not.toBeNull();
    expect(parseThaiDateInput(typed as string)).toEqual({ iso });
  });

  it("ตารางเดือน 42 ช่อง เริ่มช่องตามวันในสัปดาห์จริง — 1 ม.ค. 2569 คือวันพฤหัส (ช่อง index 4)", () => {
    const grid = monthGrid(2026, 1);
    expect(grid).toHaveLength(42);
    expect(grid[3]).toBeNull();
    expect(grid[4]).toBe("2026-01-01");
    expect(grid[4 + 30]).toBe("2026-01-31");
    expect(grid[4 + 31]).toBeNull();
  });

  it("เลื่อนเดือนข้ามปีได้ทั้งสองทิศ", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 6, -18)).toEqual({ year: 2024, month: 12 });
  });

  it("จำนวนวันในเดือนถูกทุกกรณีหัวเลี้ยว", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(daysInMonth(2100, 2)).toBe(28); // หาร 100 ลงตัวแต่ 400 ไม่ลงตัว
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  it("วันนี้ตามเวลาไทย: ห้านาทีก่อนเที่ยงคืน UTC ต้องเป็นวันถัดไปของไทยแล้ว", () => {
    expect(todayIsoBangkok(new Date("2026-08-28T23:55:00Z"))).toBe("2026-08-29");
    expect(todayIsoBangkok(new Date("2026-08-28T10:00:00Z"))).toBe("2026-08-28");
  });

  it("splitIso ปัดของปลอมทิ้ง", () => {
    expect(splitIso("2026-02-30")).toBeNull();
    expect(splitIso("2026-13-01")).toBeNull();
    expect(splitIso(buildIso(2026, 2, 28))).toEqual({ year: 2026, month: 2, day: 28 });
  });
});
