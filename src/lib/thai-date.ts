/**
 * แกนของปฏิทินเลือกวันที่ (Date Picker) แบบไทย — IP-202
 *
 * เจ้าของงานสั่ง 2026-08-28: ช่องกรอกวันที่ทั้งเว็บต้องเป็นเดือนไทย ปี พ.ศ. เพราะช่องกรอก
 * native ของเบราว์เซอร์โชว์ ค.ศ. ตามภาษาเครื่อง แต่ทั้งแอปแสดงผลเป็น พ.ศ. — คนทำแผนงานมั่ว
 *
 * ค่าที่ระบบเก็บภายในยังเป็น ISO (YYYY-MM-DD ค.ศ.) เหมือนเดิมทุกจุด ไฟล์นี้คือชั้นแปลง
 * เข้า/ออกเป็นภาษาคน ฟังก์ชันบริสุทธิ์ทั้งไฟล์ **ห้ามใช้ Date.parse กับข้อความไทย** —
 * parse ด้วย regex เอง และเช็คอธิกสุรทินจากปี ค.ศ. หลังแปลง −543 แล้วเท่านั้น
 * (2567 หาร 4 ไม่ลงตัว แต่ 2024 ลงตัว — เช็คจาก พ.ศ. ตรง ๆ จะผิด)
 */

import { shiftDays, weekdayOf } from "@/lib/work-calendar";

/** ชื่อเดือนไทยเต็ม — ของกลางหนึ่งเดียว (เดิมมีสำเนาซ้ำใน price-catalogue และ price-workspace) */
export const THAI_MONTH_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
] as const;

/** ชื่อเดือนไทยย่อ — ของกลางที่เดียวกับชื่อเต็ม ไม่งั้นสำเนาที่สามจะเกิดในวันที่มีคนต้องใช้อีกที่ */
export const THAI_MONTH_ABBR = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
] as const;

export const THAI_WEEKDAY_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"] as const;

export function toBuddhistYear(ceYear: number): number {
  return ceYear + 543;
}

export function toChristianYear(beYear: number): number {
  return beYear - 543;
}

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** แยก ISO เป็นตัวเลข — คืน null เมื่อรูปไม่ตรงหรือไม่ใช่วันจริง */
export function splitIso(iso: string): { year: number; month: number; day: number } | null {
  const match = ISO_PATTERN.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function daysInMonth(ceYear: number, month1to12: number): number {
  // วันที่ 0 ของเดือนถัดไป = วันสุดท้ายของเดือนนี้ (ตัวเลขล้วน ใช้ Date.UTC ได้)
  return new Date(Date.UTC(ceYear, month1to12, 0)).getUTCDate();
}

const pad = (value: number, width: number) => String(value).padStart(width, "0");

export function buildIso(ceYear: number, month1to12: number, day: number): string {
  return `${pad(ceYear, 4)}-${pad(month1to12, 2)}-${pad(day, 2)}`;
}

/** "2026-12-31" → "31 ธันวาคม 2569" (ป้าย/ปุ่ม) */
export function formatThaiDateLong(iso: string): string | null {
  const parts = splitIso(iso);
  if (!parts) return null;
  return `${parts.day} ${THAI_MONTH_FULL[parts.month - 1]} ${toBuddhistYear(parts.year)}`;
}

/** "2026-12-31" → "31/12/2569" (ค่าในช่องพิมพ์) */
export function formatThaiDateShort(iso: string): string | null {
  const parts = splitIso(iso);
  if (!parts) return null;
  return `${pad(parts.day, 2)}/${pad(parts.month, 2)}/${toBuddhistYear(parts.year)}`;
}

export type ThaiDateParse = { iso: string } | { error: string };

/**
 * รับที่คนไทยพิมพ์จริง: `31/12/2569` `31-12-2569` `31.12.2569` `31122569` — วัน/เดือน/ปี พ.ศ.
 * ปีต้องเป็น พ.ศ. ช่วง 2400–2700 เท่านั้น: คนเผลอพิมพ์ ค.ศ. ได้คำเตือนตรง ๆ ไม่เดาใจแปลงให้
 * เพราะการเดาผิดคือบั๊กเงียบในเอกสารสัญญา
 */
export function parseThaiDateInput(text: string): ThaiDateParse {
  const cleaned = text.trim();
  if (cleaned === "") return { error: "ยังไม่ได้กรอกวันที่" };
  const match = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(cleaned) ?? /^(\d{2})(\d{2})(\d{4})$/.exec(cleaned);
  if (!match) return { error: "กรอกเป็น วัน/เดือน/ปี พ.ศ. เช่น 31/12/2569" };
  const day = Number(match[1]);
  const month = Number(match[2]);
  const beYear = Number(match[3]);
  if (beYear < 2400 || beYear > 2700) {
    return { error: `ปีต้องเป็น พ.ศ. เช่น ${toBuddhistYear(new Date().getFullYear())} — ${beYear} อ่านเป็น พ.ศ. ไม่ได้` };
  }
  if (month < 1 || month > 12) return { error: `เดือน ${month} ไม่มีจริง` };
  const ceYear = toChristianYear(beYear);
  const limit = daysInMonth(ceYear, month);
  if (day < 1 || day > limit) {
    return { error: `${THAI_MONTH_FULL[month - 1]} ${beYear} มีถึงวันที่ ${limit}` };
  }
  return { iso: buildIso(ceYear, month, day) };
}

/**
 * ตารางเดือน 42 ช่อง (6 แถว × 7 คอลัมน์ เริ่มวันอาทิตย์) — ค่าเป็น ISO ของวันในเดือนนั้น
 * หรือ null สำหรับช่องนอกเดือน ใช้ weekdayOf ของ work-calendar ที่กันเขตเวลาแล้ว
 */
export function monthGrid(ceYear: number, month1to12: number): (string | null)[] {
  const first = buildIso(ceYear, month1to12, 1);
  const lead = weekdayOf(first); // 0 = อาทิตย์
  const total = daysInMonth(ceYear, month1to12);
  const cells: (string | null)[] = [];
  for (let index = 0; index < 42; index++) {
    const day = index - lead + 1;
    cells.push(day >= 1 && day <= total ? buildIso(ceYear, month1to12, day) : null);
  }
  return cells;
}

/** เลื่อนเดือน (delta เป็นเดือน บวก/ลบ) — คืน { year, month } ใหม่ */
export function shiftMonth(ceYear: number, month1to12: number, delta: number): { year: number; month: number } {
  const zeroBased = ceYear * 12 + (month1to12 - 1) + delta;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12 + 12) % 12 + 1 };
}

/** วันนี้ตามเวลาไทย (+7 คงที่ ไม่มี DST — หลักเดียวกับ thai-time.ts) */
export function todayIsoBangkok(now: Date = new Date()): string {
  const bangkok = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return buildIso(bangkok.getUTCFullYear(), bangkok.getUTCMonth() + 1, bangkok.getUTCDate());
}

/** เลื่อนวันแบบ re-export ให้ปฏิทินใช้ที่เดียว (ตัวจริงอยู่ work-calendar กันเขตเวลาแล้ว) */
export { shiftDays };
