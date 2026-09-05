"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MeasurementRegister } from "@/components/estimeter/markup/measurement-register";
import {
  marqueeFrom,
  segmentInMarquee,
  shapeInMarquee,
  type MarqueeRect
} from "@/lib/drawing-marquee";
import {
  hitTest,
  hitTestSegments,
  isMeasurementKind,
  measure,
  minimumPoints,
  outlinePoints,
  summarise,
  formatMetres,
  type MeasurementKind,
  type MeasurementRow
} from "@/lib/drawing-measurement";
import { explainMeasurement } from "@/lib/measurement-evidence";
import { useDrawingLayers, type PdfDocument } from "@/components/estimeter/markup/use-drawing-layers";
import { toolNeedsScale, type Tool } from "@/lib/drawing-tools";
import { drawingTourStep, type TourTarget } from "@/lib/drawing-tour";
import { explainRoomArea } from "@/lib/room-area-explained";
import { Button } from "@/components/platform/button";
import {
  gridIntersections,
  nameGridLines,
  type DraftedGridLine
} from "@/lib/drawing-grid";
import { bayExplanation, bayLabel, gridBayFromCorners, type GridBay } from "@/lib/grid-bay";
import {
  collectSnapGeometry,
  DEFAULT_SNAP_SETTINGS,
  findGeometrySnap,
  findImageSnap,
  IMAGE_LUMINANCE_CEILING,
  snapKindLabel,
  type SnapHit,
  type SnapSettings
} from "@/lib/drawing-snap";
import {
  COLUMN_MAX_METRES,
  COLUMN_MIN_METRES,
  COLUMN_TOUCH_METRES,
  DOOR_BRIDGE_METRES,
  LINE_MAX_THICKNESS_POINTS,
  MIN_STRUCTURE_METRES,
  MIN_WALL_RUN_METRES,
  OUTLINE_MIN_STEP_METRES,
  WALL_THICKNESS_METRES,
  regionRejectionMessage,
  WALL_SNAP_METRES,
  toGreyImage,
  traceRegion
} from "@/lib/region-fill";
import {
  calibrate,
  calibrateFromDimension,
  calibrationRejectionMessage,
  dimensionDisagreement,
  distancePoints,
  formatScaleRatio,
  lockToAngle,
  lockToAxis,
  POINTS_PER_METRE,
  SCALE_UNITS,
  scaleUnitLabel,
  unitToMetres,
  type PagePoint,
  type PageScale,
  type ScaleUnit,
  type StatedDimension
} from "@/lib/drawing-scale";
import type { CalibrationMethod } from "@/lib/drawing-calibration-method";
import type { CalibrationReference, StoredMark } from "@/lib/drawing-state";
import { TAKEOFF_CATEGORIES, TAKEOFF_UNITS } from "@/lib/takeoff-units";
import {
  clearDrawingCalibration,
  fileDrawingMark,
  listOpenRunItems,
  loadDrawing,
  registerDrawing,
  saveDrawingCalibration,
  saveDrawingMarks,
  saveDrawingView
} from "@/server/actions/estimeter-drawing";

/**
 * หน้าจอมาร์กอัปและวัดปริมาณบนแบบก่อสร้าง PDF (IP-227)
 *
 * **หน้าตามาจากต้นแบบที่เจ้าของงานวางไว้** `.design/estimeter-viewer/viewer-controls-prototype.html`
 * ซึ่งเป็นผืนเดียวสูงเต็มจอ สี่แถว — แถบของแอป แถบเครื่องมือไอคอน แถวกลางสามคอลัมน์
 * และแถบสถานะล่าง เขาทักเมื่อ 2026-09-02 ว่าของจริงเดิมไม่เหมือนต้นแบบ เพราะไปนั่งอยู่ในเปลือก
 * ของหน้าแรกที่มีหัวเว็บกับท้ายเว็บ แล้วเหลือพื้นที่วาดแค่ 70vh ที่ต้องเลื่อนหน้าเว็บลงไปหา
 *
 * **แบบถูกวาดในเบราว์เซอร์ ไม่ใช่บนเซิร์ฟเวอร์** วัดแล้วเมื่อ 2026-09-01 ว่าการแปลงหน้าแบบ
 * เป็นภาพฝั่งเซิร์ฟเวอร์ด้วย Node ล้มทุกหน้าที่มีตัวอักษร เพราะผืนวาดจำลองไม่รองรับฟอนต์
 * ที่ฝังมาในแบบ CAD ส่วนเบราว์เซอร์แสดงแบบชุดเดียวกันได้ครบทุกตัวอักษร
 *
 * **พิกัดทุกจุดเก็บในหน่วยของหน้ากระดาษ ไม่ใช่พิกเซลบนจอ** ผู้ใช้ซูมเข้าออกได้อิสระ
 * โดยที่ปริมาณไม่ขยับ ถ้าเก็บเป็นพิกเซล ซูมครั้งเดียวปริมาณทั้งหน้าเพี้ยนหมด
 *
 * **กล้องกับความคมชัดเป็นคนละเรื่องกัน** `view` คือตำแหน่งและระดับซูมที่ผู้ใช้ควบคุม
 * ส่วนความละเอียดที่วาดจริงอยู่ในผืนวาดสามชั้นของ `useDrawingLayers` ซึ่งชั้นฐานคงที่ต่อหน้า
 * ชั้นคมไล่ตามซูมเมื่อผู้ใช้เปิดความคมชัด และชั้นวิเคราะห์คงที่ต่อหน้าเสมอเพื่อให้การไล่พื้นที่ห้อง
 * ได้รูปเดิมทุกระดับซูม · ไฟล์นี้ไม่มี `renderScale` อีกแล้ว สูตรวางตำแหน่งจึงเป็นหน่วยหน้ากระดาษล้วน
 *
 * **รายการวัดผูกเลขหน้าติดตัวไปด้วยทุกรายการ** เส้นของหน้าหนึ่งจึงไม่มีทางไปโผล่อีกหน้าได้
 *
 * **สีของรายการมาจาก token ของธีมเท่านั้น** ห้ามมีเลขสีดิบในไฟล์นี้ ตาม ADR 0021
 */

/** ห้าสีเน้นที่ธีมมีอยู่แล้ว พอแยกห้องที่ติดกันได้โดยไม่ต้องเพิ่มสีใหม่ */
const MEASUREMENT_COLOURS = [
  "var(--teal)",
  "var(--orange)",
  "var(--success)",
  "var(--ink)",
  "var(--muted)"
] as const;

type ToolSpec = { id: Tool; label: string; key: string; hint: string; icon: string };

/**
 * เครื่องมือเก้าตัวและคีย์ลัด — ชุดเดียวกับต้นแบบทั้งชื่อ คำอธิบาย คีย์ และรูปไอคอน
 * ไอคอนเป็นเส้น SVG จากไฟล์ต้นแบบของเจ้าของงาน ไม่ใช่ emoji ตามข้อบังคับหน้าตาแอปข้อ 4
 */
const TOOLS: ToolSpec[] = [
  {
    id: "select",
    label: "เลือก",
    key: "V",
    hint: "คลิกเพื่อเลือกสิ่งที่วัดไว้แล้ว หรือเลือกแนวเสาและระยะที่แบบเขียนเพื่อลบ · ลากเพื่อเลื่อนแบบ",
    icon: "M4 3l7 17 2-7 7-2z"
  },
  {
    /**
     * ลบ — คำสั่ง ERASE ของ AutoCAD (IP-242)
     *
     * เจ้าของงานถามสองครั้งว่า "ปุ่มลบเส้นที่ไม่ต้องการล่ะ ทำไมไม่มี" ทั้งที่ปุ่ม "ลบเส้นนี้"
     * มีอยู่แล้วในแถบที่โผล่ตอนเลือกเส้นได้ · แปลว่าเส้นทางเดิมหาไม่เจอ เพราะต้องคลิกให้โดน
     * เส้นหนาหนึ่งพิกเซลก่อนถึงจะเห็นปุ่ม · ตัวนี้กลับด้าน คือกดเครื่องมือก่อน แล้วคลิกอะไรก็ลบ
     * อันนั้น ซึ่งเป็นลำดับเดียวกับที่คนเขียนแบบคุ้นมือ และลบหลายชิ้นติดกันได้โดยไม่ต้องกดซ้ำ
     *
     * คีย์ E ตามชื่อคำสั่งใน AutoCAD
     */
    id: "erase",
    label: "ลบ",
    key: "E",
    hint: "กดแล้วคลิกที่รายการวัด แนวเสา หรือระยะที่แบบเขียน เพื่อลบทีละชิ้น · ลบผิดกดย้อนกลับได้",
    icon: "M8 20H5l-2-2 11-11 6 6-7 7M20 20h-9M9 8l6 6"
  },
  {
    id: "scale",
    label: "ตั้งสเกล",
    key: "S",
    hint: "ลากทับระยะที่รู้ค่าจริง แล้วพิมพ์ระยะนั้น ทุกการวัดหลังจากนี้จึงถูก",
    icon: "M3 17l4-4M7 13l3 3M10 16l4-4M14 12l3 3M17 15l4-4M2 20h20"
  },
  {
    id: "length",
    label: "ระยะสองจุด",
    key: "L",
    hint: "คลิกจุดเริ่มและจุดจบ ได้ระยะหนึ่งค่า",
    icon: "M4 12h16M4 8v8M20 8v8"
  },
  {
    id: "polyline",
    label: "ระยะต่อเนื่อง",
    key: "P",
    hint: "คลิกไปเรื่อย ๆ ได้ระยะรวมทุกช่วง คลิกขวาหรือดับเบิลคลิกเพื่อจบ",
    icon: "M3 18l5-8 5 5 8-11"
  },
  {
    id: "rect",
    label: "พื้นที่สี่เหลี่ยม",
    key: "R",
    hint: "คลิกมุมหนึ่งแล้วคลิกมุมตรงข้าม ได้พื้นที่",
    icon: "M3 5h18v14H3z"
  },
  {
    id: "area",
    label: "พื้นที่หลายเหลี่ยม",
    key: "G",
    hint: "คลิกทีละมุมรอบรูป คลิกขวาหรือดับเบิลคลิกเพื่อปิดรูป",
    icon: "M12 3l8 6-3 10H7L4 9z"
  },
  {
    id: "room",
    label: "เลือกพื้นที่ห้อง",
    key: "K",
    hint: "คลิกในห้องหนึ่งครั้ง ระบบไล่ขอบผนังที่ปิดรอบให้เอง แล้วรอคุณยืนยัน",
    icon: "M3 21V5l9-2 9 2v16M3 21h18M14 21v-6h-4v6"
  },
  {
    id: "count",
    label: "นับจำนวน",
    key: "C",
    hint: "คลิกทีละจุด คลิกขวาหรือกด Enter เพื่อจบ เหมาะกับฐานราก เสาเข็ม ดวงโคม",
    icon: "M7 5a2 2 0 1 0 .01 0M17 5a2 2 0 1 0 .01 0M7 17a2 2 0 1 0 .01 0M17 17a2 2 0 1 0 .01 0"
  },
  {
    id: "gridline",
    label: "ร่างกริด",
    key: "D",
    hint: "ลากทับแนวเสาทีละเส้น ระบบตั้งชื่อ 1 2 3 กับ A B C ให้เอง จุดตัดที่ได้คือจุดจริงบนแบบ",
    icon: "M4 4v16M12 4v16M20 4v16M4 8h16M4 16h16"
  },
  {
    id: "dimension",
    label: "ระยะจริง",
    key: "T",
    hint: "ชี้สองจุดบนโซ่ระยะแล้วพิมพ์เลขที่แบบเขียนไว้ ตั้งสเกลของหน้าจากเลขนั้นได้เลย",
    icon: "M3 12h18M3 9v6M21 9v6M7 12l3-3M7 12l3 3"
  }
];

const ICONS = {
  open: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6",
  undo: "M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 8",
  redo: "M21 7v6h-6M21 13a9 9 0 1 1-3-7.7L21 8",
  rail: "M3 4h6v16H3zM13 6h8M13 12h8M13 18h8",
  snap: "M12 2v4M12 18v4M2 12h4M18 12h4M12 9a3 3 0 1 0 .01 0",
  panel: "M3 4h18v16H3zM15 4v16",
  back: "M4 11 12 4l8 7M6 10v9h12v-9",
  /** ความคมชัด — วงกลมกลางพร้อมรัศมีรอบทิศ สื่อถึงภาพที่ละเอียดขึ้น */
  sharp: "M12 5v3M12 16v3M5 12h3M16 12h3M7.8 7.8l2 2M14.2 14.2l2 2M16.2 7.8l-2 2M9.8 14.2l-2 2M12 10a2 2 0 1 0 .01 0",
  /** ล็อกแนวเส้น — มุมฉากพร้อมเส้นทแยงบอกว่ามุมถูกบังคับ */
  ortho: "M5 19V5M5 19h14M5 12h7v7",
  /** ตั้งฉาก — กากบาทแนวนอนกับแนวตั้งล้วน สื่อว่าเหลือแค่สองแกน ไม่มีทแยง */
  axes: "M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3",
  /** พอดีกรอบ — สี่มุมของกรอบกับแผ่นแบบข้างใน สื่อว่าแบบทั้งแผ่นถูกจับให้พอดีกรอบ */
  fit: "M3 8V4h4M21 8V4h-4M3 16v4h4M21 16v4h-4M8 9h8v6H8z",
  caret: "M7 10l5 5 5-5"
} as const;

/**
 * ชนิดของการดูดจุดที่ผู้ใช้เปิดปิดได้ เรียงตามแอปเดิมของเจ้าของงาน
 *
 * ชนิด `image` (เส้นในแบบ) อยู่ท้ายสุดเพราะมันเดาจากพิกเซล ไม่ได้คำนวณจากของที่วาดไว้
 * จึงเป็นทางสุดท้ายเมื่อยังไม่มีอะไรให้เกาะ
 */
type SnapToggleField = "endpoint" | "midpoint" | "intersection" | "perpendicular" | "onEdge" | "grid" | "imageSnap";

const SNAP_KIND_TOGGLES: { field: SnapToggleField; label: string; hint: string }[] = [
  { field: "endpoint", label: "ปลายเส้น", hint: "จุดปลายของทุกรูปที่วัดไว้แล้ว" },
  { field: "midpoint", label: "กึ่งกลาง", hint: "จุดกลางของทุกช่วงเส้น" },
  { field: "intersection", label: "จุดตัด", hint: "จุดที่เส้นสองเส้นตัดกันจริง" },
  { field: "perpendicular", label: "ตั้งฉาก", hint: "จุดที่ลากฉากจากจุดล่าสุดไปแตะเส้น" },
  { field: "onEdge", label: "บนเส้น", hint: "จุดใกล้ที่สุดบนตัวเส้น" },
  { field: "grid", label: "กริดระยะเท่า", hint: "ตารางทุกครึ่งเมตร ใช้เมื่อไม่มีอย่างอื่นติด" },
  { field: "imageSnap", label: "เส้นในแบบ", hint: "เกาะเส้นที่พิมพ์อยู่ในแบบ ใช้ตอนยังไม่มีรอยวัด" }
];


/** ระยะผ่อนผันของเครื่องมือเลือก คิดเป็นพิกเซลบนจอ แล้วหารด้วยระดับซูมให้เป็นหน่วยกระดาษ */
const HIT_RADIUS_PX = 6;
/** เกินระยะนี้ถือว่าลาก ไม่ใช่คลิก — กันมือสั่นตอนคลิกเลือกรูป */
const DRAG_SLOP_PX = 4;
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.35;
const FIT_PADDING_PX = 24;
/**
 * เพดานความละเอียดที่วาดหน้าแบบ ย้ายไปอยู่ที่ `src/lib/drawing-render.ts` แล้ว
 */
/**
 * ความกว้างของรางสองข้าง ตรึงไว้ ไม่ให้ผู้ใช้ลากปรับ (เจ้าของงานสั่ง 2026-09-05)
 *
 * เดิมมีที่จับลากสองอัน แล้วความกว้างเป็น state ที่ไม่ได้เก็บลงไหน ผลคือทุกครั้งที่เปิดหน้าใหม่
 * มันเด้งกลับค่าตั้งต้น คนจึงต้องลากใหม่ทุกวัน · เจ้าของงานลากจนพอดีแล้วสั่งว่า "fix เลย
 * ไม่ต้องให้เลื่อนขยับได้ กรอบซ้ายก็เหมือนกัน" · สองค่านี้คือความกว้างที่เขาลากไว้จริง
 *
 * ปุ่มเปิดปิดรางยังอยู่ครบ คนที่อยากได้พื้นที่แบบเต็มจอยังพับรางได้เหมือนเดิม
 */
const RAIL_WIDTH = 150;
const PANEL_WIDTH = 440;

type Camera = { scale: number; x: number; y: number };

/** ทุกอย่างที่ผู้ใช้สร้างขึ้นบนแบบ เก็บรวมกันเพื่อให้ย้อนกลับได้เป็นก้อนเดียว */
type WorkSnapshot = {
  measurements: StoredMark[];
  gridLines: DraftedGridLine[];
  dimensions: StatedDimension[];
};

/** กล่องส่งรายการวัดเข้าถอดปริมาณ — เปิดทีละรายการ สามช่องที่คนต้องเลือกเอง (IP-234) */
type FilingState = {
  mark: StoredMark;
  description: string;
  category: string;
  unit: string;
  error: string;
  busy: boolean;
  /** รายการที่เปิดอยู่ใน run เพื่อเตือนว่าจะรวมเข้ารายการเดิม โหลดครั้งเดียวตอนเปิดกล่อง */
  openItems: { description: string; unit: string; reviewState: string }[];
};

/** ลายเซ็นของรอยทั้งหน้า ใช้ตอบว่าหน้านี้ต้องเซฟรอยใหม่ไหม กติกาเดียวกับ pageSignature */
function marksSignature(marks: StoredMark[]): string {
  return JSON.stringify(marks);
}
/** `centre` คือจุดกึ่งกลางของปุ่มที่ชี้อยู่ ไม่ใช่ตำแหน่งซ้ายของป้าย — ป้ายคำนวณตำแหน่งเองหลังวัดความกว้างจริง */
type TipState = { title: string; hint: string; key: string | null; centre: number; top: number } | null;

/** ระยะเผื่อจากขอบจอถึงป้ายลอย เท่ากับต้นแบบ viewer-controls-prototype */
const TIP_EDGE_GAP = 8;

const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

/**
 * รหัสของเส้นแนวเสาและระยะจริงที่ผู้ใช้สร้าง
 *
 * ค่านี้ลงฐานข้อมูลแล้วผ่านคอลัมน์ jsonb (IP-233) แต่ยังเป็นแค่ตัวจับคู่ภายในเอกสารหนึ่งใบ
 * ไม่ใช่ primary key ของแถวไหน จึงพอแค่ไม่ชนกันภายในเอกสารเดียว ไม่ต้องไม่ชนทั้งระบบ
 */
const newId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** วิธีและจุดอ้างอิงที่ใช้ตั้งสเกลของหน้าหนึ่ง — ต้องส่งซ้ำทุกครั้งที่เซฟหน้านั้น */
type PageReference = { method: CalibrationMethod; reference: CalibrationReference };

type SaveStatus = { kind: "idle" | "saving" | "saved" | "failed" | "filed"; at?: Date; message?: string };

/**
 * ลายเซ็นของงานหนึ่งหน้า ใช้ตอบว่า "สิ่งที่อยู่บนจอตอนนี้ ตรงกับที่เซฟไปแล้วหรือยัง"
 *
 * เทียบด้วยลายเซ็นแทนการเทียบทีละช่อง เพราะการกดย้อนกลับพาค่ากลับไปเท่าเดิมได้พอดี
 * และตอนนั้นต้องไม่เซฟซ้ำ
 */
const pageSignature = (scale: PageScale, grid: DraftedGridLine[], items: StatedDimension[]) =>
  JSON.stringify({ m: scale.metresPerPoint, g: grid, d: items });

/** เวลาไทยแบบ 24 ชั่วโมง สำหรับป้าย "บันทึกแล้ว" ในแถบสถานะ */
const savedAtFormat = new Intl.DateTimeFormat("th-TH", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Bangkok"
});

/**
 * checksum ของไฟล์ที่เปิด ซึ่งเป็นตัวตนของแบบใบนั้นตลอดอายุโครงการ (IP-233)
 *
 * คำนวณในเบราว์เซอร์ ไม่มีไบต์ไหนของแบบออกจากเครื่องผู้ใช้
 */
async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function DrawingMarkup({
  projectName,
  projectHref,
  projectId
}: {
  projectName: string;
  projectHref: string;
  projectId: string;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);

  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [fileName, setFileName] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loadError, setLoadError] = useState("");
  const [regionError, setRegionError] = useState("");

  const [view, setView] = useState<Camera>({ scale: 1, x: 0, y: 0 });

  /**
   * ความคมชัดเริ่มที่ปิด
   *
   * เจ้าของงานสั่งไว้ว่า "อย่าบังคับให้คมตลอดเวลา" เพราะความคมสำคัญตอนตั้งสเกล ลากเส้น
   * และดูดจุด แต่ไม่ต้องเปิดตอนเปิดดูว่าหน้านี้เป็นแบบอะไรหรือตอนเลื่อนหาตำแหน่ง
   */
  const [sharpOn, setSharpOn] = useState(false);

  const { pageSize, baseCanvasRef, sharpCanvasRef, sharpCrop, analysis } = useDrawingLayers({
    doc,
    page,
    sharpOn,
    view,
    stageRef
  });

  const [tool, setTool] = useState<Tool>("select");
  const [snapSettings, setSnapSettings] = useState<SnapSettings>(DEFAULT_SNAP_SETTINGS);
  const [snapPanelOpen, setSnapPanelOpen] = useState(false);
  const [snapHit, setSnapHit] = useState<SnapHit | null>(null);
  const [axisLock, setAxisLock] = useState(false);
  /** Shift ค้างเปิดล็อกแนวชั่วขณะ โดยไม่แตะสถานะปุ่มสลับ */
  const [shiftHeld, setShiftHeld] = useState(false);
  /**
   * โหมดตั้งฉาก — เส้นที่ลากได้แค่แนวนอนกับแนวตั้งเท่านั้น ไม่มีทแยง (IP-242)
   *
   * **ทำไมเป็นโหมดที่สอง ไม่ใช่ไปแก้ของเดิม** เจ้าของงานเคาะเมื่อ 2026-09-02 ว่าล็อกแนวเส้น
   * ต้องเป็น 15 องศา เพราะแอปเดิมของเขาใช้ 45 องศาแล้วลากเส้นทแยงของหลังคากับบันไดไม่ได้
   * · วันที่ 2026-09-05 เขาขอโหมดแบบ AutoCAD คือกด F8 แล้วล็อกแกน x กับ y เท่านั้น
   * ซึ่งเป็นคนละอย่างกับล็อกทีละ 15 องศา ไม่ใช่ของที่มาแทนกัน · AutoCAD เองก็แยกเป็นสองปุ่ม
   * คือ F8 (ORTHO ตั้งฉาก) กับ F10 (POLAR ทีละมุม) ด้วยเหตุผลเดียวกัน
   *
   * ตั้งฉากชนะเมื่อเปิดพร้อมกัน เพราะมันเข้มกว่า คนที่เปิดตั้งฉากไว้ต้องการเส้นตรงจริง ๆ
   */
  const [orthoLock, setOrthoLock] = useState(false);
  /** ตำแหน่งเมาส์ดิบก่อนถูกดูด — แถบสถานะต้องบอกที่ที่เมาส์อยู่จริง ไม่ใช่จุดที่ดูดไปแล้ว */
  const [cursor, setCursor] = useState<PagePoint | null>(null);
  const [railOn, setRailOn] = useState(true);
  const [panelOn, setPanelOn] = useState(true);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [tip, setTip] = useState<TipState>(null);
  const [tipLeft, setTipLeft] = useState(0);

  const [scales, setScales] = useState<Record<number, PageScale>>({});
  const [draft, setDraft] = useState<PagePoint[]>([]);
  const [hover, setHover] = useState<PagePoint | null>(null);

  /** รายการวัดคือ StoredMark — มี `filed` บอกว่าส่งเข้าถอดปริมาณแล้วหรือยัง และ `layerId` (ยังไม่มี UI ให้ตั้ง) */
  const [measurements, setMeasurements] = useState<StoredMark[]>([]);
  const [gridLines, setGridLines] = useState<DraftedGridLine[]>([]);
  const [dimensions, setDimensions] = useState<StatedDimension[]>([]);
  /**
   * ประวัติย้อนกลับเป็นก้อนเดียวที่รวมทั้งสามอย่าง
   *
   * ผู้ใช้ที่ลากเส้นแนวเสาพลาดจะกด Ctrl+Z แน่นอน ถ้าประวัติเก็บแต่รายการวัด
   * การกดย้อนกลับจะไปลบรอยวัดที่ไม่เกี่ยวข้องแทน ซึ่งแย่กว่าไม่มีปุ่มย้อนกลับเลย
   */
  const [past, setPast] = useState<WorkSnapshot[]>([]);
  const [future, setFuture] = useState<WorkSnapshot[]>([]);
  /** จุดแรกของเส้นแนวเสาหรือเส้นระยะจริงที่กำลังลาก คลิกขวายกเลิก */
  const [pendingRefStart, setPendingRefStart] = useState<PagePoint | null>(null);
  /** เส้นระยะจริงที่เพิ่งลากเสร็จ รอผู้ใช้พิมพ์ค่าที่อ่านได้จากแบบ */
  const [pendingDimension, setPendingDimension] = useState<{ a: PagePoint; b: PagePoint } | null>(null);
  const [dimensionValue, setDimensionValue] = useState("");
  const [dimensionUnit, setDimensionUnit] = useState<ScaleUnit>("m");
  const [dimensionError, setDimensionError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /**
   * เส้นอ้างอิงที่เลือกอยู่ — ระยะที่แบบเขียน หรือแนวเสา (IP-235)
   *
   * **แยกจาก `selectedId` โดยตั้งใจ** ไม่ใช่ยัดสองอย่างลงตัวแปรเดียวแล้วค่อยไปค้นว่าไอดีนี้
   * เป็นของอะไร เพราะทุกที่ที่อ่าน `selectedId` อยู่แล้ว (แผงรายการ ป้ายบนรูป เส้นหนา)
   * ตั้งอยู่บนสมมติฐานว่ามันคือรายการวัด การเปลี่ยนความหมายของมันคือการต้องไล่แก้ทุกจุดนั้น
   *
   * ก่อนหน้านี้เส้นสองชนิดนี้เลือกไม่ได้เลย ลบก็ไม่ได้ ทางเดียวคือกด Ctrl+Z ย้อนไปเรื่อย ๆ
   * ซึ่งลบของที่ทำถูกไปด้วยทั้งหมดที่ทำหลังจากนั้น
   */
  const [selectedGuide, setSelectedGuide] = useState<{ kind: "dimension" | "gridline"; id: string } | null>(null);

  /**
   * รูปห้องที่เพิ่งไล่ได้ ยังไม่เข้ารายการวัดจนกว่าคนจะกดยืนยัน
   *
   * เจ้าของงานเคาะเมื่อ 2026-09-01 ว่าการเลือกพื้นที่ห้องต้องผ่านสายตาคนทุกครั้ง
   * เพราะการทะลุออกนอกห้องดูออกด้วยตาในหนึ่งวินาที แต่ถ้าไหลเข้าใบราคาไปแล้วไม่มีใครจับได้
   */
  const [pendingRoom, setPendingRoom] = useState<StoredMark | null>(null);
  const panRef = useRef<{ x: number; y: number; view: Camera; moved: boolean } | null>(null);
  /** การลากของเครื่องมือลบที่กำลังทำอยู่ · เก็บเป็น ref เพราะทุกเฟรมของการลากไม่ต้องเรนเดอร์ใหม่ */
  const eraseRef = useRef<{ x: number; y: number; start: PagePoint; moved: boolean } | null>(null);
  /** กรอบที่กำลังลากอยู่ ให้ผู้ใช้เห็นว่ากำลังจะกวาดอะไร · null เมื่อไม่ได้ลากอยู่ */
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);

  /** ตัวตนของแบบใบที่เปิดอยู่ในฐานข้อมูล — null แปลว่ายังลงทะเบียนไม่สำเร็จ จึงยังเซฟไม่ได้ */
  const [documentId, setDocumentId] = useState<string | null>(null);
  /** วิธีและจุดอ้างอิงที่ใช้ตั้งสเกลของแต่ละหน้า ต้องส่งซ้ำทุกครั้งที่เซฟหน้านั้น */
  const [references, setReferences] = useState<Record<number, PageReference>>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: "idle" });
  /** จริงระหว่างยกงานเก่าขึ้นจอ กัน effect เซฟย้อนกลับทับของที่เพิ่งอ่านมา */
  const hydratingRef = useRef(false);
  /** ลายเซ็นของแต่ละหน้า ณ ครั้งที่เซฟสำเร็จล่าสุด */
  const lastSavedRef = useRef<Record<number, string>>({});
  /** ลายเซ็นของรอยแต่ละหน้า ณ ครั้งที่เซฟสำเร็จล่าสุด — แยกจากสเกลเพราะรอยเซฟได้แม้หน้ายังไม่มีสเกล */
  const lastMarksSavedRef = useRef<Record<number, string>>({});
  const [filing, setFiling] = useState<FilingState | null>(null);
  /**
   * เลขหน้าที่ยกซูมและตำแหน่งกลับมาจากฐาน — null แปลว่าไม่มีของที่ต้องหวง
   *
   * effect พอดีกรอบผูกกับ `page` และกับขนาดหน้า ทั้งสองอย่างเปลี่ยนหลังการยกของขึ้นจอเสมอ
   * (`setPage` ของหน้าที่ค้างไว้ยิงก่อน แล้วขนาดหน้าตามมาเมื่อ pdf.js เรนเดอร์เสร็จ)
   * ถ้าไม่หวงไว้ พอดีกรอบจะทับซูมและตำแหน่งที่เพิ่งอ่านมา แล้ว effect เซฟจุดที่ค้าง
   * จะเอาค่าพอดีกรอบไปทับแถวในฐานต่อ ตำแหน่งที่ผู้ใช้ค้างไว้จึงหายถาวร
   * (กดมือแล้วเจอจริงเมื่อ 2026-09-03 ซูม 510% กลับมาเป็น 71%)
   */
  const resumedPageRef = useRef<number | null>(null);

  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState<PagePoint[]>([]);
  const [realDistance, setRealDistance] = useState("");
  const [unit, setUnit] = useState<ScaleUnit>("m");
  const [calibrationError, setCalibrationError] = useState("");

  const pageScale = scales[page] ?? null;

  /**
   * ขั้นของทัวร์ที่ควรพาทำตอนนี้ — คิดสดจากสถานะจริงทุกครั้งที่หน้าเรนเดอร์ ไม่ได้เก็บเป็น state
   *
   * ไม่เก็บเป็น state เพราะทัวร์ไม่ใช่ของที่ผู้ใช้เดินหน้าเอง มันคือคำอธิบายของสิ่งที่ล็อกอยู่
   * ณ วินาทีนั้น · คนที่เปิดไฟล์แบบใบใหม่ทับใบเดิม สเกลหายไปพร้อมไฟล์เก่า ทัวร์จึงต้องถอย
   * กลับไปขั้นตั้งสเกลเองโดยไม่มีใครสั่ง ซึ่งค่าที่เก็บไว้ทำแบบนั้นไม่ได้
   */
  const tourStep = drawingTourStep({ hasDrawing: Boolean(doc), hasPageScale: Boolean(pageScale) });

  /**
   * ขั้นที่ผู้ใช้เพิ่งชนเข้าไปเอง ด้วยการกดเครื่องมือที่ยังทำงานไม่ได้
   *
   * **ทำไมเปลี่ยนจากแถบที่ขึ้นค้างไว้** เดิมแถบพาทัวร์ขึ้นทันทีที่มีอะไรล็อกอยู่ และกินความสูง
   * 65px ตลอดเวลาจนกว่าจะตั้งสเกลเสร็จ · แถบนั้นเกิดมาเพื่อชดเชยว่าเครื่องมือดับแล้วไม่บอก
   * เหตุผล ซึ่งเป็นการแก้ที่ปลายทาง · ตอนนี้ปุ่มตอบเองได้แล้ว คำอธิบายจึงมาตอนที่คนถามจริง ๆ
   * คือตอนกดปุ่มนั้น และไม่กินผืนวาดเลยจนกว่าจะถูกถาม
   *
   * เก็บเป็น "ขั้นไหนที่ถูกถาม" ไม่ใช่ค่าจริงเท็จ เพราะเปิดไฟล์แบบเสร็จแล้วขั้นจะเปลี่ยนจาก
   * `open` เป็น `scale` เอง ถ้าเก็บเป็นจริงเท็จ คำตอบของขั้นถัดไปจะโผล่มาทั้งที่ยังไม่มีใครถาม
   */
  const [askedFor, setAskedFor] = useState<TourTarget | null>(null);
  /** คำตอบที่กำลังแสดงอยู่ · หายเองเมื่อเงื่อนไขที่ขวางอยู่ถูกแก้ เพราะ `tourStep` กลายเป็น null */
  const blockedNotice = tourStep && askedFor === tourStep.target ? tourStep : null;

  /** ช่องเลือกไฟล์ตัวเดียวของหน้านี้ — ทั้งไอคอนบนแถบและปุ่มของคำตอบกดมาที่ตัวนี้ */
  const openInputRef = useRef<HTMLInputElement | null>(null);

  /** ทุกการเปลี่ยนรายการวัดผ่านที่นี่ที่เดียว ประวัติจึงครบเสมอ ไม่มีทางลืมบันทึกบางการกระทำ */
  const snapshot = useCallback(
    (): WorkSnapshot => ({ measurements, gridLines, dimensions }),
    [dimensions, gridLines, measurements]
  );

  /**
   * ย้อนกลับหรือทำซ้ำ — แต่รอยที่ส่งเข้าถอดปริมาณแล้วต้องไม่หายจากจอ
   *
   * ปริมาณของมันอยู่ใน backup sheet แล้ว การให้ Ctrl+Z ทำให้รอยหายไปจากแบบจะเหลือบรรทัดที่
   * ชี้กลับมาที่รอยซึ่งไม่มีอยู่ ลบได้ทางเดียวคือลบบรรทัดจากหน้าถอดปริมาณ (สเปก IP-234 ขั้น 7.1)
   */
  const restore = useCallback((state: WorkSnapshot) => {
    setMeasurements((current) => {
      const kept = current.filter((mark) => mark.filed && !state.measurements.some((item) => item.id === mark.id));
      return [...state.measurements, ...kept];
    });
    setGridLines(state.gridLines);
    setDimensions(state.dimensions);
  }, []);

  const commitWork = useCallback(
    (next: Partial<WorkSnapshot>) => {
      setPast((history) => [...history, snapshot()]);
      if (next.measurements) setMeasurements(next.measurements);
      if (next.gridLines) setGridLines(next.gridLines);
      if (next.dimensions) setDimensions(next.dimensions);
      setFuture([]);
    },
    [snapshot]
  );

  const commit = useCallback(
    (next: StoredMark[]) => commitWork({ measurements: next }),
    [commitWork]
  );

  const undo = useCallback(() => {
    setPast((history) => {
      if (history.length === 0) return history;
      const previous = history[history.length - 1];
      setFuture((forward) => [snapshot(), ...forward]);
      restore(previous);
      return history.slice(0, -1);
    });
  }, [restore, snapshot]);

  const redo = useCallback(() => {
    setFuture((forward) => {
      if (forward.length === 0) return forward;
      setPast((history) => [...history, snapshot()]);
      restore(forward[0]);
      return forward.slice(1);
    });
  }, [restore, snapshot]);

  /**
   * เปิดไฟล์ ลงทะเบียนตัวตนของแบบ แล้วยกงานที่เคยทำไว้กับแบบใบนี้ขึ้นจอ (IP-233)
   *
   * **ลำดับสองบรรทัดแรกห้ามสลับ** `getDocument({ data })` ของ pdf.js โอนสิทธิ์ ArrayBuffer
   * ไปให้ตัวมันเอง ถ้าคำนวณ checksum ทีหลัง buffer จะว่างและได้ค่าเดียวกันทุกไฟล์
   *
   * ลงทะเบียนไม่สำเร็จก็ยังเปิดวัดต่อได้ แค่ไม่มีการเซฟ — เครื่องมือวัดที่เปิดไฟล์ไม่ได้
   * เพราะเน็ตสะดุด แย่กว่าเครื่องมือวัดที่เซฟไม่ได้ชั่วคราวแล้วบอกให้รู้
   */
  async function openFile(file: File) {
    setLoadError("");
    try {
      const buffer = await file.arrayBuffer();
      const checksum = await sha256Hex(buffer);
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      const bytes = new Uint8Array(buffer);
      const loaded = (await pdfjs.getDocument({ data: bytes }).promise) as unknown as PdfDocument;
      setDoc(loaded);
      setPageCount(loaded.numPages);
      setFileName(file.name);
      setPage(1);
      setView({ scale: 1, x: 0, y: 0 });
      setScales({});
      setMeasurements([]);
      // เส้นแนวเสาและระยะจริงของไฟล์ก่อนหน้าต้องหายไปพร้อมกับไฟล์นั้น ไม่อย่างนั้นมันจะไปโผล่
      // ทับแบบใบใหม่ที่คนละอาคารกัน (บั๊กที่บันทึกไว้ในไม้ต่อ 2026-09-02)
      setGridLines([]);
      setDimensions([]);
      setReferences({});
      setPast([]);
      setFuture([]);
      setThumbs({});
      setPendingRoom(null);
      setPendingDimension(null);
      setPendingRefStart(null);
      setSelectedId(null);
      setSelectedGuide(null);
      setDocumentId(null);
      lastSavedRef.current = {};
      lastMarksSavedRef.current = {};
      resumedPageRef.current = null;
      setFiling(null);
      setSaveStatus({ kind: "idle" });

      hydratingRef.current = true;
      try {
        const registered = await registerDrawing({
          projectId,
          checksum,
          mimeType: "application/pdf",
          byteSize: file.size,
          pageCount: loaded.numPages
        });
        if (!registered.ok) {
          setSaveStatus({ kind: "failed", message: registered.message });
          return;
        }
        setDocumentId(registered.documentId);

        const restored = await loadDrawing({ documentId: registered.documentId });
        if (!restored.ok) {
          setSaveStatus({ kind: "failed", message: restored.message });
          return;
        }

        const nextScales: Record<number, PageScale> = {};
        const nextReferences: Record<number, PageReference> = {};
        const nextGrid: DraftedGridLine[] = [];
        const nextDimensions: StatedDimension[] = [];
        const nextSaved: Record<number, string> = {};

        for (const calibration of restored.state.calibrations) {
          // อัตราส่วนที่คนอ่านคำนวณจาก metresPerPoint เสมอ ฐานไม่เก็บไว้ซ้ำ
          const scale: PageScale = {
            metresPerPoint: calibration.metresPerPoint,
            ratio: calibration.metresPerPoint * POINTS_PER_METRE
          };
          nextScales[calibration.pageNumber] = scale;
          if (calibration.reference) {
            nextReferences[calibration.pageNumber] = {
              method: calibration.method,
              reference: calibration.reference
            };
          }
          nextGrid.push(...calibration.grid);
          nextDimensions.push(...calibration.dimensions);
          nextSaved[calibration.pageNumber] = pageSignature(scale, calibration.grid, calibration.dimensions);
        }

        // ยกของขึ้นจอไม่ผ่าน commitWork เพราะไม่ใช่การกระทำของผู้ใช้ ประวัติย้อนกลับต้องเริ่มว่าง
        setScales(nextScales);
        setReferences(nextReferences);
        setGridLines(nextGrid);
        setDimensions(nextDimensions);
        lastSavedRef.current = nextSaved;

        // รอยทุกหน้าขึ้นจอพร้อมกัน และจำลายเซ็นไว้ไม่ให้ effect เซฟซ้ำสิ่งที่เพิ่งอ่านมา
        const nextMarks: StoredMark[] = [];
        const nextMarksSaved: Record<number, string> = {};
        for (const [key, items] of Object.entries(restored.state.marks)) {
          nextMarks.push(...items);
          nextMarksSaved[Number(key)] = marksSignature(items);
        }
        setMeasurements(nextMarks);
        lastMarksSavedRef.current = nextMarksSaved;

        if (restored.state.view) {
          const resumed = restored.state.view;
          const resumedPage = Math.min(Math.max(resumed.pageNumber, 1), loaded.numPages);
          resumedPageRef.current = resumedPage;
          setPage(resumedPage);
          setView({ scale: resumed.view.scale, x: resumed.view.x, y: resumed.view.y });
        }
      } finally {
        hydratingRef.current = false;
      }
    } catch (error) {
      hydratingRef.current = false;
      setLoadError(`เปิดไฟล์ไม่ได้: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * เซฟงานของหน้าหนึ่งลงฐาน — สเกล จุดอ้างอิง แนวเสา และระยะจริง ไปด้วยกันเป็นก้อนเดียว
   *
   * กริดกับระยะจริงรับเข้ามาเป็นอาร์กิวเมนต์ ไม่ได้อ่านจาก closure เพราะฟังก์ชันนี้ถูกเรียก
   * จากตัวตั้งเวลา ซึ่งค่าใน closure ตอนนั้นอาจเก่ากว่าที่อยู่บนจอไปแล้วหนึ่งการกระทำ
   */
  const persistPage = useCallback(
    async (
      pageNumber: number,
      scale: PageScale,
      reference: PageReference,
      grid: DraftedGridLine[],
      items: StatedDimension[]
    ) => {
      if (!documentId) return;
      setSaveStatus({ kind: "saving" });
      const result = await saveDrawingCalibration({
        documentId,
        pageNumber,
        metresPerPoint: scale.metresPerPoint,
        method: reference.method,
        reference: reference.reference,
        grid,
        dimensions: items
      });
      if (result.ok) {
        lastSavedRef.current[pageNumber] = pageSignature(scale, grid, items);
        setSaveStatus({ kind: "saved", at: new Date() });
      } else {
        setSaveStatus({ kind: "failed", message: result.message });
      }
    },
    [documentId]
  );

  /**
   * เซฟตามการเปลี่ยนของกริดและระยะจริง ครอบทั้งการวาง การลบ และการกดย้อนกลับ
   *
   * หน่วงไว้ก่อนเพราะการลากเส้นติดกันหลายเส้นไม่ควรเป็นการเขียนฐานหลายครั้ง
   * หน้าที่ยังไม่มีสเกลไม่เซฟ — กริดที่ร่างก่อนยืนยันสเกลอยู่ในเบราว์เซอร์จนถึงตอนนั้น
   */
  useEffect(() => {
    if (hydratingRef.current || !documentId) return;
    const timer = setTimeout(() => {
      for (const key of Object.keys(scales)) {
        const pageNumber = Number(key);
        const scale = scales[pageNumber];
        const reference = references[pageNumber];
        if (!scale || !reference) continue;
        const grid = gridLines.filter((line) => line.page === pageNumber);
        const items = dimensions.filter((item) => item.page === pageNumber);
        if (lastSavedRef.current[pageNumber] === pageSignature(scale, grid, items)) continue;
        void persistPage(pageNumber, scale, reference, grid, items);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [dimensions, documentId, gridLines, persistPage, references, scales]);

  /**
   * เซฟรอยวัดต่อหน้า ครอบการวาด ลบ ตั้งชื่อ และย้อนกลับ — ไม่ต้องมีสเกล เพราะการนับไม่ใช้สเกล
   * และรอยที่วาดก่อนตั้งสเกลก็เป็นงานที่คนไม่อยากทำซ้ำเหมือนกัน
   *
   * หน้าที่รอยหายไปหมดต้องเซฟด้วย (เป็นรายการว่าง) ไม่งั้นแถวในฐานจะยังมีรอยที่คนลบไปแล้ว
   */
  useEffect(() => {
    if (hydratingRef.current || !documentId) return;
    const timer = setTimeout(() => {
      const pages = new Set<number>([...measurements.map((mark) => mark.page), ...Object.keys(lastMarksSavedRef.current).map(Number)]);
      for (const pageNumber of pages) {
        const onPage = measurements.filter((mark) => mark.page === pageNumber);
        const signature = marksSignature(onPage);
        if (lastMarksSavedRef.current[pageNumber] === signature) continue;
        if (onPage.length === 0 && lastMarksSavedRef.current[pageNumber] === undefined) continue;
        void (async () => {
          const result = await saveDrawingMarks({ documentId, pageNumber, marks: onPage });
          if (result.ok) {
            lastMarksSavedRef.current[pageNumber] = signature;
            setSaveStatus({ kind: "saved", at: new Date() });
          } else {
            setSaveStatus({ kind: "failed", message: result.message });
          }
        })();
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [documentId, measurements]);

  /** เปิดกล่องส่งเข้าถอดปริมาณ พร้อมโหลดรายการที่เปิดอยู่ใน run เพื่อเตือนเรื่องรวมเข้ารายการเดิม */
  async function openFiling(markId: string) {
    const mark = measurements.find((item) => item.id === markId);
    if (!mark || mark.filed) return;
    const kind = mark.kind;
    // ความยาวมีแค่ ม. พื้นที่มีแค่ ตร.ม. การนับให้เลือกเอง ไม่มีค่าเลือกล่วงหน้า
    const unit = kind === "length" || kind === "polyline" ? "m" : kind === "area" || kind === "rect" ? "sq_m" : "";
    setFiling({ mark, description: mark.name.trim(), category: "", unit, error: "", busy: false, openItems: [] });
    const open = await listOpenRunItems({ projectId });
    if (open.ok) setFiling((current) => (current && current.mark.id === markId ? { ...current, openItems: open.items } : current));
  }

  async function submitFiling() {
    if (!filing || !documentId || filing.busy) return;
    setFiling({ ...filing, busy: true, error: "" });
    const result = await fileDrawingMark({
      documentId,
      pageNumber: filing.mark.page,
      markId: filing.mark.id,
      category: filing.category,
      description: filing.description,
      unit: filing.unit
    });
    if (!result.ok) {
      setFiling((current) => (current ? { ...current, busy: false, error: result.message } : current));
      return;
    }
    // ข้อเท็จจริงจากเซิร์ฟเวอร์ ไม่ผ่าน commitWork — การกดย้อนกลับต้องยกเลิกการส่งไม่ได้
    // และเซิร์ฟเวอร์ประทับ filed ลงฐานไปแล้ว จึงเลื่อนลายเซ็นให้ตรง ไม่ให้ effect เซฟหน้านี้ซ้ำ
    // แล้วเอาข้อความ "บันทึกแล้ว" มาทับ "ส่งเข้าถอดปริมาณแล้ว" ที่คนควรได้เห็น
    setMeasurements((current) => {
      const next = current.map((mark) => (mark.id === filing.mark.id ? { ...mark, filed: result.filed } : mark));
      lastMarksSavedRef.current[filing.mark.page] = marksSignature(next.filter((mark) => mark.page === filing.mark.page));
      return next;
    });
    setSaveStatus({ kind: "filed", at: new Date() });
    setFiling(null);
  }

  /**
   * ช่วงระหว่างแนวของรอยสี่เหลี่ยม ถ้าสองมุมที่ชี้พาดช่วงที่แบบเขียนระยะกำกับไว้
   *
   * **ทำไมต้องมี** เจ้าของงานสั่งเมื่อ 2026-09-04 ว่าอย่าไปคิดพื้นที่ห้องด้วยการวัดหมึกแล้ว
   * หักความหนาผนัง เพราะ **แบบสถาปัตย์ไม่ได้บอกขนาดเสาหรือความหนาผนัง** สองค่านั้นอยู่ใน
   * แบบโครงสร้าง การเดาจากพิกเซลจึงเป็นการเดาในสิ่งที่แบบตรงหน้าไม่ได้เขียน · คำพูดของเขาคือ
   * "หา referent เช่นเส้นบอกระยะเอามาคูณกันเลยง่ายกว่า แต่ชัวร์ เพราะขนาดห้องมันมีเส้นบอกระยะ
   * กำกับไว้ แค่คุณต้องอธิบายเหตุผลว่าทำไมใช้ค่านี้ และถือว่าเป็นการเผื่อไปในตัว"
   *
   * คืน null เมื่อไม่ใช่สี่เหลี่ยม ยังไม่มีสเกล หรือสองมุมทับกัน · ตัวมันไม่ต้องการแนวเสา
   * ที่ร่างไว้ก็ทำงานได้ แค่จะไม่มีชื่อช่วงอย่าง "1-A ถึง 2-B" ให้แสดง
   */
  function bayFor(mark: StoredMark): GridBay | null {
    if (mark.kind !== "rect" || mark.points.length < 2) return null;
    const scale = scales[mark.page] ?? null;
    if (!scale) return null;
    return gridBayFromCorners(
      mark.points[0],
      mark.points[1],
      nameGridLines(gridLines.filter((line) => line.page === mark.page)),
      dimensions.filter((item) => item.page === mark.page),
      scale
    );
  }

  /** บรรทัดวิธีคิดที่ผู้ใช้ต้องเห็นก่อนส่ง — ห้ามโชว์เลขโดยไม่บอกว่าวัดถึงไหน (สเปกพื้นที่ห้อง ข้อสาม) */
  function filingWorking(mark: StoredMark): { figure: string; how: string } {
    const scale = scales[mark.page] ?? null;
    const value = measure(mark, scale);
    const ratio = scale ? formatScaleRatio(scale) : "ยังไม่ตั้ง";
    switch (mark.kind) {
      case "length":
      case "polyline":
        return {
          figure: `${formatMetres(value.lengthMetres ?? 0)} ม.`,
          how: `ระยะระหว่างจุดที่ชี้ ${mark.points.length} จุด คูณสเกล ${ratio} ของหน้า ${mark.page}`
        };
      case "rect": {
        /**
         * มีเลขที่แบบเขียนพาดช่วงนี้เมื่อไหร่ เลขนั้นมาก่อนเลขที่คำนวณจากพิกเซลเสมอ
         *
         * เหตุผลเดียวกับที่หน้านี้เอาสเกลจากระยะที่คนอ่านจากแบบ ไม่ใช่จากสเกลที่พิมพ์ใต้รูป
         * คือแบบที่ถูกย่อขยายตอนพิมพ์ทำให้เลขที่คำนวณเพี้ยนทั้งหน้า ส่วนเลขที่เขียนกำกับไม่เพี้ยน
         * · `bayExplanation` เขียนทั้งสองค่าไว้ในบรรทัดเดียว จึงตรวจย้อนได้ว่าห่างกันเท่าไหร่
         */
        const bay = bayFor(mark);
        const stated = bay && (bay.across.statedMetres !== null || bay.down.statedMetres !== null);
        if (bay && stated) {
          return { figure: `${formatMetres(bay.areaSquareMetres)} ตร.ม.`, how: bayExplanation(bay) };
        }
        return {
          figure: `${formatMetres(value.areaSquareMetres ?? 0)} ตร.ม.`,
          how: `กว้าง ${formatMetres(value.segmentsMetres[0] ?? 0)} × ยาว ${formatMetres(value.segmentsMetres[1] ?? 0)} ม. จากสองมุมที่ชี้ คูณสเกล ${ratio}`
        };
      }
      case "area": {
        /**
         * ที่มาของพื้นที่บอกเป็น กว้าง × ยาว ไม่ใช่จำนวนด้านกับเส้นรอบรูป
         *
         * เจ้าของงานสั่งเองเมื่อ 2026-09-05 ว่า "พวกเส้นรอบรูปผมไม่เอา มันไม่ได้ใช้
         * ไม่ต้องเอาข้อมูลมาโชว์มันทุกอย่าง อยากรู้แค่ห้องกว้าง × ยาว ตัวเลขมีที่มายังไง"
         * · จำนวนด้านกับเส้นรอบรูปเป็นของที่ระบบรู้ ไม่ใช่ของที่คนตรวจตัวเลขต้องใช้
         * สองเลขที่เขาเอาไปเทียบกับเส้นบอกระยะบนแบบได้จริงคือกว้างกับยาวเท่านั้น
         */
        const box = explainRoomArea(mark.points, scale, value.areaSquareMetres);
        return {
          figure: `${formatMetres(value.areaSquareMetres ?? 0)} ตร.ม.`,
          how: box
            ? `กว้าง ${formatMetres(box.widthMetres)} × ยาว ${formatMetres(box.depthMetres)} ม. คูณสเกล ${ratio} — วัดถึงผิวผนังด้านใน ไม่ใช่กึ่งกลางเสา`
            : `คูณสเกล ${ratio} — วัดถึงผิวผนังด้านใน ไม่ใช่กึ่งกลางเสา`
        };
      }
      case "count":
        return { figure: `${value.count ?? mark.points.length} จุด`, how: "นับจุดที่แตะทีละจุด ไม่ใช้สเกล" };
    }
  }

  /**
   * เซฟจุดที่ค้างอยู่ เงียบ ๆ ไม่แตะแถบสถานะ
   *
   * ล้มเหลวก็ไม่เป็นไร ตามคอมเมนต์ของตาราง drawing_view_states — ตำแหน่งสายตาไม่ใช่หลักฐาน
   * ของปริมาณใด และไม่มีผลอะไรถ้ามันหายไป
   */
  useEffect(() => {
    if (hydratingRef.current || !documentId) return;
    const timer = setTimeout(() => {
      void saveDrawingView({
        documentId,
        pageNumber: page,
        view: { version: 1, scale: view.scale, x: view.x, y: view.y }
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [documentId, page, view]);

  // รูปย่อของทุกหน้า ทยอยวาดทีละหน้าเพื่อไม่ให้แย่งเครื่องกับหน้าที่ผู้ใช้กำลังดู
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    async function build() {
      if (!doc) return;
      for (let number = 1; number <= doc.numPages; number += 1) {
        if (cancelled) return;
        const pdfPage = await doc.getPage(number);
        const base = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({ scale: 116 / base.width });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) return;
        // ผืนวาดของรูปย่อไม่ได้อยู่ใน DOM จึงอ่าน token จากรากเอกสารแทน ตาม ADR 0021
        const paper = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim();
        if (paper) {
          context.fillStyle = paper;
          context.fillRect(0, 0, canvas.width, canvas.height);
        }
        try {
          // ไม่ส่งฟิลด์ canvas เพราะ pdfjs-dist 4.10.38 ไม่มีฟิลด์นั้น มันเป็นของรุ่น 5
          await pdfPage.render({ canvasContext: context, viewport }).promise;
        } catch {
          return;
        }
        if (cancelled) return;
        const url = canvas.toDataURL("image/jpeg", 0.6);
        setThumbs((current) => ({ ...current, [number]: url }));
      }
    }
    void build();
    return () => {
      cancelled = true;
    };
  }, [doc]);

  const fitToStage = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || pageSize.width === 0) return;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const scale = clampZoom(
      Math.min((width - FIT_PADDING_PX * 2) / pageSize.width, (height - FIT_PADDING_PX * 2) / pageSize.height)
    );
    setView({
      scale,
      x: (width - pageSize.width * scale) / 2,
      y: (height - pageSize.height * scale) / 2
    });
  }, [pageSize.height, pageSize.width]);

  // พอดีกรอบเมื่อเปิดแบบใหม่หรือเปลี่ยนหน้า และเมื่อพื้นที่วาดเปลี่ยนขนาด
  useEffect(() => {
    // หน้าที่ยกซูมและตำแหน่งกลับมาจากฐานห้ามถูกพอดีกรอบทับ ของที่ผู้ใช้ค้างไว้ต้องชนะค่าเริ่มต้น
    if (resumedPageRef.current === page) return;
    fitToStage();
  }, [fitToStage, page]);

  /**
   * ปล่อยการหวงเมื่อผู้ใช้ออกจากหน้าที่ยกกลับมา
   *
   * ประกาศทีหลัง effect พอดีกรอบโดยเจตนา เพราะ effect เรียงตามลำดับที่เขียน
   * ตอนเปลี่ยนไปหน้าอื่น พอดีกรอบจึงได้ทำงานก่อนแล้วการหวงค่อยหลุด กลับมาหน้าเดิมอีกครั้ง
   * จะพอดีกรอบตามปกติ ไม่ใช่ค้างที่ซูมเดิมตลอดกาล
   */
  useEffect(() => {
    if (resumedPageRef.current !== null && resumedPageRef.current !== page) {
      resumedPageRef.current = null;
    }
  }, [page]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => fitToStage());
    observer.observe(stage);
    return () => observer.disconnect();
  }, [fitToStage]);

  const zoomAt = useCallback((clientX: number, clientY: number, factor: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const box = stage.getBoundingClientRect();
    const px = clientX - box.left;
    const py = clientY - box.top;
    setView((current) => {
      const scale = clampZoom(current.scale * factor);
      const worldX = (px - current.x) / current.scale;
      const worldY = (py - current.y) / current.scale;
      return { scale, x: px - worldX * scale, y: py - worldY * scale };
    });
  }, []);

  const zoomCentre = useCallback(
    (factor: number) => {
      const stage = stageRef.current;
      if (!stage) return;
      const box = stage.getBoundingClientRect();
      zoomAt(box.left + box.width / 2, box.top + box.height / 2, factor);
    },
    [zoomAt]
  );

  /** พิกัดบนจอ เป็นพิกัดของหน้ากระดาษ */
  const toPagePoint = useCallback(
    (clientX: number, clientY: number): PagePoint | null => {
      const stage = stageRef.current;
      if (!stage) return null;
      const box = stage.getBoundingClientRect();
      return {
        x: (clientX - box.left - view.x) / view.scale,
        y: (clientY - box.top - view.y) / view.scale
      };
    },
    [view.scale, view.x, view.y]
  );

  /**
   * ดูดจุดเข้าหาเส้นในแบบ
   *
   * มองหาพิกเซลที่เข้มที่สุดรอบ ๆ ตำแหน่งเมาส์ ซึ่งบนแบบก่อสร้างคือเส้นที่เขียนไว้จริง
   * ทำให้คลิกลงตรงปลายเส้นได้แม่นกว่ากะด้วยสายตา โดยเฉพาะตอนสอบเทียบสเกล
   * ซึ่งความคลาดเคลื่อนหนึ่งครั้งจะติดไปกับทุกปริมาณในหน้านั้น
   */
  /** เรขาคณิตของหน้านี้ที่การดูดจุดเอาไว้เกาะ คำนวณใหม่เมื่อรายการวัดหรือหน้าเปลี่ยน */
  const snapGeometry = useMemo(
    () => collectSnapGeometry(measurements, gridLines, dimensions, page),
    [dimensions, gridLines, measurements, page]
  );

  /**
   * ช่วงระหว่างแนวของรอยสี่เหลี่ยมที่กำลังเลือกอยู่ ถ้ามีเลขที่แบบเขียนพาดช่วงนั้น
   *
   * คำนวณจาก `selectedId` ไม่ใช่จากรอยที่เพิ่งสร้าง เพราะ `finish` เลือกรอยใหม่ให้เสมอ
   * แถบจึงขึ้นทั้งตอนเพิ่งคลิกสองมุมเสร็จ และตอนกลับมาคลิกเลือกรอยเดิมทีหลัง
   */
  const selectedBay = useMemo(() => {
    const mark = measurements.find((item) => item.id === selectedId);
    if (!mark || mark.kind !== "rect" || mark.points.length < 2) return null;
    const scale = scales[mark.page] ?? null;
    if (!scale) return null;
    const bay = gridBayFromCorners(
      mark.points[0],
      mark.points[1],
      nameGridLines(gridLines.filter((line) => line.page === mark.page)),
      dimensions.filter((item) => item.page === mark.page),
      scale
    );
    if (!bay) return null;
    return bay.across.statedMetres !== null || bay.down.statedMetres !== null ? bay : null;
  }, [dimensions, gridLines, measurements, scales, selectedId]);

  /** เส้นแนวเสาของหน้านี้พร้อมชื่อที่ไล่ให้ตามตำแหน่ง คำนวณใหม่เสมอ ไม่เก็บลงที่ไหน */
  const namedGridLines = useMemo(
    () => nameGridLines(gridLines.filter((line) => line.page === page)),
    [gridLines, page]
  );

  /** จุดตัดของแนวเสา ใช้บอกตำแหน่งและใช้นับฐานรากในก้อนถัดไป */
  const intersections = useMemo(() => gridIntersections(namedGridLines), [namedGridLines]);

  /**
   * หาว่าเมาส์ตรงนี้ควรดูดไปจุดไหน
   *
   * ลองเรขาคณิตก่อนเสมอ เพราะจุดที่คำนวณจากของที่วาดไว้แล้วแม่นกว่าการเดาจากพิกเซล
   * ส่วนการดูดเข้าเส้นในแบบเป็นทางสุดท้าย ใช้เมื่อยังไม่มีอะไรวาดไว้ให้เกาะ
   */
  const findSnap = useCallback(
    (cursor: PagePoint, lastPlaced: PagePoint | null): SnapHit | null => {
      if (!snapSettings.enabled) return null;
      const radiusPagePoints = snapSettings.screenRadius / Math.max(view.scale, 0.01);
      const geometryHit = findGeometrySnap({
        cursor,
        radiusPagePoints,
        geometry: snapGeometry,
        lastPlaced,
        metresPerPoint: pageScale?.metresPerPoint ?? null,
        settings: snapSettings
      });
      if (geometryHit) return geometryHit;

      if (!snapSettings.imageSnap || !analysis) return null;
      const { image, scale: analysisScale } = analysis;
      const found = findImageSnap(
        image,
        { x: cursor.x * analysisScale, y: cursor.y * analysisScale },
        radiusPagePoints * analysisScale,
        IMAGE_LUMINANCE_CEILING[snapSettings.imageSensitivity]
      );
      if (!found) return null;
      const point = { x: found.x / analysisScale, y: found.y / analysisScale };
      return {
        kind: "image",
        point,
        distance: Math.hypot(point.x - cursor.x, point.y - cursor.y)
      };
    },
    [analysis, pageScale, snapGeometry, snapSettings, view.scale]
  );

  /**
   * จุดที่จะถูกปักจริงเมื่อผู้ใช้คลิกตรงนี้
   *
   * **การดูดจุดชนะการล็อกทีละ 15 องศา** จุดที่ดูดติดคือของจริงบนแบบ มีพิกัดของมันเอง
   * ส่วนทิศที่ล็อกเป็นการช่วยกะเมื่อไม่มีอะไรให้เกาะ ของที่วัดได้ต้องชนะของที่เดา
   *
   * **แต่ตั้งฉากชนะการดูดจุด** และเป็นข้อยกเว้นที่ตั้งใจ (IP-242) · เจ้าของงานกด F8 แล้วยังลากเอียงได้
   * เพราะโค้ดเดิมคืนค่าตั้งแต่บรรทัดดูดจุด ยังไม่ทันไปถึงบรรทัดล็อกแกน · คำว่าตั้งฉากแปลว่า
   * **เส้นเอียงต้องเกิดขึ้นไม่ได้เลย** ถ้ายังเอียงได้ก็ไม่ใช่ตั้งฉาก
   *
   * วิธีที่ได้ทั้งสองอย่างคือ **เอาจุดที่ดูดติดมาก่อน แล้วค่อยบีบแกนที่ไม่ใช่แกนหลักให้เท่ากับจุดตั้งต้น**
   * ระยะตามแนวที่ลากจึงยังมาจากของจริงบนแบบ ส่วนความเอียงถูกตัดทิ้ง · ถ้าจุดที่ดูดติดอยู่บน
   * แนวเดียวกับจุดตั้งต้นอยู่แล้ว ผลลัพธ์ไม่ขยับเลย การดูดจุดจึงยังชนะเต็ม ๆ ในกรณีนั้น
   *
   * เมื่อการบีบแกนทำให้จุดขยับ จะไม่คืน `hit` ออกไป เพราะหมุดดูดจุดบนจอจะไปโผล่คนละที่กับ
   * จุดที่ปักจริง ซึ่งเป็นการโกหกผู้ใช้
   *
   * เครื่องมือร่างกริดตั้งฉากเสมอ เพราะแนวเสาไม่เคยเอียง
   */
  const resolvePoint = useCallback(
    (clientX: number, clientY: number, anchor: PagePoint | null): { point: PagePoint; hit: SnapHit | null } | null => {
      const raw = toPagePoint(clientX, clientY);
      if (!raw) return null;
      const hit = findSnap(raw, anchor);
      if (anchor && (orthoLock || tool === "gridline")) {
        const base = hit ? hit.point : raw;
        const locked = lockToAxis(anchor, base);
        const moved = locked.x !== base.x || locked.y !== base.y;
        return { point: locked, hit: moved ? null : hit };
      }
      if (hit) return { point: hit.point, hit };
      if ((axisLock || shiftHeld) && anchor) {
        return { point: lockToAngle(anchor, raw), hit: null };
      }
      return { point: raw, hit: null };
    },
    [axisLock, findSnap, orthoLock, shiftHeld, toPagePoint, tool]
  );

  /**
   * จุดตั้งต้นที่เส้นกำลังลากออกมา — ตัวล็อกทุกชนิดอ้างอิงจุดนี้ (IP-242)
   *
   * **บั๊กที่บรรทัดนี้เกิดมาแก้** เจ้าของงานกด F8 แล้วยังเห็นเส้นเฉียง แม้แก้ไปแล้วสองรอบ
   * เพราะเครื่องมือ "ระยะจริง" กับ "ร่างกริด" ไม่ได้เก็บจุดแรกไว้ใน `draft` แต่เก็บไว้ใน
   * `pendingRefStart` ซึ่งเป็น state คนละตัว · ตอนวางจุดจริงโค้ดส่ง `pendingRefStart`
   * เข้าไปถูกแล้ว แต่**ตอนลากให้ดู** ส่งแต่ `draft` ซึ่งว่างอยู่ ตัวล็อกจึงไม่มีจุดตั้งต้น
   * และไม่ทำงานเลย
   *
   * ผลคือเส้นประที่ลากตามเมาส์เฉียงได้ ทั้งที่จุดที่ปักลงไปจริงตั้งฉาก · คนตัดสินจากสิ่งที่เห็น
   * ไม่ใช่จากสิ่งที่บันทึก เขาจึงรายงานว่า F8 ไม่ทำงาน ซึ่งถูกของเขา
   */
  const activeAnchor =
    tool === "scale"
      ? calibrationPoints.at(-1) ?? null
      : pendingRefStart ?? draft.at(-1) ?? null;

  function handleMove(event: React.PointerEvent<HTMLDivElement>) {
    const panning = panRef.current;
    if (panning) {
      const dx = event.clientX - panning.x;
      const dy = event.clientY - panning.y;
      if (Math.hypot(dx, dy) > DRAG_SLOP_PX) panning.moved = true;
      setView({ scale: panning.view.scale, x: panning.view.x + dx, y: panning.view.y + dy });
      return;
    }
    const raw = toPagePoint(event.clientX, event.clientY);
    setCursor(raw);

    /* กำลังลากกรอบลบอยู่ · ไม่ต้องคิดเรื่องดูดจุดหรือล็อกแนว เพราะกรอบไม่ใช่การวัด */
    const erasing = eraseRef.current;
    if (erasing) {
      const dx = event.clientX - erasing.x;
      const dy = event.clientY - erasing.y;
      if (Math.hypot(dx, dy) > DRAG_SLOP_PX) erasing.moved = true;
      if (erasing.moved && raw) setMarquee(marqueeFrom(erasing.start, raw));
      return;
    }

    const resolved = resolvePoint(event.clientX, event.clientY, activeAnchor);
    setHover(resolved?.point ?? null);
    setSnapHit(resolved?.hit ?? null);
  }

  function handleDown(event: React.PointerEvent<HTMLDivElement>) {
    /**
     * ปุ่มขวาคือคำสั่งจบการวัด ไม่ใช่การวางจุด
     *
     * เบราว์เซอร์ยิง pointerdown ก่อน contextmenu เสมอ ถ้าไม่กันไว้ตรงนี้
     * ทุกครั้งที่คลิกขวาเพื่อจบ จะได้จุดผีเพิ่มมาหนึ่งจุดตรงตำแหน่งเมาส์
     * ซึ่งวัดด้วยมือเมื่อ 2026-09-01 แล้วพบว่าเส้น 5.02 เมตรกลายเป็น 7.64 เมตร
     */
    if (event.button === 1) {
      // ปุ่มกลางเลื่อนแบบได้เสมอ ไม่ว่าถืออะไรอยู่
      event.preventDefault();
      startPan(event);
      return;
    }
    if (event.button !== 0) return;
    if (!doc) return;

    /*
     * เครื่องมือเลือกลากเพื่อเลื่อนแบบด้วย ปล่อยโดยแทบไม่ขยับจึงเป็นการคลิกเลือก
     * เคยมีเครื่องมือ "เลื่อน" แยกอีกตัว ถอดออก 2026-09-05 เพราะมันทำได้แค่ครึ่งเดียวของตัวนี้
     */
    if (tool === "select") {
      startPan(event);
      return;
    }

    /**
     * ลบ — กดค้างแล้วลากคือกรอบคลุม ปล่อยโดยแทบไม่ขยับคือคลิกทีละชิ้น (IP-242)
     *
     * เจ้าของงานสั่งเมื่อ 2026-09-05 ว่า "ต้องเอาเมาส์คลิกเส้น หรือลากคลุม object ที่เลือกเพื่อลบ"
     * · ทั้งสองทางจบที่ `handleUp` ตัวเดียวกัน เพราะการตัดสินว่าเป็นคลิกหรือเป็นลาก
     * ต้องรอจนปล่อยนิ้วถึงจะรู้ · ใช้เกณฑ์ระยะเดียวกับที่เครื่องมือเลือกใช้แยกคลิกออกจากลากเลื่อนแบบ
     */
    if (tool === "erase") {
      const start = toPagePoint(event.clientX, event.clientY);
      if (!start) return;
      eraseRef.current = { x: event.clientX, y: event.clientY, start, moved: false };
      setMarquee(null);
      stageRef.current?.setPointerCapture(event.pointerId);
      return;
    }

    const raw = toPagePoint(event.clientX, event.clientY);
    if (!raw) return;

    if (tool === "scale") {
      const resolved = resolvePoint(event.clientX, event.clientY, activeAnchor);
      if (!resolved) return;
      const next = [...calibrationPoints, resolved.point].slice(-2);
      setCalibrationPoints(next);
      if (next.length === 2) setCalibrationOpen(true);
      return;
    }

    /**
     * ร่างกริดกับระยะจริงใช้สองคลิก จุดแรกค้างไว้ จุดที่สองสร้างเส้น
     *
     * สองตัวนี้ทำงานได้ตั้งแต่ยังไม่ตั้งสเกล เพราะเส้นแนวเสาเป็นพิกัด และเลขระยะเป็นสิ่งที่
     * คนอ่านจากแบบ ไม่ใช่ค่าที่คำนวณจากสเกล นี่คือลำดับที่เจ้าของงานใช้จริง คือร่างกริดก่อน
     * แล้วสเกลตามมาทีหลัง
     */
    if (tool === "gridline" || tool === "dimension") {
      const resolved = resolvePoint(event.clientX, event.clientY, pendingRefStart);
      if (!resolved) return;
      if (!pendingRefStart) {
        setPendingRefStart(resolved.point);
        return;
      }
      if (tool === "gridline") {
        commitWork({
          gridLines: [
            ...gridLines,
            { id: newId(), page, a: pendingRefStart, b: resolved.point }
          ]
        });
      } else {
        setPendingDimension({ a: pendingRefStart, b: resolved.point });
        setDimensionValue("");
        setDimensionUnit("m");
      }
      setPendingRefStart(null);
      return;
    }

    if (toolNeedsScale(tool) && !pageScale) return;

    /**
     * จุดตั้งต้นของการเลือกพื้นที่ห้องไม่ผ่านการดูดจุด
     *
     * การดูดจุดมีไว้ให้คลิกลงบนเส้นได้แม่น แต่จุดตั้งต้นของการไล่พื้นที่ต้องอยู่ในที่ว่างกลางห้อง
     * ถ้าดูดเข้าหาเส้นก่อน จุดตั้งต้นจะไปอยู่บนผนังแล้วถูกปฏิเสธว่าคลิกโดนเส้นทุกครั้ง
     * ซึ่งเป็นอาการที่เจอจริงตอนกดมือเมื่อ 2026-09-01
     */
    if (tool === "room") {
      pickRoom(raw);
      return;
    }

    const resolved = resolvePoint(event.clientX, event.clientY, activeAnchor);
    if (!resolved) return;
    const next = [...draft, resolved.point];
    setDraft(next);

    // ชนิดที่มีจำนวนจุดตายตัวจบเองทันที ชนิดที่คลิกได้เรื่อย ๆ รอคลิกขวา ดับเบิลคลิก หรือ Enter
    const fixed = tool === "length" || tool === "rect" ? 2 : 0;
    if (fixed > 0 && next.length === fixed) finish(next);
  }

  /**
   * ลบชิ้นเดียวที่อยู่ใต้จุดที่คลิก
   *
   * ลำดับเดียวกับเครื่องมือเลือก คือรายการวัดมาก่อน แล้วระยะที่แบบเขียน แล้วแนวเสา
   * เพราะแนวเสาพาดทั้งหน้า ถ้าให้มันชนะ การคลิกในห้องที่มีแนวเสาพาดจะลบแนวเสาแทนห้องทุกครั้ง
   */
  function eraseAtPoint(point: PagePoint) {
    const tolerance = HIT_RADIUS_PX / view.scale;
    const mark = hitTest(measurements.filter((item) => item.page === page), point, tolerance);
    if (mark) {
      removeMeasurements([mark]);
      return;
    }
    const dimension = hitTestSegments(dimensionsOnPage, point, tolerance);
    if (dimension) {
      commitWork({ dimensions: dimensions.filter((item) => item.id !== dimension) });
      return;
    }
    const gridline = hitTestSegments(gridLines.filter((line) => line.page === page), point, tolerance);
    if (gridline) commitWork({ gridLines: gridLines.filter((line) => line.id !== gridline) });
  }

  /**
   * ลบทุกชิ้นที่กรอบเก็บได้ ในการกระทำเดียว
   *
   * **ต้องเป็นการกระทำเดียว ไม่ใช่ลบทีละชิ้น** เพราะประวัติการแก้เก็บเป็นก้อน ถ้าลบทีละชิ้น
   * คนที่กวาดโดนสิบชิ้นแล้วเปลี่ยนใจ ต้องกดย้อนกลับสิบครั้ง ซึ่งไม่มีใครคาดคิด
   */
  function eraseInMarquee(rect: MarqueeRect) {
    const marks = measurements
      .filter((item) => item.page === page && shapeInMarquee(item.points, rect))
      .map((item) => item.id);
    const keptDimensions = dimensions.filter(
      (item) => !(item.page === page && segmentInMarquee(item.a, item.b, rect))
    );
    const keptGridLines = gridLines.filter(
      (line) => !(line.page === page && segmentInMarquee(line.a, line.b, rect))
    );
    const guidesRemoved =
      keptDimensions.length !== dimensions.length || keptGridLines.length !== gridLines.length;
    if (guidesRemoved) commitWork({ dimensions: keptDimensions, gridLines: keptGridLines });
    if (marks.length > 0) removeMeasurements(marks);
    if (!guidesRemoved && marks.length === 0) {
      setRegionError(
        rect.mode === "window"
          ? "กรอบนี้ไม่ได้คลุมชิ้นไหนทั้งชิ้น ลองลากจากขวาไปซ้ายเพื่อเก็บชิ้นที่กรอบแตะก็พอ"
          : "กรอบนี้ไม่ได้แตะอะไรเลย"
      );
    }
  }

  /**
   * เอารายการวัดออกจากหน้านี้ · รายการที่ส่งเข้าถอดปริมาณแล้วลบจากที่นี่ไม่ได้ตามสเปก IP-234
   *
   * บอกเป็นจำนวนที่ลบไม่ได้ ไม่ใช่บอกทีละชิ้น เพราะการกวาดกรอบเดียวอาจโดนหลายชิ้นพร้อมกัน
   */
  function removeMeasurements(ids: readonly string[]) {
    const blocked = ids.filter((id) => filedIds.has(id));
    const removable = ids.filter((id) => !filedIds.has(id));
    if (removable.length > 0) commit(measurements.filter((item) => !removable.includes(item.id)));
    if (blocked.length > 0) {
      setRegionError(
        blocked.length === 1
          ? "รายการนี้ส่งเข้าถอดปริมาณแล้ว ลบได้จากหน้าถอดปริมาณ"
          : `${blocked.length} รายการส่งเข้าถอดปริมาณแล้ว ลบได้จากหน้าถอดปริมาณ`
      );
    }
  }

  function startPan(event: React.PointerEvent<HTMLDivElement>) {
    const stage = stageRef.current;
    if (!stage) return;
    panRef.current = { x: event.clientX, y: event.clientY, view, moved: false };
    stage.setPointerCapture(event.pointerId);
  }

  function handleUp(event: React.PointerEvent<HTMLDivElement>) {
    const erasing = eraseRef.current;
    if (erasing) {
      eraseRef.current = null;
      setMarquee(null);
      const stage = stageRef.current;
      if (stage?.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
      const end = toPagePoint(event.clientX, event.clientY);
      if (!end) return;
      if (erasing.moved) eraseInMarquee(marqueeFrom(erasing.start, end));
      else eraseAtPoint(erasing.start);
      return;
    }

    const panning = panRef.current;
    if (!panning) return;
    panRef.current = null;
    const stage = stageRef.current;
    if (stage?.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);

    // ลากคือเลื่อนแบบ ปล่อยโดยแทบไม่ขยับคือคลิกเลือก
    if (panning.moved || tool !== "select" || event.button !== 0) return;
    const raw = toPagePoint(event.clientX, event.clientY);
    if (!raw) return;
    const tolerance = HIT_RADIUS_PX / view.scale;
    const onThisPage = measurements.filter((item) => item.page === page);
    const mark = hitTest(onThisPage, raw, tolerance);
    if (mark) {
      setSelectedId(mark);
      setSelectedGuide(null);
      return;
    }

    /*
     * ลำดับ: รายการวัด แล้วระยะที่แบบเขียน แล้วแนวเสา
     *
     * รายการวัดมาก่อนเพราะมันคืองานของผู้ใช้ ส่วนอีกสองอย่างเป็นเส้นอ้างอิงที่พาดผ่านทั้งหน้า
     * ถ้าให้แนวเสาชนะ การคลิกในห้องที่มีแนวเสาพาดจะเลือกแนวเสาแทนห้อง ทุกครั้ง
     * และระยะที่แบบเขียนมาก่อนแนวเสาเพราะมันสั้นกว่า เจาะจงกว่า และมีตัวเลขติดอยู่
     */
    const dimension = hitTestSegments(dimensions.filter((item) => item.page === page), raw, tolerance);
    if (dimension) {
      setSelectedId(null);
      setSelectedGuide({ kind: "dimension", id: dimension });
      return;
    }

    const gridline = hitTestSegments(gridLines.filter((line) => line.page === page), raw, tolerance);
    setSelectedId(null);
    setSelectedGuide(gridline ? { kind: "gridline", id: gridline } : null);
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!doc) return;
    let dy = event.deltaY;
    if (event.deltaMode === 1) dy *= 16;
    if (event.deltaMode === 2) dy *= stageRef.current?.clientHeight ?? 600;
    zoomAt(event.clientX, event.clientY, Math.exp(-dy * (event.ctrlKey ? 0.01 : 0.0015)));
  }

  function handleDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    if (tool === "select") {
      zoomAt(event.clientX, event.clientY, event.shiftKey ? 1 / ZOOM_STEP : ZOOM_STEP);
      return;
    }
    finish();
  }

  /**
   * ภาพเทาของชั้นวิเคราะห์ แปลงครั้งเดียวต่อหน้า ไม่ใช่ทุกคลิก
   *
   * `traceRegion` จำหน้ากากผนังไว้กับอ็อบเจ็กต์ภาพตัวนี้ (WeakMap) ถ้าแปลงใหม่ทุกคลิก
   * จะได้อ็อบเจ็กต์ใหม่ทุกครั้งและไม่เคยได้ใช้ของที่จำไว้ คลิกละครึ่งวินาทีเท่าเดิม
   */
  const analysisGrey = useMemo(
    () => (analysis ? toGreyImage(analysis.image.data, analysis.image.width, analysis.image.height) : null),
    [analysis]
  );

  /**
   * เลือกพื้นที่ห้องด้วยคลิกเดียว
   *
   * ผลที่ได้เป็นรูปหลายเหลี่ยมที่ผู้ใช้ลากแก้จุดต่อได้ ไม่ใช่ภาพระบายสีที่แก้ไม่ได้
   * และถ้าเส้นห้องในแบบไม่ปิดสนิทจนสีทะลุ ระบบบอกตรง ๆ แล้วให้ไปคลิกไล่มุมแทน
   *
   * **รูปที่ได้ยังไม่เข้ารายการวัดทันที** ขึ้นให้ดูบนแบบก่อนแล้วรอคนกดยืนยัน
   * เพราะการทะลุออกนอกห้องบางแบบเล็กเกินกว่าเพดานพื้นที่จะจับได้ แต่ตาคนเห็นทันที
   */
  function pickRoom(point: PagePoint) {
    if (!analysis || !analysisGrey) {
      setPendingRoom(null);
      setRegionError("กำลังเตรียมภาพวิเคราะห์ของหน้านี้ ลองอีกครั้ง");
      return;
    }
    const { scale: analysisScale } = analysis;
    const grey = analysisGrey;
    /**
     * รัศมีการกลบเป็นพิกเซลของภาพวิเคราะห์ · ต้องมีสเกลของหน้าก่อนถึงจะรู้ว่าเมตรหนึ่ง
     * กว้างกี่พิกเซล หน้าที่ยังไม่ตั้งสเกลจึงไม่กลบ ซึ่งไม่เป็นปัญหาเพราะเครื่องมือนี้
     * ถูกล็อกไว้จนกว่าจะตั้งสเกลอยู่แล้ว (`toolNeedsScale`)
     */
    const pixelsPerMetre = pageScale ? analysisScale / pageScale.metresPerPoint : 0;
    const result = traceRegion(
      grey,
      { x: point.x * analysisScale, y: point.y * analysisScale },
      {
        // คัดเส้นก่อนไล่สี ผนังกั้น สัญลักษณ์ไม่กั้น — ดู skill `drawing-geometry`
        minRunPixels: MIN_WALL_RUN_METRES * pixelsPerMetre,
        minStructurePixels: MIN_STRUCTURE_METRES * pixelsPerMetre,
        // เสาเป็นก้อนอิสระที่เล็กเกินด่านขนาด แต่เป็นโครงสร้างที่ต้องกั้น ขอบห้องต้องหักอ้อมมัน
        column: {
          min: Math.round(COLUMN_MIN_METRES * pixelsPerMetre),
          max: Math.round(COLUMN_MAX_METRES * pixelsPerMetre),
          touch: Math.round(COLUMN_TOUCH_METRES * pixelsPerMetre)
        },
        // ปิดช่องได้กว้างสองเท่าของรัศมี จึงส่งครึ่งหนึ่งของความกว้างประตูที่ยอมเชื่อม
        bridgeGapPixels: (DOOR_BRIDGE_METRES / 2) * pixelsPerMetre,
        // ขอบเป็นแนวนอนกับแนวตั้งล้วน ค่านี้กวาดเฉพาะขั้นที่เกิดจากความหยาบของภาพ
        minStepPixels: OUTLINE_MIN_STEP_METRES * pixelsPerMetre,
        // ขอบไปชิดผิวในของเส้นผนัง ผนังหนาหรือบางก็ไม่กินเข้าไปในเนื้อผนัง
        snapToLinePixels: WALL_SNAP_METRES * pixelsPerMetre,
        /**
         * ความหนาสูงสุดที่ยังนับว่าเป็น**เส้น** วัดเป็นจุดกระดาษแล้วคูณด้วยความละเอียดของ
         * ผืนวิเคราะห์ · ไม่ใช่ค่าเป็นเมตร เพราะความหนาของหมึกเป็นเรื่องของตัวเรนเดอร์
         * ไม่ใช่ของอาคาร · หน้าที่เรนเดอร์ละเอียดขึ้นจึงได้ค่านี้เป็นพิกเซลมากขึ้นตามกัน
         */
        lineMaxThicknessPixels: LINE_MAX_THICKNESS_POINTS * analysisScale,
        // เส้นยาวเป็นผนังต่อเมื่อมีเส้นคู่ขนานในระยะนี้ เส้นกระเบื้องกับเส้นตัดจึงไม่กั้น
        wallThicknessPixels: WALL_THICKNESS_METRES * pixelsPerMetre
        /**
         * **ไม่กลบรอยเว้าบนก้อนพื้นที่แล้ว** เคยเปิดไว้ตอน 2026-09-04 ต้นวัน แล้วเจ้าของงาน
         * จับได้จากรูปว่าขอบลอยห่างผนังและมุมมน เพราะการกลบทำงานกับก้อนพื้นที่ มันจึงมนมุมจริง
         * ของห้องด้วยรัศมีเดียวกับที่ใช้กลบสัญลักษณ์ · ตอนนี้สัญลักษณ์ถูกคัดออกตั้งแต่ชั้นเส้นแล้ว
         * จึงไม่มีรอยเว้าให้กลบ และมุมกลับมาคมตามผนังจริง
         */
      }
    );
    if (!result.ok) {
      setPendingRoom(null);
      setRegionError(regionRejectionMessage[result.reason]);
      return;
    }
    setRegionError("");
    const polygon = result.polygon.map((pixel) => ({
      x: pixel.x / analysisScale,
      y: pixel.y / analysisScale
    }));
    setPendingRoom({
      id: newId(),
      page,
      kind: "area",
      name: "",
      points: polygon,
      colour: MEASUREMENT_COLOURS[measurements.length % MEASUREMENT_COLOURS.length],
      // ระบบไล่ขอบห้องให้ คนยืนยัน — ตอนส่งเข้าถอดปริมาณจะกลายเป็น method region_trace
      origin: "region_trace",
      filed: null,
      layerId: null
    });
  }

  function confirmRoom() {
    if (!pendingRoom) return;
    commit([...measurements, pendingRoom]);
    setSelectedId(pendingRoom.id);
    setSelectedGuide(null);
    setPendingRoom(null);
  }

  function finish(points: PagePoint[] = draft) {
    // เครื่องมือที่ไม่ได้ผลลัพธ์เป็นรายการวัด เช่น เลือก เลื่อน ตั้งสเกล กด Enter แล้วต้องไม่เกิดแถวเปล่า
    if (!isMeasurementKind(tool)) {
      setDraft([]);
      return;
    }
    if (points.length < minimumPoints(tool)) {
      setDraft([]);
      return;
    }
    const kind: MeasurementKind = tool;
    const created: StoredMark = {
      id: newId(),
      page,
      kind,
      name: "",
      points,
      colour: MEASUREMENT_COLOURS[measurements.length % MEASUREMENT_COLOURS.length],
      origin: "pointer",
      filed: null,
      layerId: null
    };
    commit([...measurements, created]);
    setSelectedId(created.id);
    setSelectedGuide(null);
    setDraft([]);
  }

  /**
   * ทิ้งทุกอย่างที่ค้างอยู่กลางคัน
   *
   * **`pendingRefStart` กับ `pendingDimension` เพิ่งถูกใส่เข้ามา 2026-09-05 (IP-242)** ก่อนหน้านี้
   * ตกหล่นไปสองตัว · เครื่องมือ "ระยะจริง" กับ "ร่างกริด" เก็บจุดแรกไว้คนละที่กับเครื่องมืออื่น
   * คนที่ปักจุดแรกแล้วเปลี่ยนใจ กด Escape ก็ล้างไม่ออก จุดนั้นค้างอยู่จนกว่าจะปักจุดที่สอง
   * แล้วได้เส้นที่ไม่ได้ตั้งใจลากมาหนึ่งเส้น
   */
  function cancelDraft() {
    setDraft([]);
    setCalibrationPoints([]);
    setCalibrationOpen(false);
    setPendingRoom(null);
    setRegionError("");
    setPendingRefStart(null);
    setPendingDimension(null);
    setDimensionError("");
  }

  /**
   * Escape สองชั้นแบบ AutoCAD — ชั้นแรกทิ้งของที่ค้าง ชั้นสองออกจากคำสั่ง (IP-242)
   *
   * เจ้าของงานขอเมื่อ 2026-09-05 ว่า "การยกเลิกคำสั่งที่กดปุ่มทำงาน ให้กด esc ได้"
   * · ของเดิม Escape ล้างแค่จุดที่ลากค้างไว้ แล้วยังติดอยู่ในเครื่องมือเดิม คนที่กดเครื่องมือผิด
   * จึงไม่มีทางออกนอกจากไปกดปุ่ม "เลือก" บนแถบ ซึ่งอยู่คนละที่กับมือที่กำลังวาดอยู่
   *
   * **แยกสองชั้น ไม่ใช่ทำทีเดียวจบ** เพราะคนที่ลากผิดจุดเดียวกลางเส้นต่อเนื่องยาว ๆ
   * ต้องการล้างจุดที่ลากค้าง แล้ววาดต่อด้วยเครื่องมือเดิมทันที ไม่ใช่ถูกเด้งออกไปเครื่องมือเลือก
   * แล้วต้องกดกลับเข้ามาใหม่ · เป็นลำดับเดียวกับที่ AutoCAD ทำ
   */
  function escapeCommand() {
    const hasPending =
      draft.length > 0 ||
      calibrationPoints.length > 0 ||
      calibrationOpen ||
      Boolean(pendingRoom) ||
      Boolean(pendingRefStart) ||
      Boolean(pendingDimension) ||
      regionError.length > 0 ||
      snapPanelOpen ||
      askedFor !== null;
    if (hasPending) {
      cancelDraft();
      setSnapPanelOpen(false);
      setAskedFor(null);
      return;
    }
    setSelectedGuide(null);
    if (tool !== "select") pickTool("select");
  }

  function applyCalibration() {
    if (calibrationPoints.length < 2) return;
    const result = calibrate({
      measuredPoints: distancePoints(calibrationPoints[0], calibrationPoints[1]),
      realDistance: Number(realDistance),
      unit
    });
    if (!result.ok) {
      setCalibrationError(calibrationRejectionMessage[result.reason]);
      return;
    }
    setScales((current) => ({ ...current, [page]: result.scale }));
    const reference: PageReference = {
      method: "two_point",
      reference: {
        version: 1,
        a: calibrationPoints[0],
        b: calibrationPoints[1],
        realDistance: Number(realDistance),
        unit
      }
    };
    setReferences((current) => ({ ...current, [page]: reference }));
    void persistPage(
      page,
      result.scale,
      reference,
      gridLines.filter((line) => line.page === page),
      dimensions.filter((item) => item.page === page)
    );
    setCalibrationError("");
    setCalibrationOpen(false);
    setCalibrationPoints([]);
    setRealDistance("");
    setTool("select");
  }

  function pickTool(next: Tool) {
    setDraft([]);
    setTool(next);
    /* เลือกเครื่องมือได้แล้วแปลว่าเรื่องที่ขวางอยู่ถูกแก้ หรือคนเปลี่ยนใจไปทำอย่างอื่น
       คำตอบจึงต้องหายไป ไม่ค้างเป็นแถบที่พูดถึงของที่ผ่านไปแล้ว */
    setAskedFor(null);
  }

  /**
   * ตอบคนที่เพิ่งกดปุ่มที่ยังทำงานไม่ได้ ว่าติดอะไรอยู่และต้องทำอะไรก่อน
   *
   * ไม่เก็บข้อความไว้เอง แต่ชี้ไปที่ขั้นที่ `drawingTourStep` คำนวณจากสถานะจริงของหน้า
   * คำตอบจึงตรงกับเหตุผลที่ล็อกอยู่จริงเสมอ และหายเองเมื่อเหตุนั้นหมดไป
   */
  function explainBlock() {
    setAskedFor(tourStep?.target ?? null);
  }

  /**
   * เปลี่ยนหน้า — ทุกทางที่เปลี่ยนหน้าต้องผ่านตัวนี้ ไม่ใช่เรียก `setPage` ตรง ๆ
   *
   * **เลิกเลือกเส้นอ้างอิงด้วยเสมอ** เพราะ `selectedGuide` เก็บแค่ไอดี ไม่ได้เก็บว่าอยู่หน้าไหน
   * เส้นที่เลือกไว้บนหน้า 1 จึงยังเลือกอยู่เมื่อเลื่อนไปหน้า 2 แถบข้างล่างจะบอกว่า
   * "เลือกอยู่ แนวเสา 1" ทั้งที่หน้านี้ไม่มีเส้นนั้น แล้วถ้ากด Delete มันจะลบของบนหน้าโน้นจริง ๆ
   * โดยไม่มีอะไรบนจอเปลี่ยนให้เห็น
   */
  function goToPage(next: number) {
    setDraft([]);
    setPendingRoom(null);
    setSelectedGuide(null);
    setPage(next);
  }

  /**
   * เส้นระยะเส้นนี้ คือเส้นที่ตั้งสเกลของหน้านี้ไว้หรือเปล่า (IP-235)
   *
   * `references[page]` เก็บ **สำเนา** ของปลายทั้งสองกับระยะจริง ไม่ได้ชี้ด้วยไอดี
   * สเกลของหน้าจึงไม่ผูกกับแถวระยะจริง และการลบเส้นไม่ทำให้สเกลเปลี่ยนหรือหาย
   * ซึ่งถูกแล้ว เพราะรอยวัดทุกอันที่วัดไปแล้วคูณด้วยสเกลตัวนั้นไปเรียบร้อย
   *
   * แต่คนใช้ต้องรู้ก่อนกด ว่าเส้นที่กำลังจะลบคือหลักฐานว่าสเกลมาจากไหน ลบแล้วเลขยังเท่าเดิม
   * แต่จะไม่มีอะไรบนแบบบอกว่าเลขนั้นมาจากช่วงไหน
   */
  function isScaleWitness(item: StatedDimension): boolean {
    const held = references[item.page]?.reference;
    if (!held) return false;
    const samePoint = (one: PagePoint, two: PagePoint) => one.x === two.x && one.y === two.y;
    return (
      samePoint(held.a, item.a) &&
      samePoint(held.b, item.b) &&
      held.unit === "m" &&
      held.realDistance === item.valueM
    );
  }

  const selectedDimension = selectedGuide?.kind === "dimension"
    ? dimensions.find((item) => item.id === selectedGuide.id) ?? null
    : null;
  const selectedGridLine = selectedGuide?.kind === "gridline"
    ? namedGridLines.find((line) => line.id === selectedGuide.id) ?? null
    : null;

  /**
   * ล้างสเกลของหน้านี้ (IP-235)
   *
   * **กดได้เฉพาะตอนหน้านั้นไม่มีแนวเสาและไม่มีระยะที่แบบเขียนเหลืออยู่** เพราะสองอย่างนั้นเก็บ
   * เป็น jsonb อยู่บนแถวสอบเทียบแถวเดียวกับสเกล และคอลัมน์สเกลเป็น NOT NULL จึงไม่มีสภาพ
   * "แถวที่ไม่มีสเกล" ให้เก็บมันไว้ · ถ้าปล่อยให้ล้างตอนยังมีเส้น มันจะลบงานของผู้ใช้เป็น
   * ผลข้างเคียงของคำสั่งที่ชื่อว่า "ล้างสเกล" ซึ่งไม่มีใครอ่านชื่อนั้นแล้วคาดคิด
   * เจ้าของงานเคาะทางนี้เมื่อ 2026-09-05 · ด่านจริงอยู่ที่ฐาน ที่นี่แค่ปิดปุ่มให้เห็นก่อน
   */
  const gridOnPage = gridLines.filter((line) => line.page === page);
  const dimensionsOnPage = dimensions.filter((item) => item.page === page);
  const marksOnPage = measurements.filter((item) => item.page === page);
  const clearScaleBlockedBy =
    !pageScale
      ? "หน้านี้ยังไม่ได้ตั้งสเกล"
      : gridOnPage.length > 0 || dimensionsOnPage.length > 0
        ? `ลบแนวเสาและระยะที่แบบเขียนบนหน้านี้ให้หมดก่อน ยังเหลือ ${gridOnPage.length + dimensionsOnPage.length} เส้น เพราะเส้นพวกนั้นเก็บรวมอยู่กับสเกล`
        : null;

  async function clearScale() {
    if (!documentId || clearScaleBlockedBy) return;
    setSaveStatus({ kind: "saving" });
    const result = await clearDrawingCalibration({ documentId, pageNumber: page });
    if (!result.ok) {
      setSaveStatus({ kind: "failed", message: result.message });
      return;
    }
    setScales((current) => {
      const next = { ...current };
      delete next[page];
      return next;
    });
    setReferences((current) => {
      const next = { ...current };
      delete next[page];
      return next;
    });
    // ลายเซ็นของหน้าต้องหายไปด้วย ไม่งั้นการตั้งสเกลใหม่ที่ให้ค่าเดิมเป๊ะจะถูกมองว่า "เซฟไปแล้ว"
    delete lastSavedRef.current[page];
    setSaveStatus({ kind: "saved", at: new Date() });
  }

  /**
   * ลบเส้นอ้างอิงที่เลือกอยู่
   *
   * ผ่าน `commitWork` เหมือนทุกการเปลี่ยนแปลง จึงกด Ctrl+Z คืนได้ และ effect ที่เฝ้ากริด
   * กับระยะจริงจะเห็นการเปลี่ยนแล้วเซฟลงฐานเอง ไม่ต้องเรียกเซฟตรงนี้
   */
  function removeSelectedGuide() {
    if (!selectedGuide) return;
    if (selectedGuide.kind === "dimension") {
      commitWork({ dimensions: dimensions.filter((item) => item.id !== selectedGuide.id) });
    } else {
      commitWork({ gridLines: gridLines.filter((line) => line.id !== selectedGuide.id) });
    }
    setSelectedGuide(null);
  }

  // คีย์ลัด — ตัวอักษรเดี่ยว ตัวเลข และ Escape เท่านั้น จึงไม่ชนคีย์ลัดของเบราว์เซอร์
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      /**
       * ปุ่มฟังก์ชันทำงานเสมอ แม้โฟกัสอยู่ในช่องกรอก — ต้องอยู่เหนือด่านข้างล่าง (IP-242)
       *
       * **บั๊กที่บรรทัดนี้เกิดมาแก้** เจ้าของงานกด F8 แล้วไม่ล็อกแกน เพราะตอนนั้นโฟกัสค้าง
       * อยู่ในช่อง "ตั้งชื่อห้อง" ที่เพิ่งขึ้นมา ด่านข้างล่างจึงตัดทุกคีย์ทิ้งก่อนถึงตัวจัดการ
       * · ด่านนั้นถูกของมันสำหรับคีย์ตัวอักษร เพราะคนกำลังพิมพ์ชื่อห้องอยู่ ตัว V ต้องเป็นตัว V
       * ไม่ใช่การสลับเครื่องมือ · แต่ปุ่มฟังก์ชันไม่พิมพ์ตัวอักษรอะไรลงช่อง จึงไม่มีอะไรให้ชน
       * และใน AutoCAD ปุ่มพวกนี้ก็ทำงานตลอดเวลาไม่ว่าเคอร์เซอร์อยู่ที่ไหน
       */
      if (event.key === "F8") {
        event.preventDefault();
        setOrthoLock((on) => !on);
        return;
      }
      /**
       * Escape ยกเลิกได้เสมอ แม้เคอร์เซอร์อยู่ในช่องกรอก — เหตุผลเดียวกับ F8 (IP-242)
       *
       * เจ้าของงานรายงานว่ากด Escape แล้วไม่ยกเลิก · ช่องกรอกที่ทำให้ตายมีสองช่องและทั้งคู่
       * โผล่มาตอนกำลังทำงานพอดี คือช่อง "ตั้งชื่อห้อง" กับช่องพิมพ์เลขระยะจริง
       * · การกด Escape ในช่องกรอกไม่ได้แปลว่าอยากพิมพ์ตัวอักษร Escape มันแปลว่าเลิก
       * ซึ่งเป็นความหมายเดียวกับที่คนคาดหวังจากทั้ง AutoCAD และจากกล่องข้อความทั่วไป
       *
       * ต้องถอนโฟกัสออกจากช่องด้วย ไม่งั้นคนกด Escape แล้วเลิกได้จริง แต่ปุ่มตัวอักษร
       * ที่กดต่อจากนั้นยังตกลงไปในช่องเดิมอยู่ดี
       */
      if (event.key === "Escape") {
        event.preventDefault();
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        escapeCommand();
        return;
      }
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.key === "Shift") setShiftHeld(true);
      /**
       * Enter จบการวัดที่ค้างอยู่ และต้องกันไม่ให้ไปกดปุ่มที่โฟกัสค้างอยู่ด้วย
       *
       * ผู้ใช้ที่เพิ่งกดปุ่มซูมออกด้วยเมาส์จะมีโฟกัสค้างที่ปุ่มนั้น พอวาดเสร็จแล้วกด Enter
       * การวัดจบจริงแต่หน้าแบบซูมออกตามไปด้วย ซึ่งกดเจอจริงเมื่อ 2026-09-01
       */
      if (event.key === "Enter") {
        if (draft.length > 0) {
          event.preventDefault();
          finish();
        }
        return;
      }
      /*
       * Delete และ Backspace ลบเส้นอ้างอิงที่เลือกอยู่ (IP-235)
       *
       * ไม่แตะรายการวัด เพราะรายการที่ส่งเข้าถอดปริมาณแล้วลบจากหน้านี้ไม่ได้ตามสเปก IP-234
       * การให้ปุ่มเดียวลบได้ทั้งสองอย่างจะทำให้บางครั้งลบได้บางครั้งไม่ได้โดยไม่มีคำอธิบาย
       * รายการวัดมีปุ่มลบของตัวเองในแผงขวาอยู่แล้ว ซึ่งบอกเหตุผลได้เมื่อลบไม่ได้
       */
      if (event.key === "Delete" || event.key === "Backspace") {
        if (!selectedGuide) return;
        event.preventDefault();
        removeSelectedGuide();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (event.ctrlKey || event.metaKey) return;

      const match = TOOLS.find((entry) => entry.key.toLowerCase() === event.key.toLowerCase());
      if (match && doc) {
        if (toolNeedsScale(match.id) && !pageScale) return;
        event.preventDefault();
        pickTool(match.id);
        return;
      }
      if (event.key.toLowerCase() === "q") {
        event.preventDefault();
        setSharpOn((on) => !on);
        return;
      }
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setSnapSettings((current) => ({ ...current, enabled: !current.enabled }));
        return;
      }
      if (event.key.toLowerCase() === "o") {
        event.preventDefault();
        setAxisLock((on) => !on);
        return;
      }
      if (event.key === "1") {
        event.preventDefault();
        setRailOn((on) => !on);
        return;
      }
      if (event.key === "2") {
        event.preventDefault();
        setPanelOn((on) => !on);
        return;
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomCentre(ZOOM_STEP);
        return;
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        zoomCentre(1 / ZOOM_STEP);
        return;
      }
      if (event.key === "0" || event.key.toLowerCase() === "f") {
        event.preventDefault();
        fitToStage();
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.key === "Shift") setShiftHeld(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  });

  /**
   * แผงรายการวัดต้องโชว์เลขเดียวกับแถบที่มาของช่วง ไม่ใช่คนละเลขบนจอเดียวกัน
   *
   * สี่เหลี่ยมที่พาดช่วงซึ่งมีเลขที่แบบเขียนกำกับ ใช้เลขนั้น ส่วนที่เหลือใช้ผลของ `measure`
   * ตามเดิม · ยอดรวมจึงเดินตามเลขที่แบบเขียนไปด้วย ซึ่งเป็นเลขที่เจ้าของงานสั่งให้ใช้
   * เพราะแบบสถาปัตย์ไม่ได้บอกขนาดเสาหรือความหนาผนัง การวัดหมึกแล้วหักผนังจึงเป็นการเดา
   */
  const summary = useMemo(() => {
    const scaleForPage = (target: number) => scales[target] ?? null;
    return summarise(measurements, scaleForPage, (mark) => {
      if (mark.kind !== "rect" || mark.points.length < 2) return null;
      const scale = scaleForPage(mark.page);
      if (!scale) return null;
      const bay = gridBayFromCorners(
        mark.points[0],
        mark.points[1],
        nameGridLines(gridLines.filter((line) => line.page === mark.page)),
        dimensions.filter((item) => item.page === mark.page),
        scale
      );
      if (!bay || (bay.across.statedMetres === null && bay.down.statedMetres === null)) return null;
      return {
        lengthMetres: null,
        perimeterMetres: null,
        areaSquareMetres: bay.areaSquareMetres,
        count: null,
        segmentsMetres: [bay.across.metres, bay.down.metres],
        blockedByScale: false
      };
    });
  }, [dimensions, gridLines, measurements, scales]);

  /**
   * ที่มาของตัวเลขในแต่ละแถวของแผงรายการวัด (IP-242)
   *
   * หน้าแบบเป็นที่เดียวที่รู้ครบทั้งสามอย่างที่ต้องใช้ — สเกลของหน้า วิธีที่สเกลนั้นถูกตั้ง
   * และระยะที่แบบเขียนไว้บนหน้าเดียวกัน · ตารางจึงไม่ต้องรู้จักของพวกนี้เลย
   */
  const evidenceFor = useCallback(
    (row: MeasurementRow) =>
      explainMeasurement({
        measurement: row.measurement,
        value: row.value,
        scale: scales[row.measurement.page] ?? null,
        method: references[row.measurement.page]?.method ?? null,
        dimensions: dimensions.filter((item) => item.page === row.measurement.page)
      }),
    [dimensions, references, scales]
  );

  const draftPreview = useMemo(() => {
    if (draft.length === 0) return null;
    const points = hover ? [...draft, hover] : draft;
    if (tool === "rect" && points.length >= 2) {
      const [a, b] = points;
      return [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];
    }
    return points;
  }, [draft, hover, tool]);

  const calibrationLength =
    calibrationPoints.length === 2 ? distancePoints(calibrationPoints[0], calibrationPoints[1]) : 0;

  const pendingValue = pendingRoom ? measure(pendingRoom, pageScale) : null;

  /**
   * ขั้นตอนที่พาไปถึงตัวเลขพื้นที่ — กางจากรูปเดียวกับที่ `measure` ใช้ ไม่ได้คิดใหม่
   *
   * ถ้ากางด้วยการคำนวณของตัวเอง มันจะกลายเป็นเลขที่สองที่อาจไม่ตรงกับเลขแรก
   * ซึ่งแย่กว่าไม่มีคำอธิบายเลย
   */
  const roomWorking = pendingRoom
    ? explainRoomArea(pendingRoom.points, pageScale, pendingValue?.areaSquareMetres ?? null)
    : null;
  const filedIds = useMemo(
    () => new Set(measurements.filter((mark) => mark.filed).map((mark) => mark.id)),
    [measurements]
  );
  const filingWork = filing ? filingWorking(filing.mark) : null;
  const filingMatch = filing
    ? filing.openItems.find(
        (item) => item.description.trim() === filing.description.trim() && item.unit === filing.unit
      ) ?? null
    : null;
  const filingUnits = filing
    ? filing.mark.kind === "count"
      ? TAKEOFF_UNITS.filter((item) => item.dimension === "count")
      : TAKEOFF_UNITS.filter((item) => item.code === filing.unit)
    : [];
  const stroke = (weight: number) => weight / view.scale;

  function showTip(event: React.PointerEvent | React.FocusEvent, spec: { label: string; hint: string; key?: string }) {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setTip({ title: spec.label, hint: spec.hint, key: spec.key ?? null, centre: box.left + box.width / 2, top: box.bottom + 8 });
  }

  /**
   * วางป้ายลอยให้อยู่ในจอเสมอ
   *
   * ปุ่มซ้ายสุดของแถบเครื่องมืออยู่ห่างขอบจอไม่ถึงครึ่งความกว้างของป้าย ถ้าวางกึ่งกลางปุ่มตรง ๆ
   * ป้ายจะล้นออกไปทางซ้ายจนอ่านไม่ครบ (เจ้าของงานเจอเอง 2026-09-02) ต้นแบบแก้ด้วยการวัดความกว้าง
   * จริงของป้ายก่อนแล้วค่อยหนีบไว้ในจอ ที่นี่ทำแบบเดียวกัน วัดตอน ref ติด DOM ซึ่งเกิดก่อนจอวาด
   * จึงไม่เห็นป้ายกระโดด
   */
  const positionTip = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element || !tip) return;
      const width = element.offsetWidth;
      const rightLimit = window.innerWidth - width - TIP_EDGE_GAP;
      setTipLeft(Math.min(rightLimit, Math.max(TIP_EDGE_GAP, tip.centre - width / 2)));
    },
    [tip]
  );

  /**
   * บันทึกระยะที่แบบเขียน และตั้งสเกลจากมันได้ในคลิกเดียว
   *
   * นี่คือลำดับที่เจ้าของงานใช้จริง — อ่านเลขจากแบบแล้วพิมพ์เข้าไป ไม่ใช่ให้ระบบเดาสเกล
   * จากตัวเลขใต้รูป เพราะแบบที่ถูกย่อขยายตอนพิมพ์จะมีสเกลจริงไม่ตรงกับที่เขียนไว้
   * และไม่มีทางรู้เลยถ้าไม่เทียบกับเส้นที่วัดได้
   */
  function saveDimension(alsoCalibrate: boolean) {
    if (!pendingDimension) return;
    const typed = Number(dimensionValue);
    if (!Number.isFinite(typed) || typed <= 0) {
      setDimensionError("ระยะที่แบบเขียนต้องมากกว่าศูนย์");
      return;
    }
    const dimension: StatedDimension = {
      id: newId(),
      page,
      a: pendingDimension.a,
      b: pendingDimension.b,
      valueM: typed * unitToMetres[dimensionUnit]
    };
    const nextDimensions = [...dimensions, dimension];
    if (alsoCalibrate) {
      const result = calibrateFromDimension(dimension);
      if (!result.ok) {
        setDimensionError(calibrationRejectionMessage[result.reason]);
        return;
      }
      setScales((current) => ({ ...current, [page]: result.scale }));
      const reference: PageReference = {
        method: "stated_dimension",
        reference: {
          version: 1,
          a: dimension.a,
          b: dimension.b,
          realDistance: dimension.valueM,
          unit: "m"
        }
      };
      setReferences((current) => ({ ...current, [page]: reference }));
      // ส่งรายการที่รวมตัวใหม่แล้ว เพราะ state ยังไม่ทันเปลี่ยนในจังหวะนี้
      void persistPage(
        page,
        result.scale,
        reference,
        gridLines.filter((line) => line.page === page),
        nextDimensions.filter((item) => item.page === page)
      );
    }
    // ไม่ได้ตั้งสเกลด้วยก็ไม่ต้องเรียกเซฟตรงนี้ effect ที่เฝ้าระยะจริงจะเห็นการเปลี่ยนเอง
    commitWork({ dimensions: nextDimensions });
    setPendingDimension(null);
    setDimensionError("");
  }

  return (
    <div className="mk">
      {/* แถวหนึ่ง — แถบของแอป ทางกลับ ชื่อโครงการ ไฟล์ที่เปิดอยู่ และประวัติการแก้ */}
      <div className="mk__bar">
        <Link className="mk__back" href={projectHref}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={ICONS.back} />
          </svg>
          กลับไปหน้าโครงการ
        </Link>
        <span className="mk__project">{projectName}</span>
        <span className="mk__divider" aria-hidden="true" />
        <label
          className={`mk__icon mk__open${blockedNotice?.target === "open" ? " is-tour-target" : ""}`}
          title="เปิดแบบ PDF"
          onPointerEnter={(event) => showTip(event, { label: "เปิดแบบ PDF", hint: "เลือกไฟล์แบบก่อสร้างจากเครื่องของคุณ" })}
          onPointerLeave={() => setTip(null)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={ICONS.open} />
          </svg>
          <span className="mk__sr">เปิดแบบ PDF</span>
          {/* ปุ่มของทัวร์กดมาที่ช่องนี้ ไม่ต้องมีช่องเลือกไฟล์ตัวที่สองให้สองที่ไม่ตรงกัน */}
          <input
            ref={openInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void openFile(file);
            }}
          />
        </label>
        <span className="mk__file">{fileName || "ยังไม่ได้เปิดแบบ"}</span>
        <button
          type="button"
          className="mk__icon"
          onClick={undo}
          disabled={past.length === 0}
          aria-label="ย้อนกลับ"
          onPointerEnter={(event) => showTip(event, { label: "ย้อนกลับ", hint: "ยกเลิกการกระทำล่าสุด", key: "Ctrl Z" })}
          onPointerLeave={() => setTip(null)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={ICONS.undo} />
          </svg>
        </button>
        <button
          type="button"
          className="mk__icon"
          onClick={redo}
          disabled={future.length === 0}
          aria-label="ทำซ้ำ"
          onPointerEnter={(event) => showTip(event, { label: "ทำซ้ำ", hint: "ทำสิ่งที่เพิ่งยกเลิกไปอีกครั้ง", key: "Ctrl Shift Z" })}
          onPointerLeave={() => setTip(null)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={ICONS.redo} />
          </svg>
        </button>
      </div>

      {/* แถวสอง — แถบเครื่องมือ */}
      <div className="mk__palette">
        <button
          type="button"
          className="mk__icon"
          aria-pressed={railOn}
          onClick={() => setRailOn((on) => !on)}
          aria-label="รางหน้าแบบ"
          onPointerEnter={(event) => showTip(event, { label: "รางหน้าแบบ", hint: "เปิดปิดแถบหน้าแบบด้านซ้าย เพื่อคืนพื้นที่ให้แบบ", key: "1" })}
          onPointerLeave={() => setTip(null)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={ICONS.rail} />
          </svg>
        </button>
        <span className="mk__divider" aria-hidden="true" />
        <div className="mk__tools" role="radiogroup" aria-label="เครื่องมือวัด">
          {TOOLS.map((entry) => {
            const locked = (toolNeedsScale(entry.id) && !pageScale) || !doc;
            return (
              <button
                key={entry.id}
                type="button"
                className={`mk__icon${blockedNotice?.target === entry.id ? " is-tour-target" : ""}`}
                role="radio"
                aria-checked={tool === entry.id}
                aria-label={entry.label}
                /*
                  `aria-disabled` ไม่ใช่ `disabled` — ปุ่มยังโฟกัสด้วยแป้นพิมพ์ได้ ยังกดได้
                  และโปรแกรมอ่านหน้าจอยังบอกว่ากดไปก็ยังไม่ได้ผล · borntodev เขียนไว้ว่า
                  "หลีกเลี่ยง Disable ควรให้ผู้ใช้กดได้ แล้วแสดงข้อความแจ้ง" ซึ่งตรงกับปัญหา
                  ที่เจอจริงบนแท็บเล็ตของเจ้าของงาน คือไม่มีการชี้เมาส์ จึงไม่มีทางเห็น tooltip
                  ที่เคยเป็นที่เดียวที่บอกเหตุผล
                */
                aria-disabled={locked || undefined}
                onClick={() => (locked ? explainBlock() : pickTool(entry.id))}
                /* เหตุผลมาจากขั้นที่ขวางอยู่จริง ไม่ใช่ข้อความตายตัวว่า "ต้องตั้งสเกลก่อน"
                   ซึ่งเดิมขึ้นแม้ตอนที่ยังไม่ได้เปิดไฟล์แบบด้วยซ้ำ */
                onPointerEnter={(event) =>
                  showTip(event, {
                    label: entry.label,
                    hint: locked ? (tourStep?.reason ?? entry.hint) : entry.hint,
                    key: entry.key
                  })
                }
                onPointerLeave={() => setTip(null)}
                onFocus={(event) =>
                  showTip(event, {
                    label: entry.label,
                    hint: locked ? (tourStep?.reason ?? entry.hint) : entry.hint,
                    key: entry.key
                  })
                }
                onBlur={() => setTip(null)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d={entry.icon} />
                </svg>
              </button>
            );
          })}
        </div>
        <span className="mk__divider" aria-hidden="true" />
        <span className="mk__snap-group">
          <button
            type="button"
            className="mk__icon"
            aria-pressed={snapSettings.enabled}
            onClick={() => setSnapSettings((current) => ({ ...current, enabled: !current.enabled }))}
            aria-label="ดูดจุด"
            onPointerEnter={(event) =>
              showTip(event, { label: "ดูดจุด", hint: "ให้ปลายเส้นวิ่งไปเกาะจุดที่มีอยู่จริงบนแบบ แม่นกว่าเล็งด้วยตา", key: "N" })
            }
            onPointerLeave={() => setTip(null)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={ICONS.snap} />
            </svg>
          </button>
          {/* ตัวเลือกชนิดอยู่ในกล่องที่เด้งจากปุ่ม ไม่กินที่ถาวรบนแถบ ตามที่เจ้าของงานเลือก */}
          <button
            type="button"
            className="mk__caret"
            aria-expanded={snapPanelOpen}
            aria-label="เลือกชนิดของการดูดจุด"
            onClick={() => setSnapPanelOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={ICONS.caret} />
            </svg>
          </button>
          {snapPanelOpen ? (
            <div className="mk__snap-menu" role="group" aria-label="ชนิดของการดูดจุด">
              {SNAP_KIND_TOGGLES.map((entry) => (
                <label key={entry.field}>
                  <input
                    type="checkbox"
                    checked={snapSettings[entry.field]}
                    onChange={(event) =>
                      setSnapSettings((current) => ({ ...current, [entry.field]: event.target.checked }))
                    }
                  />
                  <span>{entry.label}</span>
                  <small>{entry.hint}</small>
                </label>
              ))}
              <label className="mk__snap-radius">
                <span>ระยะจับ</span>
                <input
                  type="number"
                  min={4}
                  max={40}
                  value={snapSettings.screenRadius}
                  onChange={(event) =>
                    setSnapSettings((current) => ({
                      ...current,
                      screenRadius: Math.min(40, Math.max(4, Number(event.target.value) || current.screenRadius))
                    }))
                  }
                />
                <small>พิกเซลบนจอ กว้างเท่าเดิมเสมอไม่ว่าซูมเท่าไหร่</small>
              </label>
            </div>
          ) : null}
        </span>
        <button
          type="button"
          className="mk__icon"
          aria-pressed={axisLock}
          onClick={() => setAxisLock((on) => !on)}
          aria-label="ล็อกแนวเส้น"
          onPointerEnter={(event) =>
            showTip(event, {
              label: "ล็อกแนวเส้น",
              hint: "บังคับเส้นที่กำลังลากให้ตรงทีละ 15 องศา กด Shift ค้างก็ได้ · ถ้าดูดจุดติดอยู่ การดูดจุดชนะ",
              key: "O"
            })
          }
          onPointerLeave={() => setTip(null)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={ICONS.ortho} />
          </svg>
        </button>
        {/* ตั้งฉาก — F8 เหมือน ORTHO ของ AutoCAD · แยกจากล็อกทีละ 15 องศาโดยตั้งใจ (IP-242) */}
        <button
          type="button"
          className="mk__icon"
          aria-pressed={orthoLock}
          onClick={() => setOrthoLock((on) => !on)}
          aria-label="ตั้งฉาก"
          onPointerEnter={(event) =>
            showTip(event, {
              label: "ตั้งฉาก",
              hint: "เส้นที่ลากได้แค่แนวนอนกับแนวตั้ง ไม่มีทแยง เหมือน ORTHO ของ AutoCAD · เปิดพร้อมล็อกแนวเส้นได้ ตั้งฉากชนะ",
              key: "F8"
            })
          }
          onPointerLeave={() => setTip(null)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={ICONS.axes} />
          </svg>
        </button>
        {/*
          พอดีกรอบ — ปุ่มจริงบนแถบ ไม่ใช่ปุ่มลับที่มีแต่คนรู้คีย์ลัดถึงจะกดได้ (IP-239)

          `fitToStage` มีมาตั้งแต่ต้นและวางแบบไว้กลางกรอบพอดีอยู่แล้ว แต่เรียกได้ทางเดียว
          คือกด 0 หรือ F ซึ่งไม่มีอะไรบนจอบอกไว้เลย · คนที่ลากแบบเลื่อนไปจนหลงจึงไม่มีทางกลับ
          เจ้าของงานสั่งเองเมื่อ 2026-09-05 ว่า "เมื่อเรากดปุ่ม fit มันก็มาอยู่จุดนี้เสมอ
          ยึดกลางแบบปักหลักเลย" · การลากเลื่อนตอนซูมเข้ายังทำได้เหมือนเดิม ปุ่มนี้แค่พาก
          กลับมาที่หลักเมื่อไหร่ก็ได้
        */}
        <button
          type="button"
          className="mk__icon"
          onClick={() => (doc ? fitToStage() : explainBlock())}
          aria-disabled={!doc || undefined}
          aria-label="พอดีกรอบ"
          onPointerEnter={(event) =>
            showTip(event, {
              label: "พอดีกรอบ",
              hint: "ย่อขยายให้เห็นแบบทั้งแผ่นแล้ววางไว้กลางกรอบ กดเมื่อไหร่ก็กลับมาที่เดิมเสมอ",
              key: "F"
            })
          }
          onPointerLeave={() => setTip(null)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={ICONS.fit} />
          </svg>
        </button>
        <button
          type="button"
          className="mk__icon"
          aria-pressed={sharpOn}
          onClick={() => setSharpOn((on) => !on)}
          aria-label="ความคมชัด"
          onPointerEnter={(event) =>
            showTip(event, {
              label: "ความคมชัด",
              hint: "วาดแบบละเอียดเท่าที่จอทำได้ ชัดขึ้นตอนตั้งสเกลและลากเส้น ตัวเลขที่วัดไม่เปลี่ยน",
              key: "Q"
            })
          }
          onPointerLeave={() => setTip(null)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={ICONS.sharp} />
          </svg>
        </button>
        <span className="mk__scale-state">สเกลหน้า {page}: {pageScale ? formatScaleRatio(pageScale) : "ยังไม่ตั้ง"}</span>
        {/* ล้างสเกลของหน้า — ที่ผ่านมาสเกลตั้งได้ ตั้งทับได้ แต่เอาออกไม่ได้ หน้าที่เผลอตั้งผิด
            จึงติดค้างไปตลอด และตัวตนของแบบคิดจาก checksum ของเนื้อไฟล์ สเกลที่ค้างจึงตามไป
            ทุกที่ที่เปิดไฟล์นั้น · ปุ่มโผล่เฉพาะตอนหน้ามีสเกลแล้ว ไม่งั้นมันคือปุ่มที่ไม่ทำอะไร */}
        {pageScale ? (
          <button
            type="button"
            className="mk__scale-clear"
            onClick={() => void clearScale()}
            disabled={Boolean(clearScaleBlockedBy)}
            onPointerEnter={(event) =>
              showTip(event, {
                label: "ล้างสเกลของหน้านี้",
                hint:
                  clearScaleBlockedBy ??
                  `หน้านี้กลับไปเป็น "ยังไม่ตั้ง" เครื่องมือวัดจะกดไม่ได้จนกว่าจะตั้งใหม่${marksOnPage.length > 0 ? ` · รอยวัด ${marksOnPage.length} อันบนหน้านี้ยังอยู่ แต่บอกความยาวไม่ได้จนกว่าจะตั้งสเกลใหม่` : ""} · รายการที่ส่งเข้าถอดปริมาณแล้วไม่กระทบ เพราะมันก๊อปสเกลไปตอนส่ง`
              })
            }
            onPointerLeave={() => setTip(null)}
          >
            ล้างสเกล
          </button>
        ) : null}
        <button
          type="button"
          className="mk__icon"
          aria-pressed={panelOn}
          onClick={() => setPanelOn((on) => !on)}
          aria-label="แผงรายการวัด"
          onPointerEnter={(event) =>
            showTip(event, { label: "แผงรายการวัด", hint: "เปิดปิดแผงขวาที่แสดงรายการที่วัดแล้วและยอดรวม", key: "2" })
          }
          onPointerLeave={() => setTip(null)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={ICONS.panel} />
          </svg>
        </button>
      </div>

      {/*
        คำตอบของปุ่มที่ยังทำงานไม่ได้ — ขึ้นตอนที่คนกดมันจริง ๆ ไม่ใช่ขึ้นค้างไว้ก่อน (IP-236 → IP-241)

        **เดิมเป็นแถบพาทัวร์ที่ขึ้นค้าง** ทันทีที่มีอะไรล็อกอยู่ กินความสูง 65px ตลอดเวลา
        จนกว่าจะตั้งสเกลเสร็จ · แถบนั้นเกิดมาเพื่อชดเชยว่าเครื่องมือดับแล้วไม่ยอมบอกเหตุผล
        ซึ่งเป็นการแก้ที่ปลายทาง · borntodev เขียนไว้ว่า **"หลีกเลี่ยง Disable ควรให้ผู้ใช้กดได้
        แล้วแสดงข้อความแจ้งหากมีข้อผิดพลาด"** พอปุ่มตอบเองได้ แถบที่ขึ้นค้างก็ซ้ำซ้อน
        เจ้าของงานเคาะให้เปลี่ยนเมื่อ 2026-09-05 · **ผืนวาดได้ความสูงคืน 65px ตอนที่ยังไม่มีใครถาม**

        **ยังใช้เนื้อหาชุดเดิมจาก `drawing-tour.ts`** ไม่ได้เขียนคำใหม่ เพราะคำเหล่านั้นผ่าน
        การเคาะมาแล้วและมีเทสต์เฝ้าอยู่ · ที่เปลี่ยนคือจังหวะที่มันโผล่ ไม่ใช่สิ่งที่มันพูด

        **มีปุ่มปิดได้แล้ว** เพราะคำอธิบายไม่ได้หายไปจากระบบตอนปิด มันกลับไปอยู่ที่ปุ่ม
        ซึ่งกดใหม่เมื่อไหร่ก็ตอบอีก · เหตุผลเดิมที่ห้ามมีปุ่มปิดคือกลัวคนปิดแล้วไม่เหลือคำอธิบาย
        ที่ไหนเลย ซึ่งไม่จริงอีกต่อไป
      */}
      {blockedNotice ? (
        <div className="mk__tour" role="status">
          <span className="mk__tour-step">
            ขั้น <b className="mk__tour-num">{blockedNotice.index}</b> จาก{" "}
            <b className="mk__tour-num">{blockedNotice.total}</b>
          </span>
          <span className="mk__tour-text">
            <strong>{blockedNotice.title}</strong>
            <em>{blockedNotice.reason}</em>
            <span>{blockedNotice.action}</span>
            {blockedNotice.alternative ? <small>{blockedNotice.alternative}</small> : null}
          </span>
          {blockedNotice.target === "open" ? (
            /* กดแทนคนที่ช่องเลือกไฟล์ตัวเดิม ไม่ผูกเป็น <label> ตัวที่สอง เพราะเบราว์เซอร์
               เอาคำของ label ทุกตัวมาต่อกันเป็นชื่อของช่อง ปุ่มไอคอนบนแถบเครื่องมือจะถูก
               อ่านออกเสียงว่า "เปิดแบบ PDF เลือกไฟล์แบบ" ซึ่งไม่ใช่ชื่อของมัน */
            <Button tone="primary" onClick={() => openInputRef.current?.click()}>
              {blockedNotice.actionLabel}
            </Button>
          ) : (
            <Button tone="primary" onClick={() => pickTool("scale")}>
              {blockedNotice.actionLabel}
            </Button>
          )}
          <Button tone="plain" onClick={() => setAskedFor(null)}>
            ปิด
          </Button>
        </div>
      ) : null}

      {pendingRoom ? (
        <div className="mk__confirm" role="status">
          {/*
            แถบนี้บอกแค่พื้นที่ ส่วนวิธีคิดไปอยู่บนแบบ (IP-238)

            เจ้าของงานถามว่า "3.98 มาจากไหน" ทั้งที่เส้นบอกระยะเขียนว่าช่วงนี้ 2.50 × 2.00
            รอบแรกผมตอบด้วยการเขียนวิธีคิดเป็นตัวหนังสือลงในแถบนี้ ซึ่งทำให้แถบสูงขึ้น
            เป็นสี่บรรทัดและกินพื้นที่แบบไปเปล่า ๆ · เขาเคาะว่า **ให้วาดเส้นบอกระยะทับรูป
            ที่ไล่ได้บนแบบเลย** แล้วแถบนี้เหลือแค่พื้นที่ให้กดยอมรับ

            เหตุผลที่ดีกว่าคือคนที่กำลังตัดสินใจกดยอมรับ กำลังมองแบบอยู่ ไม่ได้มองแถบ
            เส้นบอกระยะที่วาดทับรูปตอบคำถาม "กว้างเท่าไหร่ ยาวเท่าไหร่" ตรงที่ตาเขาอยู่แล้ว
            และตอบด้วยภาษาเดียวกับที่แบบก่อสร้างใช้บอกระยะอยู่แล้วทั้งแผ่น
          */}
          <span className="mk__confirm-lead">
            พื้นที่ห้องที่ไล่ได้ <b className="mk__num">{formatMetres(pendingValue?.areaSquareMetres ?? 0)}</b> ตร.ม.
            <em>วัดถึงผิวผนังด้านใน ไม่ใช่กึ่งกลางเสา</em>
          </span>
          <input
            className="mk__confirm-name"
            value={pendingRoom.name}
            placeholder="ตั้งชื่อห้อง เช่น ห้องแยก"
            aria-label="ชื่อห้อง"
            onChange={(event) => setPendingRoom({ ...pendingRoom, name: event.target.value })}
          />
          <strong>ดูรูปบนแบบว่าตรงกับห้องจริงก่อนยืนยัน ถ้าสีทะลุออกนอกห้องให้ยกเลิกแล้วคลิกไล่มุมแทน</strong>
          <button type="button" onClick={confirmRoom}>ยืนยันพื้นที่นี้</button>
          <button type="button" onClick={() => setPendingRoom(null)}>ยกเลิก</button>
        </div>
      ) : null}

      {/*
        ช่วงระหว่างแนวของสี่เหลี่ยมที่เลือกอยู่ — ขึ้นเฉพาะเมื่อมีเลขที่แบบเขียนพาดช่วงนั้นจริง

        ขึ้นตรงนี้เพราะเจ้าของงานต้องเห็น **ที่มาของเลข** ตอนที่ยังมองแบบอยู่ ไม่ใช่ไปเห็น
        ตอนกดส่งเข้าถอดปริมาณแล้ว · ถ้าไม่มีเส้นบอกระยะพาดช่วงนี้ แถบนี้ไม่ขึ้น และตัวเลข
        ในแผงรายการวัดยังเป็นเลขที่คำนวณจากพิกเซลตามเดิม ซึ่งบอกไว้ตรง ๆ ว่าคำนวณมา
      */}
      {selectedBay ? (
        <div className="mk__confirm" role="status">
          <span>
            {bayLabel(selectedBay) ? `ช่วง ${bayLabel(selectedBay)} · ` : ""}
            {formatMetres(selectedBay.across.metres)} × {formatMetres(selectedBay.down.metres)} ={" "}
            {formatMetres(selectedBay.areaSquareMetres)} ตร.ม.
            <small> ใช้เลขที่แบบเขียนบนเส้นบอกระยะ ไม่ใช่เลขที่วัดจากภาพ</small>
          </span>
          <strong>{bayExplanation(selectedBay)}</strong>
        </div>
      ) : null}

      {/* แถวสาม — ราง ที่จับ แบบ ที่จับ แผงขวา */}
      <div
        className="mk__body"
        style={{ ["--mk-rail" as string]: `${railOn ? RAIL_WIDTH : 0}px`, ["--mk-panel" as string]: `${panelOn ? PANEL_WIDTH : 0}px` }}
        data-rail={railOn ? "on" : "off"}
        data-panel={panelOn ? "on" : "off"}
      >
        <aside className="mk__rail" aria-label="หน้าของแบบ">
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
            <button
              key={number}
              type="button"
              className="mk__thumb"
              aria-current={number === page ? "page" : undefined}
              onClick={() => goToPage(number)}
            >
              {thumbs[number] ? (
                // eslint-disable-next-line @next/next/no-img-element -- รูปย่อสร้างในเบราว์เซอร์เป็น data URL ตัวปรับขนาดของ Next แตะไม่ได้
                <img src={thumbs[number]} alt="" />
              ) : (
                <span className="mk__thumb-blank" aria-hidden="true" />
              )}
              <b>หน้า {number}</b>
              <span>{scales[number] ? formatScaleRatio(scales[number]) : "ยังไม่ตั้งสเกล"}</span>
            </button>
          ))}
        </aside>

        <div
          className="mk__stage"
          ref={stageRef}
          data-tool={tool}
          data-dragging={panRef.current ? "true" : undefined}
          onPointerMove={handleMove}
          onPointerDown={handleDown}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          onPointerLeave={() => setHover(null)}
          onWheel={handleWheel}
          onDoubleClick={handleDoubleClick}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files?.[0];
            if (file) void openFile(file);
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            if (tool === "gridline" || tool === "dimension") {
              setPendingRefStart(null);
              return;
            }
            finish();
          }}
        >
          {doc ? null : <p className="mk__drop">ลากไฟล์ PDF วางที่นี่ หรือกดปุ่มเปิดแบบด้านบน</p>}
          <div
            className="mk__sheet"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
              width: pageSize.width,
              height: pageSize.height
            }}
          >
            {/* ชั้นฐาน — ทั้งหน้าที่สเกลคงที่ ยืดด้วย CSS ให้เต็มแผ่นเสมอ จอจึงไม่มีวันว่าง */}
            <canvas
              ref={baseCanvasRef}
              style={{ width: pageSize.width, height: pageSize.height }}
            />
            {/* ชั้นคม — วางทับเฉพาะกรอบที่ถ่ายไว้ล่าสุด นอกกรอบยังเห็นชั้นฐาน */}
            <canvas
              ref={sharpCanvasRef}
              className="mk__sharp"
              style={
                sharpCrop
                  ? {
                      display: "block",
                      insetInlineStart: sharpCrop.x,
                      insetBlockStart: sharpCrop.y,
                      width: sharpCrop.width,
                      height: sharpCrop.height
                    }
                  : { display: "none" }
              }
            />
            {pageSize.width > 0 ? (
              <svg
                className="mk__overlay"
                viewBox={`0 0 ${pageSize.width} ${pageSize.height}`}
                width={pageSize.width}
                height={pageSize.height}
                aria-hidden="true"
              >
                <defs>
                  <marker id="mk-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                    <path d="M0 0 10 5 0 10z" fill="var(--dimension-red)" />
                  </marker>
                </defs>
                {measurements
                  .filter((item) => item.page === page)
                  .map((item) => {
                    const outline = outlinePoints(item);
                    const closed = item.kind === "area" || item.kind === "rect";
                    if (item.kind === "count") {
                      return outline.map((point, index) => (
                        <circle key={`${item.id}-${index}`} cx={point.x} cy={point.y} r={stroke(4)} fill={item.colour} />
                      ));
                    }
                    const points = outline.map((point) => `${point.x},${point.y}`).join(" ");
                    return closed ? (
                      <polygon
                        key={item.id}
                        points={points}
                        fill={item.colour}
                        fillOpacity={0.18}
                        stroke={item.colour}
                        strokeWidth={stroke(item.id === selectedId ? 3 : 1.5)}
                      />
                    ) : (
                      <polyline
                        key={item.id}
                        points={points}
                        fill="none"
                        stroke={item.colour}
                        strokeWidth={stroke(item.id === selectedId ? 3 : 1.5)}
                      />
                    );
                  })}

                {/* จุดที่นับไว้แล้วในรอบนี้ขึ้นเป็นวงกลม ไม่ลากเส้นต่อกัน เพราะการนับไม่มีเส้น */}
                {tool === "count"
                  ? draft.map((point, index) => (
                      <circle
                        key={`draft-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r={stroke(4)}
                        fill="none"
                        stroke="var(--orange)"
                        strokeWidth={stroke(1.5)}
                      />
                    ))
                  : null}

                {tool !== "count" && draftPreview ? (
                  <polyline
                    points={draftPreview.map((point) => `${point.x},${point.y}`).join(" ")}
                    fill="none"
                    stroke="var(--orange)"
                    strokeWidth={stroke(1.5)}
                    strokeDasharray={`${stroke(6)} ${stroke(4)}`}
                  />
                ) : null}

                {/* รูปห้องที่รอคนยืนยัน วาดด้วยเส้นประเพื่อให้ต่างจากรายการที่เข้าตารางแล้ว */}
                {pendingRoom && pendingRoom.page === page ? (
                  <polygon
                    points={pendingRoom.points.map((point) => `${point.x},${point.y}`).join(" ")}
                    fill="var(--orange)"
                    fillOpacity={0.18}
                    stroke="var(--orange)"
                    strokeWidth={stroke(2)}
                    strokeDasharray={`${stroke(6)} ${stroke(4)}`}
                  />
                ) : null}

                {/*
                  เส้นบอกระยะของรูปที่รอยืนยัน — วิธีคิดของพื้นที่ที่วาดให้ดูตรงที่ตาคนอยู่ (IP-238)

                  เจ้าของงานสั่งเองเมื่อ 2026-09-05 ว่า "ต้องวัดแบบนี้ให้ดูด้วยว่ามันได้กว้าง
                  เท่าไหร่ × ยาวเท่าไหร่ = พื้นที่ห้องจริงที่แสดงด้านบน" แล้วส่งรูปที่เขาขีดลูกศร
                  แดงคร่อมรูปที่ไล่ได้มาให้ · คนที่กำลังตัดสินใจกดยอมรับกำลังมองแบบอยู่
                  ไม่ได้มองแถบด้านบน คำอธิบายจึงต้องอยู่บนแบบ

                  ขนาดทุกอย่างหารด้วย `view.scale` เหมือนเส้นบอกระยะที่มีอยู่แล้ว เส้นกับตัวหนังสือ
                  จึงหนาและใหญ่เท่าเดิมบนจอทุกระดับซูม ส่วนตำแหน่งเลื่อนตามรูปเพราะอิงพิกัดกระดาษ
                */}
                {pendingRoom && pendingRoom.page === page && roomWorking ? (
                  (() => {
                    const { minX, maxX, minY, maxY } = roomWorking.bounds;
                    const gap = stroke(26);
                    const tick = stroke(5);
                    // ตัวหนังสือมีขอบสีกระดาษล้อมไว้ ไม่งั้นมันจมหายไปในเส้นของแบบที่อยู่ข้างใต้
                    const halo = { paintOrder: "stroke", stroke: "var(--paper)", strokeWidth: stroke(3.4), strokeLinejoin: "round" } as const;
                    const lineY = maxY + gap;
                    const lineX = maxX + gap;
                    return (
                      <g className="mk__roomdim">
                        {/* เส้นต่อจากมุมรูปออกไปหาเส้นบอกระยะ แบบเดียวกับที่แบบก่อสร้างเขียน */}
                        <line x1={minX} y1={maxY} x2={minX} y2={lineY + tick} stroke="var(--dimension-red)" strokeWidth={stroke(0.9)} />
                        <line x1={maxX} y1={maxY} x2={maxX} y2={lineY + tick} stroke="var(--dimension-red)" strokeWidth={stroke(0.9)} />
                        <line x1={maxX} y1={minY} x2={lineX + tick} y2={minY} stroke="var(--dimension-red)" strokeWidth={stroke(0.9)} />
                        <line x1={maxX} y1={maxY} x2={lineX + tick} y2={maxY} stroke="var(--dimension-red)" strokeWidth={stroke(0.9)} />

                        <line
                          x1={minX}
                          y1={lineY}
                          x2={maxX}
                          y2={lineY}
                          stroke="var(--dimension-red)"
                          strokeWidth={stroke(1.4)}
                          markerStart="url(#mk-arrow)"
                          markerEnd="url(#mk-arrow)"
                        />
                        <text
                          x={(minX + maxX) / 2}
                          y={lineY - stroke(6)}
                          fill="var(--dimension-red)"
                          fontSize={stroke(12)}
                          fontWeight={700}
                          textAnchor="middle"
                          style={halo}
                        >
                          {formatMetres(roomWorking.widthMetres)}
                        </text>

                        <line
                          x1={lineX}
                          y1={minY}
                          x2={lineX}
                          y2={maxY}
                          stroke="var(--dimension-red)"
                          strokeWidth={stroke(1.4)}
                          markerStart="url(#mk-arrow)"
                          markerEnd="url(#mk-arrow)"
                        />
                        <text
                          x={lineX + stroke(6)}
                          y={(minY + maxY) / 2}
                          fill="var(--dimension-red)"
                          fontSize={stroke(12)}
                          fontWeight={700}
                          dominantBaseline="middle"
                          style={halo}
                        >
                          {formatMetres(roomWorking.depthMetres)}
                        </text>

                        {/* ผลคูณเขียนไว้ใต้เส้นล่าง ให้เห็นว่าเลขบนแถบมาจากสองเลขนี้ */}
                        <text
                          x={(minX + maxX) / 2}
                          y={lineY + stroke(16)}
                          fill="var(--dimension-red)"
                          fontSize={stroke(11)}
                          fontWeight={700}
                          textAnchor="middle"
                          style={halo}
                        >
                          {formatMetres(roomWorking.widthMetres)} × {formatMetres(roomWorking.depthMetres)} ={" "}
                          {formatMetres(pendingValue?.areaSquareMetres ?? 0)} ตร.ม.
                        </text>
                      </g>
                    );
                  })()
                ) : null}

                {calibrationPoints.length > 0 ? (
                  <polyline
                    points={[...calibrationPoints, ...(hover && calibrationPoints.length < 2 ? [hover] : [])]
                      .map((point) => `${point.x},${point.y}`)
                      .join(" ")}
                    fill="none"
                    stroke="var(--orange)"
                    strokeWidth={stroke(2)}
                  />
                ) : null}

                {/*
                  แนวเสาที่ผู้ใช้ร่างเอง — เส้นประสีเทาแบบเส้นศูนย์กลาง
                  ตามที่เจ้าของงานสั่ง 2026-09-02 และตรงกับธรรมเนียมของแบบก่อสร้าง
                  ที่เขียนแนวเสาเป็นเส้นศูนย์กลาง ขีดยาวสลับจุด ไม่ใช่เส้นทึบ
                  เส้นทึบเป็นของจริงที่ก่อสร้างได้ ส่วนแนวเสาเป็นเส้นอ้างอิงที่ไม่มีอยู่จริงบนพื้น
                */}
                {namedGridLines.map((line) => (
                  <g key={line.id}>
                    {/* เส้นใสหนากว่าเดิม วางใต้เส้นจริง เพื่อให้นิ้วบนแท็บเล็ตแตะโดนได้
                        โดยที่เส้นที่ตาเห็นยังบางเท่าเดิม — ระยะผ่อนผันของการคลิกอยู่ที่
                        `HIT_RADIUS_PX` ซึ่งเป็นตัวเลขเดียวกัน ไม่ใช่คนละค่ากับที่ตาเห็น */}
                    <line
                      x1={line.a.x}
                      y1={line.a.y}
                      x2={line.b.x}
                      y2={line.b.y}
                      stroke="transparent"
                      strokeWidth={stroke(HIT_RADIUS_PX)}
                    />
                    <line
                      x1={line.a.x}
                      y1={line.a.y}
                      x2={line.b.x}
                      y2={line.b.y}
                      stroke={selectedGuide?.id === line.id ? "var(--orange)" : "var(--muted)"}
                      strokeWidth={stroke(selectedGuide?.id === line.id ? 2.4 : 1)}
                      strokeDasharray={`${stroke(14)} ${stroke(4)} ${stroke(2)} ${stroke(4)}`}
                    />
                    <circle
                      cx={line.a.x}
                      cy={line.a.y}
                      r={stroke(9)}
                      fill="var(--paper)"
                      stroke={selectedGuide?.id === line.id ? "var(--orange)" : "var(--muted)"}
                      strokeWidth={stroke(selectedGuide?.id === line.id ? 2 : 1)}
                    />
                    <text
                      x={line.a.x}
                      y={line.a.y}
                      fill="var(--muted)"
                      fontSize={stroke(11)}
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {line.label}
                    </text>
                  </g>
                ))}

                {/* จุดตัดของแนวเสา — จุดจริงที่ใช้อ้างตำแหน่งและใช้นับฐานราก จึงทึบให้เห็นชัด */}
                {intersections.map((node) => (
                  <circle
                    key={node.label}
                    cx={node.point.x}
                    cy={node.point.y}
                    r={stroke(2.4)}
                    fill="var(--ink-body)"
                  />
                ))}

                {/* ระยะที่แบบเขียนกำกับ สีแดง หัวลูกศรสองหัว พร้อมค่าที่คนอ่านมาจากแบบ */}
                {dimensions
                  .filter((item) => item.page === page)
                  .map((item) => {
                    const middle = { x: (item.a.x + item.b.x) / 2, y: (item.a.y + item.b.y) / 2 };
                    const gap = dimensionDisagreement(item, pageScale);
                    const drifted = gap !== null && Math.abs(gap.differenceM) >= 0.005;
                    const picked = selectedGuide?.id === item.id;
                    return (
                      <g key={item.id}>
                        {/* เส้นใสสำหรับให้แตะโดน เหตุผลเดียวกับแนวเสา */}
                        <line
                          x1={item.a.x}
                          y1={item.a.y}
                          x2={item.b.x}
                          y2={item.b.y}
                          stroke="transparent"
                          strokeWidth={stroke(HIT_RADIUS_PX)}
                        />
                        {picked ? (
                          <line
                            x1={item.a.x}
                            y1={item.a.y}
                            x2={item.b.x}
                            y2={item.b.y}
                            stroke="var(--orange)"
                            strokeWidth={stroke(5)}
                            strokeLinecap="round"
                            opacity={0.45}
                          />
                        ) : null}
                        <line
                          x1={item.a.x}
                          y1={item.a.y}
                          x2={item.b.x}
                          y2={item.b.y}
                          stroke="var(--dimension-red)"
                          strokeWidth={stroke(picked ? 2.2 : 1.4)}
                          markerStart="url(#mk-arrow)"
                          markerEnd="url(#mk-arrow)"
                        />
                        <text
                          x={middle.x}
                          y={middle.y - stroke(6)}
                          fill="var(--dimension-red)"
                          fontSize={stroke(11)}
                          textAnchor="middle"
                        >
                          {formatMetres(item.valueM)} ม.
                          {drifted ? ` (วัดได้ ${formatMetres(gap.measuredM)})` : ""}
                        </text>
                      </g>
                    );
                  })}

                {/*
                  กรอบลบที่กำลังลากอยู่ (IP-242)

                  เส้นทึบคือคลุมทั้งชิ้น เส้นประคือแตะก็พอ — ต่างกันที่ลายเส้น ไม่ใช่ที่สีอย่างเดียว
                  เพราะคนตาบอดสีแยกสีไม่ออกแต่แยกลายเส้นออก · ใช้สีแดงของเส้นบอกระยะ
                  ซึ่งเป็นสีเดียวในธีมที่แปลว่า "ระวัง" อยู่แล้ว
                */}
                {marquee ? (
                  <rect
                    x={marquee.minX}
                    y={marquee.minY}
                    width={marquee.maxX - marquee.minX}
                    height={marquee.maxY - marquee.minY}
                    fill="var(--dimension-red)"
                    fillOpacity={0.08}
                    stroke="var(--dimension-red)"
                    strokeWidth={stroke(1.4)}
                    strokeDasharray={marquee.mode === "crossing" ? `${stroke(6)} ${stroke(4)}` : undefined}
                  />
                ) : null}

                {/* จุดแรกของเส้นแนวเสาหรือเส้นระยะที่ยังลากไม่จบ */}
                {pendingRefStart ? (
                  <g>
                    <circle
                      cx={pendingRefStart.x}
                      cy={pendingRefStart.y}
                      r={stroke(4)}
                      fill="none"
                      stroke={tool === "gridline" ? "var(--muted)" : "var(--dimension-red)"}
                      strokeWidth={stroke(1.6)}
                    />
                    {hover ? (
                      <line
                        x1={pendingRefStart.x}
                        y1={pendingRefStart.y}
                        x2={hover.x}
                        y2={hover.y}
                        stroke={tool === "gridline" ? "var(--muted)" : "var(--dimension-red)"}
                        strokeWidth={stroke(1.2)}
                        strokeDasharray={`${stroke(6)} ${stroke(4)}`}
                      />
                    ) : null}
                  </g>
                ) : null}

                {/* จุดที่ดูดติดอยู่ตอนนี้ — ผู้ใช้ต้องเห็นก่อนกด ไม่ใช่รู้ตัวหลังจากคลิกไปแล้ว */}
                {snapHit ? (
                  <g>
                    <circle
                      cx={snapHit.point.x}
                      cy={snapHit.point.y}
                      r={stroke(7)}
                      fill="none"
                      stroke="var(--orange)"
                      strokeWidth={stroke(2)}
                    />
                    <circle cx={snapHit.point.x} cy={snapHit.point.y} r={stroke(1.6)} fill="var(--orange)" />
                  </g>
                ) : null}
              </svg>
            ) : null}
          </div>
        </div>

        <aside className="mk__panel" aria-label="รายการที่วัดแล้ว">
          <div className="mk__panel-head">
            รายการที่วัดแล้ว
            <span>{measurements.length} รายการ</span>
          </div>
          <MeasurementRegister
            summary={summary}
            selectedId={selectedId}
            currentPage={page}
            onGoToPage={goToPage}
            evidenceFor={evidenceFor}
            onSelect={setSelectedId}
            filedIds={filedIds}
            onFile={(id) => void openFiling(id)}
            onRename={(id, name) => {
              if (filedIds.has(id)) return;
              commit(measurements.map((item) => (item.id === id ? { ...item, name } : item)));
            }}
            onRemove={(id) => {
              if (filedIds.has(id)) {
                setRegionError("รายการนี้ส่งเข้าถอดปริมาณแล้ว ลบได้จากหน้าถอดปริมาณ");
                return;
              }
              commit(measurements.filter((item) => item.id !== id));
            }}
          />
          {/*
            เส้นอ้างอิงของหน้านี้ พร้อมปุ่มลบทีละเส้น (IP-242)

            **ทำไมต้องมีรายการ ทั้งที่ปุ่มลบมีอยู่แล้ว** ปุ่ม "ลบเส้นนี้" โผล่เฉพาะตอนที่คลิกโดน
            ตัวเส้นพอดี ซึ่งเส้นแนวเสาหนาหนึ่งพิกเซลและเส้นระยะก็บาง คลิกให้โดนยากมากบนแท็บเล็ต
            · เจ้าของงานถามเองเมื่อ 2026-09-05 ว่า "ปุ่มลบเส้นที่ไม่ต้องการล่ะ ทำไมไม่มี"
            ซึ่งแปลว่าเส้นทางที่มีอยู่หาไม่เจอ เท่ากับไม่มี

            **ลบจากรายการไม่ต้องเลือกก่อน** แต่ชี้ค้างที่แถวแล้วเส้นบนแบบสว่างขึ้น คนจึงเห็นว่า
            กำลังจะลบเส้นไหนก่อนกด · เป็นวิธีเดียวกับที่แผงรายการวัดทำอยู่แล้ว
          */}
          {(namedGridLines.length > 0 || dimensionsOnPage.length > 0) ? (
            <div className="mk__guides">
              <div className="mk__panel-head">
                เส้นอ้างอิงบนหน้า {page}
                <span>{namedGridLines.length + dimensionsOnPage.length} เส้น</span>
              </div>
              <ul className="mk__guide-list">
                {namedGridLines.map((line) => (
                  <li key={line.id}>
                    <button
                      type="button"
                      className="mk__guide-pick"
                      aria-pressed={selectedGuide?.id === line.id}
                      onClick={() => setSelectedGuide({ kind: "gridline", id: line.id })}
                      onPointerEnter={() => setSelectedGuide({ kind: "gridline", id: line.id })}
                    >
                      แนวเสา <b>{line.label}</b>
                    </button>
                    <button
                      type="button"
                      className="mk__guide-drop"
                      onClick={() =>
                        commitWork({ gridLines: gridLines.filter((item) => item.id !== line.id) })
                      }
                    >
                      ลบ
                    </button>
                  </li>
                ))}
                {dimensionsOnPage.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="mk__guide-pick"
                      aria-pressed={selectedGuide?.id === item.id}
                      onClick={() => setSelectedGuide({ kind: "dimension", id: item.id })}
                      onPointerEnter={() => setSelectedGuide({ kind: "dimension", id: item.id })}
                    >
                      ระยะที่แบบเขียน <b className="mk__num">{formatMetres(item.valueM)}</b> ม.
                      {isScaleWitness(item) ? <em>เส้นที่ตั้งสเกลหน้านี้</em> : null}
                    </button>
                    <button
                      type="button"
                      className="mk__guide-drop"
                      onClick={() =>
                        commitWork({ dimensions: dimensions.filter((entry) => entry.id !== item.id) })
                      }
                    >
                      ลบ
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>

      {/*
        แถบเส้นที่เลือก — โผล่เฉพาะตอนเลือกเส้นอ้างอิงอยู่ (IP-235)

        อยู่เหนือแถบสถานะ ไม่ใช่ในแผงขวา เพราะเจ้าของงานเคาะเมื่อ 2026-09-05 ว่าไม่ควรเบียด
        พื้นที่ผืนวาด และไม่ควรแย่งความกว้างของแผงรายการ · แถบหายไปเองเมื่อคลิกที่ว่าง
      */}
      {selectedGuide ? (
        <div className="mk__picked" role="status">
          {selectedDimension ? (
            <>
              <span>
                เลือกอยู่ <b>เส้นระยะที่แบบเขียน {formatMetres(selectedDimension.valueM)} ม.</b>
              </span>
              {isScaleWitness(selectedDimension) ? (
                <span className="mk__picked-warn">
                  เส้นนี้คือเส้นที่ตั้งสเกลของหน้านี้ · ลบแล้วสเกลยังเท่าเดิม แต่จะไม่มีเส้นบอกว่าสเกลมาจากช่วงไหน
                </span>
              ) : null}
            </>
          ) : selectedGridLine ? (
            <span>
              เลือกอยู่ <b>แนวเสา {selectedGridLine.label}</b>
            </span>
          ) : (
            <span>เลือกอยู่ <b>เส้นอ้างอิงที่ไม่อยู่ในหน้านี้แล้ว</b></span>
          )}
          <button type="button" className="mk__picked-drop" onClick={removeSelectedGuide}>
            ลบเส้นนี้
          </button>
          <button type="button" className="mk__picked-keep" onClick={() => setSelectedGuide(null)}>
            ยกเลิกการเลือก
          </button>
        </div>
      ) : null}

      {/* แถวสี่ — แถบสถานะ */}
      <div className="mk__status">
        <span>เครื่องมือ <b>{TOOLS.find((entry) => entry.id === tool)?.label ?? "เลือก"}</b></span>
        <span>สเกล <b>{pageScale ? formatScaleRatio(pageScale) : "ยังไม่ตั้ง"}</b></span>
        <span>ดูดจุด <b>{snapSettings.enabled ? (snapHit ? snapKindLabel[snapHit.kind] : "เปิด") : "ปิด"}</b></span>
        <span>ตั้งฉาก <b>{orthoLock ? "เปิด (F8)" : "ปิด (F8)"}</b></span>
        <span>ล็อกแนวเส้น <b>{axisLock || shiftHeld ? "เปิด" : "ปิด (กด Shift ค้าง)"}</b></span>
        <span>พิกัด <b>{cursor ? `x: ${Math.round(cursor.x)}, y: ${Math.round(cursor.y)} px` : "—"}</b></span>
        <span>ความคมชัด <b>{sharpOn ? "เปิด" : "ปิด"}</b></span>
        <span className="mk__status-right">
          <span>หน้า <b>{pageCount === 0 ? "—" : `${page} จาก ${pageCount}`}</b></span>
          <span>ซูม <b>{Math.round(view.scale * 100)}%</b></span>
          {doc && saveStatus.kind !== "idle" ? (
            <span
              className="mk__status-save"
              data-state={saveStatus.kind}
              role="status"
            >
              {saveStatus.kind === "saving"
                ? "กำลังบันทึก"
                : saveStatus.kind === "saved"
                  ? `บันทึกแล้ว ${saveStatus.at ? savedAtFormat.format(saveStatus.at) : ""}`.trim()
                  : saveStatus.kind === "filed"
                    ? `ส่งเข้าถอดปริมาณแล้ว ${saveStatus.at ? savedAtFormat.format(saveStatus.at) : ""}`.trim()
                    : `บันทึกไม่สำเร็จ — ${saveStatus.message ?? ""}`.trim()}
            </span>
          ) : null}
        </span>
      </div>

      {loadError ? <p className="mk__alert" role="alert">{loadError}</p> : null}
      {regionError ? <p className="mk__alert" role="alert">{regionError}</p> : null}

      {tip ? (
        <div className="mk__tip" ref={positionTip} style={{ left: tipLeft, top: tip.top }} role="status">
          <b>
            {tip.title}
            {tip.key ? <kbd>{tip.key}</kbd> : null}
          </b>
          <small>{tip.hint}</small>
        </div>
      ) : null}

      {calibrationOpen ? (
        <div className="mk__dialog" role="dialog" aria-label="ตั้งสเกลของหน้าแบบ">
          <h2>ตั้งสเกลของหน้า {page}</h2>
          <p>
            ลากเส้นทาบระยะที่แบบเขียนบอกไว้แล้ว จากนั้นพิมพ์ระยะจริงตามที่แบบระบุ
            <strong> ห้ามให้ระบบเดาสเกลเอง สเกลผิดทำให้ทุกปริมาณในหน้านี้ผิดตามทั้งหมด</strong>
          </p>
          <p>ความยาวเส้นที่ลาก: {calibrationLength.toFixed(1)} หน่วยกระดาษ</p>
          <label>
            ระยะจริงตามที่แบบระบุ
            <input value={realDistance} onChange={(event) => setRealDistance(event.target.value)} inputMode="decimal" autoFocus />
          </label>
          <label>
            หน่วย
            <select value={unit} onChange={(event) => setUnit(event.target.value as ScaleUnit)}>
              {SCALE_UNITS.map((value) => (
                <option key={value} value={value}>
                  {scaleUnitLabel[value]}
                </option>
              ))}
            </select>
          </label>
          {calibrationError ? <p role="alert">{calibrationError}</p> : null}
          <div>
            <button type="button" onClick={applyCalibration}>ยืนยันสเกลนี้</button>
            <button type="button" onClick={cancelDraft}>ยกเลิก</button>
          </div>
        </div>
      ) : null}

      {pendingDimension ? (
        <div className="mk__dialog" role="dialog" aria-label="ระยะจริงที่แบบเขียนกำกับ">
          <h2>ระยะที่แบบเขียนไว้</h2>
          <p>
            พิมพ์ตัวเลขที่อ่านได้จากแบบตรงช่วงนี้
            <strong> เลขบนแบบคือเจตนาของผู้ออกแบบ ส่วนสเกลใต้รูปเชื่อไม่ได้เมื่อแบบถูกย่อขยายตอนพิมพ์</strong>
          </p>
          <p>ช่วงที่ชี้ยาว {distancePoints(pendingDimension.a, pendingDimension.b).toFixed(1)} หน่วยกระดาษ</p>
          <label>
            ระยะที่แบบเขียน
            <input
              value={dimensionValue}
              onChange={(event) => setDimensionValue(event.target.value)}
              inputMode="decimal"
              autoFocus
            />
          </label>
          <label>
            หน่วย
            <select
              value={dimensionUnit}
              onChange={(event) => setDimensionUnit(event.target.value as ScaleUnit)}
            >
              {SCALE_UNITS.map((value) => (
                <option key={value} value={value}>
                  {scaleUnitLabel[value]}
                </option>
              ))}
            </select>
          </label>
          {dimensionError ? <p role="alert">{dimensionError}</p> : null}
          <div>
            <button type="button" onClick={() => saveDimension(false)}>บันทึกระยะนี้</button>
            <button type="button" onClick={() => saveDimension(true)}>
              {pageScale ? "บันทึกและตั้งสเกลใหม่จากระยะนี้" : "บันทึกและตั้งสเกลหน้านี้จากระยะนี้"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingDimension(null);
                setDimensionError("");
              }}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      ) : null}

      {filing && filingWork ? (
        <div className="mk__dialog" role="dialog" aria-label="ส่งรายการวัดเข้าถอดปริมาณ">
          <h2>ส่งเข้าถอดปริมาณ</h2>
          <p>
            <strong>{filingWork.figure}</strong> — {filingWork.how}
          </p>
          <p>
            หมวดงานกับหน่วยเลือกจากรูปไม่ได้ ต้องเป็นคนตัดสิน รายการนี้จะกลายเป็นบรรทัดหนึ่งใน backup sheet
            พร้อมวิธีคิดข้างบนและจุดที่ชี้ ชี้กลับมาที่แบบได้เสมอ
          </p>
          <label>
            รายการ
            <input
              value={filing.description}
              onChange={(event) => setFiling({ ...filing, description: event.target.value })}
              list="mk-filing-items"
              autoFocus
            />
            <datalist id="mk-filing-items">
              {filing.openItems
                .filter((item) => item.unit === filing.unit && item.reviewState !== "confirmed")
                .map((item) => (
                  <option key={`${item.description}-${item.unit}`} value={item.description} />
                ))}
            </datalist>
          </label>
          <label>
            หมวดงาน
            <select value={filing.category} onChange={(event) => setFiling({ ...filing, category: event.target.value })}>
              <option value="">เลือกหมวดงาน</option>
              {TAKEOFF_CATEGORIES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            หน่วย
            {filing.mark.kind === "count" ? (
              <select value={filing.unit} onChange={(event) => setFiling({ ...filing, unit: event.target.value })}>
                <option value="">เลือกหน่วยนับ</option>
                {filingUnits.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            ) : (
              <input value={filingUnits[0]?.label ?? ""} readOnly aria-readonly="true" />
            )}
          </label>
          {filingMatch ? (
            <p role="status">
              {filingMatch.reviewState === "confirmed"
                ? "รายการชื่อนี้ยืนยันแล้ว ส่งเข้ารวมไม่ได้ ตั้งชื่อใหม่หรือปลดการยืนยันที่หน้าถอดปริมาณ"
                : "จะรวมเข้ากับรายการเดิมชื่อนี้ ปริมาณจะบวกเข้าไปเป็นอีกบรรทัด"}
            </p>
          ) : null}
          {filing.error ? <p role="alert">{filing.error}</p> : null}
          <div>
            <button type="button" onClick={() => void submitFiling()} disabled={filing.busy}>
              {filing.busy ? "กำลังส่ง" : "ส่ง"}
            </button>
            <button type="button" onClick={() => setFiling(null)} disabled={filing.busy}>
              ยกเลิก
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * **ไฟล์นี้ต้องส่งออกเฉพาะคอมโพเนนต์เท่านั้น**
 *
 * เคยมีสองอย่างส่งออกจากท้ายไฟล์นี้ คือ `draftLengthLabel` กับ `markupInternals` ซึ่งไม่มี
 * ไฟล์ไหนนำเข้าไปใช้เลยสักที่ แต่มันมีราคาที่แพงกว่าที่คิด — Fast Refresh ของ Next ยอมเปลี่ยน
 * โค้ดโดยไม่โหลดหน้าใหม่ได้ก็ต่อเมื่อโมดูลนั้นส่งออกแต่คอมโพเนนต์ React พอมีค่าอื่นปนออกไป
 * มันยอมแพ้แล้วสั่งโหลดใหม่ทั้งหน้าทุกครั้งที่ไฟล์นี้ถูกแก้
 *
 * 2026-09-04 เจ้าของงานเจอผลของมันเต็ม ๆ หน้าที่เปิดค้างข้ามการโหลดใหม่ 172 รอบสุดท้าย
 * หลุดจาก React ทั้งหน้า ปุ่มย้อนกลับ ปุ่มเครื่องมือ และคำอธิบายที่ควรเด้งตอนเอาเมาส์วาง
 * เงียบหมด เหลือแต่ผืนวาดที่ยังทำงานเพราะมันฟังเหตุการณ์เอง — อาการนี้อ่านไม่ออกเลยว่า
 * มาจากเรื่องนี้ ถ้าวันหน้าต้องเปิดค่าในนี้ให้เทสต์ระดับหน้าจอเรียก ให้ย้ายค่านั้นไปโมดูลของมันเอง
 * แล้วให้ทั้งคอมโพเนนต์กับเทสต์นำเข้าจากที่นั่น ห้ามส่งออกเพิ่มจากไฟล์นี้
 */
