import { describe, expect, it } from "vitest";
import {
  ANGLE_LOCK_STEP_DEGREES,
  areaInSquareMetres,
  calibrate,
  calibrateFromDimension,
  dimensionDisagreement,
  distancePoints,
  formatScaleRatio,
  lengthInMetres,
  lockToAngle,
  lockToAxis,
  MIN_CALIBRATION_POINTS,
  polygonAreaPoints,
  polygonPerimeterPoints,
  polylineLengthPoints,
  POINTS_PER_METRE,
  segmentLengthsPoints,
  type PagePoint,
  type StatedDimension
} from "@/lib/drawing-scale";

const scaleOf = (input: Parameters<typeof calibrate>[0]) => {
  const result = calibrate(input);
  if (!result.ok) throw new Error(`สอบเทียบไม่ผ่าน: ${result.reason}`);
  return result.scale;
};

describe("การสอบเทียบสเกล", () => {
  it("เส้นที่ลากทาบระยะ 8.50 เมตรในแบบ ให้สเกลที่แปลงกลับได้เท่าเดิม", () => {
    const scale = scaleOf({ measuredPoints: 340, realDistance: 8.5, unit: "m" });
    expect(lengthInMetres(340, scale)).toBeCloseTo(8.5, 10);
  });

  it("หน่วยเซนติเมตรและมิลลิเมตรให้สเกลเดียวกับเมตรเมื่อระยะจริงเท่ากัน", () => {
    const metres = scaleOf({ measuredPoints: 200, realDistance: 2, unit: "m" });
    const centimetres = scaleOf({ measuredPoints: 200, realDistance: 200, unit: "cm" });
    const millimetres = scaleOf({ measuredPoints: 200, realDistance: 2000, unit: "mm" });
    expect(centimetres.metresPerPoint).toBeCloseTo(metres.metresPerPoint, 12);
    expect(millimetres.metresPerPoint).toBeCloseTo(metres.metresPerPoint, 12);
  });

  it("แบบที่พิมพ์เท่าขนาดจริงตามสเกล 1:100 ให้อัตราส่วน 1:100", () => {
    // 1 เมตรจริง ย่อ 100 เท่าบนกระดาษ = 1/100 เมตรบนกระดาษ = POINTS_PER_METRE/100 point
    const scale = scaleOf({ measuredPoints: POINTS_PER_METRE / 100, realDistance: 1, unit: "m" });
    expect(scale.ratio).toBeCloseTo(100, 9);
    expect(formatScaleRatio(scale)).toBe("1:100");
  });

  it("ปฏิเสธเมื่อยังไม่ได้ลากเส้น", () => {
    expect(calibrate({ measuredPoints: 0, realDistance: 8.5, unit: "m" })).toEqual({
      ok: false,
      reason: "measured_not_positive"
    });
  });

  it("ปฏิเสธระยะจริงที่ไม่เป็นบวก เพราะสเกลศูนย์ทำให้ทุกปริมาณเป็นศูนย์เงียบ ๆ", () => {
    expect(calibrate({ measuredPoints: 340, realDistance: 0, unit: "m" })).toEqual({
      ok: false,
      reason: "real_not_positive"
    });
    expect(calibrate({ measuredPoints: 340, realDistance: -3, unit: "m" })).toEqual({
      ok: false,
      reason: "real_not_positive"
    });
  });

  it("ปฏิเสธเส้นสอบเทียบที่สั้นเกินไป เพราะคลิกพลาดนิดเดียวทำให้สเกลเพี้ยนมาก", () => {
    expect(calibrate({ measuredPoints: MIN_CALIBRATION_POINTS - 1, realDistance: 8.5, unit: "m" })).toEqual({
      ok: false,
      reason: "measured_too_short"
    });
    expect(calibrate({ measuredPoints: MIN_CALIBRATION_POINTS, realDistance: 8.5, unit: "m" }).ok).toBe(true);
  });

  it("ไม่ปัดอัตราส่วนที่ห่างจากเลขกลม เพราะการปัดคือการซ่อนว่าแบบถูกย่อมา", () => {
    const scale = scaleOf({ measuredPoints: 100, realDistance: 5.4809, unit: "m" });
    expect(formatScaleRatio(scale)).toBe("1:155.36");
    expect(formatScaleRatio(scale)).not.toBe("1:155");
  });
});

describe("เรขาคณิตบนหน้าแบบ", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 }
  ];

  it("ระยะสองจุดคือระยะตรง", () => {
    expect(distancePoints({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("เส้นต่อเนื่องรวมทุกช่วง และบอกความยาวรายช่วงได้", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 3, y: 4 },
      { x: 3, y: 14 }
    ];
    expect(polylineLengthPoints(path)).toBe(15);
    expect(segmentLengthsPoints(path)).toEqual([5, 10]);
  });

  it("พื้นที่สี่เหลี่ยมจัตุรัสด้านละ 100 คือ 10000", () => {
    expect(polygonAreaPoints(square)).toBe(10_000);
  });

  it("คลิกไล่มุมตามเข็มหรือทวนเข็มได้พื้นที่เท่ากัน", () => {
    expect(polygonAreaPoints([...square].reverse())).toBe(polygonAreaPoints(square));
  });

  it("เส้นรอบรูปนับด้านสุดท้ายที่ปิดกลับมาจุดแรกด้วย", () => {
    expect(polygonPerimeterPoints(square)).toBe(400);
    expect(polylineLengthPoints(square)).toBe(300);
  });

  it("รูปที่มีไม่ถึงสามจุดยังไม่เป็นรูปปิด พื้นที่จึงเป็นศูนย์ ไม่ใช่ค่าเดา", () => {
    expect(polygonAreaPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe(0);
    expect(polygonPerimeterPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe(0);
  });

  it("รูปตัวแอลคำนวณได้ถูกต้อง ไม่ใช่เฉพาะสี่เหลี่ยม", () => {
    const ell = [
      { x: 0, y: 0 },
      { x: 60, y: 0 },
      { x: 60, y: 20 },
      { x: 20, y: 20 },
      { x: 20, y: 50 },
      { x: 0, y: 50 }
    ];
    // 60x20 = 1200 บวก 20x30 = 600
    expect(polygonAreaPoints(ell)).toBe(1_800);
  });
});

describe("การแปลงเป็นหน่วยจริง", () => {
  it("ห้องกว้าง 4 ยาว 5 เมตรบนสเกล 1:100 ได้ 20 ตารางเมตร", () => {
    const scale = scaleOf({ measuredPoints: POINTS_PER_METRE / 100, realDistance: 1, unit: "m" });
    const pointsPerMetre = POINTS_PER_METRE / 100;
    const room = [
      { x: 0, y: 0 },
      { x: 4 * pointsPerMetre, y: 0 },
      { x: 4 * pointsPerMetre, y: 5 * pointsPerMetre },
      { x: 0, y: 5 * pointsPerMetre }
    ];
    expect(areaInSquareMetres(polygonAreaPoints(room), scale)).toBeCloseTo(20, 9);
    expect(lengthInMetres(polygonPerimeterPoints(room), scale)).toBeCloseTo(18, 9);
  });

  it("สเกลเข้าสูตรพื้นที่สองครั้ง สเกลผิดเท่าตัวทำให้พื้นที่ผิดสี่เท่า", () => {
    const right = scaleOf({ measuredPoints: 200, realDistance: 10, unit: "m" });
    const doubled = scaleOf({ measuredPoints: 200, realDistance: 20, unit: "m" });
    expect(areaInSquareMetres(10_000, doubled)).toBeCloseTo(areaInSquareMetres(10_000, right) * 4, 9);
  });
});

describe("การบังคับแนว", () => {
  it("ลากออกด้านข้างมากกว่าขึ้นลง ได้เส้นแนวนอน", () => {
    expect(lockToAxis({ x: 10, y: 10 }, { x: 90, y: 25 })).toEqual({ x: 90, y: 10 });
  });

  it("ลากขึ้นลงมากกว่าออกด้านข้าง ได้เส้นแนวตั้ง", () => {
    expect(lockToAxis({ x: 10, y: 10 }, { x: 18, y: 95 })).toEqual({ x: 10, y: 95 });
  });
});

describe("ล็อกแนวเส้นทีละ 15 องศา", () => {
  const origin = { x: 0, y: 0 };
  const degreesOf = (point: PagePoint) => (Math.atan2(point.y, point.x) * 180) / Math.PI;
  const pointAt = (degrees: number, length: number) => ({
    x: Math.cos((degrees * Math.PI) / 180) * length,
    y: Math.sin((degrees * Math.PI) / 180) * length
  });

  it("ปัดมุม 17 องศาลงมาที่ 15 และปัด 22.6 องศาขึ้นไปที่ 30", () => {
    expect(degreesOf(lockToAngle(origin, pointAt(17, 100)))).toBeCloseTo(15, 9);
    expect(degreesOf(lockToAngle(origin, pointAt(22.6, 100)))).toBeCloseTo(30, 9);
  });

  it("ความยาวไม่เปลี่ยนเลยไม่ว่าปัดมุมไปเท่าไหร่ เพราะตัวเลขที่ผู้ใช้เห็นห้ามขยับตอนกดล็อก", () => {
    for (let degrees = 0; degrees < 360; degrees += 7) {
      const target = pointAt(degrees, 137.5);
      const locked = lockToAngle(origin, target);
      expect(Math.hypot(locked.x, locked.y)).toBeCloseTo(137.5, 9);
    }
  });

  it("ทุกมุมรอบวงตกลงบนทวีคูณของ 15 องศาเสมอ ครบ 24 ทิศ", () => {
    const landed = new Set<number>();
    for (let degrees = -180; degrees < 180; degrees += 1) {
      const locked = lockToAngle(origin, pointAt(degrees, 50));
      const angle = degreesOf(locked);
      expect(Math.abs(angle / ANGLE_LOCK_STEP_DEGREES - Math.round(angle / ANGLE_LOCK_STEP_DEGREES))).toBeLessThan(1e-9);
      // atan2 คืนค่าในช่วง (-180, 180] ทิศเดียวกันจึงโผล่เป็น -180 กับ 180 ได้ ต้องรวบก่อนนับ
      landed.add(Math.round(((angle % 360) + 360) % 360));
    }
    expect(landed.size).toBe(24);
  });

  it("เคารพขั้นองศาที่ส่งเข้ามา เพราะเครื่องมือร่างกริดต้องล็อก 90 องศาล้วน", () => {
    expect(degreesOf(lockToAngle(origin, pointAt(40, 10), 90))).toBeCloseTo(0, 9);
    expect(degreesOf(lockToAngle(origin, pointAt(50, 10), 90))).toBeCloseTo(90, 9);
  });

  it("คืนจุดเดิมเมื่อยังไม่ได้ลากไปไหน หรือขั้นองศาไม่สมเหตุสมผล", () => {
    expect(lockToAngle({ x: 7, y: 9 }, { x: 7, y: 9 })).toEqual({ x: 7, y: 9 });
    expect(lockToAngle(origin, { x: 10, y: 10 }, 0)).toEqual({ x: 10, y: 10 });
  });
});

describe("ระยะจริงที่แบบเขียนกำกับ", () => {
  const gridSpan: StatedDimension = {
    id: "d1",
    page: 7,
    a: { x: 177.84, y: 400 },
    b: { x: 291.15, y: 400 },
    valueM: 5
  };

  it("ตั้งสเกลจากช่วงกริดจริงบนหน้า 7 ได้ 1:125 ตรงกับที่หัวแบบระบุ", () => {
    const result = calibrateFromDimension(gridSpan);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scale.ratio).toBeCloseTo(125, 0);
  });

  it("ปฏิเสธช่วงที่สั้นเกินไปด้วยเหตุผลเดิม เพราะความผิดพลาดจะติดไปทั้งหน้า", () => {
    const tiny: StatedDimension = { ...gridSpan, b: { x: 177.84 + 5, y: 400 } };
    const result = calibrateFromDimension(tiny);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("measured_too_short");
  });

  it("ยังไม่มีสเกลก็ยังเทียบความต่างไม่ได้", () => {
    expect(dimensionDisagreement(gridSpan, null)).toBeNull();
  });

  it("บอกความต่างพร้อมเครื่องหมาย เมื่อระยะที่วัดได้ยาวกว่าที่แบบเขียน", () => {
    const scale = scaleOf({ measuredPoints: 113.31, realDistance: 5, unit: "m" });
    const shortStated: StatedDimension = { ...gridSpan, valueM: 4.8 };
    const gap = dimensionDisagreement(shortStated, scale);
    expect(gap).not.toBeNull();
    expect(gap!.statedM).toBe(4.8);
    expect(gap!.measuredM).toBeCloseTo(5, 2);
    expect(gap!.differenceM).toBeGreaterThan(0);
    expect(gap!.differenceM).toBeCloseTo(gap!.measuredM - 4.8, 9);
  });
});
