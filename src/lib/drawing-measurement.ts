/**
 * รายการวัดบนหน้าแบบ และการสรุปรวมของรายการเหล่านั้น (IP-228)
 *
 * ไฟล์นี้เป็นตรรกะล้วน ไม่รู้จัก React ไม่รู้จัก pdf.js และไม่แตะฐานข้อมูล
 * เพื่อให้ตัวเลขทุกตัวที่ขึ้นบนจอมีเทสต์เดินตรวจได้โดยไม่ต้องเปิดเบราว์เซอร์
 *
 * **สิ่งที่ไฟล์นี้ไม่ทำ** ไม่มีราคา ไม่มีเงิน ไม่มีการเรียกแบบจำลอง
 * การวัดคือการวัด ส่วนการตีราคาเป็นงานของชั้นราคาซึ่งอยู่คนละที่
 *
 * **ทำไมพื้นที่ต้องคืนเส้นรอบรูปมาด้วยเสมอ** ผู้ประมาณราคาเอาเส้นรอบรูปคูณความสูงเพื่อคิดงานผนัง
 * แล้วหักช่องประตูหน้าต่าง การวัดพื้นที่ห้องหนึ่งครั้งจึงป้อนได้สองรายการในใบราคา
 * ถ้าคืนแต่พื้นที่ ผู้ใช้ต้องกลับไปวัดผนังซ้ำอีกรอบทั้งที่ระบบรู้คำตอบอยู่แล้ว
 */

import {
  areaInSquareMetres,
  lengthInMetres,
  polygonAreaPoints,
  polygonPerimeterPoints,
  polylineLengthPoints,
  segmentLengthsPoints,
  type PagePoint,
  type PageScale
} from "@/lib/drawing-scale";

/** ชนิดของสิ่งที่ผู้ใช้วัด — ชื่อเหล่านี้ปรากฏบนจอ จึงเป็นคำไทยที่ตกลงกันแล้ว */
export type MeasurementKind = "length" | "polyline" | "area" | "rect" | "count";

export const measurementKindLabel: Record<MeasurementKind, string> = {
  length: "ระยะสองจุด",
  polyline: "ระยะต่อเนื่อง",
  area: "พื้นที่หลายเหลี่ยม",
  rect: "พื้นที่สี่เหลี่ยม",
  count: "นับจำนวน"
};

/** ชนิดไหนต้องมีสเกลก่อนถึงจะให้ค่าที่มีความหมาย — การนับจำนวนไม่ต้อง */
export function needsScale(kind: MeasurementKind): boolean {
  return kind !== "count";
}

export function minimumPoints(kind: MeasurementKind): number {
  switch (kind) {
    case "length":
      return 2;
    case "polyline":
      return 2;
    case "area":
      return 3;
    case "rect":
      return 2;
    case "count":
      return 1;
  }
}

export type Measurement = {
  id: string;
  /** เลขหน้าในไฟล์แบบ เริ่มที่ 1 */
  page: number;
  kind: MeasurementKind;
  /** ชื่อที่ผู้ใช้ตั้ง เช่น ห้องครัว หรือ แนวผนังทิศเหนือ — ว่างได้ */
  name: string;
  /** จุดทั้งหมดในพิกัดของหน้ากระดาษ ไม่ใช่พิกเซลบนจอ */
  points: PagePoint[];
  colour: string;
  /**
   * จุดพวกนี้ได้มาอย่างไร — คนชี้เอง หรือระบบไล่ขอบห้องแล้วคนยืนยัน
   *
   * ต้องเก็บตั้งแต่ตอนวาด เพราะหลังยืนยันแล้วรูปห้องกับรูปหลายเหลี่ยมที่ลากเองหน้าตาเหมือนกันทุกจุด
   * แต่ตอนส่งเข้าถอดปริมาณต้องบอกได้ว่าเป็น `pointer` หรือ `region_trace` (ADR 0024)
   */
  origin: MeasurementOrigin;
};

export type MeasurementOrigin = "pointer" | "region_trace";

export function isMeasurementOrigin(value: string): value is MeasurementOrigin {
  return value === "pointer" || value === "region_trace";
}

/**
 * ค่าที่คำนวณได้จากรายการวัดหนึ่งรายการ
 *
 * ช่องที่ไม่เกี่ยวกับชนิดนั้นเป็น `null` ไม่ใช่ศูนย์ เพราะศูนย์แปลว่าวัดได้ศูนย์
 * ส่วน `null` แปลว่าคำถามนี้ไม่มีความหมายกับการวัดชนิดนี้ สองอย่างนี้ต่างกัน
 */
export type MeasurementValue = {
  lengthMetres: number | null;
  perimeterMetres: number | null;
  areaSquareMetres: number | null;
  count: number | null;
  /** ความยาวรายด้านเป็นเมตร เพื่อให้ตารางตอบได้ว่าความยาวรวมมาจากด้านไหนบ้าง */
  segmentsMetres: number[];
  /** จริงเมื่อชนิดนี้ต้องใช้สเกลแต่หน้านั้นยังไม่ได้สอบเทียบ */
  blockedByScale: boolean;
};

/** สี่เหลี่ยมเก็บแค่สองมุมตรงข้าม กางเป็นสี่มุมตอนคำนวณ เพื่อให้ผู้ใช้ลากแก้ได้ง่าย */
export function rectangleCorners(points: readonly PagePoint[]): PagePoint[] {
  if (points.length < 2) return [];
  const [a, b] = points;
  return [
    { x: a.x, y: a.y },
    { x: b.x, y: a.y },
    { x: b.x, y: b.y },
    { x: a.x, y: b.y }
  ];
}

/** จุดที่ใช้วาดและใช้คำนวณจริงของรายการหนึ่ง */
export function outlinePoints(measurement: Measurement): PagePoint[] {
  return measurement.kind === "rect" ? rectangleCorners(measurement.points) : measurement.points;
}

export function isComplete(measurement: Measurement): boolean {
  return measurement.points.length >= minimumPoints(measurement.kind);
}

/**
 * ชื่อที่ส่งมาเป็นชนิดของการวัดจริงหรือไม่
 *
 * หน้าจอมีเครื่องมืออย่าง เลือก เลื่อน และ ตั้งสเกล ซึ่งไม่ได้ผลลัพธ์เป็นรายการวัด
 * ถ้าไม่มีด่านนี้ การกด Enter ตอนถือเครื่องมือเหล่านั้นจะสร้างแถวเปล่าไม่มีชนิดค้างในรายการ
 * ซึ่งเป็นสิ่งที่เจอจริงจากการกดมือเมื่อ 2026-09-01
 */
export function isMeasurementKind(value: string): value is MeasurementKind {
  return value in measurementKindLabel;
}

/**
 * หารายการวัดที่อยู่ใต้จุดที่คลิก เพื่อให้เครื่องมือเลือกหยิบรูปบนแบบได้ตรง ๆ
 *
 * ไล่จากรายการที่วาดทีหลังไปหารายการแรก เพราะรูปที่วาดทีหลังอยู่บนสุดในสายตาผู้ใช้
 * รูปปิด เช่น พื้นที่ ถือว่าโดนเมื่อคลิกในเนื้อที่หรือใกล้เส้นขอบ ส่วนเส้นและจุดนับ
 * ถือว่าโดนเมื่อคลิกใกล้กว่าระยะผ่อนผันที่ส่งเข้ามา ซึ่งหน้าจอคำนวณจากระดับซูมให้แล้ว
 */
export function hitTest(
  measurements: readonly Measurement[],
  point: PagePoint,
  tolerance: number
): string | null {
  for (let index = measurements.length - 1; index >= 0; index -= 1) {
    const item = measurements[index];
    const outline = outlinePoints(item);
    if (outline.length === 0) continue;

    if (item.kind === "count") {
      const near = outline.some((corner) => Math.hypot(corner.x - point.x, corner.y - point.y) <= tolerance);
      if (near) return item.id;
      continue;
    }

    const closed = item.kind === "area" || item.kind === "rect";
    if (closed && pointInPolygon(point, outline)) return item.id;
    const path = closed ? [...outline, outline[0]] : outline;
    if (nearPath(point, path, tolerance)) return item.id;
  }
  return null;
}

/** จุดอยู่ในรูปหลายเหลี่ยมหรือไม่ ด้วยวิธีนับจำนวนครั้งที่รังสีตัดขอบ */
export function pointInPolygon(point: PagePoint, polygon: readonly PagePoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const straddles = a.y > point.y !== b.y > point.y;
    if (!straddles) continue;
    const crossX = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (point.x < crossX) inside = !inside;
  }
  return inside;
}

function nearPath(point: PagePoint, path: readonly PagePoint[], tolerance: number): boolean {
  for (let index = 0; index + 1 < path.length; index += 1) {
    if (distanceToSegment(point, path[index], path[index + 1]) <= tolerance) return true;
  }
  return false;
}

/** ระยะจากจุดถึงส่วนของเส้นตรง ไม่ใช่ถึงเส้นตรงที่ยาวไม่สิ้นสุด */
export function distanceToSegment(point: PagePoint, from: PagePoint, to: PagePoint): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - from.x, point.y - from.y);
  const along = ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared;
  const clamped = Math.min(1, Math.max(0, along));
  return Math.hypot(point.x - (from.x + clamped * dx), point.y - (from.y + clamped * dy));
}

export function measure(measurement: Measurement, scale: PageScale | null): MeasurementValue {
  const empty: MeasurementValue = {
    lengthMetres: null,
    perimeterMetres: null,
    areaSquareMetres: null,
    count: null,
    segmentsMetres: [],
    blockedByScale: false
  };

  if (measurement.kind === "count") {
    return { ...empty, count: measurement.points.length };
  }

  if (!isComplete(measurement)) return empty;
  if (!scale) return { ...empty, blockedByScale: true };

  const outline = outlinePoints(measurement);

  if (measurement.kind === "length" || measurement.kind === "polyline") {
    return {
      ...empty,
      lengthMetres: lengthInMetres(polylineLengthPoints(outline), scale),
      segmentsMetres: segmentLengthsPoints(outline).map((segment) => lengthInMetres(segment, scale))
    };
  }

  // พื้นที่คืนเส้นรอบรูปมาด้วยเสมอ ดูเหตุผลที่หัวไฟล์
  return {
    ...empty,
    areaSquareMetres: areaInSquareMetres(polygonAreaPoints(outline), scale),
    perimeterMetres: lengthInMetres(polygonPerimeterPoints(outline), scale),
    segmentsMetres: segmentLengthsPoints([...outline, outline[0]]).map((segment) =>
      lengthInMetres(segment, scale)
    )
  };
}

export type MeasurementRow = { measurement: Measurement; value: MeasurementValue };

export type PageGroup = {
  page: number;
  rows: MeasurementRow[];
  /** ผลรวมของหน้านั้น ตรงกับแถวสรุปหน้าที่ผู้ใช้คาดหวังจากเครื่องมือประเภทนี้ */
  totalLengthMetres: number;
  totalAreaSquareMetres: number;
  totalCount: number;
};

export type KindTotal = {
  kind: MeasurementKind;
  items: number;
  lengthMetres: number;
  areaSquareMetres: number;
  count: number;
};

export type MeasurementSummary = {
  pages: PageGroup[];
  kinds: KindTotal[];
  /** จริงเมื่อมีอย่างน้อยหนึ่งรายการที่รอสเกลอยู่ ใช้กั้นการนำเข้าใบราคา */
  hasBlockedRows: boolean;
};

/**
 * สรุปรายการวัดทั้งหมด จัดกลุ่มตามหน้า แล้วรวมยอดตามชนิด
 *
 * **รายการที่ยังรอสเกลไม่ถูกนับเข้ายอดรวม** และถูกชูขึ้นมาที่ `hasBlockedRows`
 * การนับค่าที่ยังไม่มีสเกลเป็นศูนย์แล้วรวมเข้าไปเงียบ ๆ คือการทำให้ยอดรวมโกหก
 */
export function summarise(
  measurements: readonly Measurement[],
  scaleForPage: (page: number) => PageScale | null
): MeasurementSummary {
  const byPage = new Map<number, MeasurementRow[]>();
  let hasBlockedRows = false;

  for (const measurement of measurements) {
    const value = measure(measurement, scaleForPage(measurement.page));
    if (value.blockedByScale) hasBlockedRows = true;
    const rows = byPage.get(measurement.page) ?? [];
    rows.push({ measurement, value });
    byPage.set(measurement.page, rows);
  }

  const pages: PageGroup[] = [...byPage.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([page, rows]) => ({
      page,
      rows,
      totalLengthMetres: rows.reduce((sum, row) => sum + (row.value.lengthMetres ?? 0), 0),
      totalAreaSquareMetres: rows.reduce((sum, row) => sum + (row.value.areaSquareMetres ?? 0), 0),
      totalCount: rows.reduce((sum, row) => sum + (row.value.count ?? 0), 0)
    }));

  const kinds: KindTotal[] = (Object.keys(measurementKindLabel) as MeasurementKind[])
    .map((kind) => {
      const rows = pages.flatMap((group) => group.rows).filter((row) => row.measurement.kind === kind);
      return {
        kind,
        items: rows.length,
        lengthMetres: rows.reduce((sum, row) => sum + (row.value.lengthMetres ?? 0), 0),
        areaSquareMetres: rows.reduce((sum, row) => sum + (row.value.areaSquareMetres ?? 0), 0),
        count: rows.reduce((sum, row) => sum + (row.value.count ?? 0), 0)
      };
    })
    .filter((total) => total.items > 0);

  return { pages, kinds, hasBlockedRows };
}

/** ตัวเลขบนจอและตัวเลขที่ส่งออกต้องปัดด้วยฟังก์ชันเดียวกัน จะได้ไม่มีทางไม่ตรงกัน */
export function formatMetres(value: number): string {
  return value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
