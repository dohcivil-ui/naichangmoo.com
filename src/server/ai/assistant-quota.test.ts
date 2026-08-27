import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ getDb: () => ({}) }));

const { dailySpendCapMicroUsd, monthlyCapFor, perMinuteCap } = await import("@/server/ai/assistant-quota");

/**
 * ตัวเลขเพดานเป็นค่าชั่วคราวรอราคาขาย (IP-081)
 *
 * เทสต์ชุดนี้จึงไม่ได้ยืนยันว่า 300 คือตัวเลขที่ถูก แต่ยืนยันสองอย่างที่ถูกแน่ ๆ ไม่ว่าราคาจะออกมา
 * เท่าไร: **สมาชิกฟรีต้องไม่ได้เท่าคนจ่ายเงิน** และ **สถานะที่ไม่มีสิทธิ์ต้องได้ศูนย์**
 * ส่วนตัวเลขจริงแก้ได้ด้วย .env โดยไม่ต้องแตะโค้ด
 */
describe("เพดานผู้ช่วยตามหมวดสิทธิ์", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("สมาชิกจ่ายเงินได้มากกว่าทดลองใช้ และทดลองใช้ได้มากกว่าศูนย์", () => {
    expect(monthlyCapFor("active")).toBeGreaterThan(monthlyCapFor("trial"));
    expect(monthlyCapFor("trial")).toBeGreaterThan(0);
  });

  it("สมาชิกฟรีไม่ได้เท่าสมาชิกที่จ่ายเงิน", () => {
    expect(monthlyCapFor("member_free")).toBeLessThan(monthlyCapFor("active"));
  });

  it("สถานะที่ไม่มีสิทธิ์ใช้ผู้ช่วยได้ศูนย์ครั้ง ไม่ใช่ค่าเริ่มต้นของใครสักคน", () => {
    expect(monthlyCapFor("expired_read_only")).toBe(0);
    expect(monthlyCapFor("suspended")).toBe(0);
    expect(monthlyCapFor("not_activated")).toBe(0);
    expect(monthlyCapFor("not_started")).toBe(0);
  });

  it("แก้เพดานได้ด้วย .env โดยไม่ต้องแก้โค้ด", () => {
    process.env.ASSISTANT_CAP_ACTIVE = "42";
    expect(monthlyCapFor("active")).toBe(42);
  });

  it("ค่าที่ตั้งผิดรูปใน .env ตกกลับไปใช้ค่าเริ่มต้น ไม่ใช่กลายเป็นศูนย์หรือไม่จำกัด", () => {
    process.env.ASSISTANT_CAP_ACTIVE = "ไม่ใช่ตัวเลข";
    expect(monthlyCapFor("active")).toBe(300);
    process.env.ASSISTANT_CAP_ACTIVE = "-5";
    expect(monthlyCapFor("active")).toBe(300);
  });

  it("ผู้ดูแลแพลตฟอร์มมีโควตาของตัวเอง แม้สถานะจะเป็นแบบที่เพดานปกติเป็นศูนย์", () => {
    expect(monthlyCapFor("not_activated", true)).toBeGreaterThan(0);
    expect(monthlyCapFor("not_activated", false)).toBe(0);
  });

  it("เพดานต่อนาทีมีจริงและมากกว่าศูนย์", () => {
    expect(perMinuteCap()).toBeGreaterThan(0);
  });
});

describe("เบรกมือค่าใช้จ่ายรวมต่อวัน", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("แปลงบาทที่ตั้งไว้เป็น micro USD ด้วยอัตราตรึงเดียวกับที่ประเมินค่าใช้จ่าย", () => {
    process.env.ASSISTANT_DAILY_SPEND_BAHT = "350";
    expect(dailySpendCapMicroUsd()).toBe(10_000_000);
  });

  it("ค่าเริ่มต้น 300 บาทต่อวัน คิดเป็นราวหนึ่งพันสามร้อยครั้งที่ต้นทุนวัดจริง 0.22 บาทต่อครั้ง", () => {
    delete process.env.ASSISTANT_DAILY_SPEND_BAHT;
    const capBaht = (dailySpendCapMicroUsd() / 1_000_000) * 35;
    expect(Math.round(capBaht)).toBe(300);
    expect(Math.round(capBaht / 0.22)).toBeGreaterThan(1_000);
  });
});
