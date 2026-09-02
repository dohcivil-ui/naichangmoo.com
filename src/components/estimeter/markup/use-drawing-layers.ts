"use client";

import { useEffect, useRef, useState } from "react";
import {
  fullPageScaleFor,
  planCropRender,
  planSharpRender,
  SHARP_SETTLE_MS,
  type PageRect,
  type RenderPlan
} from "@/lib/drawing-render";

/**
 * ผืนวาดสามชั้นของหน้าแบบ (IP-227)
 *
 * โค้ดเดิมใช้ผืนวาดผืนเดียวทำสองหน้าที่พร้อมกัน คือแสดงผลให้คนดู และให้การดูดจุดกับการไล่
 * พื้นที่ห้องอ่านค่าพิกเซลกลับ แล้วความละเอียดของมันวิ่งตามระดับซูม **ผลคือไล่พื้นที่ห้อง
 * เดียวกันที่ซูม 50% กับ 250% ได้รูปคนละรูป** ซึ่งเป็นบั๊กเงียบที่ไม่มีใครเจอเพราะไม่มีใคร
 * ลองไล่ห้องเดิมสองครั้งที่ซูมต่างกัน การแยกชั้นแก้เรื่องนี้ไปในตัว
 *
 * | ชั้น | ขอบเขต | สเกล | ถ่ายเมื่อไหร่ |
 * |---|---|---|---|
 * | ฐาน | ทั้งหน้า | คงที่ต่อหน้า | ครั้งเดียวตอนเปลี่ยนหน้า |
 * | คม | ทั้งหน้า หรือเฉพาะกรอบที่เห็นเมื่อเกินงบ | ตามซูมคูณความหนาแน่นจอ | หลังผู้ใช้หยุดมือ |
 * | วิเคราะห์ | ทั้งหน้า | **คงที่ต่อหน้า ไม่ขึ้นกับซูม** | ครั้งเดียวตอนเปลี่ยนหน้า |
 *
 * ชั้นฐานอยู่ใต้เสมอ จอจึงไม่มีวันว่างระหว่างถ่ายชั้นคม ผู้ใช้เห็นแค่ภาพนิ่มลงชั่วครู่
 */

/**
 * รูปร่างของ pdf.js เท่าที่เราใช้จริง ประกาศเองแทนการพึ่งชนิดของไลบรารี
 *
 * **ไม่มีฟิลด์ `canvas` ใน `render()`** เพราะรุ่น 4.10.38 ที่ติดตั้งอยู่ไม่มีฟิลด์นั้น
 * มันเป็นของรุ่น 5 · โค้ดเดิมส่งไว้สองจุดและถูกละทิ้งเงียบมาตลอด การเอาออกจากชนิด
 * ทำให้ตัวตรวจชนิดข้อมูลจับได้ทันทีถ้ามีใครใส่กลับเข้ามา
 */
export type PdfRenderTask = { promise: Promise<void>; cancel: () => void };
export type PdfPage = {
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => PdfRenderTask;
  getViewport: (options: { scale: number; offsetX?: number; offsetY?: number }) => {
    width: number;
    height: number;
  };
};
export type PdfDocument = { numPages: number; getPage: (page: number) => Promise<PdfPage> };

type Camera = { scale: number; x: number; y: number };

/**
 * ภาพของชั้นวิเคราะห์ พร้อมเลขหน้าที่มันเป็นภาพของ
 *
 * เก็บเลขหน้าติดไปด้วยเพราะการถ่ายใช้เวลา ระหว่างที่ผู้ใช้เปลี่ยนหน้าแล้วภาพใหม่ยังไม่เสร็จ
 * ถ้าไม่มีเลขหน้ากำกับ การไล่พื้นที่ห้องจะไปอ่านภาพของหน้าเก่าโดยไม่มีอะไรจับได้
 */
export type AnalysisLayer = { page: number; image: ImageData; scale: number };

const readPaperColour = (element: Element | null) =>
  getComputedStyle(element ?? document.documentElement)
    .getPropertyValue("--paper")
    .trim();

/**
 * วาดหน้าหนึ่งลงผืนวาดตามแผนที่คำนวณไว้
 *
 * **ไม่ส่งฟิลด์ `canvas` เข้า `render()`** เพราะ `pdfjs-dist 4.10.38` ไม่มีฟิลด์นั้น
 * มันเป็นของรุ่น 5 และถูกละทิ้งเงียบ ๆ มาตลอด โค้ดเดิมส่งไว้สองจุดโดยไม่มีผลอะไรเลย
 */
async function paint(
  pdfPage: PdfPage,
  canvas: HTMLCanvasElement,
  plan: RenderPlan,
  options: { willReadFrequently?: boolean } = {}
): Promise<{ task: PdfRenderTask; context: CanvasRenderingContext2D } | null> {
  canvas.width = plan.canvasWidth;
  canvas.height = plan.canvasHeight;
  const context = canvas.getContext("2d", {
    willReadFrequently: options.willReadFrequently === true
  });
  if (!context) return null;
  const paper = readPaperColour(canvas.isConnected ? canvas : null);
  if (paper) {
    context.fillStyle = paper;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const viewport = pdfPage.getViewport({
    scale: plan.scale,
    offsetX: plan.offsetX,
    offsetY: plan.offsetY
  });
  return { task: pdfPage.render({ canvasContext: context, viewport }), context };
}

export function useDrawingLayers(input: {
  doc: PdfDocument | null;
  page: number;
  sharpOn: boolean;
  view: Camera;
  stageRef: { current: HTMLDivElement | null };
}): {
  pageSize: { width: number; height: number };
  baseCanvasRef: { current: HTMLCanvasElement | null };
  sharpCanvasRef: { current: HTMLCanvasElement | null };
  sharpCrop: PageRect | null;
  analysis: AnalysisLayer | null;
} {
  const { doc, page, sharpOn, view, stageRef } = input;

  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sharpCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [analysis, setAnalysis] = useState<AnalysisLayer | null>(null);
  const [sharpCrop, setSharpCrop] = useState<PageRect | null>(null);

  /**
   * นับครั้งที่หน้าต่างเปลี่ยนขนาด เพื่อบอกให้ชั้นคมวางแผนใหม่
   *
   * ความหนาแน่นจอกับขนาดพื้นที่วาดถูกอ่านสด ๆ ตอนวางแผนทุกครั้ง ไม่เก็บไว้ใน state
   * เพราะสองค่านี้เป็นของฝั่งเบราว์เซอร์ที่เปลี่ยนได้เอง การเก็บสำเนาไว้มีแต่จะทำให้ค้าง ·
   * ผู้ใช้ซูมเบราว์เซอร์หรือลากหน้าต่างไปจออื่นทำให้ความหนาแน่นจอเปลี่ยน และยิง resize เสมอ
   */
  const [resizeTick, setResizeTick] = useState(0);

  useEffect(() => {
    const onResize = () => setResizeTick((tick) => tick + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ชั้นฐาน — ทั้งหน้าที่สเกลคงที่ ถ่ายครั้งเดียวต่อหน้า จึงไม่มีวันค้างตอนผู้ใช้หมุนล้อซูม
  useEffect(() => {
    let cancelled = false;
    let task: PdfRenderTask | null = null;
    async function render() {
      const canvas = baseCanvasRef.current;
      if (!doc || !canvas) return;
      const pdfPage = await doc.getPage(page);
      if (cancelled) return;
      const size = pdfPage.getViewport({ scale: 1 });
      const plan = planCropRender(
        { x: 0, y: 0, width: size.width, height: size.height },
        fullPageScaleFor(size),
        size
      );
      if (!plan) return;
      const painted = await paint(pdfPage, canvas, plan);
      if (!painted || cancelled) return;
      task = painted.task;
      try {
        await task.promise;
      } catch {
        // ถูกยกเลิกเพราะเปลี่ยนหน้าระหว่างวาด เป็นเรื่องปกติ ไม่ใช่ความผิดพลาด
        return;
      }
      if (cancelled) return;
      setPageSize({ width: size.width, height: size.height });
    }
    void render();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page]);

  /*
   * ชั้นวิเคราะห์ — ผืนวาดนอกจอที่ไม่มีใครเห็น มีไว้ให้อ่านค่าพิกเซลกลับอย่างเดียว
   *
   * สเกลของมัน **ขึ้นกับขนาดหน้าเท่านั้น ไม่ขึ้นกับซูม** ซึ่งเป็นทั้งหมดของการแก้บั๊กเงียบ
   * และเป็นผืนเดียวที่ควรตั้ง willReadFrequently เพราะค่านั้นบังคับให้เบราว์เซอร์วาดด้วย CPU
   * แทน GPU ซึ่งคุ้มเฉพาะกับผืนที่อ่านพิกเซลกลับจริง ๆ
   */
  useEffect(() => {
    let cancelled = false;
    let task: PdfRenderTask | null = null;
    async function render() {
      if (!doc) return;
      const pdfPage = await doc.getPage(page);
      if (cancelled) return;
      const size = pdfPage.getViewport({ scale: 1 });
      const scale = fullPageScaleFor(size);
      const plan = planCropRender(
        { x: 0, y: 0, width: size.width, height: size.height },
        scale,
        size
      );
      if (!plan) return;
      const canvas = document.createElement("canvas");
      const painted = await paint(pdfPage, canvas, plan, { willReadFrequently: true });
      if (!painted || cancelled) return;
      task = painted.task;
      try {
        await task.promise;
      } catch {
        return;
      }
      if (cancelled) return;
      setAnalysis({
        page,
        image: painted.context.getImageData(0, 0, canvas.width, canvas.height),
        scale: plan.scale
      });
    }
    void render();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page]);

  /*
   * ชั้นคม — ถ่ายใหม่หลังผู้ใช้หยุดมือ ไม่ใช่ระหว่างลากหรือหมุนล้อ
   *
   * ระหว่างที่มือยังขยับ ภาพเดิมถูกยืดด้วย CSS ตามไปก่อน แล้วค่อยคมเมื่อหยุด ซึ่งเป็นวิธี
   * เดียวกับที่ตัวอ่าน PDF ทุกตัวใช้ · ปิดโหมดแล้วล้างผืนทิ้ง เหลือชั้นฐานอย่างเดียว
   */
  useEffect(() => {
    const canvas = sharpCanvasRef.current;
    if (!sharpOn || !doc || pageSize.width === 0 || !canvas) {
      setSharpCrop(null);
      return;
    }

    let cancelled = false;
    let task: PdfRenderTask | null = null;
    const timer = setTimeout(() => {
      void (async () => {
        const stage = stageRef.current;
        if (!stage) return;
        const plan = planSharpRender({
          pageSize,
          view,
          stageSize: { width: stage.clientWidth, height: stage.clientHeight },
          devicePixelRatio: window.devicePixelRatio || 1
        });
        if (!plan || cancelled) return;
        const pdfPage = await doc.getPage(page);
        if (cancelled) return;
        const painted = await paint(pdfPage, canvas, plan);
        if (!painted || cancelled) return;
        task = painted.task;
        try {
          await task.promise;
        } catch {
          return;
        }
        if (cancelled) return;
        setSharpCrop(plan.crop);
      })();
    }, SHARP_SETTLE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      task?.cancel();
    };
  }, [doc, page, sharpOn, pageSize, view, resizeTick, stageRef]);

  return {
    pageSize,
    baseCanvasRef,
    sharpCanvasRef,
    sharpCrop,
    // ภาพของหน้าเก่ายังค้างอยู่จนกว่าภาพของหน้าใหม่จะถ่ายเสร็จ จึงต้องกันไว้ตรงนี้
    analysis: analysis && analysis.page === page ? analysis : null
  };
}
