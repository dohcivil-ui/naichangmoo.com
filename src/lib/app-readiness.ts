import { THAI_MONTH_ABBR, toBuddhistYear } from "@/lib/thai-date";

/**
 * แถบความพร้อมของแอปที่ยังไม่เปิด — สามขั้นตาม ADR 0025
 *
 * **ขั้นมาจากสิ่งที่ทะเบียนตอบได้ ไม่ใช่จากระยะการพัฒนา** ผืนออกแบบวาดคำว่า
 * "กำลังพัฒนา" กับ "ทดสอบภายใน" ซึ่งทะเบียนไม่มีทางรู้ และเป็นคำแถลงที่ ADR 0015 §5
 * ปฏิเสธไว้ · สามขั้นที่ใช้จริงคือ ประกาศแล้ว · ประกาศแล้วและบอกเดือนที่คาด · เปิดใช้แล้ว
 * สองคำแรกและคำสุดท้ายเป็นศัพท์ที่ `CONTEXT.md` นิยามไว้อยู่แล้ว
 *
 * **ห้ามมีเลขเปอร์เซ็นต์ที่ไหนเลย** ตาม ADR 0025 ข้อ 6 · แถบบอกขั้น ไม่ได้บอกสัดส่วน
 * และคำใต้แถบเป็นชื่อขั้น ความยาวของแถบอยู่ใน `globals.css` ไม่ได้คำนวณจากตัวเลขใด
 */
export type ReadinessStage = "announced" | "expected" | "open";

export type Readiness = {
  stage: ReadinessStage;
  /** คำใต้แถบ — ชื่อขั้น ไม่ใช่ตัวเลข */
  label: string;
};

/**
 * เดือนที่คาดว่าเปิด เก็บเป็น `YYYY-MM` **ปี ค.ศ.** ในฐาน แล้วแสดงเป็น พ.ศ. บนหน้าจอ
 * เจ้าของงานเคาะ 2026-09-07 · เก็บเป็น ค.ศ. เพราะต้องเทียบกับนาฬิกาและกับ `announced_at`
 * ซึ่งเป็น timestamp ปกติ การเก็บ พ.ศ. จะบังคับให้ลบ 543 ทุกครั้งที่เทียบ ซึ่งเป็นที่ที่
 * ความผิดพลาดจะเข้ามาโดยไม่มีใครเห็น · ส่วนหน้าจอเป็น พ.ศ. ทั้งเว็บตามคำสั่ง 2026-08-28
 */
export type ExpectedOpenMonth = string;

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** แยก `YYYY-MM` เป็นตัวเลข · คืน null เมื่อรูปแบบไม่ถูก ซึ่งให้ผลเท่ากับยังไม่กรอก */
export function splitExpectedMonth(month: string | null): { year: number; month: number } | null {
  if (!month) return null;
  const match = MONTH_PATTERN.exec(month);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

/**
 * เดือนนั้นยังไม่ผ่านไปหรือยัง เทียบที่ความละเอียดระดับเดือน
 *
 * **เดือนที่กำลังอยู่ ถือว่ายังไม่ผ่าน** ตุลาคมยังใช้ได้ตลอดเดือนตุลาคม และหมดอายุ
 * เมื่อขึ้นพฤศจิกายน · ถ้าตัดตั้งแต่วันแรกของเดือนนั้น คำแถลงจะตายก่อนถึงกำหนดของตัวเอง
 */
export function isMonthStillAhead(month: string | null, now: Date): boolean {
  const parts = splitExpectedMonth(month);
  if (!parts) return false;
  const nowKey = now.getFullYear() * 12 + now.getMonth();
  const monthKey = parts.year * 12 + (parts.month - 1);
  return monthKey >= nowKey;
}

/** "2026-10" เป็น "ต.ค. 69" — แปลงเป็น พ.ศ. ตรงนี้ที่เดียว */
export function formatExpectedMonth(month: string): string | null {
  const parts = splitExpectedMonth(month);
  if (!parts) return null;
  const name = THAI_MONTH_ABBR[parts.month - 1];
  return `${name} ${String(toBuddhistYear(parts.year)).slice(-2)}`;
}

export type ReadinessInput = {
  announced: boolean;
  open: boolean;
  expectedOpenMonth: string | null;
};

/**
 * **รับเวลาเข้ามา ไม่อ่านนาฬิกาเอง** ตามแบบแผนของ `isPromoLive` และ `app-access`
 * ไม่งั้นเขียนเทสต์วันหมดอายุไม่ได้จนกว่าจะถึงวันนั้นจริง
 *
 * **การหมดอายุเกิดตอนอ่าน ไม่ใช่ตอนเขียน** ค่าที่เลยกำหนดยังอยู่ในฐานจนกว่าคนจะลบ
 * ฟังก์ชันนี้เป็นที่เดียวที่ตัดสินว่าวันนี้คำแถลงนั้นยังใช้ได้ไหม · ห้ามมีงานตามเวลา
 * ไปเขียนค่าว่างทับ เพราะนั่นคือการเขียนฐานข้อมูลโดยไม่มีผู้กระทำ ซึ่งชนข้อ 3 ของ ADR 0025
 *
 * คืน null เมื่อยังไม่ประกาศ — ตาม ADR 0015 §3 แอปที่ยังไม่ถูกประกาศต้องเงียบเรื่อง
 * ความพร้อม ไม่ใช่แสดงแถบที่ว่างเปล่า
 */
export function describeReadiness(claim: ReadinessInput, now: Date = new Date()): Readiness | null {
  if (!claim.announced) return null;
  if (claim.open) return { stage: "open", label: "เปิดใช้แล้ว" };

  if (isMonthStillAhead(claim.expectedOpenMonth, now)) {
    const shown = formatExpectedMonth(claim.expectedOpenMonth as string);
    if (shown) return { stage: "expected", label: `คาดว่าเปิด ${shown}` };
  }

  return { stage: "announced", label: "ประกาศแล้ว" };
}
