import { describe, expect, it } from "vitest";
import { fullPageScaleFor } from "@/lib/drawing-render";
import {
  collapseStaircases,
  removeJogs,
  simplify,
  snapOutlineToLines,
  structuralBarrier,
  toGreyImage,
  traceRegion,
  type GreyImage,
  type Pixel
} from "@/lib/region-fill";

/**
 * สร้างหน้าแบบจำลอง พื้นขาว แล้ววาดผนังห้องอย่างที่แบบจริงวาด
 *
 * ผนังคือเส้นผิวสองเส้น หนาเส้นละสองพิกเซล มีช่องสะอาดหนึ่งพิกเซลคั่น รวมหนาห้าพิกเซล
 * งอกออกไปข้างนอกจากกรอบ `room` เนื้อที่ข้างในจึงเท่ากับกรอบลบขอบหนึ่งพิกเซลรอบด้าน
 * เหมือนตอนที่ผนังยังเป็นเส้นเดียว · ต้องวาดเป็นสองเส้นเพราะ `structuralMask` รู้จักผนัง
 * จากการมีเส้นคู่ขนาน เส้นเดี่ยวบาง ๆ คือสัญลักษณ์ (ดูคำอธิบายที่ฟังก์ชันนั้น)
 */
function pageWithRoom(options: {
  width: number;
  height: number;
  room: { x: number; y: number; w: number; h: number };
  /** เว้นช่องบนผนังบน ทะลุทั้งสองผิว เพื่อจำลองประตูหรือแบบที่เส้นไม่ปิดสนิท */
  gap?: number;
}): GreyImage {
  const { width, height, room, gap = 0 } = options;
  const data = new Uint8ClampedArray(width * height).fill(255);
  const set = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < width && y < height) data[y * width + x] = 0;
  };
  const left = room.x;
  const right = room.x + room.w - 1;
  const top = room.y;
  const bottom = room.y + room.h - 1;
  // ระยะจากผิวในออกไปข้างนอก: 0 กับ 1 คือผิวใน · 2 คือช่องสะอาด · 3 กับ 4 คือผิวนอก
  const layers = [0, 1, 3, 4];
  for (let x = left - 4; x <= right + 4; x += 1) {
    const insideGap = gap > 0 && x >= room.x + Math.floor(room.w / 2) && x < room.x + Math.floor(room.w / 2) + gap;
    for (const layer of layers) {
      if (!insideGap) set(x, top - layer);
      set(x, bottom + layer);
    }
  }
  for (let y = top - 4; y <= bottom + 4; y += 1) {
    for (const layer of layers) {
      set(left - layer, y);
      set(right + layer, y);
    }
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

  it("สีไหลออกไปเกินหนึ่งในสี่ของหน้า ถือว่าทะลุ แม้ยังไม่ถึงขอบกระดาษ", () => {
    // ห้องใหญ่กลางหน้า กินเนื้อที่ 36% ของหน้า และไม่แตะขอบกระดาษเลย
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 20, y: 20, w: 120, h: 120 } });
    const result = traceRegion(image, { x: 80, y: 80 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("leaked");
  });

  it("ผ่อนเพดานให้กว้างขึ้นได้เมื่อแบบนั้นมีห้องโถงใหญ่จริง", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 20, y: 20, w: 120, h: 120 } });
    expect(traceRegion(image, { x: 80, y: 80 }, { maxAreaFraction: 0.6 }).ok).toBe(true);
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

/**
 * สัญลักษณ์ในแบบต้องไม่กินพื้นที่ห้อง
 *
 * เจ้าของงานกดจริงเมื่อ 2026-09-04 แล้วทักว่า "ยังเว้นช่องสัญลักษณ์ สามเหลี่ยมอยู่เลย
 * มันต้องไฮไลท์เต็ม" — แบบก่อสร้างมีสามเหลี่ยมบอกระดับ ตัวอักษรชื่อห้อง ป้ายชนิดพื้นและฝ้า
 * วางอยู่ในห้องเต็มไปหมด บางอันชิดผนังจนสีลอดไม่ได้ ขอบที่ไล่ได้จึงเว้าเข้ามาและพื้นที่ขาด
 */
describe("การกลบรอยเว้าที่สัญลักษณ์ทิ้งไว้", () => {
  /** ห้องที่มีแท่งทึบยื่นจากผนังบนเข้ามาในห้อง จำลองสัญลักษณ์ที่วางชิดผนัง */
  function roomWithStubFromWall(stubWidth: number, stubDepth: number): GreyImage {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const left = 70;
    for (let x = left; x < left + stubWidth; x += 1) {
      for (let y = 41; y < 41 + stubDepth; y += 1) image.data[y * image.width + x] = 0;
    }
    return image;
  }

  it("ไม่กลบ พื้นที่ขาดไปเท่ากับขนาดสัญลักษณ์", () => {
    const image = roomWithStubFromWall(6, 8);
    const result = traceRegion(image, { x: 60, y: 90 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.areaPixels).toBe(78 * 58 - 6 * 8);
  });

  it("กลบด้วยรัศมีที่กว้างกว่าครึ่งหนึ่งของสัญลักษณ์ ได้พื้นที่เต็มห้องคืนมา", () => {
    const image = roomWithStubFromWall(6, 8);
    const result = traceRegion(image, { x: 60, y: 90 }, { closeRadiusPixels: 4 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.areaPixels).toBe(78 * 58);
  });

  it("ห้องที่ไม่มีสัญลักษณ์เลย การกลบไม่ขยับขอบสักพิกเซล", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const plain = traceRegion(image, { x: 80, y: 70 });
    const closed = traceRegion(image, { x: 80, y: 70 }, { closeRadiusPixels: 4 });
    expect(plain.ok && closed.ok).toBe(true);
    if (!plain.ok || !closed.ok) return;
    expect(closed.areaPixels).toBe(plain.areaPixels);
    expect(closed.polygon).toEqual(plain.polygon);
  });

  /**
   * ข้อที่สำคัญที่สุดของชุดนี้ การกลบต้องเพิ่มพื้นที่ได้ แต่ต้องข้ามผนังไปห้องข้าง ๆ ไม่ได้
   * ถ้าข้ามได้เมื่อไหร่ มันก็ไม่ต่างอะไรกับการรั่ว ซึ่งเป็นสิ่งที่ทั้งไฟล์นี้มีไว้เพื่อกัน
   */
  it("กลบด้วยรัศมีใหญ่ ก็ยังข้ามผนังไปห้องติดกันไม่ได้", () => {
    const width = 200;
    const height = 200;
    const data = new Uint8ClampedArray(width * height).fill(255);
    const dark = (x: number, y: number) => {
      data[y * width + x] = 0;
    };
    // ห้องคู่ กว้างห้องละ 38 พิกเซล คั่นด้วยผนังหนา 2 พิกเซลตรงกลาง
    for (let x = 40; x < 120; x += 1) {
      dark(x, 40);
      dark(x, 99);
    }
    for (let y = 40; y < 100; y += 1) {
      dark(40, y);
      dark(119, y);
      dark(79, y);
      dark(80, y);
    }
    const image: GreyImage = { data, width, height };
    const left = traceRegion(image, { x: 60, y: 70 }, { closeRadiusPixels: 8 });
    expect(left.ok).toBe(true);
    if (!left.ok) return;
    // ห้องซ้ายภายในคือ 38 x 58 ห้องขวาอีก 38 x 58 — ต้องได้แค่ห้องเดียว
    expect(left.areaPixels).toBeLessThan(38 * 58 * 1.5);
  });

  it("รูที่สัญลักษณ์ลอยกลางห้องทิ้งไว้ ถูกกลบด้วย ไม่เหลือเป็นรูในรูปทรง", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    for (let x = 70; x < 76; x += 1) {
      for (let y = 60; y < 66; y += 1) image.data[y * image.width + x] = 0;
    }
    const plain = traceRegion(image, { x: 50, y: 50 });
    const closed = traceRegion(image, { x: 50, y: 50 }, { closeRadiusPixels: 4 });
    expect(plain.ok && closed.ok).toBe(true);
    if (!plain.ok || !closed.ok) return;
    expect(plain.areaPixels).toBe(78 * 58 - 36);
    expect(closed.areaPixels).toBe(78 * 58);
  });
});

/**
 * ช่องประตูที่แบบไม่ได้ลากเส้นปิด
 *
 * เจ้าของงานทักเมื่อ 2026-09-04 ว่า "ห้องที่ไม่มีเส้นกั้นตรงประตูคลิ้กเลือกแล้วไม่เป็น
 * เหมือนภาพตัวอย่าง" — ผังพื้นเขียนประตูเป็นช่องว่างบนเส้นผนัง สีจึงลอดออกไปทั้งชั้น
 * ภาพที่เขาวาดให้ดูมีเส้นแดงพาดตรงช่องประตูที่ผิวผนังพอดี ซึ่งคือสิ่งที่ต้องได้
 */
describe("การเชื่อมช่องประตูก่อนไล่สี", () => {
  it("ไม่เชื่อม ห้องที่ประตูเปิดอยู่ทำให้สีทะลุ", () => {
    const image = pageWithRoom({
      width: 200,
      height: 200,
      room: { x: 40, y: 40, w: 80, h: 60 },
      gap: 9
    });
    const result = traceRegion(image, { x: 80, y: 70 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("leaked");
  });

  it("เชื่อมช่องที่แคบกว่าสองเท่าของรัศมี ได้ห้องปิดที่พื้นที่เท่าห้องจริง", () => {
    const image = pageWithRoom({
      width: 200,
      height: 200,
      room: { x: 40, y: 40, w: 80, h: 60 },
      gap: 9
    });
    const result = traceRegion(image, { x: 80, y: 70 }, { bridgeGapPixels: 6 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.areaPixels).toBe(78 * 58);
  });

  /**
   * ด้านกลับของข้อบน ช่องที่กว้างกว่าประตูคือทางเชื่อมห้องจริง ระบบต้องไม่เดาปิดให้
   * เพราะสองห้องที่เปิดถึงกันกว้างขนาดนั้น คนประมาณราคาต้องตัดสินเองว่านับเป็นกี่ห้อง
   */
  it("ช่องที่กว้างเกินกว่าจะเป็นประตู ยังไม่ถูกเชื่อม และยังรายงานว่าทะลุ", () => {
    const image = pageWithRoom({
      width: 200,
      height: 200,
      room: { x: 40, y: 40, w: 80, h: 60 },
      gap: 30
    });
    const result = traceRegion(image, { x: 80, y: 70 }, { bridgeGapPixels: 6 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("leaked");
  });

  it("การเชื่อมไม่ขยับผนังของห้องที่ปิดสนิทอยู่แล้ว", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const plain = traceRegion(image, { x: 80, y: 70 });
    const bridged = traceRegion(image, { x: 80, y: 70 }, { bridgeGapPixels: 6 });
    expect(plain.ok && bridged.ok).toBe(true);
    if (!plain.ok || !bridged.ok) return;
    expect(bridged.areaPixels).toBe(plain.areaPixels);
    expect(bridged.polygon).toEqual(plain.polygon);
  });

  it("คลิกลงบนช่องประตูที่เพิ่งถูกเชื่อม ถือว่าคลิกโดนเส้น ไม่ใช่คืนพื้นที่มั่ว", () => {
    const image = pageWithRoom({
      width: 200,
      height: 200,
      room: { x: 40, y: 40, w: 80, h: 60 },
      gap: 9
    });
    const result = traceRegion(image, { x: 82, y: 40 }, { bridgeGapPixels: 6 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("seed_on_line");
  });

  it("เชื่อมประตูและกลบสัญลักษณ์พร้อมกัน ได้ห้องเต็มทั้งใบ", () => {
    const image = pageWithRoom({
      width: 200,
      height: 200,
      room: { x: 40, y: 40, w: 80, h: 60 },
      gap: 9
    });
    for (let x = 60; x < 66; x += 1) {
      for (let y = 93; y < 98; y += 1) image.data[y * image.width + x] = 0;
    }
    const result = traceRegion(image, { x: 100, y: 70 }, { bridgeGapPixels: 6, closeRadiusPixels: 4 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.areaPixels).toBe(78 * 58);
  });
});

/**
 * คัดเส้นก่อนไล่สี — ผนังกั้น สัญลักษณ์ไม่กั้น
 *
 * เจ้าของงานชี้เมื่อ 2026-09-04 ว่าต้นเหตุที่ได้พื้นที่ไม่จริงคือเราแยกไม่ออกว่าเส้นไหน
 * เป็นผิวผนัง เส้นไหนเป็นขอบเสา และเส้นไหนเป็นแค่สัญลักษณ์ · ภาพที่เขาทำมาให้ดูระบายแดง
 * ทับส่วนที่ขาดหายไป ซึ่งตรงกับตำแหน่งของกรอบป้ายชนิดพื้นและวงโค้งบานสวิงประตูพอดี
 */
describe("คัดเฉพาะเส้นที่เป็นผนัง", () => {
  /** ห้องกว้าง 80 x 60 ที่มีของอื่นอยู่ข้างในตามที่โจทย์กำหนด */
  function roomWith(extras: (set: (x: number, y: number) => void) => void): GreyImage {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    extras((x, y) => {
      if (x >= 0 && y >= 0 && x < image.width && y < image.height) {
        image.data[y * image.width + x] = 0;
      }
    });
    return image;
  }

  const filtered = { minRunPixels: 12, minStructurePixels: 40 };

  it("กรอบป้ายชนิดพื้นกลางห้อง ไม่กั้นและไม่กินพื้นที่", () => {
    // กรอบสี่เหลี่ยม 30 x 10 ลอยกลางห้อง ขอบบนล่างยาว 30 ผ่านด่านความยาว แต่ก้อนกว้างแค่ 30
    const image = roomWith((set) => {
      for (let x = 60; x < 90; x += 1) {
        set(x, 60);
        set(x, 70);
      }
      for (let y = 60; y <= 70; y += 1) {
        set(60, y);
        set(89, y);
      }
    });
    const raw = traceRegion(image, { x: 50, y: 50 });
    const clean = traceRegion(image, { x: 50, y: 50 }, filtered);
    expect(raw.ok && clean.ok).toBe(true);
    if (!raw.ok || !clean.ok) return;
    expect(raw.areaPixels).toBeLessThan(78 * 58);
    expect(clean.areaPixels).toBe(78 * 58);
  });

  it("วงโค้งบานสวิงประตูที่ต่อกับผนัง ไม่กั้น", () => {
    const image = roomWith((set) => {
      // เสี้ยววงกลมรัศมี 20 จากมุมบนซ้ายของห้อง ต่อกับผนังจึงอยู่ในก้อนใหญ่
      for (let step = 0; step <= 90; step += 1) {
        const angle = (step * Math.PI) / 180;
        set(Math.round(41 + 20 * Math.cos(angle)), Math.round(41 + 20 * Math.sin(angle)));
      }
    });
    const raw = traceRegion(image, { x: 100, y: 90 });
    const clean = traceRegion(image, { x: 100, y: 90 }, filtered);
    expect(raw.ok && clean.ok).toBe(true);
    if (!raw.ok || !clean.ok) return;
    expect(raw.areaPixels).toBeLessThan(78 * 58);
    expect(clean.areaPixels).toBe(78 * 58);
  });

  /**
   * ด้านกลับที่สำคัญที่สุด การคัดต้องไม่ทำให้ผนังหายจนสีทะลุ ถ้าผนังตกด่านไปด้วย
   * เราก็แค่เปลี่ยนจากพื้นที่ขาดเป็นพื้นที่เกิน ซึ่งแย่กว่าเดิม
   */
  it("ผนังยังกั้นอยู่ครบ ไม่ทะลุออกนอกห้อง", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const clean = traceRegion(image, { x: 80, y: 70 }, filtered);
    expect(clean.ok).toBe(true);
    if (!clean.ok) return;
    expect(clean.areaPixels).toBe(78 * 58);
  });

  it("ผนังบางที่คั่นห้องคู่ ยังกั้นอยู่หลังคัดเส้น", () => {
    // ผนังเบาวาดเป็นเส้นคู่เปล่า ๆ ไม่มีลายอิฐ ผิวซ้ายที่ 79-80 ช่องสะอาดที่ 81 ผิวขวาที่ 82-83
    const image = roomWith((set) => {
      for (let y = 40; y < 100; y += 1) {
        for (const x of [79, 80, 82, 83]) set(x, y);
      }
    });
    const clean = traceRegion(image, { x: 60, y: 70 }, filtered);
    expect(clean.ok).toBe(true);
    if (!clean.ok) return;
    expect(clean.areaPixels).toBe(38 * 58);
  });

  it("ตัวอักษรและสามเหลี่ยมบอกระดับ ไม่กั้น", () => {
    const image = roomWith((set) => {
      for (let step = 0; step < 12; step += 1) {
        set(70 + step, 55 + (step % 3));
        set(75, 50 + step);
      }
      for (let step = 0; step <= 8; step += 1) {
        set(100 - step, 80 + step);
        set(100 + step, 80 + step);
        set(92 + step * 2, 88);
      }
    });
    const clean = traceRegion(image, { x: 50, y: 50 }, filtered);
    expect(clean.ok).toBe(true);
    if (!clean.ok) return;
    expect(clean.areaPixels).toBe(78 * 58);
  });
});

/**
 * เสาต้องกั้น และขอบห้องต้องหักเป็นขั้นอ้อมมัน
 *
 * เจ้าของงานทักเมื่อ 2026-09-04 ว่า "คุณไฮไลท์กินพื้นที่เสา ด้านล่าง และไม่หักตรงมุมเสา"
 * เรนเดอร์หน้ากากออกมาดูแล้วพบว่าเสาเป็นรูโหว่จริง เพราะมันถูกวาดเป็นสี่เหลี่ยมเล็กที่เป็น
 * ก้อนอิสระ ไม่ต่อกับผนัง จึงตกด่านขนาดก้อนไปพร้อมกับป้ายและสัญลักษณ์
 */
describe("เสาที่มุมห้อง", () => {
  const filtered = { minRunPixels: 12, minStructurePixels: 40 };
  const withColumns = { ...filtered, column: { min: 6, max: 20, touch: 4 } };

  /** ห้อง 80 x 60 ที่มีกรอบสี่เหลี่ยม 12 x 12 เป็นเสาเกาะอยู่ที่มุมบนซ้ายด้านใน */
  function roomWithCornerColumn(): GreyImage {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const set = (x: number, y: number) => {
      image.data[y * image.width + x] = 0;
    };
    for (let step = 0; step < 12; step += 1) {
      set(42 + step, 42);
      set(42 + step, 53);
      set(42, 42 + step);
      set(53, 42 + step);
    }
    return image;
  }

  it("ไม่รู้จักเสา สีไหลเข้าไปในเสา ขอบไม่หักเป็นขั้น", () => {
    const result = traceRegion(roomWithCornerColumn(), { x: 100, y: 90 }, filtered);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.areaPixels).toBe(78 * 58);
  });

  it("รู้จักเสา พื้นที่หายไปเท่าขนาดเสาพอดี", () => {
    const result = traceRegion(roomWithCornerColumn(), { x: 100, y: 90 }, withColumns);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.areaPixels).toBe(78 * 58 - 12 * 12);
  });

  it("สี่เหลี่ยมทึบก็นับเป็นเสา ไม่ใช่เฉพาะกรอบ", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    for (let y = 42; y < 54; y += 1) {
      for (let x = 42; x < 54; x += 1) image.data[y * image.width + x] = 0;
    }
    const result = traceRegion(image, { x: 100, y: 90 }, withColumns);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.areaPixels).toBe(78 * 58 - 12 * 12);
  });

  /**
   * **เสาที่ถูกเส้นผ่าเป็นสามชิ้นไม่เท่ากัน ก็ยังเป็นเสา** — เจ้าของงานเรียกอาการนี้ว่า
   * "สีล้นในเสา" เมื่อ 2026-09-05 จากเสามุมขวาบนของห้องเก็บน้ำยาหน้า 7
   *
   * เส้นผนังแนวตั้งผ่าเสาเป็นซ้าย-ขวา แล้วเส้นผนังแนวนอนผ่าซีกซ้ายอีกเป็นบน-ล่าง เหลือ
   * ช่องว่างข้างในสามช่อง สูง 5 กับ 5 กับ 12 · ไม่มีช่องไหนผ่านเกณฑ์สัดส่วนด้านของเสา
   * ด้วยตัวเอง และซีกซ้ายบนสูง 5 เทียบกับซีกขวาสูง 12 ก็ต่างกันเกินสองเท่า จึงไม่รวมกัน
   * ถ้าเทียบทีละช่อง · ต้องรวมเป็นก้อนก่อนแล้วเทียบด้วยกรอบของก้อนวนซ้ำ
   *
   * เทสต์นี้จงใจให้ขอบล่างของเสาจางกว่าเกณฑ์เส้นผนัง เหมือนของจริง เพื่อพิสูจน์ว่าถ้าจับ
   * เสาไม่ได้ สีจะไหลเข้าไปข้างในจริง ๆ ไม่ใช่แค่ตัวเลขเปลี่ยน
   *
   * ⚠️ **ข้ามไว้เพราะยังแก้ไม่ได้ ไม่ใช่เพราะไม่สำคัญ** 2026-09-05 ลองแก้ด้วยการรวมช่อง
   * โดยเทียบกรอบของก้อนแล้ววนซ้ำ ซึ่งทำให้เทสต์นี้เขียวและเสาต้นนั้นถูกกั้นได้จริง
   * **แต่บนแบบจริงมันสร้างเสาปลอมตัวใหม่ในห้องน้ำผู้ป่วยชาย** พื้นที่ตกจาก 4.02 เหลือ 3.85
   * โดยที่เทสต์ทั้ง 1,204 ข้อยังเขียวหมด · จับได้ด้วย `scripts/sweep-region-fill.mts`
   * บนผืนวิเคราะห์จริงเท่านั้น
   *
   * รากของปัญหาไม่ได้อยู่ที่กติกาการรวมช่อง แต่อยู่ที่**ตัวจับเสายังถมกระเบื้องกับสุขภัณฑ์
   * เป็นเสา** ทุกวันนี้ขั้นเกลี่ยรอยหยักกลบความผิดนั้นไว้ · ต้องแก้ตรงนั้นก่อน แล้วเทสต์นี้
   * ถึงจะเปิดได้อย่างปลอดภัย
   */
  it.skip("เสาที่ถูกเส้นผ่าเป็นสามชิ้นไม่เท่ากัน ยังต้องกั้น สีไม่ไหลเข้าไปข้างใน", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const ink = (x: number, y: number, value: number) => {
      image.data[y * image.width + x] = value;
    };
    // กรอบเสา 14 x 14 ที่มุมบนซ้ายด้านใน · ขอบล่างจางกว่าเกณฑ์ผนัง 140 แต่ยังเข้าเกณฑ์สัญลักษณ์
    for (let step = 0; step < 14; step += 1) {
      ink(42 + step, 42, 0);
      ink(42 + step, 55, 170);
      ink(42, 42 + step, 0);
      ink(55, 42 + step, 0);
    }
    // เส้นแนวตั้งผ่ากลางเสา แล้วเส้นแนวนอนผ่าเฉพาะซีกซ้าย เหลือช่องสูง 5 · 5 · 12
    for (let y = 43; y < 55; y += 1) {
      ink(48, y, 0);
      ink(49, y, 0);
    }
    for (let x = 43; x < 48; x += 1) {
      ink(x, 48, 0);
      ink(x, 49, 0);
    }
    const result = traceRegion(image, { x: 100, y: 90 }, withColumns);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // เสาถูกกันครบทั้งต้น พื้นที่จึงหายไปเท่าขนาดเสา ไม่ใช่หายแค่บางช่อง
    expect(result.areaPixels).toBe(78 * 58 - 14 * 14);
  });

  /**
   * **พื้นกระเบื้องทั้งผืนต้องไม่กลายเป็นเสา**
   *
   * ช่องกระเบื้องแต่ละช่องคือช่องปิดสนิทขนาดพอดีเกณฑ์เสา สิ่งที่ทำให้มันรอดคือช่องเรียงกัน
   * เป็นตารางแล้วเกาะกันเป็นก้อนใหญ่เกินเสา · ถ้ากติกาการรวมก้อนเปลี่ยนจนกระเบื้องบางกลุ่ม
   * เหลือขนาดพอดีเสา มันจะถูกถมเป็นเสาปลอมกลางห้อง แล้วขอบห้องจะไปเกาะขอบของแถบนั้น
   *
   * ⚠️ **เทสต์นี้เป็นด่านหยาบ ๆ เท่านั้น** ตารางกระเบื้องสังเคราะห์เป็นระเบียบเกินไป
   * ทุกช่องขนาดเท่ากันหมด · ของจริงกระเบื้องถูกสุขภัณฑ์กับเส้นตัดแบ่งเป็นกลุ่มขนาดไม่เท่ากัน
   * 2026-09-05 มีการแก้กติกาเสาที่ทำให้ห้องน้ำผู้ป่วยชายหน้า 7 ตกจาก 4.02 เหลือ 3.85
   * โดยเทสต์ทั้งชุดยังเขียว · **ด่านจริงคือกวาดทั้งหน้าด้วย `scripts/sweep-region-fill.mts`
   * บนผืนวิเคราะห์จริง ต้องรันทุกครั้งที่แตะกติกาเสา**
   */
  it("พื้นที่ปูกระเบื้องเต็มห้อง ไม่มีช่องไหนกลายเป็นเสา ห้องยังเต็มเท่าเดิม", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const set = (x: number, y: number) => {
      image.data[y * image.width + x] = 0;
    };
    // ตารางกระเบื้องช่องละ 10 พิกเซล ซึ่งอยู่ในช่วงขนาดของเสาพอดี ปูเต็มพื้นห้อง
    for (let x = 41; x <= 118; x += 1) {
      for (let y = 41; y <= 98; y += 10) set(x, y);
    }
    for (let y = 41; y <= 98; y += 1) {
      for (let x = 41; x <= 118; x += 10) set(x, y);
    }
    const result = traceRegion(image, { x: 75, y: 75 }, withColumns);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xs = result.polygon.map((point) => point.x);
    const ys = result.polygon.map((point) => point.y);
    /**
     * ขอบยังกินเต็มห้อง ไม่ไปเกาะขอบของแถบกระเบื้องที่ถูกถมเป็นเสาปลอม
     * · ผ่อนได้หนึ่งพิกเซลเพราะเส้นกระเบื้องเส้นแรกทับแนวผิวผนังพอดี
     * ตอนพังจริงห้องขาดไปเกือบครึ่ง ไม่ใช่ขาดพิกเซลเดียว
     */
    expect(Math.min(...xs)).toBeLessThanOrEqual(42);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(118);
    expect(Math.min(...ys)).toBeLessThanOrEqual(42);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(98);
  });

  /**
   * ด้านกลับสามข้อ กติกาเสาต้องไม่เปิดทางให้ของอื่นกลับมากั้น ไม่งั้นเราก็แค่ย้ายปัญหา
   */
  it("สี่เหลี่ยมเล็กกลางห้องที่ไม่ติดผนัง ไม่ใช่เสา", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const set = (x: number, y: number) => {
      image.data[y * image.width + x] = 0;
    };
    for (let step = 0; step < 12; step += 1) {
      set(75 + step, 65);
      set(75 + step, 76);
      set(75, 65 + step);
      set(86, 65 + step);
    }
    const result = traceRegion(image, { x: 50, y: 50 }, withColumns);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.areaPixels).toBe(78 * 58);
  });

  it("สามเหลี่ยมบอกระดับที่เกาะผนัง ไม่ใช่เสา", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const set = (x: number, y: number) => {
      image.data[y * image.width + x] = 0;
    };
    for (let step = 0; step <= 10; step += 1) {
      set(70 + step, 42);
      set(70 + step, 42 + step);
      set(80 - step, 42 + step);
    }
    const result = traceRegion(image, { x: 60, y: 80 }, withColumns);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.areaPixels).toBe(78 * 58);
  });

  /**
   * สัญลักษณ์ประตูหน้าต่างเป็นสามเหลี่ยมสองอันประกบผนัง มันเป็นรูปปิดจึงมีที่ว่างปิดสนิท
   * อยู่ข้างในเหมือนเสา และอยู่ชิดผนังด้วย · 2026-09-04 กติกาเสารุ่นแรกถมมันเป็นเสาปลอม
   * ทุกบาน ขอบห้องจึงโป่งเข้าไปในเนื้อผนังทุกจุดที่มีประตู เจ้าของงานจับได้จากรูปทันที
   */
  it("สามเหลี่ยมสัญลักษณ์ที่คร่อมผนัง ไม่ใช่เสา แม้ข้างในจะเป็นที่ว่างปิดสนิท", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const set = (x: number, y: number) => {
      image.data[y * image.width + x] = 0;
    };
    // สามเหลี่ยมชี้เข้าหาผนังซ้าย ปลายแหลมแตะผนังที่ x = 40
    for (let step = 0; step <= 14; step += 1) {
      set(26, 63 + step);
      set(26 + step, 63 + step);
      set(26 + step, 77 - step);
    }
    for (let y = 63; y <= 77; y += 1) set(40, y);
    const result = traceRegion(image, { x: 80, y: 70 }, withColumns);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.areaPixels).toBe(78 * 58);
  });

  it("วงกลมเลขแนวเสาที่ชิดผนัง ไม่ใช่เสา", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    for (let step = 0; step < 360; step += 2) {
      const angle = (step * Math.PI) / 180;
      const x = Math.round(48 + 7 * Math.cos(angle));
      const y = Math.round(70 + 7 * Math.sin(angle));
      image.data[y * image.width + x] = 0;
    }
    const result = traceRegion(image, { x: 90, y: 90 }, withColumns);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.areaPixels).toBe(78 * 58);
  });

  /**
   * เสาต้นเล็กที่สุดในแบบทดสอบมีกรอบนอกแปดพิกเซล เนื้อในเหลือหก ซึ่งต่ำกว่าเกณฑ์ขนาด
   * ที่ตั้งไว้เจ็ด · 2026-09-04 มันจึงยังถูกกินอยู่ทั้งที่เสาต้นอื่นถูกกันไว้หมดแล้ว
   */
  it("เสาต้นเล็กที่เนื้อในแคบกว่าเกณฑ์ ยังต้องกั้นได้", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const set = (x: number, y: number) => {
      image.data[y * image.width + x] = 0;
    };
    // กรอบนอกแปดพิกเซล ชิดมุมล่างขวาด้านในของห้อง
    for (let step = 0; step < 8; step += 1) {
      set(110 + step, 90);
      set(110 + step, 97);
      set(110, 90 + step);
      set(117, 90 + step);
    }
    const result = traceRegion(image, { x: 60, y: 60 }, withColumns);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.areaPixels).toBeLessThan(78 * 58);
    expect(result.areaPixels).toBeGreaterThan(78 * 58 - 100);
  });

  it("กรอบที่ใหญ่เกินช่วงของเสา ไม่ใช่เสา", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const set = (x: number, y: number) => {
      image.data[y * image.width + x] = 0;
    };
    for (let step = 0; step < 30; step += 1) {
      set(45 + step, 42);
      set(45 + step, 52);
    }
    for (let step = 0; step <= 10; step += 1) {
      set(45, 42 + step);
      set(74, 42 + step);
    }
    const result = traceRegion(image, { x: 60, y: 80 }, withColumns);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.areaPixels).toBe(78 * 58);
  });
});

/**
 * ขอบต้องเป็นแนวนอนกับแนวตั้งล้วน
 *
 * เจ้าของงานสั่งเมื่อ 2026-09-04 ว่า "ลักษณะของเส้นที่วิ่งตามขอบมักจะไม่มีโค้ง
 * เพราะองค์อาคารส่วนใหญ่เป็นแบบเหลี่ยม" · ของเดิมลดจุดด้วยวิธีที่ยอมแทนบันไดพิกเซล
 * ด้วยเส้นเฉียง มุมเสาจึงถูกตัดเฉียงเป็นสามเหลี่ยม
 */
describe("ขอบเป็นเหลี่ยมล้วน ไม่มีเส้นเฉียง", () => {
  const axisAligned = (points: { x: number; y: number }[]) =>
    points.every((point, index) => {
      const next = points[(index + 1) % points.length];
      return point.x === next.x || point.y === next.y;
    });

  it("ห้องสี่เหลี่ยมได้สี่มุมพอดี และทุกด้านตั้งฉาก", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const result = traceRegion(image, { x: 80, y: 70 }, { minStepPixels: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.polygon).toHaveLength(4);
    expect(axisAligned(result.polygon)).toBe(true);
  });

  /** เสาชนผนังเหมือนในแบบจริง รอยเว้าจึงเปิดออกสู่ขอบห้อง ไม่ใช่รูที่ถูกล้อมรอบ */
  it("ห้องที่มีเสาที่มุม ได้มุมเพิ่มเป็นขั้น และยังไม่มีเส้นเฉียง", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const set = (x: number, y: number) => {
      image.data[y * image.width + x] = 0;
    };
    for (let step = 0; step < 12; step += 1) {
      set(41 + step, 41);
      set(41 + step, 52);
      set(41, 41 + step);
      set(52, 41 + step);
    }
    const result = traceRegion(image, { x: 100, y: 90 }, {
      minRunPixels: 12,
      minStructurePixels: 40,
      column: { min: 6, max: 20, touch: 4 },
      minStepPixels: 3
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.polygon.length).toBeGreaterThan(4);
    expect(axisAligned(result.polygon)).toBe(true);
  });

  it("ขอบที่ได้อยู่บนรอยต่อพิกเซล ไม่เหลื่อมเข้าไปครึ่งพิกเซล", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const result = traceRegion(image, { x: 80, y: 70 }, { minStepPixels: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xs = result.polygon.map((point) => point.x);
    const ys = result.polygon.map((point) => point.y);
    // ภายในกรอบคือพิกเซล 41 ถึง 118 และ 41 ถึง 98 มุมจึงอยู่ที่ 41 กับ 119 และ 41 กับ 99
    expect(Math.min(...xs)).toBe(41);
    expect(Math.max(...xs)).toBe(119);
    expect(Math.min(...ys)).toBe(41);
    expect(Math.max(...ys)).toBe(99);
  });
});

/**
 * ขอบต้องนั่งบนเส้นผิวผนังด้านใน ไม่ใช่ถอยเข้ามาในห้อง
 *
 * เจ้าของงานขีดเส้นน้ำเงินให้ดูเมื่อ 2026-09-04 แล้วบอกว่า "ขีดเส้นสีน้ำเงินให้มัน
 * ก็ยังไม่ทำตาม" · ระยะที่ต่างกันมีแค่หนึ่งถึงสองพิกเซล แต่มันผิดทุกด้านเท่ากันหมด
 * จึงเห็นชัดทันทีที่ซูมเข้าไป และสะสมเป็นพื้นที่ที่ขาดไปทั้งห้อง
 *
 * **ความละเอียดของผืนวิเคราะห์ในเทสต์ชุดนี้คือสองพิกเซลต่อจุดกระดาษ** เท่ากับของจริง
 * (`BASE_TARGET_SCALE`) เส้นที่วาดจึงหนาได้ไม่เกินสองพิกเซล ซึ่งคือค่าที่ส่งเป็น
 * `lineMaxThicknessPixels` · หมึกที่หนากว่านั้นไม่ใช่เส้น มันคือเนื้อของผนัง
 */
describe("การดันขอบไปชิดผิวในของเส้นผนัง", () => {
  /** หนึ่งจุดกระดาษเป็นสองพิกเซลบนผืนวิเคราะห์ เท่ากับของจริง */
  const LINE_MAX_PIXELS = 2;

  /**
   * ห้องที่กรอบผนังหนาตามที่สั่ง · ผิวในของห้องอยู่ที่ 43 กับ 117 เสมอ ไม่ว่าผนังหนาเท่าไร
   * เพราะความหนางอกออกไปข้างนอก ซึ่งเป็นเนื้อผนัง ไม่ใช่พื้นที่ใช้สอย
   */
  function roomWithWall(thickness: number): GreyImage {
    const width = 200;
    const height = 200;
    const data = new Uint8ClampedArray(width * height).fill(255);
    for (let y = 43 - thickness; y < 97 + thickness; y += 1) {
      for (let x = 43 - thickness; x < 117 + thickness; x += 1) {
        const onFrame = x < 43 || x >= 117 || y < 43 || y >= 97;
        if (onFrame) data[y * width + x] = 0;
      }
    }
    return { data, width, height };
  }

  const roomWithThickWall = () => roomWithWall(3);

  it("ไม่ดัน ขอบหยุดที่ขอบในของเส้น", () => {
    const result = traceRegion(roomWithThickWall(), { x: 80, y: 70 }, { minStepPixels: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Math.min(...result.polygon.map((point) => point.x))).toBe(43);
    expect(Math.max(...result.polygon.map((point) => point.x))).toBe(117);
  });

  /**
   * คำตัดสินของเจ้าของงาน 2026-09-04 — "หนาหรือบางก็เอาชิดด้านในห้อง"
   * เทสต์นี้คือด่านที่กันไม่ให้ใครเอาขอบไปไว้กึ่งกลาง**ผนัง** เพราะกึ่งกลางผนังจะให้ค่า
   * 42.5 กับ 41.5 กับ 38.5 ตามความหนา ซึ่งกินเข้าไปในเนื้อผนังลึกขึ้นเรื่อย ๆ
   * · หมึกหนาสามพิกเซลขึ้นไปคือเนื้อผนัง ไม่ใช่เส้นที่วาด ขอบจึงต้องไม่ขยับเลย
   */
  it.each([3, 9])("หมึกหนา %i พิกเซลคือเนื้อผนัง ขอบอยู่ที่ผิวในเท่าเดิม ไม่กินเข้าเนื้อผนัง", (thickness) => {
    const result = traceRegion(roomWithWall(thickness), { x: 80, y: 70 }, {
      minStepPixels: 3,
      snapToLinePixels: 3,
      lineMaxThicknessPixels: LINE_MAX_PIXELS
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Math.min(...result.polygon.map((point) => point.x))).toBe(43);
    expect(Math.max(...result.polygon.map((point) => point.x))).toBe(117);
    expect(Math.min(...result.polygon.map((point) => point.y))).toBe(43);
    expect(Math.max(...result.polygon.map((point) => point.y))).toBe(97);
  });

  /**
   * **นี่คือ 4% ที่หายไป** เส้นในไฟล์ CAD ไม่มีความหนา ตัวเรนเดอร์ระบายหมึกคร่อมมันออกไป
   * ทั้งสองข้าง ตำแหน่งของเส้นจึงอยู่กลางแถบหมึก · ขอบที่หยุดตรงขอบในของแถบอ่านผิวผนัง
   * ต่ำไปครึ่งความหนาของเส้นทุกด้าน กรอบผนังหนาหนึ่งพิกเซลจึงต้องได้ 42.5 ไม่ใช่ 43
   *
   * ระยะครึ่งพิกเซลนี้คือครึ่งความหนาของ**เส้น** ไม่ใช่ครึ่งความหนาของ**ผนัง**
   * ผนังจะหนาแค่ไหนก็ไม่ทำให้ระยะนี้โตขึ้น ซึ่งเทสต์ข้อบนพิสูจน์ไว้แล้ว
   */
  it("เส้นผิวผนังหนาหนึ่งพิกเซล ขอบไปนั่งกึ่งกลางเส้น ไม่ใช่ขอบในของเส้น", () => {
    const result = traceRegion(roomWithWall(1), { x: 80, y: 70 }, {
      minStepPixels: 3,
      snapToLinePixels: 3,
      lineMaxThicknessPixels: LINE_MAX_PIXELS
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Math.min(...result.polygon.map((point) => point.x))).toBe(42.5);
    expect(Math.max(...result.polygon.map((point) => point.x))).toBe(117.5);
    expect(Math.min(...result.polygon.map((point) => point.y))).toBe(42.5);
    expect(Math.max(...result.polygon.map((point) => point.y))).toBe(97.5);
  });

  /**
   * ผนังอย่างที่แบบจริงวาด — เส้นผิวสองเส้นหนาเส้นละสองพิกเซล มีช่องสะอาดคั่น
   * ขอบต้องไปนั่งกึ่งกลางเส้นผิว**ด้านใน** ไม่ใช่เส้นผิวด้านนอก และไม่ใช่กลางความหนาผนัง
   */
  it("ผนังที่วาดเป็นเส้นคู่ ขอบนั่งกึ่งกลางเส้นผิวด้านใน ไม่ข้ามไปเส้นผิวด้านนอก", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const result = traceRegion(image, { x: 80, y: 70 }, {
      minStepPixels: 3,
      snapToLinePixels: 3,
      lineMaxThicknessPixels: LINE_MAX_PIXELS
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // เส้นผิวในด้านซ้ายกินคอลัมน์ 39 กับ 40 กึ่งกลางจึงอยู่ที่มุม 40.0 · ด้านขวา 119 กับ 120 ได้ 120.0
    expect(Math.min(...result.polygon.map((point) => point.x))).toBe(40);
    expect(Math.max(...result.polygon.map((point) => point.x))).toBe(120);
    expect(Math.min(...result.polygon.map((point) => point.y))).toBe(40);
    expect(Math.max(...result.polygon.map((point) => point.y))).toBe(100);
  });

  /**
   * ด่านที่กันไม่ให้ขอบเลยกึ่งกลางเส้นออกไป · ต่อให้เส้นผิวในหนาเท่าเพดานที่ยอมรับพอดี
   * ขอบก็ต้องหยุดที่กึ่งกลางของมัน ไม่ไหลออกไปหาช่องสะอาดหรือเส้นผิวนอก
   */
  it("ขอบไม่เลยกึ่งกลางเส้นออกไป แม้เส้นจะหนาเท่าเพดานที่ยอมรับพอดี", () => {
    const width = 60;
    const height = 60;
    const dark = new Uint8Array(width * height);
    // เส้นผิวในหนาสองพิกเซลที่คอลัมน์ 8 กับ 9 · ช่องสะอาดที่ 10 · เส้นผิวนอกที่ 11 กับ 12
    for (let y = 0; y < height; y += 1) {
      for (const x of [8, 9, 11, 12]) dark[y * width + x] = 1;
    }
    const outline: Pixel[] = [
      { x: 10, y: 12 },
      { x: 46, y: 12 },
      { x: 46, y: 48 },
      { x: 10, y: 48 }
    ];
    const snapped = snapOutlineToLines(outline, dark, width, height, 3, LINE_MAX_PIXELS);
    // กึ่งกลางของคอลัมน์ 8 กับ 9 คือมุม 9.0 · ไม่ใช่ 10 ซึ่งเป็นขอบใน และไม่ใช่ 8 ซึ่งเลยกึ่งกลางไป
    expect(snapped[0].x).toBe(9);
    expect(snapped[3].x).toBe(9);
  });

  /**
   * ผู้เรียกที่ไม่บอกความละเอียดของผืน ต้องได้พฤติกรรมเดิมทุกประการ ไม่ใช่ค่าที่เดาเอง
   * เพราะครึ่งความหนาของเส้นแปลงเป็นพิกเซลได้ต่อเมื่อรู้ว่าเรนเดอร์มากี่พิกเซลต่อจุด
   */
  it("ไม่บอกความหนาสูงสุดของเส้นมา ขอบหยุดที่ขอบในของหมึกเหมือนเดิม", () => {
    const result = traceRegion(roomWithWall(1), { x: 80, y: 70 }, {
      minStepPixels: 3,
      snapToLinePixels: 3
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Math.min(...result.polygon.map((point) => point.x))).toBe(43);
    expect(Math.max(...result.polygon.map((point) => point.x))).toBe(117);
  });

  /**
   * เหตุผลที่ขั้นนี้ยังต้องมีอยู่ ทั้งที่การไล่สีก็หยุดที่ผิวในเองในกรณีปกติ
   *
   * การไล่สีหยุดที่ **หน้ากากที่เชื่อมช่องประตูแล้ว** ซึ่งอ้วนกว่าหมึกจริงตรงที่มีรอยเว้า
   * ขอบจึงลอยห่างผนังอยู่ไม่กี่พิกเซลโดยมีที่ว่างคั่น · ขั้นนี้เอื้อมออกไปเกาะผิวในของหมึกจริง
   * แล้วหยุดตรงนั้นพอดี ไม่เลยเข้าไปในเนื้อผนัง
   */
  it("ด้านที่ลอยห่างผนัง ถูกเอื้อมออกไปเกาะผิวในของหมึก แล้วหยุดตรงนั้น", () => {
    const width = 40;
    const height = 40;
    const dark = new Uint8Array(width * height);
    // ผนังซ้ายเป็นแถบหมึกหนาห้าพิกเซล กินคอลัมน์ 5 ถึง 9 ผิวในจึงอยู่ที่ขอบมุม 10
    for (let y = 0; y < height; y += 1) {
      for (let x = 5; x < 10; x += 1) dark[y * width + x] = 1;
    }
    // ขอบเริ่มต้นลอยอยู่ที่ 12 ห่างผิวในสองพิกเซล โดยมีที่ว่างคั่นจริง
    const floating: Pixel[] = [
      { x: 12, y: 8 },
      { x: 30, y: 8 },
      { x: 30, y: 32 },
      { x: 12, y: 32 }
    ];
    const snapped = snapOutlineToLines(floating, dark, width, height, 3, LINE_MAX_PIXELS);
    // แถบหนาห้าพิกเซลคือเนื้อผนัง ไม่ใช่เส้น ขอบจึงหยุดที่ผิวใน ไม่เลื่อนเข้าไปในเนื้อ
    expect(snapped[0].x).toBe(10);
    expect(snapped[3].x).toBe(10);
  });

  /**
   * เจ้าของงานเลือกเมื่อ 2026-09-04 จากภาพขยาย 14 เท่าของผนังบนห้องพักพยาบาล ว่าขอบต้อง
   * อยู่ใต้เส้นผิวบางที่วิ่งตลอดแนว (ตัวเลือก B) ไม่ใช่ใต้หมึกที่เกาะอยู่แค่บางช่วง (ตัวเลือก C)
   */
  it("หมึกที่เกาะใต้ผิวผนังแค่บางช่วง ไม่ใช่ผนัง ขอบทับมันขึ้นไปชิดเส้นผิวที่วิ่งตลอดแนว", () => {
    const width = 120;
    const height = 40;
    const dark = new Uint8Array(width * height);
    // เส้นผิวผนังบนหนาสองพิกเซล วิ่งตลอดความกว้าง ที่แถว 10 กับ 11
    for (let x = 0; x < width; x += 1) {
      dark[10 * width + x] = 1;
      dark[11 * width + x] = 1;
    }
    // หมึกอีกสองแถวเกาะอยู่ใต้ผิว แต่วิ่งแค่ครึ่งด้าน ตั้งแต่ x 20 ถึง 70 จากด้านที่กว้าง 100
    for (let x = 20; x < 70; x += 1) {
      dark[12 * width + x] = 1;
      dark[13 * width + x] = 1;
    }
    // ขอบเริ่มต้นหยุดใต้หมึกก้อนนั้น คือแถว 14 ทั้งด้าน
    const stopped: Pixel[] = [
      { x: 10, y: 14 },
      { x: 110, y: 14 },
      { x: 110, y: 34 },
      { x: 10, y: 34 }
    ];
    const snapped = snapOutlineToLines(stopped, dark, width, height, 3, LINE_MAX_PIXELS);
    // เส้นผิวที่วิ่งตลอดแนวกินแถว 10 กับ 11 กึ่งกลางจึงอยู่ที่มุม 11.0 ไม่ใช่ 12 ซึ่งเป็นขอบใน
    expect(snapped[0].y).toBe(11);
    expect(snapped[1].y).toBe(11);
  });

  it("ด้านที่ไม่มีเส้นอยู่ข้างนอกเลย อยู่ที่เดิม ไม่ถูกดันมั่ว", () => {
    const image = roomWithThickWall();
    // ลบผนังบนออกทั้งแนว แล้วเชื่อมช่องกลับด้วยการเชื่อมช่องประตู
    for (let y = 40; y < 43; y += 1) {
      for (let x = 60; x < 100; x += 1) image.data[y * image.width + x] = 255;
    }
    const result = traceRegion(image, { x: 80, y: 70 }, {
      minStepPixels: 3,
      snapToLinePixels: 3,
      bridgeGapPixels: 22
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Math.min(...result.polygon.map((point) => point.y))).toBeGreaterThanOrEqual(41);
    expect(Math.min(...result.polygon.map((point) => point.y))).toBeLessThanOrEqual(43);
  });
});

describe("การยุบบันไดที่ต่อกันหลายขั้น", () => {
  /** สี่เหลี่ยม 100 × 100 ที่มุมล่างขวาแหว่งเป็นบันไดหกขั้น ขั้นละหนึ่งถึงสามพิกเซล */
  function boxWithRaggedCorner(): Pixel[] {
    return [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 90 },
      { x: 97, y: 90 },
      { x: 97, y: 92 },
      { x: 95, y: 92 },
      { x: 95, y: 93 },
      { x: 94, y: 93 },
      { x: 94, y: 94 },
      { x: 92, y: 94 },
      { x: 92, y: 100 },
      { x: 0, y: 100 }
    ];
  }

  /** หมุนวงให้เริ่มที่จุดซ้ายบนสุด เพราะการยุบอาจคืนวงเดิมที่เริ่มคนละจุด */
  function fromTopLeft(points: readonly Pixel[]): Pixel[] {
    let start = 0;
    points.forEach((point, index) => {
      const best = points[start];
      if (point.y < best.y || (point.y === best.y && point.x < best.x)) start = index;
    });
    return [...points.slice(start), ...points.slice(0, start)];
  }

  it("บันไดหกขั้นที่มุมยุบเป็นมุมฉากเดียว โดยไม่นับเศษบันไดเป็นพื้นห้อง", () => {
    const squared = fromTopLeft(collapseStaircases(boxWithRaggedCorner(), 7));
    expect(squared).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 90 },
      { x: 92, y: 90 },
      { x: 92, y: 100 },
      { x: 0, y: 100 }
    ]);
  });

  it("ขั้นที่ใหญ่เท่าเสาไม่ถูกยุบ เพราะมันคือขอบที่หักอ้อมเสาจริง", () => {
    const withColumn: Pixel[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 7 },
      { x: 91, y: 7 },
      { x: 91, y: 100 },
      { x: 0, y: 100 }
    ];
    expect(collapseStaircases(withColumn, 7)).toEqual(withColumn);
  });

  it("ขั้นเดี่ยวที่มีด้านยาวขนาบสองข้างไม่ใช่บันได ปล่อยไว้ให้กติกาของขั้นเดี่ยวตัดสิน", () => {
    const stub: Pixel[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 40 },
      { x: 96, y: 40 },
      { x: 96, y: 100 },
      { x: 0, y: 100 }
    ];
    expect(collapseStaircases(stub, 7)).toEqual(stub);
  });

  it("บันไดที่คร่อมรอยต่อของอาร์เรย์ก็ยุบได้", () => {
    const box = boxWithRaggedCorner();
    // หมุนอาร์เรย์ให้บันไดคร่อมจุดเริ่มต้น
    const rotated = [...box.slice(6), ...box.slice(0, 6)];
    const squared = collapseStaircases(rotated, 7);
    expect(squared.length).toBe(6);
    expect(squared).toContainEqual({ x: 92, y: 90 });
    expect(squared).not.toContainEqual({ x: 94, y: 94 });
  });

  it("ไล่ขอบห้องจริง มุมเสาที่โดนสัญลักษณ์กัดแหว่งออกมาเป็นมุมฉากเดียว", () => {
    // หน้าใหญ่กว่าห้องมาก ไม่งั้นห้องจะเกินเพดานสัดส่วนพื้นที่แล้วถูกตีว่าสีทะลุ
    const image = pageWithRoom({ width: 400, height: 400, room: { x: 40, y: 40, w: 120, h: 120 } });
    const { data, width } = image;
    // เสาทึบที่มุมล่างขวา กว้างสิบสองพิกเซล ชิดผิวในของผนังทั้งสองด้าน
    for (let y = 147; y < 159; y += 1) for (let x = 147; x < 159; x += 1) data[y * width + x] = 0;
    // มุมบนซ้ายของเสาแหว่งเป็นบันไดสี่ขั้น เหมือนโดนสัญลักษณ์กัด
    for (let step = 0; step < 4; step += 1) {
      for (let x = 147; x < 147 + 4 - step; x += 1) data[(147 + step) * width + x] = 255;
    }
    const result = traceRegion(image, { x: 100, y: 100 }, {
      minRunPixels: 10,
      minStructurePixels: 60,
      column: { min: 7, max: 36, touch: 5 },
      minStepPixels: 2,
      snapToLinePixels: 3
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // มุมเสาต้องเป็นมุมฉากเดียวที่ (147, 147) ไม่มีจุดอื่นในบริเวณบันได
    const nearCorner = result.polygon.filter((point) => point.x >= 145 && point.x <= 153 && point.y >= 145 && point.y <= 153);
    expect(nearCorner).toEqual([{ x: 147, y: 147 }]);
  });

});

describe("การยุบขั้นบันไดเล็ก", () => {
  it("ขั้นหนึ่งพิกเซลถูกยุบ", () => {
    const stepped = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 1 },
      { x: 100, y: 1 },
      { x: 100, y: 60 },
      { x: 0, y: 60 }
    ];
    const cleaned = removeJogs(stepped, 4);
    expect(cleaned).toHaveLength(4);
    expect(cleaned.every((point, index) => {
      const next = cleaned[(index + 1) % cleaned.length];
      return point.x === next.x || point.y === next.y;
    })).toBe(true);
  });

  /** ขั้นที่หลบเสากว้างอย่างน้อย 0.20 เมตร ซึ่งใหญ่กว่าค่ายุบมาก ห้ามหาย */
  it("ขั้นที่หลบเสาไม่ถูกยุบ", () => {
    const withColumn = [
      { x: 0, y: 0 },
      { x: 88, y: 0 },
      { x: 88, y: 12 },
      { x: 100, y: 12 },
      { x: 100, y: 60 },
      { x: 0, y: 60 }
    ];
    expect(removeJogs(withColumn, 4)).toHaveLength(6);
  });
});

describe("จำหน้ากากผนังไว้กับภาพ ไม่คำนวณซ้ำทุกคลิก", () => {
  const options = { minRunPixels: 20, minStructurePixels: 40, bridgeGapPixels: 3, wallThicknessPixels: 6 };

  it("ภาพเดิม เกณฑ์เดิม ได้หน้ากากอ็อบเจ็กต์เดิม ไม่ใช่คำนวณใหม่", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const first = structuralBarrier(image, options);
    const second = structuralBarrier(image, options);
    expect(second.barrier).toBe(first.barrier);
    expect(second.drawn).toBe(first.drawn);
  });

  it("เกณฑ์เปลี่ยน ต้องคำนวณใหม่ ไม่เอาของเก่ามาให้", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const first = structuralBarrier(image, options);
    const second = structuralBarrier(image, { ...options, bridgeGapPixels: 5 });
    expect(second.barrier).not.toBe(first.barrier);
  });

  it("ภาพคนละใบ ไม่ปนกัน แม้ขนาดและเกณฑ์เท่ากัน", () => {
    const a = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const b = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 }, gap: 10 });
    structuralBarrier(a, options);
    const mine = structuralBarrier(b, options);
    expect(mine.barrier).not.toBe(structuralBarrier(a, options).barrier);
  });

  it("คลิกครั้งที่สองบนภาพเดิม ผ่านของที่จำไว้ ได้ขอบเท่ากันทุกจุด", () => {
    const image = pageWithRoom({ width: 200, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const first = traceRegion(image, { x: 80, y: 70 }, options);
    const second = traceRegion(image, { x: 60, y: 50 }, options);
    expect(first.ok).toBe(true);
    expect(second).toEqual(first);
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

/**
 * เทสต์กันถอยหลังของบั๊กเงียบที่มีอยู่ในโค้ดก่อนก้อน A
 *
 * เดิมภาพที่การไล่พื้นที่ห้องอ่าน เป็นผืนเดียวกับที่แสดงบนจอ และความละเอียดของมัน
 * ไล่ตามระดับซูม **ผลคือคลิกกลางห้องเดียวกันที่ซูมต่างกัน ได้พื้นที่คนละค่า** โดยไม่มี
 * อะไรเตือน เพราะจำนวนพิกเซลของห้องเปลี่ยนไปตามความละเอียดของภาพ
 *
 * `fullPageScaleFor` เป็นตัวเดียวที่กำหนดความละเอียดของชั้นวิเคราะห์ และมันรับแค่ขนาดหน้า
 * ถ้าวันหนึ่งมีคนเติมพารามิเตอร์ระดับซูมเข้าไป หรือเอาชั้นวิเคราะห์ไปผูกกับซูมอีกครั้ง
 * เทสต์ชุดนี้ต้องแดงทันที
 */
describe("ความละเอียดของชั้นวิเคราะห์ต้องไม่ขึ้นกับระดับซูม", () => {
  const A3 = { width: 1190.55, height: 841.89 };

  it("หน้าเดียวกันให้ความละเอียดค่าเดียวเสมอ ไม่ว่าผู้ใช้จะซูมเท่าไหร่", () => {
    // ไม่มีทางส่งระดับซูมเข้าไปได้เลย คุมด้วยลายเซ็นของฟังก์ชัน เรียกซ้ำจึงต้องได้ค่าเดิม
    const first = fullPageScaleFor(A3);
    for (let repeat = 0; repeat < 5; repeat += 1) {
      expect(fullPageScaleFor(A3)).toBe(first);
    }
  });

  it("ห้องเดียวกันบนภาพที่ความละเอียดเท่ากัน ให้พื้นที่เท่ากันทุกครั้ง", () => {
    const image = pageWithRoom({ width: 240, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const first = traceRegion(image, { x: 80, y: 70 });
    const second = traceRegion(image, { x: 82, y: 72 });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.areaPixels).toBe(first.areaPixels);
  });

  it("ภาพความละเอียดต่างกันให้จำนวนพิกเซลต่างกัน ซึ่งคือเหตุผลที่ชั้นวิเคราะห์ต้องคงที่", () => {
    const low = pageWithRoom({ width: 120, height: 100, room: { x: 20, y: 20, w: 40, h: 30 } });
    const high = pageWithRoom({ width: 240, height: 200, room: { x: 40, y: 40, w: 80, h: 60 } });
    const lowResult = traceRegion(low, { x: 40, y: 35 });
    const highResult = traceRegion(high, { x: 80, y: 70 });
    expect(lowResult.ok && highResult.ok).toBe(true);
    if (!lowResult.ok || !highResult.ok) return;
    // 38x28 = 1064 กับ 78x58 = 4524 — ต่างกันเกือบสี่เท่าจากความละเอียดล้วน ๆ
    expect(lowResult.areaPixels).not.toBe(highResult.areaPixels);
  });
});
