/**
 * เส้นกริดที่ผู้ใช้ร่างเอง และจุดตัดของแนวเสา (IP-227)
 *
 * เจ้าของงานทำงานตามลำดับนี้จริงในแอปเดิมของเขา — **ร่างเส้นทับแนวเสาก่อน แล้วจุดตัดที่ได้
 * คือจุดจริงบนแบบ** ซึ่งใช้อ้างตำแหน่งและใช้นับฐานรากกับเสาได้แม่น จากนั้นค่อยตั้งสเกล
 * โดยพิมพ์ระยะที่แบบเขียนกำกับ ไม่ใช่ตั้งสเกลก่อนแล้วค่อยทำอย่างอื่น
 *
 * **ชื่อแนวและจุดตัดคำนวณใหม่เสมอ ไม่เก็บลงฐาน** สิ่งที่เก็บคือตำแหน่งของเส้นเท่านั้น
 * ถ้าเก็บจุดตัดไว้ วันที่คนลากเส้นใหม่แทรกกลางหรือลบเส้นทิ้ง จุดตัดที่เก็บไว้จะกลายเป็น
 * ค่าค้างที่ไม่มีใครรู้ว่าเก่า และไม่มีอะไรบอกได้ว่ามันเก่า
 *
 * ไฟล์นี้ไม่รู้จัก React ไม่รู้จัก pdf.js และไม่รู้จักฐานข้อมูล
 */

import type { PagePoint } from "@/lib/drawing-scale";

/** เส้นที่ผู้ใช้ลากทับแนวเสาหนึ่งเส้น เก็บแค่ตำแหน่งกับชื่อที่คนพิมพ์ทับ (ถ้ามี) */
export type DraftedGridLine = {
  id: string;
  page: number;
  a: PagePoint;
  b: PagePoint;
  /**
   * ชื่อที่ผู้ใช้ดับเบิลคลิกแล้วพิมพ์ทับ
   *
   * เจ้าของงานเคาะ 2026-09-02 ว่า "ไล่ให้ก่อน แต่ดับเบิลคลิกแก้ทับได้ทีละเส้น" เพราะแบบไทยจริง
   * ไม่ได้เริ่มที่ 1 หรือ A เสมอ บางหน้าเป็นรูปขยายที่แนวเสาเริ่มที่ C หรือข้ามตัวอักษรบางตัว
   * เส้นที่ไม่มีค่านี้ยังถูกไล่ชื่อใหม่ตามตำแหน่งเหมือนเดิม การพิมพ์ทับเส้นหนึ่งจึงไม่ไปหยุด
   * การไล่ชื่ออัตโนมัติของเส้นอื่น
   */
  label?: string;
};

/** แนวตัวเลขคือเส้นที่ตั้ง แนวตัวอักษรคือเส้นที่นอน ตามธรรมเนียมแบบก่อสร้าง */
export type GridFamily = "number" | "letter";

export type NamedGridLine = DraftedGridLine & {
  family: GridFamily;
  /** ชื่อที่ใช้จริง — ชื่อที่คนพิมพ์ทับชนะเสมอเมื่อมี */
  label: string;
  /** ชื่อที่ระบบไล่ให้จากตำแหน่ง เก็บไว้ให้จอบอกได้ว่าชื่อนี้ถูกแก้ทับอยู่ */
  autoLabel: string;
};

const midpointX = (line: { a: PagePoint; b: PagePoint }) => (line.a.x + line.b.x) / 2;
const midpointY = (line: { a: PagePoint; b: PagePoint }) => (line.a.y + line.b.y) / 2;

/**
 * เส้นนี้เป็นแนวตัวเลขหรือแนวตัวอักษร
 *
 * เส้นที่ตั้งกว่านอนเป็นแนวตัวเลข ที่เหลือเป็นแนวตัวอักษร เส้นเฉียง 45 องศาพอดีนับเป็น
 * แนวตัวอักษร เพื่อให้ผลออกมาแน่นอนค่าเดียว ไม่ใช่ขึ้นกับความคลาดเคลื่อนของทศนิยม
 */
export function classifyGridLine(line: { a: PagePoint; b: PagePoint }): GridFamily {
  const dx = Math.abs(line.b.x - line.a.x);
  const dy = Math.abs(line.b.y - line.a.y);
  return dy > dx ? "number" : "letter";
}

/**
 * ชื่อของแนวลำดับที่ index (เริ่มนับจาก 0)
 *
 * แนวตัวเลขได้ 1 2 3 · แนวตัวอักษรได้ A B C แล้วต่อด้วย AA AB เมื่อเกิน Z
 * แบบเดียวกับชื่อคอลัมน์ของโปรแกรมตาราง ซึ่งเป็นแบบที่คนทำแบบคุ้นอยู่แล้ว
 */
export function gridLabelForIndex(family: GridFamily, index: number): string {
  if (!Number.isFinite(index) || index < 0) return "";
  if (family === "number") return String(Math.floor(index) + 1);
  let remaining = Math.floor(index);
  let label = "";
  while (remaining >= 0) {
    label = String.fromCharCode(65 + (remaining % 26)) + label;
    remaining = Math.floor(remaining / 26) - 1;
  }
  return label;
}

/**
 * ไล่ชื่อให้ทุกเส้นตามตำแหน่ง
 *
 * แนวตัวเลขเรียงจากพิกัดกลางแนวนอนน้อยไปมาก แนวตัวอักษรเรียงจากพิกัดกลางแนวตั้งน้อยไปมาก
 * ซึ่งตรงกับที่แบบก่อสร้างเขียน คือเลขไล่จากซ้ายไปขวา ตัวอักษรไล่จากบนลงล่าง
 *
 * ลำดับของผลลัพธ์ตรงกับลำดับที่ส่งเข้ามา ไม่ใช่ลำดับที่เรียงแล้ว เพื่อให้ผู้เรียกจับคู่กลับ
 * ไปยังรายการเดิมได้โดยไม่ต้องค้นหา
 */
export function nameGridLines(lines: readonly DraftedGridLine[]): NamedGridLine[] {
  const classified = lines.map((line) => ({ line, family: classifyGridLine(line) }));

  const orderOf = (family: GridFamily) =>
    classified
      .map((entry, index) => ({ ...entry, index }))
      .filter((entry) => entry.family === family)
      .sort((left, right) =>
        family === "number"
          ? midpointX(left.line) - midpointX(right.line)
          : midpointY(left.line) - midpointY(right.line)
      );

  const autoLabels = new Map<number, string>();
  for (const family of ["number", "letter"] as const) {
    orderOf(family).forEach((entry, position) => {
      autoLabels.set(entry.index, gridLabelForIndex(family, position));
    });
  }

  return classified.map(({ line, family }, index) => {
    const autoLabel = autoLabels.get(index) ?? "";
    const typed = line.label?.trim();
    return { ...line, family, autoLabel, label: typed ? typed : autoLabel };
  });
}

/**
 * จุดที่เส้นสองเส้นตัดกัน โดยจุดตัดต้องอยู่บนตัวเส้นทั้งคู่ ไม่ใช่บนเส้นที่ต่อออกไป
 *
 * คืน null เมื่อเส้นขนานกัน หรือจุดตัดหลุดออกไปนอกช่วงของเส้นใดเส้นหนึ่ง
 */
export function segmentIntersection(
  first: { a: PagePoint; b: PagePoint },
  second: { a: PagePoint; b: PagePoint }
): PagePoint | null {
  const dx1 = first.b.x - first.a.x;
  const dy1 = first.b.y - first.a.y;
  const dx2 = second.b.x - second.a.x;
  const dy2 = second.b.y - second.a.y;
  const denominator = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denominator) < 1e-9) return null;
  const t = ((second.a.x - first.a.x) * dy2 - (second.a.y - first.a.y) * dx2) / denominator;
  const u = ((second.a.x - first.a.x) * dy1 - (second.a.y - first.a.y) * dx1) / denominator;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: first.a.x + t * dx1, y: first.a.y + t * dy1 };
}

export type GridIntersection = { label: string; point: PagePoint };

/**
 * จุดตัดของแนวเสาทั้งหมดบนหน้านี้
 *
 * จับคู่เฉพาะแนวตัวเลขกับแนวตัวอักษร เส้นตระกูลเดียวกันไม่จับคู่กัน เพราะแนวเสาที่ขนานกัน
 * ตัดกันไม่ได้อยู่แล้ว ถ้ามันตัดกันแปลว่าคนลากผิด ไม่ใช่ว่ามีจุดตัดจริง
 *
 * ป้ายเป็นรูป "1-A" คือชื่อแนวตัวเลขก่อน ตามด้วยชื่อแนวตัวอักษร
 * **ผลลัพธ์ของฟังก์ชันนี้ห้ามเก็บลงฐานข้อมูล** ให้เรียกใหม่ทุกครั้งที่ต้องใช้
 */
export function gridIntersections(lines: readonly NamedGridLine[]): GridIntersection[] {
  const numbers = lines.filter((line) => line.family === "number");
  const letters = lines.filter((line) => line.family === "letter");
  const found: GridIntersection[] = [];
  for (const number of numbers) {
    for (const letter of letters) {
      const point = segmentIntersection(number, letter);
      if (point) found.push({ label: `${number.label}-${letter.label}`, point });
    }
  }
  return found;
}

/**
 * จุดตัดที่ใกล้จุดที่ให้มาที่สุด ภายในระยะที่ยอมรับได้
 *
 * ใช้ตอบว่า "หมุดที่ปักอยู่ตรงไหน" ให้เป็นชื่อที่เขียนลงเอกสารได้ เช่น `F2 ที่ 3-B`
 * แทนที่จะเป็นพิกัดซึ่งไม่มีใครตรวจซ้ำได้ · คืน null เมื่อไม่มีจุดตัดไหนอยู่ในระยะ
 * ซึ่งเป็นคำตอบที่ถูกต้อง ไม่ใช่ความล้มเหลว เพราะฐานรากนอกแนวเสาก็มีจริง
 */
export function nearestIntersection(
  intersections: readonly GridIntersection[],
  at: PagePoint,
  withinPoints: number
): GridIntersection | null {
  let best: { intersection: GridIntersection; distance: number } | null = null;
  for (const intersection of intersections) {
    const distance = Math.hypot(intersection.point.x - at.x, intersection.point.y - at.y);
    if (distance > withinPoints) continue;
    if (!best || distance < best.distance) best = { intersection, distance };
  }
  return best ? best.intersection : null;
}
