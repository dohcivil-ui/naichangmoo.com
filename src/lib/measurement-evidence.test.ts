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

describe("การกางวิธีคิดของรายการวัด", () => {
  it("ตอบสี่คำถามที่คนอ่านจะถาม เรียงตามลำดับที่เขาถาม", () => {
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
      const numbers = (line.match(/[\d.]+/g) ?? []).map(Number);
      const [points, perPoint, metres] = numbers;
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
    expect(step.working).toContain("คลาด");
  });

  /**
   * ทางแยกข้อสองของแผน — ตอนแบบยังไม่มีเส้นบอกระยะให้เทียบ จะบอกอย่างไร
   * เลือกทาง "ขึ้นป้ายบอกตรง ๆ" ไม่ใช่ทาง "กันไม่ให้ส่งเข้าถอดปริมาณ" เพราะทางหลัง
   * เปลี่ยนพฤติกรรมของแอป ซึ่งเป็นคำตัดสินที่เจ้าของงานยังไม่ได้เคาะ
   */
  it("หน้าที่ไม่มีระยะให้เทียบ ต้องบอกว่ายังเทียบไม่ได้ ไม่ใช่เงียบ", () => {
    const evidence = explainMeasurement({
      measurement: room(),
      value,
      scale,
      method: "two_point",
      dimensions: []
    });
    if (!evidence) return;
    expect(evidence.steps[2].working).toBeNull();
    expect(evidence.openQuestions.join(" ")).toContain("ยังไม่มีระยะที่แบบเขียนให้เทียบ");
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
