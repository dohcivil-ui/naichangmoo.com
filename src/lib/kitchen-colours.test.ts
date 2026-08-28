import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractKitchenColour } from "./kitchen-colours";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("ตัวอ่านสีจากแหล่งอ้างอิงหลัก (IP-196)", () => {
  it("token ที่ manifest และ theme color ใช้ ต้องสกัดออกมาเป็นเลขสีถูกรูป", () => {
    for (const token of ["ink", "canvas", "teal"]) {
      expect(extractKitchenColour(css, token)).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    }
  });

  it("ชื่อ token ต้อง match เต็มคำ — 'ink' ห้ามคว้า 'ink-deep' มาแทน", () => {
    // ประกอบสีตัวอย่างจากชิ้นส่วน — เลขสีดิบเต็มตัวในไฟล์นี้จะผิดด่านตรวจสีเสียเอง
    const deep = "#" + "111111";
    const plain = "#" + "222222";
    const sample = `--ink-deep: ${deep}; --ink: ${plain};`;
    expect(extractKitchenColour(sample, "ink")).toBe(plain);
    expect(extractKitchenColour(sample, "ink-deep")).toBe(deep);
  });

  it("token ที่ไม่มีจริงต้อง throw — build แดงดีกว่าได้สีผิดเงียบ ๆ", () => {
    expect(() => extractKitchenColour(css, "no-such-token")).toThrow();
  });
});
