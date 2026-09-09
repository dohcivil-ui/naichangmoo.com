import { THAI_MONTH_ABBR, toBuddhistYear } from "@/lib/thai-date";
import { bangkokYearMonth } from "@/lib/thai-format";

/**
 * แถบความพร้อมของแอปที่ยังไม่เปิด — สามขั้นตาม ADR 0025
 *
 * **ขั้นมาจากสิ่งที่ทะเบียนตอบได้ ไม่ใช่จากระยะการพัฒนา** ผืนออกแบบวาดคำว่า
 * "กำลังพัฒนา" กับ "ทดสอบภายใน" ซึ่งทะเบียนไม่มีทางรู้ และเป็นคำแถลงที่ ADR 0015 §5
 * ปฏิเสธไว้ · สามขั้นที่ใช้จริงคือ ประกาศแล้ว · ประกาศแล้วและบอกเดือนที่คาด · เปิดใช้แล้ว
 *
 * **ที่มาของคำ ไม่ได้มาจากที่เดียวกันทั้งสามคำ** `ประกาศแล้ว` กับ `เปิดใช้แล้ว` เป็นศัพท์ที่
 * `CONTEXT.md` นิยามไว้อยู่ก่อนแล้ว · ส่วน **`คาดว่าเปิด` เป็นคำใหม่ มาจาก ADR 0025 ข้อ 1
 * ที่เจ้าของงานเคาะเมื่อ 2026-09-07** ไม่ใช่คำที่ประดิษฐ์ขึ้นตรงนี้ และเข้า `CONTEXT.md` แล้ว
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

/**
 * ช่วงปีที่รับได้ตอน **เขียน** เดือนที่คาดว่าเปิด — ปีนี้ถึงปีนี้บวก N ตามนาฬิกากรุงเทพ
 *
 * **เจ้าของงานเคาะเลข 4 เมื่อ 2026-09-09** · **และต้องบันทึกไว้ด้วยว่ามันไม่ได้เริ่มต้นแบบนั้น**
 * เลขนี้ถูกตั้งขึ้นเองใน `10f8874` ตอนทำช่องเลือกปีในหน้าหลังบ้าน โดยไม่เคยผ่านเจ้าของงาน ·
 * ตอนนั้นมันเป็นแค่ความยาวของรายการในกล่องเลือก ผิดแล้วแก้ง่าย · การยกมันขึ้นเป็นด่าน
 * ที่ปฏิเสธค่าจริงของคน ทำให้มันกลายเป็นกฎ จึงต้องมีคนเคาะก่อน ไม่ใช่ไหลขึ้นมาเงียบ ๆ
 *
 * **ที่นี่คือที่เดียวของเลขนี้** ฟอร์มหลังบ้านกับ `setExpectedOpenMonth` อ่านจากตัวเดียวกัน ·
 * ถ้าพิมพ์ไว้สองที่ วันที่ใครแก้ที่หนึ่ง เซิร์ฟเวอร์จะปฏิเสธค่าที่หน้าจอของตัวเองเพิ่งสร้าง
 * ซึ่งเป็นบั๊กที่ผู้ใช้แก้เองไม่ได้เลย เพราะเขาเลือกได้เฉพาะสิ่งที่กล่องยื่นให้
 */
export const EXPECTED_MONTH_YEARS_AHEAD = 4;

/**
 * **ใช้ตอนเขียนเท่านั้น ห้ามใช้ตอนอ่าน** — คำสั่งเจ้าของงาน 2026-09-09
 *
 * ค่าที่เคยบันทึกไว้แล้วและวันนี้หลุดช่วงไปแล้ว **ต้องยังแสดงได้และแก้ได้ตามปกติ** ·
 * ถ้าเอาช่วงนี้ไปกรองตอนอ่านด้วย วันหนึ่งจะมีแถวที่เปิดดูไม่ได้และแก้ไม่ได้พร้อมกัน
 * ซึ่งแย่กว่าค่าที่ผิดช่วง เพราะค่าที่ผิดช่วงยังมีคนไปแก้ได้
 */
export function expectedMonthYearRange(now: Date): { first: number; last: number } {
  const here = bangkokYearMonth(now);
  return { first: here.year, last: here.year + EXPECTED_MONTH_YEARS_AHEAD };
}

/** เดือนนี้เขียนลงทะเบียนได้ไหม ณ เวลานี้ · รูปแบบถูกและปีอยู่ในช่วงที่หน้าจอสร้างได้ */
export function isExpectedMonthWritable(month: string, now: Date): boolean {
  const parts = splitExpectedMonth(month);
  if (!parts) return false;
  const { first, last } = expectedMonthYearRange(now);
  return parts.year >= first && parts.year <= last;
}

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
 *
 * **อ่านเดือนตามเขตเวลาไทย ไม่ใช่ของเครื่องที่รัน** `getMonth()` ตอบตามเครื่อง ซึ่งบนเซิร์ฟเวอร์
 * ที่เป็น UTC ไม่ใช่เขตเวลาที่กิจการนี้อยู่ · เที่ยงคืนวันที่ 1 พฤศจิกายนที่กรุงเทพ ยังเป็น
 * 31 ตุลาคม 17:00 ที่ UTC การ์ดจึงพูดว่า "คาดว่าเปิด ต.ค." ต่อไปอีกเจ็ดชั่วโมงหลังตุลาคมจบแล้ว
 * ซึ่งชน ADR 0025 ข้อ 4 ตรง ๆ · ใช้ `bangkokYearMonth` ที่ `thai-format.ts` ซึ่งตรึงเขตเวลาไว้
 * ที่เดียวด้วยเหตุผลเดียวกันนี้อยู่ก่อนแล้ว
 */
export function isMonthStillAhead(month: string | null, now: Date): boolean {
  const parts = splitExpectedMonth(month);
  if (!parts) return false;
  const here = bangkokYearMonth(now);
  const nowKey = here.year * 12 + (here.month - 1);
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
