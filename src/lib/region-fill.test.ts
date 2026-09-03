import { describe, expect, it } from "vitest";
import { fullPageScaleFor } from "@/lib/drawing-render";
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
