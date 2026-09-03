/**
 * วิธีที่สเกลของหน้าหนึ่งถูกตั้งขึ้น — ทะเบียนของคอลัมน์ `drawing_calibrations.method` (IP-233)
 *
 * รูปทรงเดียวกับ `quantity-provenance.ts` และด้วยเหตุผลเดียวกัน — ฐานเก็บค่าที่เลือกไว้
 * ส่วนรายการค่าที่ถูกต้องอยู่ในโค้ดที่เทสต์เดินตรวจได้ · และเก็บ **วิธี** ไม่ใช่คำตัดสิน
 * ว่าวิธีไหนน่าเชื่อกว่ากัน
 *
 * **ทำไมคอลัมน์นี้ต้องมี** สองวิธีนี้ให้เลขเดียวกันได้ แต่ต้นทางของความผิดพลาดคนละที่
 * `two_point` พึ่งความเที่ยงของการคลิกสองครั้ง คลาดไปครึ่งหน่วยกระดาษก็เพี้ยนทั้งหน้า
 * ส่วน `stated_dimension` เกาะจุดตัดของแนวเสาที่คำนวณได้ จึงไม่มีนิ้วอยู่ในสมการ
 * วันที่ตัวเลขของหน้าหนึ่งน่าสงสัย คำถามแรกคือสเกลมาจากไหน — คอลัมน์นี้คือคำตอบ
 */

export type CalibrationMethod = "two_point" | "stated_dimension";

export type CalibrationMethodKind = {
  key: CalibrationMethod;
  /** ป้ายภาษาไทยที่ขึ้นในแถบสถานะและหน้าตรวจงาน */
  label: string;
  description: string;
};

export const CALIBRATION_METHODS: readonly CalibrationMethodKind[] = [
  {
    key: "two_point",
    label: "คลิกสองจุดแล้วพิมพ์ระยะ",
    description:
      "คนคลิกปลายทั้งสองของระยะที่รู้ค่าบนแบบ แล้วพิมพ์ระยะจริงเข้าไป " +
      "ความเที่ยงขึ้นกับการคลิก จึงควรใช้เมื่อหน้านั้นยังไม่มีแนวเสาให้เกาะ"
  },
  {
    key: "stated_dimension",
    label: "ระยะที่แบบเขียน",
    description:
      "คนใส่ระยะที่แบบเขียนไว้ให้ช่วงหนึ่ง แล้วสเกลตามมาเอง " +
      "จุดปลายเกาะแนวเสาที่ร่างไว้ จึงไม่เคลื่อนตามมือ"
  }
] as const;

export function isCalibrationMethod(value: string): value is CalibrationMethod {
  return CALIBRATION_METHODS.some((kind) => kind.key === value);
}

export function calibrationMethodKind(method: CalibrationMethod): CalibrationMethodKind {
  const found = CALIBRATION_METHODS.find((kind) => kind.key === method);
  if (!found) throw new Error(`ไม่รู้จักวิธีตั้งสเกล: ${method}`);
  return found;
}
