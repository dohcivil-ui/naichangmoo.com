import { describe, expect, it } from "vitest";
import { simplify, toGreyImage, traceRegion, type GreyImage } from "@/lib/region-fill";

/** สร้างหน้าแบบจำลอง พื้นขาว แล้ววาดกรอบห้องเป็นเส้นดำ */
function pageWithRoom(options: {
  width: number;
  height: number;
  room: { x: number; y: number; w: number; h: number };
  /** เว้นช่องบนเส้นบน เพื่อจำลองแบบที่เส้นไม่ปิดสนิท */
  gap?: number;
}): GreyImage {
  const { width, height, room, gap = 0 } = options;
  const data = new Uint8ClampedArray(width * height).fill(255);
  const set = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < width && y < height) data[y * width + x] = 0;
  };
  for (let x = room.x; x < room.x + room.w; x += 1) {
    const insideGap = gap > 0 && x >= room.x + Math.floor(room.w / 2) && x < room.x + Math.floor(room.w / 2) + gap;
    if (!insideGap) set(x, room.y);
    set(x, room.y + room.h - 1);
  }
  for (let y = room.y; y < room.y + room.h; y += 1) {
    set(room.x, y);
    set(room.x + room.w - 1, y);
  }
  return { data, width, height };
}

describe("การเลือกพื้นที่ห้องด้วยคลิกเดียว", () => {
  it("คลิกกลางห้องที่เส้นปิดสนิท ได้พื้นที่ใกล้เคียงขนาดห้องจริง", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const result = traceRegion(image, { x: 80, y: 70 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // ภายในกรอบคือ 78 x 58 = 4524 พิกเซล
    expect(result.areaPixels).toBe(78 * 58);
    expect(result.polygon.length).toBeGreaterThanOrEqual(4);
    expect(result.polygon.length).toBeLessThan(40);
  });

  it("ตอบเหมือนเดิมทุกครั้งที่คลิกจุดต่างกันในห้องเดียวกัน", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const a = traceRegion(image, { x: 50, y: 50 });
    const b = traceRegion(image, { x: 110, y: 95 });
    expect(a.ok && b.ok).toBe(true);
    expect(a.areaPixels).toBe(b.areaPixels);
  });

  it("เส้นห้องไม่ปิดสนิท ต้องจับได้ว่ารั่ว ไม่ใช่คืนพื้นที่มั่ว", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 }, gap: 6 });
    const result = traceRegion(image, { x: 80, y: 70 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("leaked");
  });

  it("คลิกโดนเส้นพอดี บอกให้คลิกใหม่ ไม่ใช่คืนพื้นที่ศูนย์เงียบ ๆ", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const result = traceRegion(image, { x: 40, y: 60 });
    expect(result).toMatchObject({ ok: false, reason: "seed_on_line" });
  });

  it("คลิกนอกหน้าแบบ ปฏิเสธ", () => {
    const image = pageWithRoom({ width: 100, height: 100, room: { x: 10, y: 10, w: 40, h: 40 } });
    expect(traceRegion(image, { x: -5, y: 20 })).toMatchObject({ ok: false, reason: "seed_outside" });
    expect(traceRegion(image, { x: 500, y: 20 })).toMatchObject({ ok: false, reason: "seed_outside" });
  });

  it("ห้องเล็กจิ๋วถือว่าไม่ใช่ห้อง", () => {
    const image = pageWithRoom({ width: 100, height: 100, room: { x: 10, y: 10, w: 5, h: 5 } });
    const result = traceRegion(image, { x: 12, y: 12 });
    expect(result).toMatchObject({ ok: false, reason: "too_small" });
  });

  it("เส้นจางในแบบสแกนยังกั้นได้เมื่อปรับค่าตัดความเข้ม", () => {
    const width = 120;
    const height = 120;
    const data = new Uint8ClampedArray(width * height).fill(255);
    // เส้นสีเทาอ่อน ค่า 200 ซึ่งเข้มไม่พอสำหรับค่าตั้งต้น
    for (let x = 20; x < 80; x += 1) {
      data[20 * width + x] = 200;
      data[79 * width + x] = 200;
    }
    for (let y = 20; y < 80; y += 1) {
      data[y * width + 20] = 200;
      data[y * width + 79] = 200;
    }
    const image = { data, width, height };

    expect(traceRegion(image, { x: 50, y: 50 })).toMatchObject({ ok: false, reason: "leaked" });
    const relaxed = traceRegion(image, { x: 50, y: 50 }, { lineThreshold: 220 });
    expect(relaxed.ok).toBe(true);
  });
});

describe("การลดจำนวนจุดของเส้นขอบ", () => {
  it("จุดที่อยู่บนเส้นตรงเดิมถูกตัดทิ้ง", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 }
    ];
    expect(simplify(line, 1)).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 }
    ]);
  });

  it("มุมที่หักจริงถูกเก็บไว้", () => {
    const corner = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 }
    ];
    expect(simplify(corner, 1)).toHaveLength(3);
  });
});

describe("การแปลงภาพจากผืนวาด", () => {
  it("สี่ช่องต่อพิกเซลถูกยุบเป็นค่าความสว่างช่องเดียว", () => {
    const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
    const grey = toGreyImage(rgba, 2, 1);
    expect(Array.from(grey.data)).toEqual([255, 0]);
    expect(grey.width).toBe(2);
  });
});
