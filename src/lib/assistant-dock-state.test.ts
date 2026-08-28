import { describe, expect, it } from "vitest";
import { parseDockState, toggleDockState } from "./assistant-dock-state";

describe("สถานะย่อ/กางของแผงผู้ช่วยกลาง (IP-185)", () => {
  it("ค่าที่บันทึกไว้ถูกอ่านกลับตรงตัว", () => {
    expect(parseDockState("open")).toBe("open");
    expect(parseDockState("collapsed")).toBe("collapsed");
  });

  it("ค่าขยะ ค่าว่าง หรืออ่านไม่ได้ ถือเป็นค่าเริ่มต้น 'กาง' — คนใหม่เห็นทันทีว่ามีผู้ช่วย (คำชี้ขาด 2026-08-28)", () => {
    expect(parseDockState(null)).toBe("open");
    expect(parseDockState(undefined)).toBe("open");
    expect(parseDockState("")).toBe("open");
    expect(parseDockState("banana")).toBe("open");
  });

  it("สลับสถานะไปกลับได้ครบวงจร", () => {
    expect(toggleDockState("collapsed")).toBe("open");
    expect(toggleDockState("open")).toBe("collapsed");
    expect(toggleDockState(toggleDockState("open"))).toBe("open");
  });
});
