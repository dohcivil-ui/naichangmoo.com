import { describe, expect, it } from "vitest";
import {
  BASE_TARGET_SCALE,
  fullPageScaleFor,
  FULL_PAGE_MAX_PIXELS,
  MAX_CANVAS_SIDE,
  planCropRender,
  planSharpRender,
  SHARP_MAX_PIXELS,
  visiblePageRect
} from "@/lib/drawing-render";

/** A3 แนวนอน หน่วย point — ขนาดของทุกหน้าในแบบโรงพยาบาลกุสุมาลย์ที่ใช้วัดจริง */
const A3 = { width: 1190.55, height: 841.89 };

/** ความหนาแน่นจอของเครื่องเจ้าของงาน วัดได้ 2026-09-02 */
const DPR = 1.89;

const STAGE = { width: 1440, height: 900 };

/** กล้องที่พอดีกรอบ วางหน้าไว้ที่มุมบนซ้ายของพื้นที่วาด */
const viewAt = (scale: number) => ({ scale, x: 0, y: 0 });

describe("fullPageScaleFor", () => {
  it("ให้ A3 ได้สเกลเป้าหมาย 2.0 เต็ม เพราะ 4.01 ล้านจุดยังห่างจากงบ 2^24 มาก", () => {
    expect(fullPageScaleFor(A3)).toBe(BASE_TARGET_SCALE);
    const pixels = Math.ceil(A3.width * 2) * Math.ceil(A3.height * 2);
    expect(pixels).toBeLessThan(FULL_PAGE_MAX_PIXELS);
    expect(pixels / 1e6).toBeCloseTo(4.01, 2);
  });

  it("หนีบสเกลลงเมื่อหน้าใหญ่จนสเกลเป้าหมายเกินงบพิกเซล", () => {
    const huge = { width: 3000, height: 2000 };
    const scale = fullPageScaleFor(huge);
    expect(scale).toBeLessThan(BASE_TARGET_SCALE);
    expect(huge.width * scale * (huge.height * scale)).toBeLessThanOrEqual(FULL_PAGE_MAX_PIXELS);
  });

  it("หนีบสเกลลงเมื่อด้านยาวสุดจะเกินเพดาน 16,384 พิกเซล", () => {
    const long = { width: 20000, height: 40 };
    const scale = fullPageScaleFor(long);
    expect(long.width * scale).toBeLessThanOrEqual(MAX_CANVAS_SIDE);
  });

  it("คืน 0 เมื่อหน้ายังไม่มีขนาด เพื่อบอกผู้เรียกว่าอย่าวาด", () => {
    expect(fullPageScaleFor({ width: 0, height: 0 })).toBe(0);
    expect(fullPageScaleFor({ width: A3.width, height: 0 })).toBe(0);
    expect(fullPageScaleFor({ width: Number.NaN, height: A3.height })).toBe(0);
  });

  it("ให้ค่าเดิมเสมอสำหรับหน้าเดียวกัน ไม่ว่าจะเรียกกี่ครั้ง — ชั้นวิเคราะห์พึ่งข้อนี้", () => {
    expect(fullPageScaleFor(A3)).toBe(fullPageScaleFor(A3));
  });
});

describe("planCropRender", () => {
  it("วาด A3 ทั้งหน้าที่ 300 dpi ได้ 4965x3511 ใต้เพดานด้าน — ข้อพิสูจน์ว่างานอ่านด้วยเครื่องเรียกตัวนี้ได้", () => {
    const whole = { x: 0, y: 0, width: A3.width, height: A3.height };
    const plan = planCropRender(whole, 4.17, A3);
    expect(plan).not.toBeNull();
    expect(plan?.canvasWidth).toBe(4965);
    expect(plan?.canvasHeight).toBe(3511);
    expect(plan?.scale).toBe(4.17);
    expect(plan?.canvasWidth).toBeLessThanOrEqual(MAX_CANVAS_SIDE);
    expect(plan?.canvasHeight).toBeLessThanOrEqual(MAX_CANVAS_SIDE);
  });

  it("ให้ offset ที่เลื่อนกรอบมาไว้ที่มุมบนซ้ายของผืนวาด", () => {
    const plan = planCropRender({ x: 100, y: 50, width: 200, height: 100 }, 2, A3);
    expect(plan?.offsetX).toBe(-200);
    expect(plan?.offsetY).toBe(-100);
    expect(plan?.canvasWidth).toBe(400);
    expect(plan?.canvasHeight).toBe(200);
  });

  it("ไม่มี offset เมื่อวาดทั้งหน้า", () => {
    const plan = planCropRender({ x: 0, y: 0, width: A3.width, height: A3.height }, 2, A3);
    expect(plan?.offsetX).toBe(0);
    expect(plan?.offsetY).toBe(0);
  });

  it("หนีบกรอบที่ยื่นออกนอกหน้าให้กลับเข้าขอบ", () => {
    const plan = planCropRender({ x: -500, y: -500, width: 800, height: 800 }, 1, A3);
    expect(plan?.crop).toEqual({ x: 0, y: 0, width: 300, height: 300 });
    expect(plan?.offsetX).toBe(0);
  });

  it("คืน null เมื่อกรอบไม่ทับหน้าเลย หรือกรอบไม่มีเนื้อที่ หรือสเกลไม่เป็นบวก", () => {
    expect(planCropRender({ x: 5000, y: 0, width: 100, height: 100 }, 2, A3)).toBeNull();
    expect(planCropRender({ x: 0, y: 0, width: 0, height: 100 }, 2, A3)).toBeNull();
    expect(planCropRender({ x: 0, y: 0, width: 100, height: 100 }, 0, A3)).toBeNull();
    expect(planCropRender({ x: 0, y: 0, width: 100, height: 100 }, 2, { width: 0, height: 0 })).toBeNull();
  });

  it("ผืนวาดที่ปัดขึ้นเป็นจำนวนเต็มแล้วยังต้องไม่เกินงบที่ให้มา", () => {
    const plan = planCropRender({ x: 0, y: 0, width: A3.width, height: A3.height }, 8, A3, {
      maxPixels: SHARP_MAX_PIXELS
    });
    expect(plan).not.toBeNull();
    expect((plan?.canvasWidth ?? 0) * (plan?.canvasHeight ?? 0)).toBeLessThanOrEqual(SHARP_MAX_PIXELS);
  });
});

describe("visiblePageRect", () => {
  it("คืนทั้งหน้าเมื่อหน้าเล็กกว่าจอ", () => {
    const rect = visiblePageRect(viewAt(0.5), STAGE, A3, 0);
    expect(rect).toEqual({ x: 0, y: 0, width: A3.width, height: A3.height });
  });

  it("คืนเฉพาะส่วนที่อยู่ในจอเมื่อซูมจนหน้าใหญ่กว่าจอ", () => {
    const rect = visiblePageRect(viewAt(4), STAGE, A3, 0);
    expect(rect?.x).toBe(0);
    expect(rect?.width).toBeCloseTo(STAGE.width / 4, 6);
    expect(rect?.height).toBeCloseTo(STAGE.height / 4, 6);
  });

  it("บวกระยะเผื่อรอบด้านแล้วยังไม่ยื่นออกนอกขอบหน้า", () => {
    const rect = visiblePageRect({ scale: 4, x: -1000, y: -600 }, STAGE, A3, 64);
    expect(rect).not.toBeNull();
    expect(rect!.x).toBeGreaterThanOrEqual(0);
    expect(rect!.y).toBeGreaterThanOrEqual(0);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(A3.width);
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(A3.height);
  });

  it("คืน null เมื่อหน้าถูกเลื่อนออกไปนอกจอจนหมด", () => {
    expect(visiblePageRect({ scale: 1, x: -99999, y: 0 }, STAGE, A3)).toBeNull();
    expect(visiblePageRect(viewAt(0), STAGE, A3)).toBeNull();
  });
});

describe("planSharpRender", () => {
  it("ที่ซูม 150% วาดทั้งหน้าที่สเกล 2.835 ไม่มี offset", () => {
    const plan = planSharpRender({
      pageSize: A3,
      view: viewAt(1.5),
      stageSize: STAGE,
      devicePixelRatio: DPR
    });
    expect(plan?.scale).toBeCloseTo(2.835, 6);
    expect(plan?.offsetX).toBe(0);
    expect(plan?.offsetY).toBe(0);
    expect(plan?.crop).toEqual({ x: 0, y: 0, width: A3.width, height: A3.height });
  });

  it("ที่ซูม 300% สเกลที่อยากได้ 5.67 เกินเพดานทั้งหน้า 3.99 จึงถอยไปวาดเฉพาะกรอบที่มองเห็น", () => {
    const capScale = fullPageScaleFor(A3, Number.POSITIVE_INFINITY, SHARP_MAX_PIXELS, MAX_CANVAS_SIDE);
    expect(capScale).toBeCloseTo(3.995, 3);

    const plan = planSharpRender({
      pageSize: A3,
      view: viewAt(3),
      stageSize: STAGE,
      devicePixelRatio: DPR
    });
    expect(plan?.scale).toBeCloseTo(5.67, 6);
    expect(plan?.crop.width).toBeLessThan(A3.width);
    const widthCeiling = Math.ceil((STAGE.width + 2 * 64) * DPR);
    expect(plan?.canvasWidth).toBeLessThanOrEqual(widthCeiling);
  });

  it("ให้อัตราส่วนความคมไม่ต่ำกว่า 1.0 ทุกระดับซูม ซึ่งเป็นเกณฑ์ที่เจ้าของงานตั้งไว้", () => {
    for (const zoom of [1, 2.11, 4, 8]) {
      const plan = planSharpRender({
        pageSize: A3,
        view: viewAt(zoom),
        stageSize: STAGE,
        devicePixelRatio: DPR
      });
      expect(plan).not.toBeNull();
      expect(plan!.scale / (zoom * DPR)).toBeGreaterThanOrEqual(1);
    }
  });

  it("ผืนวาดของทางถอยไม่โตตามซูม เพราะกรอบผูกกับขนาดจอ", () => {
    const sizes = [4, 8, 16].map((zoom) => {
      const plan = planSharpRender({
        pageSize: A3,
        view: viewAt(zoom),
        stageSize: STAGE,
        devicePixelRatio: DPR
      });
      return (plan?.canvasWidth ?? 0) * (plan?.canvasHeight ?? 0);
    });
    for (const pixels of sizes) {
      expect(pixels).toBeLessThanOrEqual(SHARP_MAX_PIXELS);
      expect(pixels).toBeLessThanOrEqual(sizes[0]);
    }
  });

  it("คืน null เมื่อยังไม่มีหน้า หรือหน้าอยู่นอกจอทั้งหมด", () => {
    expect(
      planSharpRender({
        pageSize: { width: 0, height: 0 },
        view: viewAt(1),
        stageSize: STAGE,
        devicePixelRatio: DPR
      })
    ).toBeNull();
    expect(
      planSharpRender({
        pageSize: A3,
        view: { scale: 8, x: -99999, y: 0 },
        stageSize: STAGE,
        devicePixelRatio: DPR
      })
    ).toBeNull();
  });
});
