import { describe, expect, it } from "vitest";
import {
  collectSnapGeometry,
  DEFAULT_SNAP_SETTINGS,
  findGeometrySnap,
  findImageSnap,
  GRID_FALLBACK_SPACING_POINTS,
  IMAGE_LUMINANCE_CEILING,
  IMAGE_SNAP_MAX_RADIUS_PX,
  type Segment,
  type SnapSettings
} from "@/lib/drawing-snap";
import type { Measurement } from "@/lib/drawing-measurement";
import type { DraftedGridLine } from "@/lib/drawing-grid";
import type { StatedDimension } from "@/lib/drawing-scale";

const only = (...kinds: (keyof SnapSettings)[]): SnapSettings => ({
  ...DEFAULT_SNAP_SETTINGS,
  endpoint: false,
  midpoint: false,
  intersection: false,
  perpendicular: false,
  onEdge: false,
  grid: false,
  imageSnap: false,
  ...Object.fromEntries(kinds.map((kind) => [kind, true]))
});

const snapWith = (
  settings: SnapSettings,
  cursor: { x: number; y: number },
  segments: Segment[],
  extra?: { lastPlaced?: { x: number; y: number }; loosePoints?: { x: number; y: number }[]; radius?: number }
) =>
  findGeometrySnap({
    cursor,
    radiusPagePoints: extra?.radius ?? 12,
    geometry: { segments, loosePoints: extra?.loosePoints ?? [] },
    lastPlaced: extra?.lastPlaced ?? null,
    metresPerPoint: null,
    settings
  });

const wall: Segment = { a: { x: 100, y: 100 }, b: { x: 300, y: 100 } };

describe("ค่าเริ่มต้นของการดูดจุด", () => {
  it("ตรงกับแอปเดิมของเจ้าของงานทุกช่อง เพราะเขาเคาะว่ายกมาทั้งชุด", () => {
    expect(DEFAULT_SNAP_SETTINGS).toEqual({
      enabled: true,
      endpoint: true,
      midpoint: true,
      intersection: true,
      perpendicular: false,
      onEdge: false,
      grid: false,
      imageSnap: false,
      imageSensitivity: "normal",
      screenRadius: 12,
      gridSpacingM: 0.5
    });
  });

  it("เพดานความสว่างสามระดับตรงกับแอปเดิม", () => {
    expect(IMAGE_LUMINANCE_CEILING).toEqual({ dark: 90, normal: 130, faint: 170 });
  });
});

describe("รวบรวมเรขาคณิตของหน้า", () => {
  const measurement = (over: Partial<Measurement>): Measurement => ({
    id: "m",
    page: 7,
    kind: "length",
    name: "",
    colour: "var(--ink)",
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 }
    ],
    ...over
  });

  it("เส้นเปิดได้ขอบเท่าจำนวนช่วง ไม่มีขอบปิดวง", () => {
    const { segments } = collectSnapGeometry([measurement({ kind: "polyline", points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 }
    ] })], [], [], 7);
    expect(segments).toHaveLength(2);
  });

  it("รูปปิดนับขอบที่ปิดวงด้วย เพราะขอบนั้นมีอยู่จริงในสายตาผู้ใช้", () => {
    const { segments } = collectSnapGeometry([measurement({ kind: "area", points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 }
    ] })], [], [], 7);
    expect(segments).toHaveLength(3);
  });

  it("สี่เหลี่ยมที่เก็บแค่สองมุมถูกกางเป็นสี่ขอบ", () => {
    const { segments } = collectSnapGeometry([measurement({ kind: "rect", points: [
      { x: 0, y: 0 },
      { x: 10, y: 10 }
    ] })], [], [], 7);
    expect(segments).toHaveLength(4);
  });

  it("หมุดนับจำนวนเข้ากองจุดเดี่ยว ไม่กลายเป็นเส้น", () => {
    const { segments, loosePoints } = collectSnapGeometry([measurement({ kind: "count", points: [
      { x: 1, y: 1 },
      { x: 2, y: 2 }
    ] })], [], [], 7);
    expect(segments).toHaveLength(0);
    expect(loosePoints).toHaveLength(2);
  });

  it("รับเส้นกริดและระยะจริงเข้ามาเป็นเส้นให้ดูดได้ด้วย", () => {
    const gridLine: DraftedGridLine = { id: "g", page: 7, a: { x: 0, y: 0 }, b: { x: 0, y: 50 } };
    const dimension: StatedDimension = { id: "d", page: 7, a: { x: 5, y: 5 }, b: { x: 55, y: 5 }, valueM: 5 };
    const { segments } = collectSnapGeometry([], [gridLine], [dimension], 7);
    expect(segments).toHaveLength(2);
  });

  it("ข้ามของที่อยู่คนละหน้า", () => {
    const gridLine: DraftedGridLine = { id: "g", page: 8, a: { x: 0, y: 0 }, b: { x: 0, y: 50 } };
    const { segments } = collectSnapGeometry([measurement({ page: 8 })], [gridLine], [], 7);
    expect(segments).toHaveLength(0);
  });
});

describe("ดูดเข้าเรขาคณิต", () => {
  it("ปลายเส้นติดเมื่ออยู่ในรัศมี", () => {
    const hit = snapWith(only("endpoint"), { x: 104, y: 103 }, [wall]);
    expect(hit?.kind).toBe("endpoint");
    expect(hit?.point).toEqual({ x: 100, y: 100 });
  });

  it("หมุดเดี่ยวของการนับก็นับเป็นปลายเส้นได้", () => {
    const hit = snapWith(only("endpoint"), { x: 502, y: 500 }, [], {
      loosePoints: [{ x: 500, y: 500 }]
    });
    expect(hit?.point).toEqual({ x: 500, y: 500 });
  });

  it("กึ่งกลางติดตรงกลางช่วงพอดี", () => {
    const hit = snapWith(only("midpoint"), { x: 202, y: 102 }, [wall]);
    expect(hit?.kind).toBe("midpoint");
    expect(hit?.point).toEqual({ x: 200, y: 100 });
  });

  it("จุดตัดของเส้นสองเส้นติด แม้ไม่มีปลายเส้นอยู่ตรงนั้นเลย", () => {
    const column: Segment = { a: { x: 200, y: 0 }, b: { x: 200, y: 300 } };
    const hit = snapWith(only("intersection"), { x: 203, y: 102 }, [wall, column]);
    expect(hit?.kind).toBe("intersection");
    expect(hit?.point).toEqual({ x: 200, y: 100 });
  });

  it("ดูดเข้าตั้งฉากลากฉากจากจุดล่าสุดที่ปักไว้ ไม่ใช่จากเคอร์เซอร์", () => {
    const hit = snapWith(only("perpendicular"), { x: 152, y: 102 }, [wall], {
      lastPlaced: { x: 150, y: 400 }
    });
    expect(hit?.kind).toBe("perpendicular");
    expect(hit?.point).toEqual({ x: 150, y: 100 });
  });

  it("ดูดเข้าตั้งฉากไม่ทำงานเลยเมื่อยังไม่มีจุดล่าสุด", () => {
    expect(snapWith(only("perpendicular"), { x: 152, y: 102 }, [wall])).toBeNull();
  });

  it("บนเส้นติดจุดใกล้สุดบนตัวเส้น", () => {
    const hit = snapWith(only("onEdge"), { x: 157, y: 104 }, [wall]);
    expect(hit?.kind).toBe("on_edge");
    expect(hit?.point).toEqual({ x: 157, y: 100 });
  });

  it("เท้าฉากถูกหนีบไว้ที่ปลายเส้น ไม่หลุดออกไปในที่ว่างนอกเส้น", () => {
    const hit = snapWith(only("onEdge"), { x: 305, y: 100 }, [wall]);
    expect(hit?.point).toEqual({ x: 300, y: 100 });
  });

  it("ไม่ติดอะไรเลยเมื่อทุกอย่างอยู่นอกรัศมี", () => {
    expect(snapWith(only("endpoint"), { x: 500, y: 500 }, [wall])).toBeNull();
  });

  it("ปิดสวิตช์ใหญ่แล้วไม่ดูดอะไรเลย แม้ชนิดย่อยจะเปิดอยู่", () => {
    const settings = { ...only("endpoint"), enabled: false };
    expect(snapWith(settings, { x: 100, y: 100 }, [wall])).toBeNull();
  });
});

describe("ลำดับความสำคัญของการดูดจุด", () => {
  /** แนวเสาที่ตัดผนังตรง 250,100 ซึ่งไม่ใช่กึ่งกลางผนัง จะได้ไม่เสมอกับการดูดกึ่งกลาง */
  const column: Segment = { a: { x: 250, y: 0 }, b: { x: 250, y: 300 } };
  /** ชุดค่าเริ่มต้นจริงบวกกริดระยะเท่า — บนเส้นกับตั้งฉากปิดอยู่ตามค่าเริ่มต้นของแอปเดิม */
  const all: SnapSettings = { ...DEFAULT_SNAP_SETTINGS, grid: true };

  it("ใกล้ที่สุดชนะเสมอ ไม่มีชนิดไหนมีสิทธิ์เหนือชนิดอื่น", () => {
    // เคอร์เซอร์อยู่ใกล้ปลายเส้นที่ 300,100 มากกว่าจุดตัดที่ 250,100
    const hit = findGeometrySnap({
      cursor: { x: 298, y: 96 },
      radiusPagePoints: 200,
      geometry: { segments: [wall, column], loosePoints: [] },
      lastPlaced: null,
      metresPerPoint: null,
      settings: all
    });
    expect(hit?.kind).toBe("endpoint");
    expect(hit?.point).toEqual({ x: 300, y: 100 });
  });

  it("จุดตัดชนะปลายเส้นเมื่อจุดตัดอยู่ใกล้กว่า", () => {
    const hit = findGeometrySnap({
      cursor: { x: 251, y: 96 },
      radiusPagePoints: 200,
      geometry: { segments: [wall, column], loosePoints: [] },
      lastPlaced: null,
      metresPerPoint: null,
      settings: all
    });
    expect(hit?.kind).toBe("intersection");
    expect(hit?.point).toEqual({ x: 250, y: 100 });
  });

  it("บนเส้นที่ระยะศูนย์ชนะทุกอย่างเมื่อเปิดไว้ เพราะเคอร์เซอร์อยู่บนเส้นพอดี", () => {
    const hit = findGeometrySnap({
      cursor: { x: 298, y: 100 },
      radiusPagePoints: 200,
      geometry: { segments: [wall], loosePoints: [] },
      lastPlaced: null,
      metresPerPoint: null,
      settings: { ...all, onEdge: true }
    });
    expect(hit?.kind).toBe("on_edge");
    expect(hit?.distance).toBe(0);
  });

  it("กริดระยะเท่าใช้ต่อเมื่อไม่มีชนิดอื่นติดเลย เพราะมันเป็นตารางสมมติไม่ได้อ้างของบนแบบ", () => {
    const near = findGeometrySnap({
      cursor: { x: 102, y: 96 },
      radiusPagePoints: 12,
      geometry: { segments: [wall], loosePoints: [] },
      lastPlaced: null,
      metresPerPoint: null,
      settings: all
    });
    expect(near?.kind).toBe("endpoint");

    const far = findGeometrySnap({
      cursor: { x: GRID_FALLBACK_SPACING_POINTS * 8 + 2, y: GRID_FALLBACK_SPACING_POINTS * 8 },
      radiusPagePoints: 12,
      geometry: { segments: [wall], loosePoints: [] },
      lastPlaced: null,
      metresPerPoint: null,
      settings: all
    });
    expect(far?.kind).toBe("grid");
    expect(far?.point).toEqual({
      x: GRID_FALLBACK_SPACING_POINTS * 8,
      y: GRID_FALLBACK_SPACING_POINTS * 8
    });
  });

  it("ระยะกริดมาจากเมตรจริงเมื่อหน้ามีสเกลแล้ว", () => {
    // 0.5 เมตร ที่ 0.01 เมตรต่อ point คือ 50 point พอดี
    const hit = findGeometrySnap({
      cursor: { x: 149, y: 0 },
      radiusPagePoints: 12,
      geometry: { segments: [], loosePoints: [] },
      lastPlaced: null,
      metresPerPoint: 0.01,
      settings: { ...only("grid") }
    });
    expect(hit?.point.x).toBeCloseTo(150, 9);
  });
});

describe("ดูดเข้าเส้นในแบบ", () => {
  /** ภาพขาวล้วนขนาด w x h แล้วแต้มพิกเซลเข้มตามที่ระบุ */
  const imageWith = (width: number, height: number, dark: { x: number; y: number; value?: number }[]) => {
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    for (const pixel of dark) {
      const offset = (pixel.y * width + pixel.x) * 4;
      const value = pixel.value ?? 0;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
    return { data, width, height };
  };

  it("เลือกพิกเซลที่ใกล้ที่สุด ไม่ใช่เข้มที่สุด ซึ่งเป็นจุดที่ต่างจากโค้ดเดิมของเรา", () => {
    // พิกเซลที่ 12,10 ดำสนิทแต่ไกล ส่วน 11,10 เทาเข้มกว่าเกณฑ์แต่ใกล้กว่า
    const image = imageWith(30, 20, [
      { x: 12, y: 10, value: 0 },
      { x: 11, y: 10, value: 100 }
    ]);
    expect(findImageSnap(image, { x: 10, y: 10 }, 12, IMAGE_LUMINANCE_CEILING.normal)).toEqual({
      x: 11,
      y: 10
    });
  });

  it("ข้ามพิกเซลที่สว่างเกินเพดานของความไวที่เลือกไว้", () => {
    const image = imageWith(30, 20, [{ x: 11, y: 10, value: 150 }]);
    expect(findImageSnap(image, { x: 10, y: 10 }, 12, IMAGE_LUMINANCE_CEILING.normal)).toBeNull();
    expect(findImageSnap(image, { x: 10, y: 10 }, 12, IMAGE_LUMINANCE_CEILING.faint)).toEqual({
      x: 11,
      y: 10
    });
  });

  it("ข้ามพิกเซลโปร่งใส เพราะที่ว่างไม่ใช่เส้นสีเข้ม", () => {
    const image = imageWith(30, 20, []);
    const offset = (10 * 30 + 11) * 4;
    image.data[offset] = 0;
    image.data[offset + 1] = 0;
    image.data[offset + 2] = 0;
    image.data[offset + 3] = 0;
    expect(findImageSnap(image, { x: 10, y: 10 }, 12, IMAGE_LUMINANCE_CEILING.normal)).toBeNull();
  });

  it("ไม่มองออกไปไกลกว่ารัศมีที่ให้มา", () => {
    const image = imageWith(60, 20, [{ x: 30, y: 10 }]);
    expect(findImageSnap(image, { x: 10, y: 10 }, 5, IMAGE_LUMINANCE_CEILING.normal)).toBeNull();
    expect(findImageSnap(image, { x: 10, y: 10 }, 25, IMAGE_LUMINANCE_CEILING.normal)).toEqual({
      x: 30,
      y: 10
    });
  });

  it("หนีบรัศมีไม่ให้เกิน 35 พิกเซล เพื่อไม่ให้การไล่พิกเซลบานปลาย", () => {
    const image = imageWith(200, 200, [{ x: 150, y: 100 }]);
    expect(findImageSnap(image, { x: 100, y: 100 }, 500, IMAGE_LUMINANCE_CEILING.normal)).toBeNull();
    expect(IMAGE_SNAP_MAX_RADIUS_PX).toBe(35);
  });

  it("คืน null เมื่อจุดกลางอยู่นอกภาพ", () => {
    const image = imageWith(30, 20, [{ x: 5, y: 5 }]);
    expect(findImageSnap(image, { x: -1, y: 5 }, 12, IMAGE_LUMINANCE_CEILING.normal)).toBeNull();
    expect(findImageSnap(image, { x: 5, y: 50 }, 12, IMAGE_LUMINANCE_CEILING.normal)).toBeNull();
  });
});
