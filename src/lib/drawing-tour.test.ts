import { describe, expect, it } from "vitest";
import { drawingTourStep } from "@/lib/drawing-tour";
import { toolNeedsScale, type Tool } from "@/lib/drawing-tools";

/**
 * ตารางความจริงของทัวร์ ครบทั้งสี่ช่อง — ไม่ใช่แค่สองช่องที่เดินหน้าตามปกติ
 *
 * ช่องที่ดูเหมือนเกิดไม่ได้ (ไม่มีแบบ แต่มีสเกล) คือช่องที่เทสต์ต้องเฝ้าที่สุด เพราะวันที่มีคน
 * เพิ่มการกู้สถานะเก่ากลับมาก่อนไฟล์ถูกเปิด มันจะเกิดขึ้นจริงโดยไม่มีใครตั้งใจ
 */
describe("ผู้ช่วยพาทัวร์ของหน้าแบบ (IP-236)", () => {
  it("ยังไม่เปิดแบบ พาไปเปิดแบบก่อน", () => {
    const step = drawingTourStep({ hasDrawing: false, hasPageScale: false });
    expect(step?.target).toBe("open");
    expect(step?.index).toBe(1);
  });

  it("ไม่มีแบบ แต่มีสเกลค้างอยู่ ยังพาไปเปิดแบบก่อนเสมอ", () => {
    expect(drawingTourStep({ hasDrawing: false, hasPageScale: true })?.target).toBe("open");
  });

  it("เปิดแบบแล้วแต่ยังไม่ตั้งสเกล พาไปตั้งสเกล", () => {
    const step = drawingTourStep({ hasDrawing: true, hasPageScale: false });
    expect(step?.target).toBe("scale");
    expect(step?.index).toBe(2);
  });

  it("ครบทั้งสองอย่างแล้ว ทัวร์หายไปเอง ไม่ต้องให้คนกดปิด", () => {
    expect(drawingTourStep({ hasDrawing: true, hasPageScale: true })).toBeNull();
  });

  it("ทุกขั้นบอกครบว่าทำไมกดไม่ได้ และต้องทำอะไรต่อ", () => {
    for (const state of [
      { hasDrawing: false, hasPageScale: false },
      { hasDrawing: true, hasPageScale: false }
    ]) {
      const step = drawingTourStep(state);
      expect(step).not.toBeNull();
      expect(step?.reason.length).toBeGreaterThan(0);
      expect(step?.action.length).toBeGreaterThan(0);
      expect(step?.actionLabel.length).toBeGreaterThan(0);
      expect(step?.total).toBe(2);
    }
  });

  /**
   * ทัวร์กับด่านสเกลต้องพูดตรงกัน — วันที่มีคนขยายด่านให้ล็อกเครื่องมือเพิ่ม ทัวร์ที่ยัง
   * บอกว่า "ครบแล้ว" จะกลายเป็นคำโกหกทันที เทสต์นี้ผูกสองเรื่องเข้าด้วยกันไม่ให้แยกกันเพี้ยน
   */
  it("ทัวร์จบก็ต่อเมื่อไม่มีเครื่องมือตัวไหนถูกล็อกด้วยเรื่องสเกลอีก", () => {
    const everyTool: Tool[] = [
      "select",
      "scale",
      "room",
      "gridline",
      "dimension",
      "length",
      "polyline",
      "rect",
      "area",
      "count"
    ];
    const stillLocked = everyTool.filter((tool) => toolNeedsScale(tool));
    expect(stillLocked.length).toBeGreaterThan(0);
    expect(drawingTourStep({ hasDrawing: true, hasPageScale: false })).not.toBeNull();
    expect(drawingTourStep({ hasDrawing: true, hasPageScale: true })).toBeNull();
  });
});
