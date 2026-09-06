import { describe, expect, it } from "vitest";
import { explainMeasurement, worstScaleGap } from "@/lib/measurement-evidence";
import type { Measurement, MeasurementValue } from "@/lib/drawing-measurement";
import type { PageScale, StatedDimension } from "@/lib/drawing-scale";

/** สเกล 1:125.29 ของหน้า 7 ในแบบทดสอบ — หนึ่งจุดกระดาษเท่ากับ 0.0442 เมตรจริง */
const scale: PageScale = { metresPerPoint: 0.044198895, ratio: 125.29 };

/** ห้องน้ำผู้ป่วยชายหน้า 7 · กรอบเป็นหน่วยจุดกระดาษ กว้าง 52.5 ลึก 41 */
function room(): Measurement {
  return {
    id: "m1",
    page: 7,
    kind: "area",
    name: "ห้องน้ำผู้ป่วยชาย",
    points: [
      { x: 589.75, y: 481 },
      { x: 642.25, y: 481 },
      { x: 642.25, y: 522 },
      { x: 589.75, y: 522 }
    ],
    // สีไม่เกี่ยวกับสิ่งที่เทสต์นี้ตรวจ และรั้วสี (ADR 0021) ห้ามฝังเลขสีดิบนอกครัวกลาง
    colour: "var(--orange)",
    origin: "region_trace"
  };
}

const value: MeasurementValue = {
  lengthMetres: null,
  perimeterMetres: 8.26,
  areaSquareMetres: 4.185,
  count: null,
  segmentsMetres: [],
  blockedByScale: false
};

const dimensions: StatedDimension[] = [
  { id: "d1", page: 7, a: { x: 589.75, y: 470 }, b: { x: 646.3, y: 470 }, valueM: 2.5 },
  { id: "d2", page: 7, a: { x: 580, y: 481 }, b: { x: 580, y: 526 }, valueM: 2.0 }
];

/**
 * อ่านตัวเลขทุกตัวออกจากบรรทัดเดียว ตามลำดับที่มันปรากฏ
 *
 * ต้องเริ่มด้วยตัวเลขเสมอ ไม่งั้นจุดท้ายคำว่า "ม." จะถูกอ่านเป็นตัวเลขตัวหนึ่งด้วย
 * แล้วกลายเป็น NaN ที่ทำให้เทสต์ที่นับจำนวนตัวเลขบนบรรทัดอ่านผิด
 */
const numbersIn = (line: string) => (line.match(/\d[\d.]*/g) ?? []).map(Number);

describe("การกางวิธีคิดของรายการวัด", () => {
  it("ตอบห้าคำถามที่คนอ่านจะถาม เรียงตามลำดับที่เขาถาม", () => {
    const evidence = explainMeasurement({
      measurement: room(),
      value,
      scale,
      method: "two_point",
      dimensions
    });
    expect(evidence).not.toBeNull();
    if (!evidence) return;
    expect(evidence.steps.map((step) => step.question)).toEqual([
      "รูปที่วัดอยู่ตรงไหนของแบบ",
      "จุดบนกระดาษกลายเป็นเมตรได้ยังไง",
      "สเกลที่ใช้เชื่อได้แค่ไหน",
      "เลขที่รายงานคิดออกมาได้ยังไง",
      "ตัวเลขนี้วัดถึงตรงไหน"
    ]);
  });

  /**
   * **บรรทัดบัญญัติไตรยางศ์ต้องกดเครื่องคิดเลขตามได้จริง** ไม่ใช่ข้อความประกอบ
   * เทสต์นี้อ่านตัวเลขออกจากบรรทัดที่จะขึ้นบนจอ แล้วคูณเองเทียบกับผลที่เขียนไว้ในบรรทัดเดียวกัน
   */
  it("บรรทัดคูณกลับแล้วต้องได้ผลตามที่เขียนไว้ในบรรทัดนั้นเอง", () => {
    const evidence = explainMeasurement({
      measurement: room(),
      value,
      scale,
      method: "two_point",
      dimensions
    });
    if (!evidence) return;
    const working = evidence.steps[1].working ?? "";
    const lines = working.split("\n");
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      const [points, perPoint, metres] = numbersIn(line);
      /**
       * ยอมคลาดได้ห้ามิลลิเมตร เพราะทั้งตัวคูณและผลลัพธ์บนบรรทัดถูกปัดเศษก่อนขึ้นจอ
       * ตัวคูณปัดที่ทศนิยมสี่ตำแหน่ง ผลลัพธ์ปัดที่สาม · คนที่กดเครื่องคิดเลขตามจะได้
       * เลขต่างจากที่เห็นไม่เกินครึ่งหลักสุดท้าย ซึ่งเป็นเรื่องปกติของการปัดเศษ ไม่ใช่ความผิด
       */
      expect(points * perPoint).toBeCloseTo(metres, 2);
    }
    // กว้าง 52.5 จุด ลึก 41 จุด ตามกรอบของห้อง
    expect(lines[0]).toContain("52.5 จุด");
    expect(lines[1]).toContain("41.0 จุด");
  });

  /**
   * **สองด้านที่กางไว้ต้องบอกให้ชัดว่าเป็นกรอบที่ครอบรูป ไม่ใช่ด้านของห้อง**
   * ถ้าไม่บอก คนที่คูณตามบรรทัดจะได้เลขใหญ่กว่าที่รายงานทุกครั้งที่ห้องไม่ใช่สี่เหลี่ยม
   */
  it("บอกว่าสองด้านที่กางเป็นกรอบที่ครอบรูป ไม่ใช่ด้านของห้อง", () => {
    const evidence = explainMeasurement({
      measurement: room(),
      value,
      scale,
      method: "two_point",
      dimensions
    });
    if (!evidence) return;
    for (const line of (evidence.steps[1].working ?? "").split("\n")) {
      expect(line).toContain("กรอบที่ครอบรูป");
    }
  });

  it("บอกวิธีที่สเกลถูกตั้งขึ้น และเส้นที่คลาดมากที่สุด", () => {
    const evidence = explainMeasurement({
      measurement: room(),
      value,
      scale,
      method: "stated_dimension",
      dimensions
    });
    if (!evidence) return;
    const step = evidence.steps[2];
    expect(step.answer).toContain("1:125.29");
    expect(step.answer).toContain("ระยะที่แบบเขียน");
    expect(step.answer).toContain("คลาดมากที่สุด");
    expect(step.working).toContain("คลาด");
  });

  /**
   * ทางแยกข้อสองของแผน — ตอนแบบยังไม่มีเส้นบอกระยะให้เทียบ จะบอกอย่างไร
   * เลือกทาง "ขึ้นป้ายบอกตรง ๆ" ไม่ใช่ทาง "กันไม่ให้ส่งเข้าถอดปริมาณ" เพราะทางหลัง
   * เปลี่ยนพฤติกรรมของแอป ซึ่งเป็นคำตัดสินที่เจ้าของงานยังไม่ได้เคาะ
   *
   * **และคำว่ายังตอบไม่ได้ต้องอยู่ในช่องคำตอบของคำถามนั้นเอง** (เจ้าของงานเคาะ 2026-09-06)
   * ของเดิมเขียนคำตอบเป็น "1:125.29 ตั้งจาก..." ซึ่งตอบคนละคำถามกับที่ถาม แล้วเอาคำตอบจริง
   * ไปวางในกล่องข้างล่าง · คำถามจึงดูเหมือนถูกตอบแล้วทั้งที่ยังไม่ถูกตอบ
   */
  it("หน้าที่ไม่มีระยะให้เทียบ ต้องตอบตรงช่องคำตอบว่ายังบอกไม่ได้", () => {
    const evidence = explainMeasurement({
      measurement: room(),
      value,
      scale,
      method: "two_point",
      dimensions: []
    });
    if (!evidence) return;
    const step = evidence.steps[2];
    expect(step.question).toBe("สเกลที่ใช้เชื่อได้แค่ไหน");
    expect(step.answer).toContain("ยังบอกไม่ได้");
    expect(step.answer).toContain("ไม่มีระยะที่แบบเขียนให้เทียบ");
    expect(step.working).toBeNull();
    // ต้องไม่พูดซ้ำอีกรอบในกล่องข้างล่าง เพราะคำตอบเดียวที่เขียนสองที่อ่านแล้วสับสน
    expect(evidence.openQuestions.join(" ")).not.toContain("ไม่มีระยะที่แบบเขียนให้เทียบ");
  });

  it("หน้าที่ยังไม่ตั้งสเกล บอกว่าแปลงเป็นเมตรไม่ได้ และไม่แต่งบรรทัดคูณขึ้นมา", () => {
    const evidence = explainMeasurement({
      measurement: room(),
      value: { ...value, blockedByScale: true },
      scale: null,
      method: null,
      dimensions
    });
    if (!evidence) return;
    expect(evidence.steps.map((step) => step.question)).toEqual([
      "รูปที่วัดอยู่ตรงไหนของแบบ",
      "ตัวเลขนี้วัดถึงตรงไหน"
    ]);
    expect(evidence.openQuestions.join(" ")).toContain("ยังไม่ได้ตั้งสเกล");
    expect(evidence.openQuestions.join(" ")).toContain("ยังไม่ถูกนับเข้ายอดรวม");
  });

  it("รูปที่คนชี้เอง ต้องไม่อ้างว่าวัดถึงผิวผนัง", () => {
    const evidence = explainMeasurement({
      measurement: { ...room(), origin: "pointer" },
      value,
      scale,
      method: "two_point",
      dimensions
    });
    if (!evidence) return;
    const step = evidence.steps[evidence.steps.length - 1];
    expect(step.answer).toContain("จุดที่คนชี้เอง");
    expect(step.answer).not.toContain("ผิวผนัง");
  });
});

/**
 * **ข้อที่พาวงกลับมาปิดที่เลขบนแถว** ของเดิมกางสี่ข้อแล้วจบโดยที่เลขที่แถวรายงาน
 * ไม่เคยโผล่ในแผงเลย คนอ่านต้องคูณเองแล้วเดาเองว่าต้องได้เท่าไร
 */
describe("บรรทัดปิดวงที่พากลับมาที่เลขที่รายงาน", () => {
  it("พื้นที่ต้องเขียนเลขที่รายงานออกมาตรง ๆ พร้อมเส้นรอบรูป", () => {
    const evidence = explainMeasurement({
      measurement: room(),
      value,
      scale,
      method: "two_point",
      dimensions
    });
    if (!evidence) return;
    const step = evidence.steps[3];
    expect(step.question).toBe("เลขที่รายงานคิดออกมาได้ยังไง");
    expect(step.answer).toContain("4.185");
    expect(step.answer).toContain("8.260");
  });

  /**
   * บรรทัดแรกคือกรอบคูณกัน บรรทัดที่สองคือกรอบคูณสัดส่วนที่รูปกินในกรอบ
   * ทั้งสองบรรทัดต้องกดเครื่องคิดเลขตามแล้วได้ผลตามที่เขียนไว้ในบรรทัดเดียวกัน
   */
  it("สองบรรทัดของพื้นที่คูณกลับแล้วได้ผลตามที่เขียนไว้", () => {
    const evidence = explainMeasurement({
      measurement: room(),
      value,
      scale,
      method: "two_point",
      dimensions
    });
    if (!evidence) return;
    const lines = (evidence.steps[3].working ?? "").split("\n");
    expect(lines).toHaveLength(2);

    const [width, depth, boundingArea] = numbersIn(lines[0]);
    expect(width * depth).toBeCloseTo(boundingArea, 2);

    // บรรทัดสอง — จำนวนด้าน แล้วเปอร์เซ็นต์ แล้วพื้นที่ที่รายงาน
    const [sideCount, percent, reported] = numbersIn(lines[1]);
    expect(sideCount).toBe(4);
    expect(boundingArea * (percent / 100)).toBeCloseTo(reported, 2);
    expect(reported).toBe(4.185);
  });

  /**
   * **ห้องรูปตัว L คือกรณีที่เจอบ่อยที่สุดในผังพื้นจริง** และเป็นกรณีที่กรอบที่ครอบรูป
   * ใหญ่กว่าตัวห้องจริงชัดเจน · ถ้าแผงไม่อธิบายช่องว่างนั้น คนที่คูณกว้างกับลึกตามบรรทัดข้างบน
   * จะได้เลขใหญ่กว่าที่รายงาน แล้วสรุปว่าแอปคิดผิด
   */
  it("ห้องรูปตัว L ต้องอธิบายว่าทำไมกรอบใหญ่กว่าพื้นที่ที่รายงาน", () => {
    const lRoom: Measurement = {
      ...room(),
      // กรอบ 100 × 100 จุด แต่ตัวรูปกินแค่สามในสี่ของกรอบ
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 50, y: 50 },
        { x: 50, y: 100 },
        { x: 0, y: 100 }
      ]
    };
    const boundingArea = (100 * scale.metresPerPoint) ** 2;
    const evidence = explainMeasurement({
      measurement: lRoom,
      value: { ...value, areaSquareMetres: boundingArea * 0.75, perimeterMetres: null },
      scale,
      method: "two_point",
      dimensions
    });
    if (!evidence) return;
    const lines = (evidence.steps[3].working ?? "").split("\n");
    const [sideCount, percent, reported] = numbersIn(lines[1]);
    expect(sideCount).toBe(6);
    expect(percent).toBeCloseTo(75, 1);
    const [width, depth, bounding] = numbersIn(lines[0]);
    expect(width * depth).toBeCloseTo(bounding, 2);
    expect(bounding * (percent / 100)).toBeCloseTo(reported, 2);
    // และกรอบต้องใหญ่กว่าที่รายงานจริง ไม่ใช่เท่ากันเพราะบังเอิญห้องเป็นสี่เหลี่ยม
    expect(bounding).toBeGreaterThan(reported);
  });

  /**
   * **เส้นระยะที่ลากเฉียงคือจุดที่ของเดิมพัง** มันกางบรรทัด "กว้าง × ลึก" ของกรอบที่ครอบเส้น
   * ออกมาทั้งที่คำตอบจริงคือด้านตรงข้ามมุมฉาก ซึ่งไม่มีในแผงเลยสักบรรทัด
   */
  it("ระยะสองจุดที่ลากเฉียง ต้องกางความยาวจริง ไม่ใช่กรอบที่ครอบเส้น", () => {
    const diagonal: Measurement = {
      ...room(),
      kind: "length",
      origin: "pointer",
      // สามสี่ห้า — กรอบกว้าง 30 ลึก 40 แต่เส้นยาว 50 จุด
      points: [
        { x: 0, y: 0 },
        { x: 30, y: 40 }
      ]
    };
    const lengthMetres = 50 * scale.metresPerPoint;
    const evidence = explainMeasurement({
      measurement: diagonal,
      value: {
        ...value,
        areaSquareMetres: null,
        perimeterMetres: null,
        lengthMetres,
        segmentsMetres: [lengthMetres]
      },
      scale,
      method: "two_point",
      dimensions
    });
    if (!evidence) return;

    const conversion = evidence.steps[1].working ?? "";
    expect(conversion.split("\n")).toHaveLength(1);
    expect(conversion).toContain("50.0 จุด");
    expect(conversion).not.toContain("กรอบ");
    const [points, perPoint, metres] = numbersIn(conversion);
    expect(points * perPoint).toBeCloseTo(metres, 2);

    const closing = evidence.steps[3];
    expect(closing.question).toBe("เลขที่รายงานคิดออกมาได้ยังไง");
    expect(closing.answer).toContain(lengthMetres.toFixed(3));
    // ด้านเดียวไม่มีอะไรให้บวก จึงไม่แต่งบรรทัดที่มีเลขตัวเดียวขึ้นมา
    expect(closing.working).toBeNull();
  });

  it("ระยะต่อเนื่องต้องกางว่าความยาวรวมมาจากด้านไหนบ้าง แล้วบวกกลับได้", () => {
    const polyline: Measurement = {
      ...room(),
      kind: "polyline",
      origin: "pointer",
      points: [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 30, y: 40 }
      ]
    };
    const segments = [30 * scale.metresPerPoint, 40 * scale.metresPerPoint];
    const total = segments[0] + segments[1];
    const evidence = explainMeasurement({
      measurement: polyline,
      value: {
        ...value,
        areaSquareMetres: null,
        perimeterMetres: null,
        lengthMetres: total,
        segmentsMetres: segments
      },
      scale,
      method: "two_point",
      dimensions
    });
    if (!evidence) return;
    const closing = evidence.steps[3];
    const parts = numbersIn(closing.working ?? "");
    expect(parts).toHaveLength(3);
    expect(parts[0] + parts[1]).toBeCloseTo(parts[2], 2);
    expect(parts[2]).toBeCloseTo(total, 2);
  });

  /**
   * **การนับจำนวนไม่ใช้สเกล** ของเดิมยังขึ้นป้ายทวงสเกลให้กับการนับบนหน้าที่ยังไม่ตั้งสเกล
   * ซึ่งเป็นการทวงของที่ไม่ได้ใช้ · และกรอบที่ครอบจุดที่นับก็ไม่ได้แปลว่าอะไร
   */
  it("การนับจำนวนไม่ถามเรื่องสเกล และไม่ทวงสเกลที่ไม่ได้ใช้", () => {
    const tally: Measurement = {
      ...room(),
      kind: "count",
      origin: "pointer",
      points: [
        { x: 10, y: 10 },
        { x: 40, y: 12 },
        { x: 70, y: 9 }
      ]
    };
    const evidence = explainMeasurement({
      measurement: tally,
      value: {
        lengthMetres: null,
        perimeterMetres: null,
        areaSquareMetres: null,
        count: 3,
        segmentsMetres: [],
        blockedByScale: false
      },
      scale: null,
      method: null,
      dimensions: []
    });
    if (!evidence) return;
    expect(evidence.steps.map((step) => step.question)).toEqual([
      "รูปที่วัดอยู่ตรงไหนของแบบ",
      "เลขที่รายงานคิดออกมาได้ยังไง",
      "ตัวเลขนี้วัดถึงตรงไหน"
    ]);
    expect(evidence.steps[1].answer).toContain("นับได้ 3 จุด");
    expect(evidence.openQuestions).toEqual([]);
  });

  /**
   * สี่เหลี่ยมเก็บแค่สองมุมตรงข้าม แต่มันมีสี่ด้าน · ถ้าอ่านจากจุดที่เก็บตรง ๆ
   * แผงจะเขียนว่า "พื้นที่สี่เหลี่ยม 2 จุด" ซึ่งไม่ตรงกับรูปที่คนเห็นบนแบบ
   */
  it("พื้นที่สี่เหลี่ยมต้องนับสี่จุด ไม่ใช่สองจุดที่เก็บไว้", () => {
    const rect: Measurement = {
      ...room(),
      kind: "rect",
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 50 }
      ]
    };
    const evidence = explainMeasurement({
      measurement: rect,
      value: { ...value, areaSquareMetres: (100 * 50) * scale.metresPerPoint ** 2 },
      scale,
      method: "two_point",
      dimensions
    });
    if (!evidence) return;
    expect(evidence.steps[0].answer).toContain("4 จุด");
  });
});

describe("การหาเส้นที่สเกลคลาดมากที่สุด", () => {
  it("เอาเส้นที่แย่ที่สุด ไม่ใช่ค่าเฉลี่ย เพราะคนที่ท้วงจะชี้ไปที่เส้นนั้น", () => {
    const nearly: StatedDimension = { id: "a", page: 7, a: { x: 0, y: 0 }, b: { x: 226.25, y: 0 }, valueM: 10 };
    const far: StatedDimension = { id: "b", page: 7, a: { x: 0, y: 0 }, b: { x: 249, y: 0 }, valueM: 10 };
    const worst = worstScaleGap([nearly, far], scale);
    expect(worst).not.toBeNull();
    if (!worst) return;
    expect(Math.abs(worst.percent)).toBeGreaterThan(9);
  });

  it("ข้ามเส้นที่สั้นเกินไป เพราะเปอร์เซ็นต์ของระยะสั้นแกว่งจนไม่มีความหมาย", () => {
    const tiny: StatedDimension = { id: "a", page: 7, a: { x: 0, y: 0 }, b: { x: 2, y: 0 }, valueM: 0.2 };
    expect(worstScaleGap([tiny], scale)).toBeNull();
  });

  it("ไม่มีสเกลก็เทียบไม่ได้", () => {
    expect(worstScaleGap(dimensions, null)).toBeNull();
  });
});
