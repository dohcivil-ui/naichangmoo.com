/**
 * ขอบเขตวันและเดือนตามเวลาไทย
 *
 * มีอยู่เพราะตัวนับของ `rate-limit.ts` แบ่งหน้าต่างด้วย `floor(now / windowMs)` ซึ่งวัดจาก
 * epoch ตรง ๆ หน้าต่างขนาดหนึ่งวันจึงรีเซ็ตเที่ยงคืน UTC = **07:00 เช้าไทย** และหน้าต่างขนาด
 * 30 วันก็ไม่ใช่เดือนปฏิทิน มันเลื่อนไปเรื่อย ๆ ทีละสองสามวันต่อปี
 *
 * เพดานที่ผู้ใช้เห็นเป็นคำสัญญาเชิงพาณิชย์ว่า "เดือนนี้ใช้ได้กี่ครั้ง" ถ้าโควตาคืนตอนเจ็ดโมงเช้า
 * ระหว่างที่คนกำลังทำงานอยู่ คำสัญญานั้นก็ไม่ตรงกับสิ่งที่เกิดขึ้น
 *
 * กรุงเทพเป็น UTC+7 คงที่ ไม่เคยมี DST ตั้งแต่ พ.ศ. 2483 การคำนวณจึงเป็นการบวกลบค่าคงที่
 * ไม่ต้องพึ่ง `Intl.DateTimeFormat` ซึ่งเปลี่ยนพฤติกรรมตามฐานข้อมูลเขตเวลาของเครื่องที่รัน
 */

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** เวลาจริง (UTC) ของ 00:00 น. ตามเวลาไทยของวันแรกในเดือนที่ `now` ตกอยู่ */
export function thaiMonthStart(now: Date | number = Date.now()): Date {
  const shifted = new Date(toMs(now) + BANGKOK_OFFSET_MS);
  const startShifted = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1);
  return new Date(startShifted - BANGKOK_OFFSET_MS);
}

/** เวลาจริง (UTC) ของ 00:00 น. ตามเวลาไทยของวันที่ `now` ตกอยู่ */
export function thaiDayStart(now: Date | number = Date.now()): Date {
  const shifted = new Date(toMs(now) + BANGKOK_OFFSET_MS);
  const startShifted = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return new Date(startShifted - BANGKOK_OFFSET_MS);
}

/** ต้นเดือนไทยของเดือนถัดไป ใช้บอกผู้ใช้ว่าโควตาจะคืนเมื่อไร */
export function thaiNextMonthStart(now: Date | number = Date.now()): Date {
  const shifted = new Date(toMs(now) + BANGKOK_OFFSET_MS);
  const startShifted = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 1);
  return new Date(startShifted - BANGKOK_OFFSET_MS);
}

const toMs = (value: Date | number) => (value instanceof Date ? value.getTime() : value);
