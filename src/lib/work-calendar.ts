import { defaultHolidays, type ThaiHoliday } from "./thai-holidays";

/**
 * ปฏิทินวันทำงานของแผนงานก่อสร้าง
 *
 * ระยะเวลางานก่อสร้างนับเป็นวันทำงาน ไม่ใช่วันปฏิทิน — งานสิบวันที่เริ่มวันศุกร์
 * ไม่ได้จบวันจันทร์ถัดไป โมดูลนี้จึงเป็นตัวแปลงระหว่างสองหน่วยนั้น และเป็นชั้นเดียว
 * ที่รู้ว่าวันไหนทำงานได้
 *
 * สี่ข้อที่กำหนดรูปร่างของโมดูลนี้:
 *
 * หนึ่ง — **หยุดอาทิตย์กับวันหยุดราชการ เสาร์ทำงาน** ตรงกับหน้างานก่อสร้างไทยจริง
 * ไม่ใช่ปฏิทินสำนักงานห้าวัน และตรงกับที่ระบบซึ่งผู้รับเหมาไทยใช้จริงประกาศไว้เอง
 *
 * สอง — **ผู้ใช้แก้ปฏิทินเองได้** เพิ่มวันหยุดของโครงการ เช่น วันหยุดประจำปีของบริษัท
 * หรือวันที่หน่วยงานสั่งหยุด และเอาวันที่ชุดตั้งต้นให้มาแต่โครงการนี้ไม่หยุดออกได้
 * ระบบที่เราไปดูมาไม่มีที่ไหนให้ดูหรือแก้รายการวันหยุดเลย ผู้ใช้จึงตรวจไม่ได้ว่าวันที่หายไปหายเพราะอะไร
 *
 * สาม — **เผื่อวันฝนเป็นเปอร์เซ็นต์ของระยะเวลา** ตามมติของเจ้าของงาน
 * คิดที่ระดับโครงการ ไม่ใช่ที่ระดับปฏิทินและไม่ใช่ที่ระดับกิจกรรม เพราะฝนไม่ได้ทำให้วันนั้น
 * ทำงานไม่ได้ทั้งวันเสมอไป มันทำให้งานทั้งโครงการเสร็จช้าลง ซึ่งเป็นคนละเรื่องกับวันหยุด
 * ที่ทำงานไม่ได้จริง และการไปบวกใส่ทุกกิจกรรมคือการเขียนทับตัวเลขที่ผู้ใช้พิมพ์เอง
 * บรรทัดนี้เคยเขียนว่าคิดที่ระดับกิจกรรม เจ้าของงานตัดสินเป็นระดับโครงการเมื่อ 2026-08-26
 * ตัวคิดอยู่ที่ `projectDemand` ใน `work-plan-schedule.ts`
 *
 * สี่ — **คิดด้วยวันปฏิทินภายใน ไม่ใช้ Date ไปตลอดทาง** เทียบวันด้วยข้อความ `YYYY-MM-DD`
 * เพื่อไม่ให้เขตเวลาของเครื่องผู้ใช้เข้ามาเปลี่ยนคำตอบ ซึ่งเป็นที่มาของบั๊กวันเหลื่อมหนึ่งวัน
 */

/**
 * ปฏิทินของโครงการหนึ่ง เก็บเฉพาะส่วนที่ต่างจากชุดตั้งต้น
 *
 * ไม่ถือรายการวันหยุดเต็มชุด เพราะชุดตั้งต้นเป็นของโปรแกรมที่อัปเดตได้เมื่อมีประกาศใหม่
 * ถ้าคัดลอกทั้งชุดไปเก็บไว้กับโครงการ โครงการเก่าจะค้างอยู่กับประกาศรุ่นเก่าตลอดไป
 * และที่เก็บของเบราว์เซอร์จะถูกเปลืองไปกับข้อมูลเดิมซ้ำทุกโครงการ
 */
export type WorkCalendar = {
  /** วันหยุดที่ผู้ใช้เพิ่มเองสำหรับโครงการนี้ */
  added: ThaiHoliday[];
  /** วันในชุดตั้งต้นที่โครงการนี้ไม่หยุด เก็บเป็นวันที่ */
  removed: string[];
  /** ทำงานวันอาทิตย์หรือไม่ ค่าเริ่มต้นคือไม่ */
  worksSunday: boolean;
  /** ทำงานวันเสาร์หรือไม่ ค่าเริ่มต้นคือทำ */
  worksSaturday: boolean;
};

export const defaultWorkCalendar = (): WorkCalendar => ({
  added: [],
  removed: [],
  worksSunday: false,
  worksSaturday: true
});

/** วันหยุดทั้งหมดที่ใช้จริงกับโครงการนี้ เรียงตามวันที่ */
export const calendarHolidays = (calendar: WorkCalendar): ThaiHoliday[] => {
  const removed = new Set(calendar.removed);
  const merged = new Map<string, ThaiHoliday>();
  for (const holiday of defaultHolidays()) if (!removed.has(holiday.date)) merged.set(holiday.date, holiday);
  // วันที่ผู้ใช้เพิ่มเองทับของตั้งต้นได้ เผื่อกรณีที่ชื่อของหน่วยงานต่างจากชื่อทางการ
  for (const holiday of calendar.added) if (!removed.has(holiday.date)) merged.set(holiday.date, holiday);
  return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
};

/** เลื่อนวันแบบปฏิทิน โดยไม่ให้เขตเวลาของเครื่องเข้ามาเปลี่ยนคำตอบ */
export function shiftDays(date: string, days: number): string {
  const stamp = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(stamp)) return date;
  return new Date(stamp + days * 86_400_000).toISOString().slice(0, 10);
}

/** 0 คือวันอาทิตย์ ตามที่ `Date.getUTCDay` ใช้ */
export function weekdayOf(date: string): number {
  const stamp = Date.parse(`${date}T00:00:00Z`);
  return Number.isNaN(stamp) ? -1 : new Date(stamp).getUTCDay();
}

/** ดัชนีวันหยุดที่ใช้จริง หลังหักวันที่โครงการนี้เอาออกแล้ว */
const activeHolidays = (calendar: WorkCalendar): Map<string, ThaiHoliday> =>
  new Map(calendarHolidays(calendar).map((holiday) => [holiday.date, holiday]));

export type NonWorkingReason =
  | { kind: "weekend"; name: string }
  | { kind: "holiday"; name: string; holiday: ThaiHoliday };

/**
 * บอกว่าวันนี้ทำงานไม่ได้เพราะอะไร คืน null เมื่อทำงานได้
 *
 * คืนเหตุผลเป็นชื่อวัน ไม่ใช่แค่จริงหรือเท็จ เพราะทั้งหน้าจอและเอกสารต้องตอบผู้ใช้ได้ว่า
 * วันที่หายไปจากแผนหายเพราะวันอะไร ซึ่งเป็นสิ่งที่ระบบของคู่แข่งตอบไม่ได้
 */
export function nonWorkingReason(calendar: WorkCalendar, date: string): NonWorkingReason | null {
  const holiday = activeHolidays(calendar).get(date);
  if (holiday) return { kind: "holiday", name: holiday.name, holiday };

  const weekday = weekdayOf(date);
  if (weekday === 0 && !calendar.worksSunday) return { kind: "weekend", name: "วันอาทิตย์" };
  if (weekday === 6 && !calendar.worksSaturday) return { kind: "weekend", name: "วันเสาร์" };
  return null;
}

export const isWorkingDay = (calendar: WorkCalendar, date: string): boolean =>
  nonWorkingReason(calendar, date) === null;

/** วันทำงานวันแรกนับจากวันที่ให้มา รวมวันนั้นเองถ้าทำงานได้ */
export function nextWorkingDay(calendar: WorkCalendar, date: string): string {
  let cursor = date;
  // เพดาน 400 วันกันวนไม่จบเมื่อปฏิทินถูกตั้งจนไม่เหลือวันทำงานเลย
  for (let guard = 0; guard < 400; guard += 1) {
    if (isWorkingDay(calendar, cursor)) return cursor;
    cursor = shiftDays(cursor, 1);
  }
  return cursor;
}

/**
 * วันสิ้นสุดของงานที่เริ่มวันหนึ่งและกินเวลากี่วันทำงาน
 *
 * นับวันเริ่มเป็นวันทำงานวันที่หนึ่ง ตามที่ตารางแผนงานก่อสร้างนับกัน
 * ระยะเวลาศูนย์หรือติดลบคืนวันเริ่มเอง เพราะหมุดหมายไม่กินเวลา
 */
export function endOfWorkingDays(calendar: WorkCalendar, start: string, workingDays: number): string {
  const first = nextWorkingDay(calendar, start);
  if (workingDays <= 1) return first;

  let cursor = first;
  let counted = 1;
  for (let guard = 0; guard < 4000 && counted < workingDays; guard += 1) {
    cursor = shiftDays(cursor, 1);
    if (isWorkingDay(calendar, cursor)) counted += 1;
  }
  return cursor;
}

/** จำนวนวันทำงานในช่วงวันที่ นับรวมทั้งวันแรกและวันสุดท้าย */
export function workingDaysBetween(calendar: WorkCalendar, from: string, to: string): number {
  if (from > to) return 0;
  let count = 0;
  let cursor = from;
  for (let guard = 0; guard < 4000 && cursor <= to; guard += 1) {
    if (isWorkingDay(calendar, cursor)) count += 1;
    cursor = shiftDays(cursor, 1);
  }
  return count;
}

/** วันที่ทำงานไม่ได้ในช่วง พร้อมเหตุผล สำหรับแสดงให้ผู้ใช้ตรวจ */
export function nonWorkingDaysBetween(
  calendar: WorkCalendar,
  from: string,
  to: string
): { date: string; reason: NonWorkingReason }[] {
  const out: { date: string; reason: NonWorkingReason }[] = [];
  let cursor = from;
  for (let guard = 0; guard < 4000 && cursor <= to; guard += 1) {
    const reason = nonWorkingReason(calendar, cursor);
    if (reason) out.push({ date: cursor, reason });
    cursor = shiftDays(cursor, 1);
  }
  return out;
}

/**
 * เผื่อวันฝนและความเสี่ยง เป็นเปอร์เซ็นต์ของระยะเวลา
 *
 * ปัดขึ้นเสมอ เพราะครึ่งวันที่ทำไม่ได้ก็คือวันที่ทำไม่ได้ในตารางที่นับเป็นวัน
 * และการปัดลงทำให้แผนสั้นกว่าความจริง ซึ่งผิดในทางที่ผู้รับเหมาเสียหาย
 */
export const RAIN_ALLOWANCE_CHOICES = [0, 5, 10, 15] as const;
export type RainAllowancePercent = (typeof RAIN_ALLOWANCE_CHOICES)[number];

export function withRainAllowance(workingDays: number, percent: number): number {
  if (workingDays <= 0 || percent <= 0) return Math.max(0, workingDays);
  return Math.ceil(workingDays * (100 + percent) / 100);
}

/** จำนวนวันที่เพิ่มขึ้นจากการเผื่อฝน ใช้บอกผู้ใช้ว่าเผื่อไปกี่วัน */
export const rainAllowanceDays = (workingDays: number, percent: number): number =>
  withRainAllowance(workingDays, percent) - Math.max(0, workingDays);
