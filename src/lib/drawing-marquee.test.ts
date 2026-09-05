import { describe, expect, it } from "vitest";
import {
  marqueeFrom,
  pointInMarquee,
  segmentInMarquee,
  segmentTouchesMarquee,
  shapeInMarquee
} from "@/lib/drawing-marquee";

/**
 * กรณีที่เทสต์ชุดนี้เฝ้าอยู่จริง ๆ คือ **แนวเสาที่พาดยาวตลอดหน้า**
 *
 * ถ้ากติกาพลาดไปทางเข้มเกิน จะลบแนวเสาไม่ได้เลยเพราะไม่มีใครลากกรอบครอบทั้งหน้าไหว
 * ถ้าพลาดไปทางหลวมเกิน การลากกรอบเล็ก ๆ ตรงไหนก็ได้จะกวาดแนวเสาไปด้วยทุกครั้ง
 * ทั้งสองอย่างคือการลบงานของผู้ใช้โดยที่เขาไม่ได้สั่ง
 */
describe("กรอบลากเลือกของหน้าแบบ", () => {
  it("ลากไปทางขวาคือคลุมทั้งชิ้น ลากไปทางซ้ายคือแตะก็พอ", () => {
    expect(marqueeFrom({ x: 10, y: 10 }, { x: 50, y: 40 }).mode).toBe("window");
    expect(marqueeFrom({ x: 50, y: 10 }, { x: 10, y: 40 }).mode).toBe("crossing");
  });

  it("ลากตรงดิ่งโดยไม่ขยับแกน x ถือเป็นคลุมทั้งชิ้น เพราะเป็นกติกาที่ปลอดภัยกว่า", () => {
    expect(marqueeFrom({ x: 20, y: 10 }, { x: 20, y: 90 }).mode).toBe("window");
  });

  it("กรอบเรียงจากมุมไหนก็ได้ ค่าที่ออกมาเรียงน้อยไปมากเสมอ", () => {
    const rect = marqueeFrom({ x: 80, y: 90 }, { x: 20, y: 30 });
    expect([rect.minX, rect.minY, rect.maxX, rect.maxY]).toEqual([20, 30, 80, 90]);
  });

  it("จุดบนขอบพอดีนับว่าอยู่ใน เพราะคนลากให้ปลายชนขอบแล้วคาดว่าจะติด", () => {
    const rect = marqueeFrom({ x: 0, y: 0 }, { x: 10, y: 10 });
    expect(pointInMarquee({ x: 10, y: 10 }, rect)).toBe(true);
    expect(pointInMarquee({ x: 10.01, y: 10 }, rect)).toBe(false);
  });

  it("เส้นที่พาดทะลุกรอบโดยปลายทั้งสองอยู่นอกกรอบ ถือว่าแตะ", () => {
    const rect = marqueeFrom({ x: 60, y: 10 }, { x: 10, y: 40 });
    expect(segmentTouchesMarquee({ x: -100, y: 25 }, { x: 400, y: 25 }, rect)).toBe(true);
  });

  it("เส้นที่อยู่คนละฝั่งของกรอบทั้งเส้น ไม่ถือว่าแตะ", () => {
    const rect = marqueeFrom({ x: 60, y: 10 }, { x: 10, y: 40 });
    expect(segmentTouchesMarquee({ x: -100, y: 200 }, { x: 400, y: 200 }, rect)).toBe(false);
  });

  it("แนวเสาที่พาดตลอดหน้า ลบได้ด้วยกรอบแตะ แต่ไม่ติดกรอบคลุมทั้งชิ้น", () => {
    const a = { x: 300, y: 0 };
    const b = { x: 300, y: 900 };
    const crossing = marqueeFrom({ x: 340, y: 400 }, { x: 260, y: 460 });
    const window = marqueeFrom({ x: 260, y: 400 }, { x: 340, y: 460 });
    expect(segmentInMarquee(a, b, crossing)).toBe(true);
    expect(segmentInMarquee(a, b, window)).toBe(false);
  });

  it("เส้นสั้นที่อยู่ในกรอบทั้งเส้น ติดทั้งสองกติกา", () => {
    const a = { x: 20, y: 20 };
    const b = { x: 40, y: 30 };
    expect(segmentInMarquee(a, b, marqueeFrom({ x: 10, y: 10 }, { x: 50, y: 50 }))).toBe(true);
    expect(segmentInMarquee(a, b, marqueeFrom({ x: 50, y: 10 }, { x: 10, y: 50 }))).toBe(true);
  });

  it("หมุดนับจำนวนจุดเดียว ตัดสินด้วยตำแหน่งของมันเอง", () => {
    const rect = marqueeFrom({ x: 0, y: 0 }, { x: 10, y: 10 });
    expect(shapeInMarquee([{ x: 5, y: 5 }], rect)).toBe(true);
    expect(shapeInMarquee([{ x: 15, y: 5 }], rect)).toBe(false);
  });

  it("รูปปิดที่กรอบแตะแค่ด้านเดียว ติดกติกาแตะ แต่ไม่ติดกติกาคลุมทั้งชิ้น", () => {
    const room = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
      { x: 100, y: 200 }
    ];
    const crossing = marqueeFrom({ x: 260, y: 150 }, { x: 190, y: 160 });
    const window = marqueeFrom({ x: 190, y: 150 }, { x: 260, y: 160 });
    expect(shapeInMarquee(room, crossing)).toBe(true);
    expect(shapeInMarquee(room, window)).toBe(false);
  });

  it("รูปปิดที่อยู่ในกรอบทั้งรูป ติดกติกาคลุมทั้งชิ้น", () => {
    const room = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
      { x: 100, y: 200 }
    ];
    expect(shapeInMarquee(room, marqueeFrom({ x: 90, y: 90 }, { x: 210, y: 210 }))).toBe(true);
  });

  it("ด้านปิดของรูปก็นับด้วย ไม่ใช่นับแค่ด้านที่ไล่ตามลำดับจุด", () => {
    /* กรอบแตะเฉพาะด้านซ้ายซึ่งเป็นด้านที่ต่อจากจุดสุดท้ายกลับไปจุดแรก
       ถ้าลืมต่อปลายกลับ ด้านนี้จะหายไปหนึ่งด้านและตอบผิดว่าไม่ติด */
    const room = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
      { x: 100, y: 200 }
    ];
    const crossing = marqueeFrom({ x: 110, y: 140 }, { x: 60, y: 160 });
    expect(shapeInMarquee(room, crossing)).toBe(true);
  });

  it("รูปว่างเปล่าไม่ติดอะไรเลย ไม่ระเบิด", () => {
    expect(shapeInMarquee([], marqueeFrom({ x: 0, y: 0 }, { x: 10, y: 10 }))).toBe(false);
  });
});
