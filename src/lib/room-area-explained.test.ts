import { describe, expect, it } from "vitest";
import { explainRoomArea } from "@/lib/room-area-explained";
import { POINTS_PER_METRE, areaInSquareMetres, polygonAreaPoints } from "@/lib/drawing-scale";

/** สเกลของหน้า 7 แบบโรงพยาบาลกุสุมาลย์ ที่ยืนยันไว้จริงในฐาน — 1:124.60 */
const scale = { metresPerPoint: 0.04395604, ratio: 0.04395604 * POINTS_PER_METRE };

/** สี่เหลี่ยมกว้าง w เมตร ลึก d เมตร วางตามแนวกระดาษ */
function rectangle(widthMetres: number, depthMetres: number) {
  const w = widthMetres / scale.metresPerPoint;
  const d = depthMetres / scale.metresPerPoint;
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: d },
    { x: 0, y: d }
  ];
}

describe("กางวิธีคิดของพื้นที่ห้อง (IP-238)", () => {
  it("ห้องสี่เหลี่ยม กว้างคูณลึกต้องเท่ากับพื้นที่ที่รายงาน", () => {
    const points = rectangle(2.26, 1.76);
    const area = areaInSquareMetres(polygonAreaPoints(points), scale);
    const out = explainRoomArea(points, scale, area);
    expect(out).not.toBeNull();
    expect(out!.widthMetres).toBeCloseTo(2.26, 6);
    expect(out!.depthMetres).toBeCloseTo(1.76, 6);
    expect(out!.boundingAreaSquareMetres).toBeCloseTo(area, 6);
    expect(out!.fillRatio).toBeCloseTo(1, 6);
    expect(out!.sideCount).toBe(4);
  });

  /**
   * เลขที่เจ้าของงานถามถึงจริง ๆ เมื่อ 2026-09-05
   *
   * เขาเห็น 3.98 บนจอทั้งที่เส้นบอกระยะเขียนว่าช่วงนี้ 2.50 × 2.00 · เทสต์นี้ตรึงไว้ว่า
   * 3.98 ตรงกับรูปขนาด 2.26 × 1.76 เพื่อให้คำอธิบายบนจอกับเลขบนจอมาจากรูปเดียวกันเสมอ
   */
  it("รูป 2.26 × 1.76 ให้พื้นที่ 3.98 ตร.ม. ตรงกับที่เขาเห็นบนจอ", () => {
    const points = rectangle(2.26, 1.76);
    const area = areaInSquareMetres(polygonAreaPoints(points), scale);
    expect(Number(area.toFixed(2))).toBe(3.98);
  });

  it("ห้องรูปตัวแอลบอกได้ว่ารูปกินกรอบไม่เต็ม จึงไม่ต้องให้คนเดาว่าทำไมไม่เท่ากัน", () => {
    const w = 2.0 / scale.metresPerPoint;
    const d = 2.0 / scale.metresPerPoint;
    const points = [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: d / 2 },
      { x: w / 2, y: d / 2 },
      { x: w / 2, y: d },
      { x: 0, y: d }
    ];
    const area = areaInSquareMetres(polygonAreaPoints(points), scale);
    const out = explainRoomArea(points, scale, area)!;
    expect(out.sideCount).toBe(6);
    expect(out.boundingAreaSquareMetres).toBeCloseTo(4, 6);
    expect(out.fillRatio).toBeCloseTo(0.75, 6);
  });

  it("ไม่มีสเกล ไม่มีรูป หรือไม่มีพื้นที่ ตอบ null ไม่เดา", () => {
    expect(explainRoomArea(rectangle(2, 2), null, 4)).toBeNull();
    expect(explainRoomArea([{ x: 0, y: 0 }], scale, 4)).toBeNull();
    expect(explainRoomArea(rectangle(2, 2), scale, null)).toBeNull();
  });

  it("รูปแบนสนิทไม่ทำให้หารด้วยศูนย์", () => {
    const out = explainRoomArea(
      [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 }
      ],
      scale,
      0
    )!;
    expect(out.fillRatio).toBe(0);
    expect(Number.isFinite(out.fillRatio)).toBe(true);
  });
});
