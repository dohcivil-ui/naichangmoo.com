import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ด่านตรวจอัตโนมัติของฉากสาธิตสด (IP-197)
 *
 * ปุ่มในหน้าต่างสาธิตเป็นภาพประกอบล้วน — ปุ่มที่ tab ไปถึงแล้วกดไม่เกิดอะไรคือการหลอกผู้ใช้
 * เจ้าของงานเคาะข้อนี้ตอนกริล 2026-08-28 เทสต์นี้อ่านซอร์สจริงแบบเดียวกับ
 * way-home.test.ts เพื่อกันคนเผลอใส่ <button> กลับมาทีหลัง และยืนยันว่า
 * โปรแกรมอ่านหน้าจอได้ข้อความสรุปแทนฉากที่ถูกซ่อน
 */

const COMPONENT_PATH = join(process.cwd(), "src/components/landing/hero-live-demo.tsx");

/** ประวัติอยู่ในคอมเมนต์ได้ นับเฉพาะโค้ดที่ render จริง */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

describe("ด่านตรวจฉากสาธิตสด (IP-197)", () => {
  const source = withoutComments(readFileSync(COMPONENT_PATH, "utf8"));

  it("ในกรอบสาธิตต้องไม่มีปุ่มจริง — ของกดไม่ได้ห้ามแต่งตัวเป็นของกดได้", () => {
    expect(source).not.toMatch(/<button/i);
  });

  it("กรอบสาธิตถูกซ่อนจากโปรแกรมอ่านหน้าจอ และมีข้อความสรุปแทน", () => {
    expect(source).toContain("aria-hidden");
    expect(source).toContain("hero-demo__sr");
  });

  it("SSR คือเฟรมสุดท้ายจริง ไม่ใช่กล่องเปล่า — คลาสเริ่มต้นมี is-static และจังหวะจบ", () => {
    expect(source).toMatch(/className="hero-demo is-static[^"]*is-phase4/);
  });

  it("คำต้องห้ามไม่โผล่ในฉาก: ใช้ 'ช่องเวลา' ตาม CONTEXT.md ไม่ใช่ 'งวด'", () => {
    expect(source).not.toMatch(/งวด/);
  });
});
