/**
 * เครื่องยนต์ดูดจุด — เจ็ดชนิด แข่งกันด้วยระยะล้วน (IP-227)
 *
 * สเปกทั้งไฟล์นี้มาจากแอปเดิมของเจ้าของงานที่ `doh-thai.com/estimate/` ซึ่งเขาใช้งานผ่านแล้ว
 * ไม่ใช่การออกแบบใหม่ · เจ้าของงานเคาะ 2026-09-02 ว่า **ยกมาทั้งเจ็ดแบบ ค่าเริ่มต้นเหมือนเดิม**
 *
 * **กติกาที่สำคัญที่สุดคือทุกชนิดที่เปิดอยู่แข่งกันด้วยระยะห่างล้วน ๆ ใกล้ที่สุดชนะ**
 * ไม่มีชนิดไหนมีสิทธิ์เหนือชนิดอื่น ยกเว้นกริดระยะเท่าซึ่งใช้ต่อเมื่อไม่มีชนิดอื่นติดเลย
 * เพราะกริดระยะเท่าไม่ได้อ้างอิงอะไรบนแบบจริง มันเป็นตารางสมมติที่เราวางทับลงไป
 *
 * **รัศมีจับวัดเป็นพิกเซลบนจอแล้วหารด้วยระดับซูม** ระยะจับจึงกว้างเท่าเดิมเสมอในสายตา
 * ไม่ว่าจะซูมเข้าหรือออก ผู้เรียกเป็นคนหารแล้วส่ง `radiusPagePoints` เข้ามา
 *
 * ไฟล์นี้ไม่รู้จัก React ไม่รู้จัก pdf.js และไม่รู้จักฐานข้อมูล
 */

import { segmentIntersection, type DraftedGridLine } from "@/lib/drawing-grid";
import { outlinePoints, type Measurement } from "@/lib/drawing-measurement";
import type { PagePoint, StatedDimension } from "@/lib/drawing-scale";

export { segmentIntersection };

export type SnapKind =
  | "endpoint"
  | "midpoint"
  | "intersection"
  | "perpendicular"
  | "on_edge"
  | "grid"
  | "image";

export const snapKindLabel: Record<SnapKind, string> = {
  endpoint: "ปลายเส้น",
  midpoint: "กึ่งกลาง",
  intersection: "จุดตัด",
  perpendicular: "ตั้งฉาก",
  on_edge: "บนเส้น",
  grid: "กริด",
  image: "เส้นในแบบ"
};

export type ImageSensitivity = "dark" | "normal" | "faint";

export type SnapSettings = {
  enabled: boolean;
  endpoint: boolean;
  midpoint: boolean;
  intersection: boolean;
  perpendicular: boolean;
  onEdge: boolean;
  grid: boolean;
  imageSnap: boolean;
  imageSensitivity: ImageSensitivity;
  /** รัศมีจับ หน่วยพิกเซลบนจอ */
  screenRadius: number;
  /** ระยะของกริดสมมติ หน่วยเมตร */
  gridSpacingM: number;
};

/**
 * ค่าเริ่มต้นทุกช่องตรงกับแอปเดิมของเจ้าของงาน
 *
 * สามชนิดแรกเปิดเพราะอ้างอิงของที่มีอยู่จริงบนแบบและแทบไม่เคยดูดผิด ส่วนสี่ชนิดหลังปิด
 * เพราะมันเสนอจุดได้เยอะจนเกะกะเมื่อไม่ได้ตั้งใจใช้ ผู้ใช้เปิดเองเมื่อถึงจังหวะที่ต้องการ
 */
export const DEFAULT_SNAP_SETTINGS: SnapSettings = {
  enabled: true,
  endpoint: true,
  midpoint: true,
  intersection: true,
  perpendicular: false,
  onEdge: false,
  grid: false,
  imageSnap: false,
  imageSensitivity: "normal",
  screenRadius: 12,
  gridSpacingM: 0.5
};

/** เพดานความสว่างที่ยังนับว่าเป็นเส้นในแบบ ยิ่งสูงยิ่งจับเส้นจาง */
export const IMAGE_LUMINANCE_CEILING: Record<ImageSensitivity, number> = {
  dark: 90,
  normal: 130,
  faint: 170
};

/** ระยะกริดสมมติเมื่อหน้ายังไม่ได้ตั้งสเกล จึงแปลงเมตรเป็น point ไม่ได้ */
export const GRID_FALLBACK_SPACING_POINTS = 50;

export const IMAGE_SNAP_MIN_RADIUS_PX = 1;
export const IMAGE_SNAP_MAX_RADIUS_PX = 35;

/** พิกเซลที่โปร่งกว่านี้ถือว่าไม่มีอะไรอยู่ ไม่ใช่เส้นสีเข้ม */
const IMAGE_MIN_ALPHA = 20;

export type Segment = { a: PagePoint; b: PagePoint };

export type SnapHit = { kind: SnapKind; point: PagePoint; distance: number };

const distanceBetween = (from: PagePoint, to: PagePoint) => Math.hypot(to.x - from.x, to.y - from.y);

/**
 * จุดบนช่วงเส้นที่ใกล้จุดที่ให้มาที่สุด โดยหนีบไว้ไม่ให้เลยปลายทั้งสองข้าง
 *
 * การหนีบเป็นเรื่องสำคัญ ไม่ใช่รายละเอียด ถ้าไม่หนีบ เท้าฉากจะไปตกบนเส้นที่ต่อออกไป
 * ในที่ว่างซึ่งไม่มีอะไรอยู่จริง แล้วผู้ใช้จะคลิกโดนจุดที่ไม่มีอยู่บนแบบ
 */
function closestPointOnSegment(point: PagePoint, segment: Segment): PagePoint {
  const dx = segment.b.x - segment.a.x;
  const dy = segment.b.y - segment.a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 1e-9) return { x: segment.a.x, y: segment.a.y };
  const raw = ((point.x - segment.a.x) * dx + (point.y - segment.a.y) * dy) / lengthSquared;
  const clamped = Math.min(1, Math.max(0, raw));
  return { x: segment.a.x + clamped * dx, y: segment.a.y + clamped * dy };
}

/**
 * รวบรวมเรขาคณิตของหน้าหนึ่งให้เครื่องยนต์ใช้
 *
 * รูปปิด (พื้นที่หลายเหลี่ยมและสี่เหลี่ยม) นับขอบที่ปิดวงด้วย เพราะขอบนั้นมีอยู่จริงในสายตา
 * ผู้ใช้ · สี่เหลี่ยมถูกกางเป็นสี่มุมก่อน เพราะในข้อมูลมันเก็บแค่สองมุมตรงข้าม
 * · จุดของเครื่องมือนับจำนวนเข้า `loosePoints` เพราะมันเป็นหมุดเดี่ยว ไม่ได้ประกอบเป็นเส้น
 *
 * เส้นร่างที่ยังลากไม่จบไม่รวมอยู่ในนี้ เพราะการดูดเข้าหาเส้นที่ตัวเองกำลังลากทำให้ปลายเส้น
 * วิ่งไปเกาะจุดก่อนหน้าของตัวเอง
 */
export function collectSnapGeometry(
  measurements: readonly Measurement[],
  gridLines: readonly DraftedGridLine[],
  dimensions: readonly StatedDimension[],
  page: number
): { segments: Segment[]; loosePoints: PagePoint[] } {
  const segments: Segment[] = [];
  const loosePoints: PagePoint[] = [];

  for (const measurement of measurements) {
    if (measurement.page !== page) continue;
    if (measurement.kind === "count") {
      loosePoints.push(...measurement.points);
      continue;
    }
    const outline = outlinePoints(measurement);
    if (outline.length < 2) continue;
    const closes = measurement.kind === "area" || measurement.kind === "rect";
    const edgeCount = closes ? outline.length : outline.length - 1;
    for (let index = 0; index < edgeCount; index += 1) {
      segments.push({ a: outline[index], b: outline[(index + 1) % outline.length] });
    }
  }

  for (const line of gridLines) {
    if (line.page !== page) continue;
    segments.push({ a: line.a, b: line.b });
  }

  for (const dimension of dimensions) {
    if (dimension.page !== page) continue;
    segments.push({ a: dimension.a, b: dimension.b });
  }

  return { segments, loosePoints };
}

/**
 * หาจุดที่ควรดูดเข้าหา จากเรขาคณิตของหน้าเท่านั้น ยังไม่แตะภาพ
 *
 * ลำดับที่ไล่ในโค้ดนี้มีผลเฉพาะตอนระยะเสมอกันพอดี ซึ่งเกิดยากแต่เกิดได้ การกำหนดลำดับไว้
 * ทำให้ผลออกมานิ่งและเทสต์ได้ ไม่ใช่ขึ้นกับว่าวนเจออะไรก่อน
 */
export function findGeometrySnap(input: {
  cursor: PagePoint;
  radiusPagePoints: number;
  geometry: { segments: readonly Segment[]; loosePoints: readonly PagePoint[] };
  lastPlaced: PagePoint | null;
  metresPerPoint: number | null;
  settings: SnapSettings;
}): SnapHit | null {
  const { cursor, radiusPagePoints, geometry, lastPlaced, settings } = input;
  if (!settings.enabled) return null;
  if (!Number.isFinite(radiusPagePoints) || radiusPagePoints <= 0) return null;

  let best: SnapHit | null = null;
  const offer = (kind: SnapKind, point: PagePoint, distance: number) => {
    if (distance > radiusPagePoints) return;
    if (!best || distance < best.distance) best = { kind, point, distance };
  };

  if (settings.endpoint) {
    for (const segment of geometry.segments) {
      offer("endpoint", segment.a, distanceBetween(cursor, segment.a));
      offer("endpoint", segment.b, distanceBetween(cursor, segment.b));
    }
    for (const point of geometry.loosePoints) {
      offer("endpoint", point, distanceBetween(cursor, point));
    }
  }

  if (settings.midpoint) {
    for (const segment of geometry.segments) {
      const middle = { x: (segment.a.x + segment.b.x) / 2, y: (segment.a.y + segment.b.y) / 2 };
      offer("midpoint", middle, distanceBetween(cursor, middle));
    }
  }

  if (settings.intersection) {
    for (let first = 0; first < geometry.segments.length; first += 1) {
      for (let second = first + 1; second < geometry.segments.length; second += 1) {
        const crossing = segmentIntersection(geometry.segments[first], geometry.segments[second]);
        if (crossing) offer("intersection", crossing, distanceBetween(cursor, crossing));
      }
    }
  }

  // ดูดเข้าตั้งฉากต้องมีจุดล่าสุดที่ผู้ใช้ปักแล้ว เพราะฉากลากจากจุดนั้นไปหาเส้น ไม่ใช่จากเคอร์เซอร์
  if (settings.perpendicular && lastPlaced) {
    for (const segment of geometry.segments) {
      const foot = closestPointOnSegment(lastPlaced, segment);
      offer("perpendicular", foot, distanceBetween(cursor, foot));
    }
  }

  if (settings.onEdge) {
    for (const segment of geometry.segments) {
      const onEdge = closestPointOnSegment(cursor, segment);
      offer("on_edge", onEdge, distanceBetween(cursor, onEdge));
    }
  }

  // กริดระยะเท่าเป็นตารางสมมติ ไม่ได้อ้างอิงอะไรบนแบบจริง จึงใช้ต่อเมื่อไม่มีชนิดอื่นติดเลย
  if (!best && settings.grid) {
    const spacing =
      input.metresPerPoint && input.metresPerPoint > 0
        ? settings.gridSpacingM / input.metresPerPoint
        : GRID_FALLBACK_SPACING_POINTS;
    if (spacing > 0) {
      const originX = lastPlaced?.x ?? 0;
      const originY = lastPlaced?.y ?? 0;
      const snapped = {
        x: originX + Math.round((cursor.x - originX) / spacing) * spacing,
        y: originY + Math.round((cursor.y - originY) / spacing) * spacing
      };
      offer("grid", snapped, distanceBetween(cursor, snapped));
    }
  }

  return best;
}

/**
 * หาพิกเซลของเส้นในแบบที่อยู่ใกล้เคอร์เซอร์ที่สุด
 *
 * **หา "ใกล้ที่สุด" ไม่ใช่ "เข้มที่สุด"** ซึ่งเป็นจุดที่ต่างจากโค้ดเดิมของเรา โค้ดเดิมให้คะแนน
 * ด้วยความเข้มบวกโทษระยะ ทำให้เส้นหนาที่อยู่ไกลชนะเส้นบางที่อยู่ตรงหน้า ทั้งที่ผู้ใช้เล็งเส้นบาง
 * แอปเดิมของเจ้าของงานใช้เกณฑ์ผ่านไม่ผ่านกับความสว่าง แล้วเลือกจากระยะอย่างเดียว
 *
 * ทำงานบนภาพของชั้นวิเคราะห์ พิกัดที่รับและคืนจึงเป็นพิกเซลของชั้นนั้น ไม่ใช่หน่วยหน้ากระดาษ
 */
export function findImageSnap(
  image: { data: Uint8ClampedArray; width: number; height: number },
  centre: { x: number; y: number },
  radiusPx: number,
  ceiling: number
): { x: number; y: number } | null {
  const centreX = Math.round(centre.x);
  const centreY = Math.round(centre.y);
  if (centreX < 0 || centreY < 0 || centreX >= image.width || centreY >= image.height) return null;

  const radius = Math.max(
    IMAGE_SNAP_MIN_RADIUS_PX,
    Math.min(IMAGE_SNAP_MAX_RADIUS_PX, Math.round(radiusPx))
  );
  const radiusSquared = radius * radius;
  let bestDistanceSquared = Number.POSITIVE_INFINITY;
  let best: { x: number; y: number } | null = null;

  for (let dy = -radius; dy <= radius; dy += 1) {
    const y = centreY + dy;
    if (y < 0 || y >= image.height) continue;
    for (let dx = -radius; dx <= radius; dx += 1) {
      const x = centreX + dx;
      if (x < 0 || x >= image.width) continue;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared > radiusSquared || distanceSquared >= bestDistanceSquared) continue;
      const offset = (y * image.width + x) * 4;
      if (image.data[offset + 3] < IMAGE_MIN_ALPHA) continue;
      const luminance =
        0.299 * image.data[offset] + 0.587 * image.data[offset + 1] + 0.114 * image.data[offset + 2];
      if (luminance >= ceiling) continue;
      if (distanceSquared < bestDistanceSquared) {
        bestDistanceSquared = distanceSquared;
        best = { x, y };
      }
    }
  }

  return best;
}
