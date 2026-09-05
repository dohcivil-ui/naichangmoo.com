/**
 * กรอบลากเลือกของหน้าแบบ — คลุมทั้งชิ้นหรือแค่แตะก็พอ ตามทิศที่ลาก (IP-242)
 *
 * **ทำไมต้องมีสองแบบ** เจ้าของงานสั่งเมื่อ 2026-09-05 ว่า "ต้องเอาเมาส์คลิกเส้น หรือลากคลุม
 * object ที่เลือกเพื่อลบ" ซึ่งเป็นวิธีของ AutoCAD และ AutoCAD แยกสองทิศมาตั้งแต่ต้นด้วยเหตุผล
 * ที่ยังจริงอยู่ — **แนวเสาพาดยาวตลอดหน้า** ถ้าใช้กติกา "แตะก็พอ" อย่างเดียว การลากกรอบเล็ก ๆ
 * ตรงไหนก็ได้จะกวาดแนวเสาไปด้วยทุกครั้ง แต่ถ้าใช้ "คลุมทั้งชิ้น" อย่างเดียว ก็ลบแนวเสาไม่ได้เลย
 * เพราะไม่มีใครลากกรอบครอบทั้งหน้าไหว
 *
 * | ลากไปทาง | เรียก | เก็บชิ้นที่ |
 * |---|---|---|
 * | ขวา | คลุมทั้งชิ้น (window) | อยู่ในกรอบทั้งชิ้น |
 * | ซ้าย | แตะก็พอ (crossing) | มีส่วนใดส่วนหนึ่งอยู่ในกรอบ |
 *
 * ไฟล์นี้รู้จักแต่ตัวเลข ไม่รู้จัก React ไม่รู้จักฐานข้อมูล และไม่รู้ว่าใครจะเอาไปลบอะไร
 */

import type { PagePoint } from "@/lib/drawing-scale";

export type MarqueeMode = "window" | "crossing";

export type MarqueeRect = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  mode: MarqueeMode;
};

/**
 * กรอบที่ได้จากจุดเริ่มถึงจุดปัจจุบัน พร้อมกติกาที่ทิศการลากเป็นคนเลือก
 *
 * ทิศตัดสินจากแกน x เท่านั้น เหมือน AutoCAD · ลากขึ้นหรือลงไม่เปลี่ยนกติกา
 * ลากตรงดิ่งโดยไม่ขยับแกน x เลยถือเป็นคลุมทั้งชิ้น เพราะเป็นกติกาที่ปลอดภัยกว่า
 */
export function marqueeFrom(start: PagePoint, current: PagePoint): MarqueeRect {
  return {
    minX: Math.min(start.x, current.x),
    minY: Math.min(start.y, current.y),
    maxX: Math.max(start.x, current.x),
    maxY: Math.max(start.y, current.y),
    mode: current.x < start.x ? "crossing" : "window"
  };
}

/** จุดนี้อยู่ในกรอบไหม · ขอบนับว่าอยู่ใน เพราะคนลากให้ปลายพอดีขอบแล้วคาดว่าจะติด */
export function pointInMarquee(point: PagePoint, rect: MarqueeRect): boolean {
  return point.x >= rect.minX && point.x <= rect.maxX && point.y >= rect.minY && point.y <= rect.maxY;
}

/** ด้านที่โผล่พ้นกรอบไปทางไหนบ้าง ใช้ตัดเส้นที่อยู่คนละฝั่งออกก่อนคำนวณจุดตัด */
function outcode(point: PagePoint, rect: MarqueeRect): number {
  let code = 0;
  if (point.x < rect.minX) code |= 1;
  if (point.x > rect.maxX) code |= 2;
  if (point.y < rect.minY) code |= 4;
  if (point.y > rect.maxY) code |= 8;
  return code;
}

/**
 * ส่วนของเส้นตรงนี้ตัดผ่านกรอบไหม — Cohen–Sutherland ตัดปลายทีละด้าน
 *
 * ใช้วิธีนี้แทนการเช็คจุดตัดกับสี่ด้านทีละด้าน เพราะมันจบด้วยการเปรียบเทียบจำนวนเต็มเป็นหลัก
 * และตอบถูกในกรณีที่เส้นพาดทะลุกรอบโดยที่ปลายทั้งสองอยู่นอกกรอบ ซึ่งเป็นกรณีของแนวเสาพอดี
 */
export function segmentTouchesMarquee(a: PagePoint, b: PagePoint, rect: MarqueeRect): boolean {
  let ax = a.x;
  let ay = a.y;
  let bx = b.x;
  let by = b.y;
  let codeA = outcode({ x: ax, y: ay }, rect);
  let codeB = outcode({ x: bx, y: by }, rect);

  for (let guard = 0; guard < 8; guard += 1) {
    if ((codeA | codeB) === 0) return true;
    if ((codeA & codeB) !== 0) return false;
    const code = codeA !== 0 ? codeA : codeB;
    let x = 0;
    let y = 0;
    if ((code & 8) !== 0) {
      x = ax + ((bx - ax) * (rect.maxY - ay)) / (by - ay);
      y = rect.maxY;
    } else if ((code & 4) !== 0) {
      x = ax + ((bx - ax) * (rect.minY - ay)) / (by - ay);
      y = rect.minY;
    } else if ((code & 2) !== 0) {
      y = ay + ((by - ay) * (rect.maxX - ax)) / (bx - ax);
      x = rect.maxX;
    } else {
      y = ay + ((by - ay) * (rect.minX - ax)) / (bx - ax);
      x = rect.minX;
    }
    if (code === codeA) {
      ax = x;
      ay = y;
      codeA = outcode({ x: ax, y: ay }, rect);
    } else {
      bx = x;
      by = y;
      codeB = outcode({ x: bx, y: by }, rect);
    }
  }
  return false;
}

/** เส้นตรงหนึ่งท่อนถูกกรอบนี้เก็บไหม ตามกติกาของทิศที่ลาก */
export function segmentInMarquee(a: PagePoint, b: PagePoint, rect: MarqueeRect): boolean {
  if (rect.mode === "window") return pointInMarquee(a, rect) && pointInMarquee(b, rect);
  return segmentTouchesMarquee(a, b, rect);
}

/**
 * รูปที่ประกอบจากหลายจุดถูกกรอบนี้เก็บไหม
 *
 * จุดเดียวก็ตอบได้ ใช้กับหมุดนับจำนวน · รูปปิดส่งจุดตามที่เก็บไว้มาได้เลย ฟังก์ชันนี้
 * ต่อปลายกลับหาจุดแรกให้เอง เฉพาะตอนที่มีตั้งแต่สามจุดขึ้นไป เพราะสองจุดคือเส้นตรง ไม่ใช่รูปปิด
 */
export function shapeInMarquee(points: readonly PagePoint[], rect: MarqueeRect): boolean {
  if (points.length === 0) return false;
  if (points.length === 1) return pointInMarquee(points[0], rect);
  if (rect.mode === "window") return points.every((point) => pointInMarquee(point, rect));
  for (let index = 0; index < points.length - 1; index += 1) {
    if (segmentTouchesMarquee(points[index], points[index + 1], rect)) return true;
  }
  if (points.length >= 3 && segmentTouchesMarquee(points[points.length - 1], points[0], rect)) return true;
  return false;
}
