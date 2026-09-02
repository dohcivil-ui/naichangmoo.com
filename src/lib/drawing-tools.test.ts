import { describe, expect, it } from "vitest";
import { toolNeedsScale, type Tool } from "@/lib/drawing-tools";

/**
 * ตารางนี้เขียนทีละช่องโดยตั้งใจ ไม่ใช้การวนหรือการเดาจากชนิด
 *
 * เพราะสิ่งที่เฝ้าอยู่คือ **คำตัดสินของเจ้าของงาน** ว่าเครื่องมือไหนใช้ได้ก่อนตั้งสเกล
 * ไม่ใช่ตรรกะที่อนุมานได้จากโค้ด วันที่มีคนเผลอขยายด่านกลับไปกว้างเหมือนเดิม
 * เทสต์ต้องแดงทันที ไม่ใช่รอเจ้าของงานเปิดใช้แล้วเจอว่าร่างกริดไม่ได้
 */
describe("ด่านสเกลของเครื่องมือ", () => {
  it("ความยาวสองจุดต้องมีสเกล เพราะคืนค่าเป็นเมตร", () => {
    expect(toolNeedsScale("length")).toBe(true);
  });

  it("ความยาวต่อเนื่องต้องมีสเกล", () => {
    expect(toolNeedsScale("polyline")).toBe(true);
  });

  it("พื้นที่สี่เหลี่ยมต้องมีสเกล เพราะคืนค่าเป็นตารางเมตร", () => {
    expect(toolNeedsScale("rect")).toBe(true);
  });

  it("พื้นที่หลายเหลี่ยมต้องมีสเกล", () => {
    expect(toolNeedsScale("area")).toBe(true);
  });

  it("เลือกพื้นที่ห้องต้องมีสเกล", () => {
    expect(toolNeedsScale("room")).toBe(true);
  });

  it("เครื่องมือเลือกไม่ต้องมีสเกล", () => {
    expect(toolNeedsScale("select")).toBe(false);
  });

  it("เครื่องมือเลื่อนไม่ต้องมีสเกล", () => {
    expect(toolNeedsScale("pan")).toBe(false);
  });

  it("เครื่องมือตั้งสเกลเองไม่ต้องมีสเกล มิฉะนั้นตั้งสเกลครั้งแรกไม่ได้เลย", () => {
    expect(toolNeedsScale("scale")).toBe(false);
  });

  it("นับจำนวนไม่ต้องมีสเกล เพราะคืนค่าเป็นจำนวนจุด ไม่ใช่เมตร", () => {
    expect(toolNeedsScale("count")).toBe(false);
  });

  it("ร่างกริดไม่ต้องมีสเกล เพราะแนวเสามาก่อนสเกลตามลำดับงานที่เจ้าของงานใช้จริง", () => {
    expect(toolNeedsScale("gridline")).toBe(false);
  });

  it("ระยะจริงไม่ต้องมีสเกล เพราะมันคือสิ่งที่ใช้ตั้งสเกล", () => {
    expect(toolNeedsScale("dimension")).toBe(false);
  });

  it("ครอบคลุมเครื่องมือครบทั้งสิบเอ็ดตัว ไม่มีตัวไหนหลุดจากตาราง", () => {
    const all: Tool[] = [
      "select",
      "pan",
      "scale",
      "room",
      "gridline",
      "dimension",
      "length",
      "polyline",
      "area",
      "rect",
      "count"
    ];
    expect(all.length).toBe(11);
    expect(all.filter(toolNeedsScale).sort()).toEqual(["area", "length", "polyline", "rect", "room"]);
  });
});
