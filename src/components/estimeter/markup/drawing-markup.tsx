"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MeasurementRegister } from "@/components/estimeter/markup/measurement-register";
import {
  isComplete,
  measure,
  measurementKindLabel,
  minimumPoints,
  needsScale,
  outlinePoints,
  summarise,
  formatMetres,
  type Measurement,
  type MeasurementKind
} from "@/lib/drawing-measurement";
import {
  regionRejectionMessage,
  toGreyImage,
  traceRegion
} from "@/lib/region-fill";
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
 * **แบบถูกวาดในเบราว์เซอร์ ไม่ใช่บนเซิร์ฟเวอร์** วัดแล้วเมื่อ 2026-09-01 ว่าการแปลงหน้าแบบ
 * เป็นภาพฝั่งเซิร์ฟเวอร์ด้วย Node ล้มทุกหน้าที่มีตัวอักษร เพราะผืนวาดจำลองไม่รองรับฟอนต์
 * ที่ฝังมาในแบบ CAD ส่วนเบราว์เซอร์แสดงแบบชุดเดียวกันได้ครบทุกตัวอักษร
 * และการมาร์กอัปก็ต้องเกิดในเบราว์เซอร์อยู่แล้ว จึงไม่ต้องแปลงสองที่
 *
 * **พิกัดทุกจุดเก็บในหน่วยของหน้ากระดาษ ไม่ใช่พิกเซลบนจอ** ผู้ใช้ซูมเข้าออกได้อิสระ
 * โดยที่ปริมาณไม่ขยับ ถ้าเก็บเป็นพิกเซล ซูมครั้งเดียวปริมาณทั้งหน้าเพี้ยนหมด
 *
 * **รายการวัดผูกเลขหน้าติดตัวไปด้วยทุกรายการ** เส้นของหน้าหนึ่งจึงไม่มีทางไปโผล่อีกหน้าได้
 * ข้อนี้เป็นข้อบกพร่องที่เจ้าของงานเจอในเครื่องมือที่ใช้อยู่ และแก้ที่โครงสร้างข้อมูล
 * ไม่ใช่แก้ที่การวาด
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

/** เครื่องมือที่วางบนแถบ เรียงตามลำดับที่ผู้ใช้หยิบจริง */
const TOOLS: { id: Tool; label: string; key: string; hint?: string }[] = [
  { id: "select", label: "เลือก", key: "V" },
  { id: "pan", label: "เลื่อน", key: "H" },
  { id: "scale", label: "ตั้งสเกล", key: "K" },
  { id: "length", label: "ระยะสองจุด", key: "L", hint: "ต้องตั้งสเกลก่อน" },
  { id: "polyline", label: "ระยะต่อเนื่อง", key: "P", hint: "ต้องตั้งสเกลก่อน" },
  { id: "rect", label: "พื้นที่สี่เหลี่ยม", key: "R", hint: "ต้องตั้งสเกลก่อน" },
  { id: "area", label: "พื้นที่หลายเหลี่ยม", key: "A", hint: "ต้องตั้งสเกลก่อน" },
  { id: "room", label: "เลือกพื้นที่ห้อง", key: "S", hint: "ต้องตั้งสเกลก่อน" },
  { id: "count", label: "นับจำนวน", key: "C" }
];

type Tool = "select" | "pan" | "scale" | "room" | MeasurementKind;

/** เครื่องมือที่ผลลัพธ์เป็นรายการวัด และต้องมีสเกลก่อนถึงจะให้ค่าที่มีความหมาย */
function toolNeedsScale(tool: Tool): boolean {
  if (tool === "select" || tool === "pan" || tool === "scale") return false;
  if (tool === "room") return true;
  return needsScale(tool);
}

type PdfPage = { render: (options: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas: HTMLCanvasElement }) => { promise: Promise<void> }; getViewport: (options: { scale: number }) => { width: number; height: number } };
type PdfDocument = { numPages: number; getPage: (page: number) => Promise<PdfPage> };

const SNAP_RADIUS_PX = 8;
const DARK_ENOUGH = 140;

export function DrawingMarkup() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imageDataRef = useRef<ImageData | null>(null);

  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [fileName, setFileName] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [loadError, setLoadError] = useState("");
  const [regionError, setRegionError] = useState("");

  const [tool, setTool] = useState<Tool>("select");
  const [snapOn, setSnapOn] = useState(true);
  const [axisLock, setAxisLock] = useState(false);

  const [scales, setScales] = useState<Record<number, PageScale>>({});
  const [draft, setDraft] = useState<PagePoint[]>([]);
  const [hover, setHover] = useState<PagePoint | null>(null);

  const [past, setPast] = useState<Measurement[][]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [future, setFuture] = useState<Measurement[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    } catch (error) {
      setLoadError(`เปิดไฟล์ไม่ได้: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // วาดหน้าแบบใหม่ทุกครั้งที่เปลี่ยนหน้าหรือเปลี่ยนระดับซูม
  useEffect(() => {
    let cancelled = false;
    async function render() {
      const canvas = canvasRef.current;
      if (!doc || !canvas) return;
      const pdfPage = await doc.getPage(page);
      const base = pdfPage.getViewport({ scale: 1 });
      const viewport = pdfPage.getViewport({ scale: zoom });
      if (cancelled) return;
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) return;
      // พื้นรองหน้าแบบอ่านจาก token ของธีม ไม่ประกาศเลขสีในคอมโพเนนต์ ตาม ADR 0021
      const paper = getComputedStyle(canvas).getPropertyValue("--paper").trim();
      if (paper) {
        context.fillStyle = paper;
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      await pdfPage.render({ canvasContext: context, viewport, canvas }).promise;
      if (cancelled) return;
      setPageSize({ width: base.width, height: base.height });
      imageDataRef.current = context.getImageData(0, 0, canvas.width, canvas.height);
    }
    void render();
    return () => {
      cancelled = true;
    };
  }, [doc, page, zoom]);

  /** พิกัดบนจอ เป็นพิกัดของหน้ากระดาษ */
  const toPagePoint = useCallback(
    (clientX: number, clientY: number): PagePoint | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const box = canvas.getBoundingClientRect();
      return { x: (clientX - box.left) / zoom, y: (clientY - box.top) / zoom };
    },
    [zoom]
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
      const image = imageDataRef.current;
      if (!snapOn || !image) return point;
      const cx = Math.round(point.x * zoom);
      const cy = Math.round(point.y * zoom);
      let best: { x: number; y: number; value: number } | null = null;
      for (let dy = -SNAP_RADIUS_PX; dy <= SNAP_RADIUS_PX; dy += 1) {
        for (let dx = -SNAP_RADIUS_PX; dx <= SNAP_RADIUS_PX; dx += 1) {
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
      return best ? { x: best.x / zoom, y: best.y / zoom } : point;
    },
    [snapOn, zoom]
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
    const point = resolvePoint(event.clientX, event.clientY, activeAnchor);
    setHover(point);
  }

  function handleClick(event: React.PointerEvent<HTMLDivElement>) {
    if (!doc || tool === "select" || tool === "pan") return;
    const point = resolvePoint(event.clientX, event.clientY, activeAnchor);
    if (!point) return;

    if (tool === "scale") {
      const next = [...calibrationPoints, point].slice(-2);
      setCalibrationPoints(next);
      if (next.length === 2) setCalibrationOpen(true);
      return;
    }

    if (toolNeedsScale(tool) && !pageScale) return;

    if (tool === "room") {
      pickRoom(point);
      return;
    }

    const next = [...draft, point];
    setDraft(next);

    // ชนิดที่มีจำนวนจุดตายตัวจบเองทันที ชนิดที่คลิกได้เรื่อย ๆ รอคลิกขวา
    const fixed = tool === "length" || tool === "rect" ? 2 : tool === "count" ? 1 : 0;
    if (fixed > 0 && next.length === fixed) finish(next);
  }

  /**
   * เลือกพื้นที่ห้องด้วยคลิกเดียว
   *
   * ผลที่ได้เป็นรูปหลายเหลี่ยมที่ผู้ใช้ลากแก้จุดต่อได้ ไม่ใช่ภาพระบายสีที่แก้ไม่ได้
   * และถ้าเส้นห้องในแบบไม่ปิดสนิทจนสีทะลุ ระบบบอกตรง ๆ แล้วให้ไปคลิกไล่มุมแทน
   * ไม่คืนพื้นที่มั่ว ๆ ให้ไหลเข้าใบราคา
   */
  function pickRoom(point: PagePoint) {
    const image = imageDataRef.current;
    if (!image) return;
    const grey = toGreyImage(image.data, image.width, image.height);
    const result = traceRegion(grey, { x: point.x * zoom, y: point.y * zoom });
    if (!result.ok) {
      setRegionError(regionRejectionMessage[result.reason]);
      return;
    }
    setRegionError("");
    const polygon = result.polygon.map((pixel) => ({ x: pixel.x / zoom, y: pixel.y / zoom }));
    const created: Measurement = {
      id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      page,
      kind: "area",
      name: "",
      points: polygon,
      colour: MEASUREMENT_COLOURS[measurements.length % MEASUREMENT_COLOURS.length]
    };
    commit([...measurements, created]);
    setSelectedId(created.id);
  }

  function finish(points: PagePoint[] = draft) {
    if (points.length < minimumPoints(tool as MeasurementKind)) {
      setDraft([]);
      return;
    }
    const kind = tool as MeasurementKind;
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

  // คีย์ลัด — ตัวอักษรเดี่ยวกับ Escape เท่านั้น จึงไม่ชนคีย์ลัดของเบราว์เซอร์
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.key === "Shift") setAxisLock(true);
      if (event.key === "Escape") cancelDraft();
      if (event.key === "Enter") finish();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      const match = TOOLS.find((entry) => entry.key.toLowerCase() === event.key.toLowerCase());
      if (match && !event.ctrlKey && !event.metaKey) {
        setDraft([]);
        setTool(match.id);
      }
      if (event.key === "F3") {
        event.preventDefault();
        setSnapOn((on) => !on);
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

  return (
    <div className="markup">
      <div className="markup__bar">
        <label className="markup__open">
          เปิดแบบ PDF
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void openFile(file);
            }}
          />
        </label>
        <span className="markup__file">{fileName || "ยังไม่ได้เปิดแบบ"}</span>
        <button type="button" onClick={undo} disabled={past.length === 0}>
          ย้อนกลับ
        </button>
        <button type="button" onClick={redo} disabled={future.length === 0}>
          ทำซ้ำ
        </button>
      </div>

      <div className="markup__tools" role="toolbar" aria-label="เครื่องมือวัด">
        {TOOLS.map((entry) => {
          const locked =
            entry.id !== "select" &&
            entry.id !== "pan" &&
            entry.id !== "scale" &&
            toolNeedsScale(entry.id) &&
            !pageScale;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                setDraft([]);
                setTool(entry.id);
              }}
              disabled={locked || !doc}
              aria-pressed={tool === entry.id}
              title={locked ? `${entry.label} — ${entry.hint}` : `${entry.label} (${entry.key})`}
            >
              {entry.label}
            </button>
          );
        })}
        <button type="button" onClick={() => setSnapOn((on) => !on)} aria-pressed={snapOn}>
          ดูดจุด
        </button>
        <span className="markup__scale-state">
          สเกลหน้า {page}: {pageScale ? formatScaleRatio(pageScale) : "ยังไม่ตั้ง"}
        </span>
      </div>

      <div className="markup__body">
        <aside className="markup__pages">
          <h2>หน้าแบบ {pageCount} หน้า</h2>
          <ol>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
              <li key={number}>
                <button
                  type="button"
                  onClick={() => {
                    setDraft([]);
                    setPage(number);
                  }}
                  aria-current={number === page ? "page" : undefined}
                >
                  หน้า {number}
                  {scales[number] ? <small>{formatScaleRatio(scales[number])}</small> : <small>ยังไม่ตั้งสเกล</small>}
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <div
          className="markup__stage"
          ref={stageRef}
          onPointerMove={handleMove}
          onPointerDown={handleClick}
          onContextMenu={(event) => {
            event.preventDefault();
            finish();
          }}
        >
          {doc ? null : (
            <p className="markup__drop">ลากไฟล์ PDF วางที่นี่ หรือกดปุ่มเปิดแบบด้านบน</p>
          )}
          <div className="markup__canvas-wrap">
            <canvas ref={canvasRef} />
            {pageSize.width > 0 ? (
              <svg
                className="markup__overlay"
                viewBox={`0 0 ${pageSize.width} ${pageSize.height}`}
                style={{ width: pageSize.width * zoom, height: pageSize.height * zoom }}
                aria-hidden="true"
              >
                {measurements
                  .filter((item) => item.page === page)
                  .map((item) => {
                    const outline = outlinePoints(item);
                    const closed = item.kind === "area" || item.kind === "rect";
                    if (item.kind === "count") {
                      return outline.map((point, index) => (
                        <circle
                          key={`${item.id}-${index}`}
                          cx={point.x}
                          cy={point.y}
                          r={4 / zoom}
                          fill={item.colour}
                        />
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
                        strokeWidth={(item.id === selectedId ? 3 : 1.5) / zoom}
                      />
                    ) : (
                      <polyline
                        key={item.id}
                        points={points}
                        fill="none"
                        stroke={item.colour}
                        strokeWidth={(item.id === selectedId ? 3 : 1.5) / zoom}
                      />
                    );
                  })}

                {draftPreview ? (
                  <polyline
                    points={draftPreview.map((point) => `${point.x},${point.y}`).join(" ")}
                    fill="none"
                    stroke="var(--orange)"
                    strokeWidth={1.5 / zoom}
                    strokeDasharray={`${6 / zoom} ${4 / zoom}`}
                  />
                ) : null}

                {calibrationPoints.length > 0 ? (
                  <polyline
                    points={[...calibrationPoints, ...(hover && calibrationPoints.length < 2 ? [hover] : [])]
                      .map((point) => `${point.x},${point.y}`)
                      .join(" ")}
                    fill="none"
                    stroke="var(--orange)"
                    strokeWidth={2 / zoom}
                  />
                ) : null}
              </svg>
            ) : null}
          </div>
        </div>

        <aside className="markup__panel">
          <h2>รายการวัด</h2>
          <MeasurementRegister
            summary={summary}
            selectedId={selectedId}
            currentPage={page}
            onGoToPage={setPage}
            onSelect={setSelectedId}
            onRename={(id, name) =>
              commit(measurements.map((item) => (item.id === id ? { ...item, name } : item)))
            }
            onRemove={(id) => commit(measurements.filter((item) => item.id !== id))}
          />
        </aside>
      </div>

      <div className="markup__status">
        <span>เครื่องมือ: {TOOLS.find((entry) => entry.id === tool)?.label ?? "เลือก"}</span>
        <span>สเกล: {pageScale ? formatScaleRatio(pageScale) : "ยังไม่ตั้ง"}</span>
        <span>ดูดจุด: {snapOn ? "เปิด" : "ปิด"}</span>
        <span>บังคับแนว: {axisLock ? "เปิด" : "ปิด (กด Shift ค้าง)"}</span>
        <span>ซูม: {Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((value) => Math.max(0.25, value - 0.25))}>
          ซูมออก
        </button>
        <button type="button" onClick={() => setZoom((value) => Math.min(6, value + 0.25))}>
          ซูมเข้า
        </button>
      </div>

      {loadError ? <p role="alert">{loadError}</p> : null}
      {regionError ? <p role="alert">{regionError}</p> : null}

      {calibrationOpen ? (
        <div className="markup__dialog" role="dialog" aria-label="ตั้งสเกลของหน้าแบบ">
          <h2>ตั้งสเกลของหน้า {page}</h2>
          <p>
            ลากเส้นทาบระยะที่แบบเขียนบอกไว้แล้ว จากนั้นพิมพ์ระยะจริงตามที่แบบระบุ
            <strong> ห้ามให้ระบบเดาสเกลเอง สเกลผิดทำให้ทุกปริมาณในหน้านี้ผิดตามทั้งหมด</strong>
          </p>
          <p>ความยาวเส้นที่ลาก: {calibrationLength.toFixed(1)} หน่วยกระดาษ</p>
          <label>
            ระยะจริงตามที่แบบระบุ
            <input
              value={realDistance}
              onChange={(event) => setRealDistance(event.target.value)}
              inputMode="decimal"
              autoFocus
            />
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
            <button type="button" onClick={applyCalibration}>
              ยืนยันสเกลนี้
            </button>
            <button type="button" onClick={cancelDraft}>
              ยกเลิก
            </button>
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
