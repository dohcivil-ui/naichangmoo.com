/**
 * สเกลของหน้าแบบ และการแปลงระยะบนแบบให้เป็นระยะจริง (IP-227)
 *
 * **ทุกอย่างในไฟล์นี้ทำงานบนพิกัดของหน้ากระดาษ PDF ไม่ใช่พิกเซลบนจอ** พิกเซลบนจอเปลี่ยน
 * ทุกครั้งที่ผู้ใช้ซูม ถ้าเก็บสเกลเป็นพิกเซล ซูมเข้าออกครั้งเดียวปริมาณทั้งหน้าเพี้ยนตามทั้งหมด
 * หน่วยของหน้ากระดาษ PDF คือ point ซึ่งคงที่ไม่ว่าจะแสดงผลที่ขนาดใด ตัวแปลงพิกัดจอเป็น point
 * เป็นหน้าที่ของชั้นแสดงผล ไม่ใช่ของไฟล์นี้
 *
 * ไฟล์นี้ไม่รู้จัก React ไม่รู้จัก pdf.js และไม่รู้จักฐานข้อมูล เพื่อให้เทสต์เดินได้โดยไม่ต้องมีจอ
 *
 * **ไม่มีเรื่องเงินในไฟล์นี้** เป็นเรขาคณิตล้วน
 */

/** หน่วยที่ผู้ใช้กรอกได้ตอนบอกระยะจริง */
export type ScaleUnit = "m" | "cm" | "mm";

export const SCALE_UNITS: readonly ScaleUnit[] = ["m", "cm", "mm"] as const;

export const unitToMetres: Record<ScaleUnit, number> = {
  m: 1,
  cm: 0.01,
  mm: 0.001
};

export const scaleUnitLabel: Record<ScaleUnit, string> = {
  m: "เมตร",
  cm: "เซนติเมตร",
  mm: "มิลลิเมตร"
};

/**
 * หนึ่งเมตรบนกระดาษเท่ากับกี่ point
 *
 * PDF นิยาม 1 point = 1/72 นิ้ว และ 1 นิ้ว = 0.0254 เมตร ค่านี้จึงตายตัวตามนิยาม
 * ไม่ใช่ค่าที่วัดมาหรือประมาณเอา
 */
export const POINTS_PER_METRE = 72 / 0.0254;

/** จุดหนึ่งจุดบนหน้ากระดาษ หน่วยเป็น point */
export type PagePoint = { x: number; y: number };

/**
 * สเกลของหน้าแบบหนึ่งหน้าที่ผ่านการยืนยันของคนแล้ว
 *
 * `metresPerPoint` คือหัวใจ ทุกการวัดในหน้านั้นคูณด้วยค่านี้เพื่อกลายเป็นระยะจริง
 */
export type PageScale = {
  metresPerPoint: number;
  /** ตัวเลขหลังเครื่องหมาย 1: ที่เอาไว้โชว์ให้คนอ่าน เช่น 100 หมายถึง 1:100 */
  ratio: number;
};

export type CalibrationInput = {
  /** ระยะที่ผู้ใช้ลากบนแบบ วัดในหน่วย point ของหน้ากระดาษ */
  measuredPoints: number;
  /** ระยะจริงที่แบบระบุไว้ ตามที่ผู้ใช้พิมพ์ */
  realDistance: number;
  unit: ScaleUnit;
};

export type CalibrationRejection =
  | "measured_not_positive"
  | "real_not_positive"
  | "measured_too_short";

/**
 * เส้นสอบเทียบที่สั้นเกินไปทำให้ความคลาดเคลื่อนของการคลิกกลายเป็นความคลาดเคลื่อนของสเกล
 *
 * คลิกพลาดหนึ่ง point บนเส้นยาว 200 point คือผิด 0.5% แต่บนเส้นยาว 4 point คือผิด 25%
 * ค่านี้จึงเป็นด่านกันความผิดพลาด ไม่ใช่ความจู้จี้
 */
export const MIN_CALIBRATION_POINTS = 20;

export type CalibrationResult =
  | { ok: true; scale: PageScale }
  | { ok: false; reason: CalibrationRejection };

/**
 * สอบเทียบสเกลจากเส้นที่ผู้ใช้ลากทาบระยะที่แบบเขียนบอกไว้
 *
 * ลำดับนี้ตรงกับที่ผู้ประมาณราคาทำจริง คือลากทาบเส้นบอกระยะในแบบ แล้วบอกระบบว่าเส้นนั้น
 * ที่จริงยาวเท่าไร ไม่ใช่ให้กรอกจำนวนพิกเซลซึ่งไม่มีใครรู้
 */
export function calibrate(input: CalibrationInput): CalibrationResult {
  if (!Number.isFinite(input.measuredPoints) || input.measuredPoints <= 0) {
    return { ok: false, reason: "measured_not_positive" };
  }
  if (!Number.isFinite(input.realDistance) || input.realDistance <= 0) {
    return { ok: false, reason: "real_not_positive" };
  }
  if (input.measuredPoints < MIN_CALIBRATION_POINTS) {
    return { ok: false, reason: "measured_too_short" };
  }

  const metresPerPoint = (input.realDistance * unitToMetres[input.unit]) / input.measuredPoints;
  return { ok: true, scale: { metresPerPoint, ratio: metresPerPoint * POINTS_PER_METRE } };
}

export const calibrationRejectionMessage: Record<CalibrationRejection, string> = {
  measured_not_positive: "ยังไม่ได้ลากเส้นสอบเทียบ",
  real_not_positive: "ระยะจริงต้องมากกว่าศูนย์",
  measured_too_short: "เส้นสอบเทียบสั้นเกินไป ลากให้ยาวขึ้นเพื่อให้สเกลแม่นพอ"
};

/** ระยะระหว่างสองจุด หน่วย point */
export function distancePoints(a: PagePoint, b: PagePoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** ความยาวรวมของเส้นต่อเนื่อง หน่วย point */
export function polylineLengthPoints(points: readonly PagePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += distancePoints(points[i - 1], points[i]);
  }
  return total;
}

/** ความยาวแต่ละช่วงของเส้นต่อเนื่อง เพื่อให้ตารางบอกได้ว่าความยาวรวมมาจากช่วงไหนบ้าง */
export function segmentLengthsPoints(points: readonly PagePoint[]): number[] {
  const segments: number[] = [];
  for (let i = 1; i < points.length; i += 1) {
    segments.push(distancePoints(points[i - 1], points[i]));
  }
  return segments;
}

/** เส้นรอบรูปของรูปปิด หน่วย point — ต่างจากเส้นต่อเนื่องตรงที่นับด้านสุดท้ายกลับมาจุดแรกด้วย */
export function polygonPerimeterPoints(points: readonly PagePoint[]): number {
  if (points.length < 3) return 0;
  return polylineLengthPoints([...points, points[0]]);
}

/**
 * พื้นที่ของรูปหลายเหลี่ยม หน่วย point กำลังสอง
 *
 * ใช้สูตรเชือกผูกรองเท้า คืนค่าสัมบูรณ์เสมอ ทิศทางการคลิกตามเข็มหรือทวนเข็มจึงให้ผลเท่ากัน
 * ซึ่งเป็นสิ่งที่ผู้ใช้คาดหวัง เขาไม่ได้คิดเรื่องทิศตอนคลิกไล่มุมห้อง
 */
export function polygonAreaPoints(points: readonly PagePoint[]): number {
  if (points.length < 3) return 0;
  let twiceArea = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    twiceArea += current.x * next.y - next.x * current.y;
  }
  return Math.abs(twiceArea) / 2;
}

/** แปลงความยาวบนกระดาษเป็นเมตรจริง */
export function lengthInMetres(lengthPoints: number, scale: PageScale): number {
  return lengthPoints * scale.metresPerPoint;
}

/** แปลงพื้นที่บนกระดาษเป็นตารางเมตรจริง — สเกลเข้ามาสองครั้งเพราะพื้นที่มีสองมิติ */
export function areaInSquareMetres(areaPoints: number, scale: PageScale): number {
  return areaPoints * scale.metresPerPoint * scale.metresPerPoint;
}

/**
 * ข้อความสเกลสำหรับแถบสถานะ
 *
 * ปัดเป็นจำนวนเต็มเมื่อใกล้สเกลมาตรฐานพอ เพราะ 1:100 อ่านง่ายกว่า 1:100.03
 * แต่ไม่ปัดเมื่อห่างจริง เพราะ 1:155.34 ที่ปัดเป็น 1:155 คือการซ่อนว่าแบบถูกย่อมา
 */
export function formatScaleRatio(scale: PageScale): string {
  const rounded = Math.round(scale.ratio);
  const nearInteger = rounded > 0 && Math.abs(scale.ratio - rounded) / rounded < 0.001;
  return nearInteger ? `1:${rounded}` : `1:${scale.ratio.toFixed(2)}`;
}

/**
 * ดูดจุดให้ตรงแนวนอนหรือแนวตั้ง
 *
 * เจ้าของงานยืนยัน 2026-09-01 ว่าการดูดจุดคือจุดที่แอปของเราชัวร์กว่าเครื่องมือที่เทียบ
 * ตัวนี้เป็นการบังคับแนวอย่างเดียว การดูดเข้าหาปลายเส้นจริงในแบบเป็นคนละเรื่องและอยู่ที่ชั้นแสดงผล
 */
export function lockToAxis(from: PagePoint, to: PagePoint): PagePoint {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  return dx >= dy ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
}
