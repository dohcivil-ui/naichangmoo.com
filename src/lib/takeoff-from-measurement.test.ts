import { describe, expect, it } from "vitest";

import { measure, type Measurement } from "@/lib/drawing-measurement";
import { POINTS_PER_METRE, type PageScale } from "@/lib/drawing-scale";
import { measurementSubtotal } from "@/lib/takeoff-measurement";
import { toFiledLine } from "@/lib/takeoff-from-measurement";

/**
 * สะพานจากรอยวัดไป backup sheet (IP-234)
 *
 * ข้อที่เฝ้าการตัดสินใจคือ "เลขที่ลงฐานเท่ากับเลขที่หน้าจอโชว์" — measurementSubtotal ของบรรทัด
 * ที่ได้ ต้องเท่ากับค่าจาก measure() ในระดับหกตำแหน่ง ถ้าวันหนึ่งมีใครคำนวณซ้ำในไฟล์นี้
 * แล้วปัดคนละแบบ เทสต์นี้ต้องแดง
 */

// สเกล 1:100 — หนึ่งเมตรจริงคือ POINTS_PER_METRE / 100 จุดบนกระดาษ
const scale: PageScale = { metresPerPoint: 100 / POINTS_PER_METRE, ratio: 100 };
const pt = POINTS_PER_METRE / 100;

const make = (over: Partial<Measurement> & Pick<Measurement, "kind" | "points">): Measurement => ({
  id: "m1",
  page: 7,
  name: "",
  colour: "var(--teal)",
  origin: "pointer",
  ...over
});

const near = (line: { count: number; dimensions: string[]; conversionFactor: string | null }, expected: number) =>
  expect(Number(measurementSubtotal(line))).toBeCloseTo(expected, 5);

describe("แปลงรอยวัดเป็นบรรทัดใน backup sheet", () => {
  it("ความยาวสองจุดเป็น pointer หน่วยความยาว ตัวประกอบเดียว", () => {
    const mark = make({ kind: "length", points: [{ x: 0, y: 0 }, { x: 5 * pt, y: 0 }] });
    const result = toFiledLine(mark, scale);
    if (!result.ok) throw new Error(result.reason);
    expect(result.line.method).toBe("pointer");
    expect(result.line.unitDimension).toBe("length");
    expect(result.line.measurement.count).toBe(1);
    expect(result.line.measurement.dimensions).toEqual(["5.000000"]);
    near(result.line.measurement, measure(mark, scale).lengthMetres ?? -1);
  });

  it("ระยะต่อเนื่องรวมทุกท่อนเป็นความยาวเดียว", () => {
    const mark = make({ kind: "polyline", points: [{ x: 0, y: 0 }, { x: 3 * pt, y: 0 }, { x: 3 * pt, y: 4 * pt }] });
    const result = toFiledLine(mark, scale);
    if (!result.ok) throw new Error(result.reason);
    near(result.line.measurement, 7);
    near(result.line.measurement, measure(mark, scale).lengthMetres ?? -1);
  });

  it("สี่เหลี่ยมส่งกว้างคูณยาว และผลคูณเท่ากับพื้นที่จาก measure()", () => {
    const mark = make({ kind: "rect", points: [{ x: 0, y: 0 }, { x: 5 * pt, y: 4.9 * pt }] });
    const result = toFiledLine(mark, scale);
    if (!result.ok) throw new Error(result.reason);
    expect(result.line.unitDimension).toBe("area");
    expect(result.line.measurement.dimensions).toHaveLength(2);
    near(result.line.measurement, 24.5);
    near(result.line.measurement, measure(mark, scale).areaSquareMetres ?? -1);
  });

  it("พื้นที่ที่คนลากเองเป็น pointer ส่วนห้องที่ระบบไล่ขอบเป็น region_trace ตัวเลขเท่ากัน", () => {
    const points = [{ x: 0, y: 0 }, { x: 4 * pt, y: 0 }, { x: 4 * pt, y: 3 * pt }, { x: 0, y: 3 * pt }];
    const drawn = toFiledLine(make({ kind: "area", points, origin: "pointer" }), scale);
    const traced = toFiledLine(make({ kind: "area", points, origin: "region_trace" }), scale);
    if (!drawn.ok || !traced.ok) throw new Error("expected ok");
    expect(drawn.line.method).toBe("pointer");
    expect(traced.line.method).toBe("region_trace");
    expect(drawn.line.measurement.dimensions).toEqual(traced.line.measurement.dimensions);
    near(drawn.line.measurement, 12);
    expect(traced.line.geometry.origin).toBe("region_trace");
  });

  it("การนับจำนวนเป็น pointer_count จำนวนเท่าจุด ไม่ต้องมีสเกล และหลักฐานไม่มีสเกล", () => {
    const mark = make({ kind: "count", points: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }] });
    const result = toFiledLine(mark, null);
    if (!result.ok) throw new Error(result.reason);
    expect(result.line.method).toBe("pointer_count");
    expect(result.line.measurement.count).toBe(3);
    expect(result.line.measurement.dimensions).toEqual([]);
    expect(result.line.geometry.scale).toBeNull();
    near(result.line.measurement, 3);
  });

  it("ชนิดที่ต้องใช้สเกลแต่หน้ายังไม่ตั้ง คืน needs_scale", () => {
    const mark = make({ kind: "length", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] });
    expect(toFiledLine(mark, null)).toEqual({ ok: false, reason: "needs_scale" });
  });

  it("จุดน้อยกว่าที่ชนิดนั้นต้องใช้ คืน too_few_points", () => {
    const mark = make({ kind: "area", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] });
    expect(toFiledLine(mark, scale)).toEqual({ ok: false, reason: "too_few_points" });
  });

  it("ป้ายเป็นไทยล้วนบอกหน้าและชนิด และหลักฐานก๊อปสเกล ณ ตอนส่ง", () => {
    const mark = make({ kind: "length", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] });
    const result = toFiledLine(mark, scale);
    if (!result.ok) throw new Error(result.reason);
    expect(result.line.measurement.label).toBe("หน้า 7 · ระยะสองจุด");
    expect(result.line.geometry.scale).toEqual({ metresPerPoint: scale.metresPerPoint });
    expect(result.line.geometry.points).toEqual(mark.points);
  });

  it("ไม่มีช่องเงินหรือราคาในผลลัพธ์", () => {
    const mark = make({ kind: "length", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] });
    const result = toFiledLine(mark, scale);
    const keys = JSON.stringify(result).toLowerCase();
    for (const banned of ["price", "cost", "baht", "amount", "ราคา", "บาท"]) {
      expect(keys.includes(banned)).toBe(false);
    }
  });
});
