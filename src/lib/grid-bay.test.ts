import { describe, expect, it } from "vitest";
import { nameGridLines } from "@/lib/drawing-grid";
import {
  bayExplanation,
  bayLabel,
  gridBayFromCorners,
  DIMENSION_MATCH_METRES
} from "@/lib/grid-bay";
import type { PageScale, StatedDimension } from "@/lib/drawing-scale";

/**
 * ช่วงระหว่างแนวเสา — เทสต์ของเลขที่ใช้ประมาณราคาจริง (IP-235)
 *
 * ไฟล์นี้เฝ้าสองอย่างที่ผิดแล้วเงียบ คือการเลือกเลขผิดแหล่ง (คำนวณทั้งที่แบบเขียนไว้แล้ว)
 * และการเรียกค่าที่มาจากนิ้วว่ามาจากแนวเสา ซึ่งทำให้ใบราคาอ้างสิ่งที่ไม่จริง
 */

/** สเกลสมมติที่ทำให้ 1 พอยต์ = 0.05 เมตร ตัวเลขจึงอ่านออกด้วยตาเปล่า */
const scale: PageScale = { metresPerPoint: 0.05, ratio: 141.7 };

/** แนวเสาสองคู่ล้อมช่วงกว้าง 50 พอยต์ (2.50 ม.) ลึก 60 พอยต์ (3.00 ม.) */
const lines = nameGridLines([
  { id: "n1", page: 7, a: { x: 100, y: 0 }, b: { x: 100, y: 400 } },
  { id: "n2", page: 7, a: { x: 150, y: 0 }, b: { x: 150, y: 400 } },
  { id: "lA", page: 7, a: { x: 0, y: 200 }, b: { x: 300, y: 200 } },
  { id: "lB", page: 7, a: { x: 0, y: 260 }, b: { x: 300, y: 260 } }
]);

const cornerA = { x: 100, y: 200 };
const cornerB = { x: 150, y: 260 };

describe("ช่วงระหว่างแนวเสา", () => {
  it("สองมุมที่เกาะจุดตัด ได้พื้นที่จากกึ่งกลางเสาถึงกึ่งกลางเสา", () => {
    const bay = gridBayFromCorners(cornerA, cornerB, lines, [], scale);
    expect(bay).not.toBeNull();
    expect(bay!.across.measuredMetres).toBeCloseTo(2.5, 6);
    expect(bay!.down.measuredMetres).toBeCloseTo(3.0, 6);
    expect(bay!.areaSquareMetres).toBeCloseTo(7.5, 6);
    expect(bay!.everyCornerOnGrid).toBe(true);
    expect(bayLabel(bay!)).toBe("1-A ถึง 2-B");
  });

  /**
   * ข้อนี้คือเหตุผลที่วิธีนี้มีอยู่ ถ้าป้ายบอกว่ามาจากแนวเสาได้ทั้งที่มุมมาจากนิ้ว
   * ใบราคาจะอ้างความเที่ยงที่ไม่มีจริง และไม่มีใครรู้ตัวจนกว่าจะมีคนไปวัดแบบซ้ำ
   */
  it("มุมที่ไม่ได้อยู่บนจุดตัด ทำให้ทั้งช่วงไม่นับเป็นกึ่งกลางเสา", () => {
    const bay = gridBayFromCorners(cornerA, { x: 152, y: 260 }, lines, [], scale);
    expect(bay!.everyCornerOnGrid).toBe(false);
    expect(bayLabel(bay!)).toBeNull();
    expect(bay!.corners[0].intersectionLabel).toBe("1-A");
    expect(bay!.corners[2].intersectionLabel).toBeNull();
  });

  it("ไม่มีแนวเสาเลย ยังคำนวณพื้นที่ได้ แต่ไม่ใช่กึ่งกลางเสา", () => {
    const bay = gridBayFromCorners(cornerA, cornerB, [], [], scale);
    expect(bay!.areaSquareMetres).toBeCloseTo(7.5, 6);
    expect(bay!.everyCornerOnGrid).toBe(false);
  });

  it("สองมุมที่ทับกันหรืออยู่แนวเดียวกัน ไม่ใช่ช่วง คืน null", () => {
    expect(gridBayFromCorners(cornerA, cornerA, lines, [], scale)).toBeNull();
    expect(gridBayFromCorners(cornerA, { x: 100, y: 260 }, lines, [], scale)).toBeNull();
    expect(gridBayFromCorners(cornerA, { x: 150, y: 200 }, lines, [], scale)).toBeNull();
  });
});

describe("เลขที่แบบเขียนมาก่อนเลขที่คำนวณได้", () => {
  /** เส้นบอกระยะเขียนอยู่นอกตัวผัง ปลายตรงกับแนวเสา แต่ห่างจากผังออกไปมาก */
  const stated: StatedDimension = {
    id: "d1",
    page: 7,
    a: { x: 100, y: -80 },
    b: { x: 150, y: -80 },
    valueM: 2.5
  };

  it("เส้นระยะจริงที่พาดช่วงนี้ ชนะเลขที่คำนวณจากสเกล", () => {
    const drifted: PageScale = { metresPerPoint: 0.0505, ratio: 143.1 };
    const bay = gridBayFromCorners(cornerA, cornerB, lines, [stated], drifted);
    expect(bay!.across.measuredMetres).toBeCloseTo(2.525, 6);
    expect(bay!.across.statedMetres).toBe(2.5);
    expect(bay!.across.metres).toBe(2.5);
    expect(bay!.across.dimensionId).toBe("d1");
  });

  it("อีกด้านที่ไม่มีเส้นระยะจริงพาด ยังใช้เลขที่คำนวณได้ตามเดิม", () => {
    const bay = gridBayFromCorners(cornerA, cornerB, lines, [stated], scale);
    expect(bay!.down.statedMetres).toBeNull();
    expect(bay!.down.metres).toBeCloseTo(3.0, 6);
    expect(bay!.down.dimensionId).toBeNull();
  });

  it("เส้นที่ปลายไม่ตรงกับขอบของช่วง ไม่ถูกจับคู่", () => {
    const offBy = DIMENSION_MATCH_METRES / scale.metresPerPoint + 1;
    const elsewhere: StatedDimension = { ...stated, a: { x: 100 - offBy, y: -80 } };
    const bay = gridBayFromCorners(cornerA, cornerB, lines, [elsewhere], scale);
    expect(bay!.across.statedMetres).toBeNull();
  });

  it("เส้นที่วางตั้งฉากกับช่วง ไม่ถูกจับคู่แม้ปลายจะอยู่ในระยะ", () => {
    const crossways: StatedDimension = {
      id: "d2",
      page: 7,
      a: { x: 120, y: 200 },
      b: { x: 120, y: 260 },
      valueM: 9.99
    };
    const bay = gridBayFromCorners(cornerA, cornerB, lines, [crossways], scale);
    expect(bay!.across.statedMetres).toBeNull();
    expect(bay!.down.statedMetres).toBe(9.99);
  });

  /**
   * แบบจริงมีทั้งเส้นระยะรวมทั้งอาคารและเส้นระยะช่วงย่อยซ้อนกันอยู่ ถ้าเอาเส้นแรกที่เจอ
   * คำตอบจะเปลี่ยนตามลำดับที่คนลาก ซึ่งขัดกับหลักข้อแรกของแพลตฟอร์มว่าถามซ้ำได้คำตอบเดิม
   */
  it("เจอหลายเส้นในระยะ เอาเส้นที่ปลายตรงที่สุด ไม่ใช่เส้นแรก", () => {
    const looser: StatedDimension = {
      id: "หลวม",
      page: 7,
      a: { x: 101, y: -60 },
      b: { x: 149, y: -60 },
      valueM: 9.99
    };
    const bay = gridBayFromCorners(cornerA, cornerB, lines, [looser, stated], scale);
    expect(bay!.across.dimensionId).toBe("d1");
  });
});

describe("บรรทัดวิธีคิด", () => {
  it("บอกช่วง วิธีวัด และตัวคูณทั้งสองด้าน", () => {
    const bay = gridBayFromCorners(cornerA, cornerB, lines, [], scale);
    const text = bayExplanation(bay!);
    expect(text).toContain("ช่วง 1-A ถึง 2-B");
    expect(text).toContain("วัดกึ่งกลางเสาถึงกึ่งกลางเสา");
    expect(text).toContain("2.50 × 3.00 = 7.50 ตร.ม.");
  });

  it("ช่วงที่คนชี้เอง ไม่อ้างว่ามาจากแนวเสา", () => {
    const bay = gridBayFromCorners(cornerA, { x: 152, y: 260 }, lines, [], scale);
    const text = bayExplanation(bay!);
    expect(text).toContain("วัดจากจุดที่คนชี้เอง");
    expect(text).not.toContain("กึ่งกลางเสาถึงกึ่งกลางเสา");
  });

  it("ด้านที่ใช้เลขที่แบบเขียน บอกความต่างจากที่วัดได้", () => {
    const stated: StatedDimension = {
      id: "d1",
      page: 7,
      a: { x: 100, y: -80 },
      b: { x: 150, y: -80 },
      valueM: 2.5
    };
    const drifted: PageScale = { metresPerPoint: 0.0505, ratio: 143.1 };
    const text = bayExplanation(gridBayFromCorners(cornerA, cornerB, lines, [stated], drifted)!);
    expect(text).toContain("ใช้เลขที่แบบเขียน 2.50 ม.");
    expect(text).toContain("วัดได้ 2.53 ม.");
    expect(text).toContain("ต่างกัน 0.03 ม.");
  });
});
