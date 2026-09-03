import { describe, expect, it } from "vitest";
import {
  distanceToSegment,
  hitTest,
  isComplete,
  isMeasurementKind,
  measure,
  minimumPoints,
  needsScale,
  outlinePoints,
  pointInPolygon,
  rectangleCorners,
  summarise,
  type Measurement
} from "@/lib/drawing-measurement";
import { calibrate, POINTS_PER_METRE, type PageScale } from "@/lib/drawing-scale";

/** สเกล 1:100 — หนึ่งเมตรจริงเท่ากับ POINTS_PER_METRE/100 point บนกระดาษ */
const scale100: PageScale = (() => {
  const result = calibrate({ measuredPoints: POINTS_PER_METRE / 100, realDistance: 1, unit: "m" });
  if (!result.ok) throw new Error("สอบเทียบตัวอย่างไม่ผ่าน");
  return result.scale;
})();

const pt = POINTS_PER_METRE / 100;

const make = (over: Partial<Measurement> & Pick<Measurement, "kind" | "points">): Measurement => ({
  id: over.id ?? "m1",
  page: over.page ?? 1,
  name: over.name ?? "",
  colour: over.colour ?? "var(--teal)",
  origin: over.origin ?? "pointer",
  ...over
});

describe("ชนิดของการวัด", () => {
  it("การนับจำนวนไม่ต้องใช้สเกล ชนิดอื่นต้องใช้", () => {
    expect(needsScale("count")).toBe(false);
    expect(needsScale("length")).toBe(true);
    expect(needsScale("area")).toBe(true);
  });

  it("พื้นที่หลายเหลี่ยมต้องมีอย่างน้อยสามจุด สองจุดยังไม่เป็นรูป", () => {
    expect(minimumPoints("area")).toBe(3);
    expect(isComplete(make({ kind: "area", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }))).toBe(false);
  });

  it("สี่เหลี่ยมเก็บสองมุมตรงข้าม แล้วกางเป็นสี่มุมตอนคำนวณ", () => {
    expect(rectangleCorners([{ x: 10, y: 20 }, { x: 40, y: 60 }])).toEqual([
      { x: 10, y: 20 },
      { x: 40, y: 20 },
      { x: 40, y: 60 },
      { x: 10, y: 60 }
    ]);
    expect(outlinePoints(make({ kind: "rect", points: [{ x: 0, y: 0 }, { x: 4, y: 5 }] }))).toHaveLength(4);
  });
});

describe("การคำนวณค่าของรายการวัด", () => {
  it("ห้อง 4x5 เมตรได้พื้นที่ 20 ตารางเมตร และเส้นรอบรูป 18 เมตร", () => {
    const room = make({ kind: "rect", points: [{ x: 0, y: 0 }, { x: 4 * pt, y: 5 * pt }] });
    const value = measure(room, scale100);
    expect(value.areaSquareMetres).toBeCloseTo(20, 6);
    expect(value.perimeterMetres).toBeCloseTo(18, 6);
  });

  it("พื้นที่คืนเส้นรอบรูปมาด้วยเสมอ เพราะเอาไปคูณความสูงคิดงานผนังต่อได้ทันที", () => {
    const room = make({ kind: "area", points: [
      { x: 0, y: 0 },
      { x: 3 * pt, y: 0 },
      { x: 3 * pt, y: 3 * pt },
      { x: 0, y: 3 * pt }
    ] });
    const value = measure(room, scale100);
    expect(value.areaSquareMetres).toBeCloseTo(9, 6);
    expect(value.perimeterMetres).toBeCloseTo(12, 6);
  });

  it("ระยะต่อเนื่องบอกความยาวรายช่วง ไม่ใช่แค่ยอดรวม", () => {
    const wall = make({ kind: "polyline", points: [
      { x: 0, y: 0 },
      { x: 3 * pt, y: 0 },
      { x: 3 * pt, y: 4 * pt }
    ] });
    const value = measure(wall, scale100);
    expect(value.lengthMetres).toBeCloseTo(7, 6);
    expect(value.segmentsMetres.map((s) => Number(s.toFixed(4)))).toEqual([3, 4]);
  });

  it("การนับจำนวนได้ค่าแม้ยังไม่ตั้งสเกล", () => {
    const marks = make({ kind: "count", points: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }] });
    expect(measure(marks, null).count).toBe(3);
    expect(measure(marks, null).blockedByScale).toBe(false);
  });

  it("ชนิดที่ต้องใช้สเกลแต่ยังไม่มีสเกล คืนค่าว่างพร้อมธงกั้นไว้ ไม่ใช่คืนศูนย์", () => {
    const wall = make({ kind: "length", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] });
    const value = measure(wall, null);
    expect(value.lengthMetres).toBeNull();
    expect(value.blockedByScale).toBe(true);
  });
});

describe("การสรุปรวม", () => {
  const scaleForAll = () => scale100;

  it("รายการของหน้า 1 ไม่ปนกับหน้า 2 — เส้นค้างข้ามหน้าเป็นไปไม่ได้ตั้งแต่โครงสร้างข้อมูล", () => {
    const items: Measurement[] = [
      make({ id: "a", page: 1, kind: "length", points: [{ x: 0, y: 0 }, { x: 2 * pt, y: 0 }] }),
      make({ id: "b", page: 2, kind: "length", points: [{ x: 0, y: 0 }, { x: 5 * pt, y: 0 }] }),
      make({ id: "c", page: 1, kind: "length", points: [{ x: 0, y: 0 }, { x: 3 * pt, y: 0 }] })
    ];
    const summary = summarise(items, scaleForAll);

    expect(summary.pages.map((group) => group.page)).toEqual([1, 2]);
    expect(summary.pages[0].rows.map((row) => row.measurement.id)).toEqual(["a", "c"]);
    expect(summary.pages[1].rows.map((row) => row.measurement.id)).toEqual(["b"]);
    expect(summary.pages[0].totalLengthMetres).toBeCloseTo(5, 6);
    expect(summary.pages[1].totalLengthMetres).toBeCloseTo(5, 6);
  });

  it("ยอดรวมตามชนิดคือผลรวมของทุกหน้า", () => {
    const items: Measurement[] = [
      make({ id: "a", page: 1, kind: "area", points: [{ x: 0, y: 0 }, { x: 2 * pt, y: 3 * pt }] }),
      make({ id: "b", page: 2, kind: "area", points: [{ x: 0, y: 0 }, { x: 4 * pt, y: 5 * pt }] })
    ];
    // ทั้งสองเป็นชนิดพื้นที่หลายเหลี่ยมที่มีสองจุด จึงยังไม่ครบรูป
    const incomplete = summarise(items, scaleForAll);
    expect(incomplete.kinds.find((total) => total.kind === "area")?.areaSquareMetres).toBe(0);

    const rects = items.map((item) => ({ ...item, kind: "rect" as const }));
    const summary = summarise(rects, scaleForAll);
    const areaTotal = summary.kinds.find((total) => total.kind === "rect");
    expect(areaTotal?.items).toBe(2);
    expect(areaTotal?.areaSquareMetres).toBeCloseTo(6 + 20, 5);
  });

  it("รายการที่ยังรอสเกลไม่ถูกนับเข้ายอดรวม และถูกชูธงไว้ให้เห็น", () => {
    const items: Measurement[] = [
      make({ id: "a", page: 1, kind: "length", points: [{ x: 0, y: 0 }, { x: 2 * pt, y: 0 }] }),
      make({ id: "b", page: 2, kind: "length", points: [{ x: 0, y: 0 }, { x: 9 * pt, y: 0 }] })
    ];
    const summary = summarise(items, (page) => (page === 1 ? scale100 : null));

    expect(summary.hasBlockedRows).toBe(true);
    expect(summary.pages[1].totalLengthMetres).toBe(0);
    expect(summary.kinds.find((total) => total.kind === "length")?.lengthMetres).toBeCloseTo(2, 6);
  });

  it("ชนิดที่ไม่มีรายการเลยไม่ขึ้นในตารางสรุป", () => {
    const summary = summarise(
      [make({ id: "a", kind: "count", points: [{ x: 1, y: 1 }] })],
      scaleForAll
    );
    expect(summary.kinds.map((total) => total.kind)).toEqual(["count"]);
  });
});

describe("ชื่อเครื่องมือที่เป็นชนิดของการวัดจริง", () => {
  it("เครื่องมือช่วยอย่างเลือก เลื่อน ตั้งสเกล ไม่ใช่ชนิดของการวัด", () => {
    expect(isMeasurementKind("select")).toBe(false);
    expect(isMeasurementKind("pan")).toBe(false);
    expect(isMeasurementKind("scale")).toBe(false);
    expect(isMeasurementKind("room")).toBe(false);
  });

  it("ชนิดที่วัดได้จริงทั้งห้าตัวผ่าน", () => {
    for (const kind of ["length", "polyline", "area", "rect", "count"]) {
      expect(isMeasurementKind(kind)).toBe(true);
    }
  });
});

describe("การคลิกเลือกรูปที่วัดไว้บนแบบ", () => {
  const square = make({
    id: "area1",
    kind: "area",
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ]
  });
  const line = make({ id: "line1", kind: "length", points: [{ x: 200, y: 0 }, { x: 300, y: 0 }] });
  const dots = make({ id: "count1", kind: "count", points: [{ x: 400, y: 400 }] });

  it("คลิกในเนื้อที่ของรูปปิด ถือว่าเลือกรูปนั้น", () => {
    expect(hitTest([square], { x: 50, y: 50 }, 3)).toBe("area1");
  });

  it("คลิกนอกรูปและไกลจากทุกเส้น ไม่เลือกอะไรเลย", () => {
    expect(hitTest([square, line, dots], { x: 150, y: 150 }, 3)).toBeNull();
  });

  it("คลิกใกล้เส้นในระยะผ่อนผัน ถือว่าโดนเส้น", () => {
    expect(hitTest([line], { x: 250, y: 2 }, 3)).toBe("line1");
    expect(hitTest([line], { x: 250, y: 9 }, 3)).toBeNull();
  });

  it("คลิกใกล้จุดนับ ถือว่าโดนจุดนั้น", () => {
    expect(hitTest([dots], { x: 402, y: 401 }, 4)).toBe("count1");
  });

  it("รูปที่วาดทีหลังทับอยู่ข้างบน จึงถูกเลือกก่อน", () => {
    const later = make({
      id: "area2",
      kind: "rect",
      points: [{ x: 20, y: 20 }, { x: 80, y: 80 }]
    });
    expect(hitTest([square, later], { x: 50, y: 50 }, 3)).toBe("area2");
  });

  it("สี่เหลี่ยมที่เก็บแค่สองมุมยังเลือกจากเนื้อที่ได้", () => {
    const rect = make({ id: "r", kind: "rect", points: [{ x: 0, y: 0 }, { x: 40, y: 60 }] });
    expect(hitTest([rect], { x: 20, y: 30 }, 1)).toBe("r");
    expect(hitTest([rect], { x: 60, y: 30 }, 1)).toBeNull();
  });
});

describe("เรขาคณิตที่การเลือกใช้", () => {
  it("จุดในและนอกรูปหลายเหลี่ยมแยกออกจากกัน", () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ];
    expect(pointInPolygon({ x: 5, y: 5 }, polygon)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, polygon)).toBe(false);
  });

  it("ระยะถึงส่วนของเส้นวัดจากปลายเส้น ไม่ใช่จากเส้นที่ยาวไม่สิ้นสุด", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 10, y: 0 };
    expect(distanceToSegment({ x: 5, y: 3 }, from, to)).toBeCloseTo(3, 6);
    expect(distanceToSegment({ x: 14, y: 0 }, from, to)).toBeCloseTo(4, 6);
  });
});
