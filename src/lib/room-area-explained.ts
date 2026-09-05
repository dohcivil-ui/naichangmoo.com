/**
 * พื้นที่ห้องต้องบอกได้ว่าคิดมาอย่างไร ไม่ใช่โผล่มาเป็นเลขตัวเดียว (IP-238)
 *
 * **ทำไมต้องมีไฟล์นี้** เจ้าของงานเปิดหน้าแบบแล้วเจอ "พื้นที่ห้องที่ไล่ได้ 3.98 ตร.ม."
 * ทั้งที่เส้นบอกระยะบนแบบเขียนว่าช่วงนี้ 2.50 × 2.00 ซึ่งคูณกันได้ 5.00 · เขาถามว่า
 * "ตัวเลข 3.98 มาจากไหน" แล้วจอตอบไม่ได้เลย มีแต่เลขกับประโยคเดียวว่าวัดถึงผิวผนังด้านใน
 *
 * เลขที่ตอบไม่ได้ว่ามาจากไหน คือเลขที่เถียงในห้องประชุมไม่ได้ ซึ่งเป็นปัญหาข้อแรก
 * ที่หน้าขายของเราประกาศว่าเครื่องมือนี้แก้ · จอที่แสดงแต่ผลลัพธ์จึงขัดกับตัวเองอยู่
 *
 * ไฟล์นี้ไม่คำนวณพื้นที่ใหม่ — พื้นที่ยังมาจาก `measure()` ที่เดียวเหมือนเดิม
 * มันแค่กางขั้นตอนที่พาไปถึงเลขนั้นออกมาให้อ่านได้ ถ้ามันคำนวณเองจะกลายเป็นเลขที่สอง
 * ที่อาจไม่ตรงกับเลขแรก ซึ่งแย่กว่าไม่มีคำอธิบายเลย
 */

import type { PagePoint, PageScale } from "@/lib/drawing-scale";

export type RoomAreaExplained = {
  /**
   * กรอบที่ครอบรูป หน่วยจุดบนหน้ากระดาษ — เอาไว้วาดเส้นบอกระยะทับรูปบนแบบ
   *
   * คืนออกมาด้วยเพื่อให้ตัวที่วาดไม่ต้องไล่หาค่าน้อยสุดมากสุดเองอีกรอบ ค่าที่วาดกับค่าที่
   * เขียนเป็นตัวเลขจึงมาจากการไล่ครั้งเดียวกันเสมอ ไม่มีทางหลุดจากกัน
   */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  /** ด้านกว้างของกรอบที่ครอบรูปทั้งรูป หน่วยเมตร */
  widthMetres: number;
  /** ด้านลึกของกรอบที่ครอบรูปทั้งรูป หน่วยเมตร */
  depthMetres: number;
  /** กว้างคูณลึก — เท่ากับพื้นที่จริงเมื่อห้องเป็นสี่เหลี่ยมเต็มกรอบ */
  boundingAreaSquareMetres: number;
  /** จำนวนด้านของรูปที่ไล่ได้ */
  sideCount: number;
  /**
   * สัดส่วนที่รูปจริงกินในกรอบ — 1.00 คือสี่เหลี่ยมเต็มกรอบ ต่ำกว่านั้นคือห้องมีมุมหัก
   *
   * ค่านี้คือคำตอบว่าทำไมกว้างคูณลึกถึงไม่เท่ากับพื้นที่ที่รายงาน โดยไม่ต้องให้คนเดาเอง
   */
  fillRatio: number;
  /** หนึ่งจุดบนหน้ากระดาษยาวกี่เมตรจริง — ตัวคูณที่ทุกอย่างบนหน้านี้ใช้ร่วมกัน */
  metresPerPoint: number;
  /** ตัวหารของสเกล เช่น 124.6 หมายถึง 1:124.6 */
  scaleRatio: number;
};

/**
 * กางวิธีคิดของพื้นที่ห้องหนึ่งห้อง — คืน `null` เมื่อยังไม่มีรูปหรือยังไม่มีสเกล
 *
 * กรอบที่ครอบรูปใช้ค่าน้อยสุดกับมากสุดของแต่ละแกน ไม่ได้หมุนตามห้อง เพราะห้องในผังพื้น
 * เป็นเหลี่ยมมุมฉากตามแนวกระดาษอยู่แล้ว (ดู skill `drawing-geometry`) กรอบที่หมุนได้
 * จะให้เลขที่สวยกว่าแต่เทียบกับเส้นบอกระยะบนแบบไม่ได้ ซึ่งเป็นเหตุผลเดียวที่กางมันออกมา
 */
export function explainRoomArea(
  points: readonly PagePoint[],
  scale: PageScale | null,
  areaSquareMetres: number | null
): RoomAreaExplained | null {
  if (!scale || points.length < 3 || areaSquareMetres === null) return null;

  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }

  const widthMetres = (maxX - minX) * scale.metresPerPoint;
  const depthMetres = (maxY - minY) * scale.metresPerPoint;
  const boundingAreaSquareMetres = widthMetres * depthMetres;

  return {
    bounds: { minX, maxX, minY, maxY },
    widthMetres,
    depthMetres,
    boundingAreaSquareMetres,
    sideCount: points.length,
    // กรอบกว้างศูนย์เกิดได้เมื่อรูปแบนสนิท ซึ่งไม่ใช่ห้อง แต่หารด้วยศูนย์ก็ยังห้ามอยู่ดี
    fillRatio: boundingAreaSquareMetres > 0 ? areaSquareMetres / boundingAreaSquareMetres : 0,
    metresPerPoint: scale.metresPerPoint,
    scaleRatio: scale.ratio
  };
}
