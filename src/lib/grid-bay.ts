/**
 * ช่วงระหว่างแนวเสา — พื้นที่ห้องที่คิดจากกึ่งกลางเสาถึงกึ่งกลางเสา (IP-235)
 *
 * **ทำไมต้องมีวิธีนี้ทั้งที่ไล่ขอบห้องได้แล้ว** เจ้าของงานซึ่งประมาณราคามา 26 ปีอธิบายเมื่อ
 * 2026-09-04 ว่าในทางปฏิบัติเขาคิดพื้นที่ห้องจากจุดตัดแนวเสา เช่น 2.50 × 3.00 = 7.50 ตร.ม.
 * ไม่ใช่จากรูปที่ไล่ขอบผนังได้ซึ่งให้ 7.03 และ**ไม่ต้องคิดค่าเผื่ออีก** เพราะส่วนต่าง 0.47 ตร.ม.
 * ทำหน้าที่เป็นค่าเผื่อในตัวมันเองอยู่แล้ว มันกลืนค่าสูญเสียจากการตัดกระเบื้องเข้ามุมไป
 * การใช้กริดแล้วบวกค่าเผื่ออีกคือการเผื่อซ้อนสองชั้น
 *
 * **และการไล่ขอบยังเชื่อไม่ได้** กดจริงเมื่อ 2026-09-04 บนห้องที่ขอบไม่ปิดตรงช่องประตู
 * ได้ 265.13 ตร.ม. จากห้องที่จริง ๆ ราว 7 ตร.ม. โดยเพดานกันการรั่วไม่จับ เพราะหน้ากระดาษ
 * ใหญ่พอที่ 265 ตร.ม. ยังไม่ถึงหนึ่งในสี่ของหน้า ห้องที่ขอบไม่ปิดคือห้องส่วนใหญ่ในแบบจริง
 *
 * **ไฟล์นี้เป็นฟังก์ชันบริสุทธิ์** รับเส้นกับจุดเป็นตัวเลขล้วน ไม่แตะ DOM ไม่แตะ canvas
 * และ**ไม่เก็บผลลัพธ์ลงฐาน** ด้วยเหตุผลเดียวกับ `gridIntersections` คือชื่อแนวไล่ใหม่ทุกครั้ง
 * จากตำแหน่ง ร่างแนวเพิ่มทีหลังแล้วชื่อเดิมเลื่อนได้ สิ่งที่เก็บลงฐานคือ**พิกัดของมุม**
 * ส่วนชื่ออย่าง "1-A ถึง 2-B" เป็นคำอธิบายให้คนอ่าน ไม่ใช่กุญแจที่ใช้ค้นย้อน
 */

import { gridIntersections, nearestIntersection, type NamedGridLine } from "@/lib/drawing-grid";
import {
  distancePoints,
  lengthInMetres,
  type PagePoint,
  type PageScale,
  type StatedDimension
} from "@/lib/drawing-scale";

/**
 * ระยะที่ถือว่าปลายเส้นระยะจริง "อยู่ตรงแนวเดียวกัน" กับขอบของช่วง หน่วยเป็นเมตรบนแบบจริง
 *
 * 0.15 เมตรคือความหนาผนังก่ออิฐฉาบสองด้านโดยประมาณ ซึ่งเป็นระยะที่คนลากเส้นระยะจริง
 * พลาดได้โดยยังตั้งใจหมายถึงแนวเดียวกัน กว้างกว่านี้จะเริ่มกินช่วงข้างเคียงบนแบบที่เสาถี่
 */
export const DIMENSION_MATCH_METRES = 0.15;

/** ระยะที่ถือว่าจุดที่คลิก "อยู่บน" จุดตัด หน่วยเป็นพอยต์ของหน้ากระดาษ */
export const INTERSECTION_MATCH_POINTS = 0.5;

/** มุมหนึ่งมุมของช่วง พร้อมคำตอบว่ามันเกาะจุดตัดของแนวเสาหรือไม่ */
export type BayCorner = {
  point: PagePoint;
  /** ชื่อจุดตัดอย่าง "1-A" · null แปลว่ามุมนี้ไม่ได้อยู่บนจุดตัดแนวเสา */
  intersectionLabel: string | null;
};

/** ด้านหนึ่งด้านของช่วง และคำตอบว่าเลขนี้มาจากไหน */
export type BaySpan = {
  /** ระยะที่ใช้จริง เป็นเมตร */
  metres: number;
  /** ระยะที่คำนวณจากพิกัดคูณสเกล เป็นเมตร · มีเสมอ */
  measuredMetres: number;
  /** ระยะที่คนพิมพ์ไว้บนเส้นระยะจริงที่จับคู่ได้ · null แปลว่าไม่มีเส้นไหนพาดช่วงนี้ */
  statedMetres: number | null;
  /** id ของเส้นระยะจริงที่ใช้ · null เมื่อไม่มี */
  dimensionId: string | null;
};

export type GridBay = {
  /** สี่มุมเรียงตามเข็มนาฬิกา เริ่มจากมุมที่คลิกก่อน */
  corners: BayCorner[];
  /** ด้านตามแกนนอน */
  across: BaySpan;
  /** ด้านตามแกนตั้ง */
  down: BaySpan;
  areaSquareMetres: number;
  /**
   * ทุกมุมอยู่บนจุดตัดแนวเสาหรือไม่
   *
   * เป็นจริงเมื่อไหร่ ป้ายที่คนเห็นในใบราคาจึงเป็น "กึ่งกลางเสาถึงกึ่งกลางเสา" ได้
   * เป็นเท็จเมื่อไหร่ ป้ายลดชั้นเป็น "คนชี้จุดบนแบบ" ตามคำตัดสินเจ้าของงาน 2026-09-04
   * เพราะมุมที่มาจากนิ้วกับมุมที่มาจากแนวเสาเป็นข้อมูลคนละชนิด และใบราคาต้องไม่โกหก
   */
  everyCornerOnGrid: boolean;
};

/** ชื่อของช่วงอย่าง "1-A ถึง 2-B" · null เมื่อมุมใดมุมหนึ่งไม่ได้อยู่บนจุดตัด */
export function bayLabel(bay: GridBay): string | null {
  const first = bay.corners[0]?.intersectionLabel;
  const opposite = bay.corners[2]?.intersectionLabel;
  if (!first || !opposite) return null;
  return `${first} ถึง ${opposite}`;
}

/**
 * เส้นระยะจริงที่เป็นเลขของช่วงนี้ ถ้ามี
 *
 * **กติกาจับคู่** เส้นต้องวางไปตามแกนเดียวกับช่วง และปลายทั้งสองข้างต้องอยู่ตรงกับขอบทั้งสอง
 * ของช่วงในระยะที่ยอมรับได้ โดยดูเฉพาะพิกัดตามแกนนั้น ไม่ดูอีกแกน — เพราะเส้นบอกระยะในแบบ
 * ก่อสร้างเขียนอยู่นอกตัวผัง ห่างจากผนังออกไปหลายเมตร แต่ปลายเส้นตรงกับแนวเสาเสมอ
 *
 * เจอมากกว่าหนึ่งเส้นให้เอาเส้นที่ปลายตรงที่สุด ไม่ใช่เส้นแรกที่เจอ เพราะแบบที่มีทั้งเส้นรวม
 * และเส้นย่อยซ้อนกันอยู่จะให้คำตอบต่างกันตามลำดับที่คนลาก ซึ่งไม่ใช่คำตอบที่คงที่
 */
function matchDimension(
  dimensions: readonly StatedDimension[],
  axis: "x" | "y",
  from: number,
  to: number,
  tolerancePoints: number
): StatedDimension | null {
  const other = axis === "x" ? "y" : "x";
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  let best: { dimension: StatedDimension; error: number } | null = null;
  for (const dimension of dimensions) {
    const alongSpan = Math.abs(dimension.b[axis] - dimension.a[axis]);
    const acrossSpan = Math.abs(dimension.b[other] - dimension.a[other]);
    if (alongSpan <= acrossSpan) continue;
    const ends = [dimension.a[axis], dimension.b[axis]].sort((one, two) => one - two);
    const error = Math.abs(ends[0] - low) + Math.abs(ends[1] - high);
    if (Math.abs(ends[0] - low) > tolerancePoints) continue;
    if (Math.abs(ends[1] - high) > tolerancePoints) continue;
    if (!best || error < best.error) best = { dimension, error };
  }
  return best ? best.dimension : null;
}

function spanFor(
  dimensions: readonly StatedDimension[],
  axis: "x" | "y",
  from: number,
  to: number,
  scale: PageScale,
  tolerancePoints: number
): BaySpan {
  const measuredMetres = lengthInMetres(Math.abs(to - from), scale);
  const matched = matchDimension(dimensions, axis, from, to, tolerancePoints);
  return {
    metres: matched ? matched.valueM : measuredMetres,
    measuredMetres,
    statedMetres: matched ? matched.valueM : null,
    dimensionId: matched ? matched.id : null
  };
}

/**
 * ช่วงระหว่างแนวเสาจากสองมุมตรงข้ามที่คนคลิก
 *
 * **เลขที่แบบเขียนมาก่อนเลขที่คำนวณได้** ตามคำตัดสินเจ้าของงาน 2026-09-04 ด้วยเหตุผลเดียว
 * กับที่โปรเจกต์นี้ตัดสินไปแล้วว่าสเกลของหน้ามาจากเลขที่แบบเขียน ไม่ใช่จากสเกลที่พิมพ์ใต้รูป
 * แบบที่ถูกย่อขยายตอนพิมพ์ทำให้เลขที่คำนวณได้เพี้ยนทั้งหน้า ส่วนเลขที่เขียนกำกับไม่เพี้ยนตาม
 * · ทั้งสองค่ายังอยู่ในผลลัพธ์ทั้งคู่ หน้าจอจึงแสดงความต่างให้เห็นได้ ไม่ใช่เลือกให้เงียบ ๆ
 *
 * คืน null เมื่อสองมุมทับกันจนไม่เป็นสี่เหลี่ยม ซึ่งเป็นการคลิกพลาด ไม่ใช่ช่วงที่มีพื้นที่ศูนย์
 */
export function gridBayFromCorners(
  first: PagePoint,
  second: PagePoint,
  lines: readonly NamedGridLine[],
  dimensions: readonly StatedDimension[],
  scale: PageScale
): GridBay | null {
  if (distancePoints(first, second) < INTERSECTION_MATCH_POINTS) return null;
  if (first.x === second.x || first.y === second.y) return null;

  const nodes = gridIntersections(lines);
  const cornerPoints: PagePoint[] = [
    { x: first.x, y: first.y },
    { x: second.x, y: first.y },
    { x: second.x, y: second.y },
    { x: first.x, y: second.y }
  ];
  const corners = cornerPoints.map((point) => ({
    point,
    intersectionLabel:
      nearestIntersection(nodes, point, INTERSECTION_MATCH_POINTS)?.label ?? null
  }));

  const tolerancePoints = DIMENSION_MATCH_METRES / scale.metresPerPoint;
  const across = spanFor(dimensions, "x", first.x, second.x, scale, tolerancePoints);
  const down = spanFor(dimensions, "y", first.y, second.y, scale, tolerancePoints);

  return {
    corners,
    across,
    down,
    areaSquareMetres: across.metres * down.metres,
    everyCornerOnGrid: corners.every((corner) => corner.intersectionLabel !== null)
  };
}

/**
 * บรรทัดวิธีคิดที่คนอ่านแล้วตรวจซ้ำได้เอง
 *
 * มีเพราะสเปกสั่งว่าห้ามโชว์เลขพื้นที่โดยไม่บอกว่าวัดถึงผิวในหรือกึ่งกลางเสา ตัวเลขเปล่า ๆ
 * ตรวจไม่ได้ แต่ "2.50 × 3.00" ตรวจได้ด้วยการเอาไม้บรรทัดทาบแบบ · บรรทัดนี้ลง
 * `evidence_references.note` ซึ่งรับข้อความยาว ไม่ใช่ `label` ที่จำกัด 120 ตัวอักษร
 */
export function bayExplanation(bay: GridBay): string {
  const name = bayLabel(bay);
  const where = name ? `ช่วง ${name}` : "ช่วงที่ชี้เอง";
  const how = bay.everyCornerOnGrid ? "วัดกึ่งกลางเสาถึงกึ่งกลางเสา" : "วัดจากจุดที่คนชี้เอง";
  const sides = `${bay.across.metres.toFixed(2)} × ${bay.down.metres.toFixed(2)}`;
  const parts = [`${where} · ${how} · ${sides} = ${bay.areaSquareMetres.toFixed(2)} ตร.ม.`];
  for (const [axis, span] of [
    ["ด้านกว้าง", bay.across],
    ["ด้านลึก", bay.down]
  ] as const) {
    if (span.statedMetres === null) {
      parts.push(`${axis} ${span.measuredMetres.toFixed(2)} ม. คำนวณจากสเกล ไม่มีเลขที่แบบเขียน`);
      continue;
    }
    const gap = Math.abs(span.statedMetres - span.measuredMetres);
    parts.push(
      `${axis} ใช้เลขที่แบบเขียน ${span.statedMetres.toFixed(2)} ม. · วัดได้ ${span.measuredMetres.toFixed(2)} ม. · ต่างกัน ${gap.toFixed(2)} ม.`
    );
  }
  return parts.join(" · ");
}
