"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MeasurementRegister } from "@/components/estimeter/markup/measurement-register";
import {
  hitTest,
  isComplete,
  isMeasurementKind,
  measure,
  measurementKindLabel,
  minimumPoints,
  outlinePoints,
  summarise,
  formatMetres,
  type Measurement,
  type MeasurementKind
} from "@/lib/drawing-measurement";
import { useDrawingLayers, type PdfDocument } from "@/components/estimeter/markup/use-drawing-layers";
import { toolNeedsScale, type Tool } from "@/lib/drawing-tools";
import { regionRejectionMessage, toGreyImage, traceRegion } from "@/lib/region-fill";
import {
  calibrate,
  calibrationRejectionMessage,
  distancePoints,
  formatScaleRatio,
  lockToAxis,
  polylineLengthPoints,
  SCALE_UNITS,
  scaleUnitLabel,
  type PagePoint,
  type PageScale,
  type ScaleUnit
} from "@/lib/drawing-scale";

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
    hint: "คลิกเพื่อเลือกสิ่งที่วัดไว้แล้ว ลากเพื่อเลื่อนแบบ",
    icon: "M4 3l7 17 2-7 7-2z"
  },
  {
    id: "pan",
    label: "เลื่อน",
    key: "H",
    hint: "ลากเพื่อเลื่อนแบบอย่างเดียว",
    icon: "M9 11V6a1.5 1.5 0 1 1 3 0v5m0-1V5a1.5 1.5 0 1 1 3 0v6m0-2a1.5 1.5 0 1 1 3 0v6a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L5 15a1.5 1.5 0 0 1 2.5-1.7L9 15"
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
  sharp: "M12 5v3M12 16v3M5 12h3M16 12h3M7.8 7.8l2 2M14.2 14.2l2 2M16.2 7.8l-2 2M9.8 14.2l-2 2M12 10a2 2 0 1 0 .01 0"
} as const;


const SNAP_RADIUS_PX = 8;
const DARK_ENOUGH = 140;
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
const RAIL_MIN = 110;
const RAIL_MAX = 320;
const PANEL_MIN = 240;
const PANEL_MAX = 560;

type Camera = { scale: number; x: number; y: number };
/** `centre` คือจุดกึ่งกลางของปุ่มที่ชี้อยู่ ไม่ใช่ตำแหน่งซ้ายของป้าย — ป้ายคำนวณตำแหน่งเองหลังวัดความกว้างจริง */
type TipState = { title: string; hint: string; key: string | null; centre: number; top: number } | null;

/** ระยะเผื่อจากขอบจอถึงป้ายลอย เท่ากับต้นแบบ viewer-controls-prototype */
const TIP_EDGE_GAP = 8;

const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

export function DrawingMarkup({ projectName, projectHref }: { projectName: string; projectHref: string }) {
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
  const [snapOn, setSnapOn] = useState(true);
  const [axisLock, setAxisLock] = useState(false);
  const [railOn, setRailOn] = useState(true);
  const [panelOn, setPanelOn] = useState(true);
  const [railWidth, setRailWidth] = useState(150);
  const [panelWidth, setPanelWidth] = useState(330);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [tip, setTip] = useState<TipState>(null);
  const [tipLeft, setTipLeft] = useState(0);

  const [scales, setScales] = useState<Record<number, PageScale>>({});
  const [draft, setDraft] = useState<PagePoint[]>([]);
  const [hover, setHover] = useState<PagePoint | null>(null);

  const [past, setPast] = useState<Measurement[][]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [future, setFuture] = useState<Measurement[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /**
   * รูปห้องที่เพิ่งไล่ได้ ยังไม่เข้ารายการวัดจนกว่าคนจะกดยืนยัน
   *
   * เจ้าของงานเคาะเมื่อ 2026-09-01 ว่าการเลือกพื้นที่ห้องต้องผ่านสายตาคนทุกครั้ง
   * เพราะการทะลุออกนอกห้องดูออกด้วยตาในหนึ่งวินาที แต่ถ้าไหลเข้าใบราคาไปแล้วไม่มีใครจับได้
   */
  const [pendingRoom, setPendingRoom] = useState<Measurement | null>(null);
  const panRef = useRef<{ x: number; y: number; view: Camera; moved: boolean } | null>(null);
  const splitRef = useRef<{ which: "rail" | "panel"; x: number; width: number } | null>(null);

  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState<PagePoint[]>([]);
  const [realDistance, setRealDistance] = useState("");
  const [unit, setUnit] = useState<ScaleUnit>("m");
  const [calibrationError, setCalibrationError] = useState("");

  const pageScale = scales[page] ?? null;

  /** ทุกการเปลี่ยนรายการวัดผ่านที่นี่ที่เดียว ประวัติจึงครบเสมอ ไม่มีทางลืมบันทึกบางการกระทำ */
  const commit = useCallback(
    (next: Measurement[]) => {
      setPast((history) => [...history, measurements]);
      setMeasurements(next);
      setFuture([]);
    },
    [measurements]
  );

  const undo = useCallback(() => {
    setPast((history) => {
      if (history.length === 0) return history;
      const previous = history[history.length - 1];
      setFuture((forward) => [measurements, ...forward]);
      setMeasurements(previous);
      return history.slice(0, -1);
    });
  }, [measurements]);

  const redo = useCallback(() => {
    setFuture((forward) => {
      if (forward.length === 0) return forward;
      setPast((history) => [...history, measurements]);
      setMeasurements(forward[0]);
      return forward.slice(1);
    });
  }, [measurements]);

  async function openFile(file: File) {
    setLoadError("");
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      const bytes = new Uint8Array(await file.arrayBuffer());
      const loaded = (await pdfjs.getDocument({ data: bytes }).promise) as unknown as PdfDocument;
      setDoc(loaded);
      setPageCount(loaded.numPages);
      setFileName(file.name);
      setPage(1);
      setScales({});
      setMeasurements([]);
      setPast([]);
      setFuture([]);
      setThumbs({});
      setPendingRoom(null);
    } catch (error) {
      setLoadError(`เปิดไฟล์ไม่ได้: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

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
    fitToStage();
  }, [fitToStage, page]);

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
  const snap = useCallback(
    (point: PagePoint): PagePoint => {
      const image = analysis?.image;
      const analysisScale = analysis?.scale ?? 0;
      if (!snapOn || !image || analysisScale <= 0) return point;
      const cx = Math.round(point.x * analysisScale);
      const cy = Math.round(point.y * analysisScale);
      const radius = Math.max(2, Math.round(SNAP_RADIUS_PX * (analysisScale / Math.max(view.scale, 0.01))));
      let best: { x: number; y: number; value: number } | null = null;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
          const offset = (y * image.width + x) * 4;
          const luminance = (image.data[offset] + image.data[offset + 1] + image.data[offset + 2]) / 3;
          if (luminance > DARK_ENOUGH) continue;
          const distance = Math.hypot(dx, dy);
          const score = luminance + distance * 8;
          if (!best || score < best.value) best = { x, y, value: score };
        }
      }
      return best ? { x: best.x / analysisScale, y: best.y / analysisScale } : point;
    },
    [analysis, snapOn, view.scale]
  );

  const resolvePoint = useCallback(
    (clientX: number, clientY: number, anchor: PagePoint | null): PagePoint | null => {
      const raw = toPagePoint(clientX, clientY);
      if (!raw) return null;
      const snapped = snap(raw);
      return axisLock && anchor ? lockToAxis(anchor, snapped) : snapped;
    },
    [axisLock, snap, toPagePoint]
  );

  const activeAnchor = tool === "scale" ? calibrationPoints.at(-1) ?? null : draft.at(-1) ?? null;

  function handleMove(event: React.PointerEvent<HTMLDivElement>) {
    const splitting = splitRef.current;
    if (splitting) {
      const delta = (event.clientX - splitting.x) * (splitting.which === "panel" ? -1 : 1);
      const next = splitting.width + delta;
      if (splitting.which === "rail") setRailWidth(Math.min(RAIL_MAX, Math.max(RAIL_MIN, next)));
      else setPanelWidth(Math.min(PANEL_MAX, Math.max(PANEL_MIN, next)));
      return;
    }
    const panning = panRef.current;
    if (panning) {
      const dx = event.clientX - panning.x;
      const dy = event.clientY - panning.y;
      if (Math.hypot(dx, dy) > DRAG_SLOP_PX) panning.moved = true;
      setView({ scale: panning.view.scale, x: panning.view.x + dx, y: panning.view.y + dy });
      return;
    }
    setHover(resolvePoint(event.clientX, event.clientY, activeAnchor));
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

    if (tool === "pan" || tool === "select") {
      startPan(event);
      if (tool === "pan") return;
      return;
    }

    const raw = toPagePoint(event.clientX, event.clientY);
    if (!raw) return;

    if (tool === "scale") {
      const point = resolvePoint(event.clientX, event.clientY, activeAnchor);
      if (!point) return;
      const next = [...calibrationPoints, point].slice(-2);
      setCalibrationPoints(next);
      if (next.length === 2) setCalibrationOpen(true);
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

    const point = resolvePoint(event.clientX, event.clientY, activeAnchor);
    if (!point) return;
    const next = [...draft, point];
    setDraft(next);

    // ชนิดที่มีจำนวนจุดตายตัวจบเองทันที ชนิดที่คลิกได้เรื่อย ๆ รอคลิกขวา ดับเบิลคลิก หรือ Enter
    const fixed = tool === "length" || tool === "rect" ? 2 : 0;
    if (fixed > 0 && next.length === fixed) finish(next);
  }

  function startPan(event: React.PointerEvent<HTMLDivElement>) {
    const stage = stageRef.current;
    if (!stage) return;
    panRef.current = { x: event.clientX, y: event.clientY, view, moved: false };
    stage.setPointerCapture(event.pointerId);
  }

  function handleUp(event: React.PointerEvent<HTMLDivElement>) {
    if (splitRef.current) {
      splitRef.current = null;
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
    const onThisPage = measurements.filter((item) => item.page === page);
    setSelectedId(hitTest(onThisPage, raw, HIT_RADIUS_PX / view.scale));
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
    if (tool === "select" || tool === "pan") {
      zoomAt(event.clientX, event.clientY, event.shiftKey ? 1 / ZOOM_STEP : ZOOM_STEP);
      return;
    }
    finish();
  }

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
    if (!analysis) {
      setPendingRoom(null);
      setRegionError("กำลังเตรียมภาพวิเคราะห์ของหน้านี้ ลองอีกครั้ง");
      return;
    }
    const { image, scale: analysisScale } = analysis;
    const grey = toGreyImage(image.data, image.width, image.height);
    const result = traceRegion(grey, { x: point.x * analysisScale, y: point.y * analysisScale });
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
      id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      page,
      kind: "area",
      name: "",
      points: polygon,
      colour: MEASUREMENT_COLOURS[measurements.length % MEASUREMENT_COLOURS.length]
    });
  }

  function confirmRoom() {
    if (!pendingRoom) return;
    commit([...measurements, pendingRoom]);
    setSelectedId(pendingRoom.id);
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
    const created: Measurement = {
      id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      page,
      kind,
      name: "",
      points,
      colour: MEASUREMENT_COLOURS[measurements.length % MEASUREMENT_COLOURS.length]
    };
    commit([...measurements, created]);
    setSelectedId(created.id);
    setDraft([]);
  }

  function cancelDraft() {
    setDraft([]);
    setCalibrationPoints([]);
    setCalibrationOpen(false);
    setPendingRoom(null);
    setRegionError("");
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
    setCalibrationError("");
    setCalibrationOpen(false);
    setCalibrationPoints([]);
    setRealDistance("");
    setTool("select");
  }

  function pickTool(next: Tool) {
    setDraft([]);
    setTool(next);
  }

  // คีย์ลัด — ตัวอักษรเดี่ยว ตัวเลข และ Escape เท่านั้น จึงไม่ชนคีย์ลัดของเบราว์เซอร์
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.key === "Shift") setAxisLock(true);
      if (event.key === "Escape") cancelDraft();
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
        setSnapOn((on) => !on);
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
      if (event.key === "Shift") setAxisLock(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  });

  const summary = useMemo(
    () => summarise(measurements, (target) => scales[target] ?? null),
    [measurements, scales]
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
          className="mk__icon mk__open"
          title="เปิดแบบ PDF"
          onPointerEnter={(event) => showTip(event, { label: "เปิดแบบ PDF", hint: "เลือกไฟล์แบบก่อสร้างจากเครื่องของคุณ" })}
          onPointerLeave={() => setTip(null)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={ICONS.open} />
          </svg>
          <span className="mk__sr">เปิดแบบ PDF</span>
          <input
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
            const locked = toolNeedsScale(entry.id) && !pageScale;
            return (
              <button
                key={entry.id}
                type="button"
                className="mk__icon"
                role="radio"
                aria-checked={tool === entry.id}
                aria-label={entry.label}
                disabled={locked || !doc}
                onClick={() => pickTool(entry.id)}
                onPointerEnter={(event) =>
                  showTip(event, { label: entry.label, hint: locked ? "ต้องตั้งสเกลของหน้านี้ก่อน" : entry.hint, key: entry.key })
                }
                onPointerLeave={() => setTip(null)}
                onFocus={(event) => showTip(event, { label: entry.label, hint: entry.hint, key: entry.key })}
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
        <button
          type="button"
          className="mk__icon"
          aria-pressed={snapOn}
          onClick={() => setSnapOn((on) => !on)}
          aria-label="ดูดจุด"
          onPointerEnter={(event) =>
            showTip(event, { label: "ดูดจุด", hint: "ให้ปลายเส้นวิ่งไปเกาะเส้นในแบบเอง แม่นกว่าเล็งด้วยตา", key: "N" })
          }
          onPointerLeave={() => setTip(null)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={ICONS.snap} />
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

      {pendingRoom ? (
        <div className="mk__confirm" role="status">
          <span>
            พื้นที่ห้องที่ไล่ได้ {formatMetres(pendingValue?.areaSquareMetres ?? 0)} ตร.ม.
            เส้นรอบรูป {formatMetres(pendingValue?.perimeterMetres ?? 0)} ม.
          </span>
          <strong>ดูรูปบนแบบว่าตรงกับห้องจริงก่อนยืนยัน ถ้าสีทะลุออกนอกห้องให้ยกเลิกแล้วคลิกไล่มุมแทน</strong>
          <button type="button" onClick={confirmRoom}>ยืนยันพื้นที่นี้</button>
          <button type="button" onClick={() => setPendingRoom(null)}>ยกเลิก</button>
        </div>
      ) : null}

      {/* แถวสาม — ราง ที่จับ แบบ ที่จับ แผงขวา */}
      <div
        className="mk__body"
        style={{ ["--mk-rail" as string]: `${railOn ? railWidth : 0}px`, ["--mk-panel" as string]: `${panelOn ? panelWidth : 0}px` }}
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
              onClick={() => {
                setDraft([]);
                setPendingRoom(null);
                setPage(number);
              }}
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
          className="mk__splitter mk__splitter--rail"
          role="separator"
          aria-orientation="vertical"
          aria-label="ปรับความกว้างรางหน้าแบบ"
          tabIndex={0}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            splitRef.current = { which: "rail", x: event.clientX, width: railWidth };
          }}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            setRailWidth((width) => Math.min(RAIL_MAX, Math.max(RAIL_MIN, width + (event.key === "ArrowRight" ? 12 : -12))));
          }}
        />

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
              </svg>
            ) : null}
          </div>
        </div>

        <div
          className="mk__splitter mk__splitter--panel"
          role="separator"
          aria-orientation="vertical"
          aria-label="ปรับความกว้างแผงรายการวัด"
          tabIndex={0}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            splitRef.current = { which: "panel", x: event.clientX, width: panelWidth };
          }}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            setPanelWidth((width) => Math.min(PANEL_MAX, Math.max(PANEL_MIN, width + (event.key === "ArrowLeft" ? 12 : -12))));
          }}
        />

        <aside className="mk__panel" aria-label="รายการที่วัดแล้ว">
          <div className="mk__panel-head">
            รายการที่วัดแล้ว
            <span>{measurements.length} รายการ</span>
          </div>
          <MeasurementRegister
            summary={summary}
            selectedId={selectedId}
            currentPage={page}
            onGoToPage={setPage}
            onSelect={setSelectedId}
            onRename={(id, name) => commit(measurements.map((item) => (item.id === id ? { ...item, name } : item)))}
            onRemove={(id) => commit(measurements.filter((item) => item.id !== id))}
          />
        </aside>
      </div>

      {/* แถวสี่ — แถบสถานะ */}
      <div className="mk__status">
        <span>เครื่องมือ <b>{TOOLS.find((entry) => entry.id === tool)?.label ?? "เลือก"}</b></span>
        <span>สเกล <b>{pageScale ? formatScaleRatio(pageScale) : "ยังไม่ตั้ง"}</b></span>
        <span>ดูดจุด <b>{snapOn ? "เปิด" : "ปิด"}</b></span>
        <span>ล็อกแนวเส้น <b>{axisLock ? "เปิด" : "ปิด (กด Shift ค้าง)"}</b></span>
        <span>ความคมชัด <b>{sharpOn ? "เปิด" : "ปิด"}</b></span>
        <span className="mk__status-right">
          <span>หน้า <b>{pageCount === 0 ? "—" : `${page} จาก ${pageCount}`}</b></span>
          <span>ซูม <b>{Math.round(view.scale * 100)}%</b></span>
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
    </div>
  );
}

/** ใช้ในสรุปท้ายหน้าเมื่อยังไม่มีรายการ เก็บไว้ที่นี่เพื่อไม่ให้คอมโพเนนต์อื่นคิดเลขเอง */
export function draftLengthLabel(points: PagePoint[], scale: PageScale | null): string {
  if (points.length < 2 || !scale) return "";
  return `${formatMetres(polylineLengthPoints(points) * scale.metresPerPoint)} ม.`;
}

/** เผยไว้ให้เทสต์ระดับหน้าจอเรียกได้ โดยไม่ต้องส่งออกทั้งคอมโพเนนต์ */
export const markupInternals = { MEASUREMENT_COLOURS, TOOLS, measure, isComplete, measurementKindLabel };
