import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isPromoLive, promoEndsAt } from "@/lib/landing-v3-data";

/**
 * ด่านตรวจว่าแท็บโปรโมชั่นกับบล็อกโปรโมชั่นตายพร้อมกัน
 *
 * **บั๊กที่ด่านนี้เกิดมาเพื่อกัน** `2abbd67` เคยถอนแท็บโปรโมชั่นออกเพราะ `#promo`
 * ยังไม่มีปลายทาง แล้ว `7a2f429` เอากลับมาพร้อมบล็อกจริง ตามกติกาที่เขียนไว้เองว่า
 * ปลายทางกับลิงก์ต้องเกิดพร้อมกันเสมอ · แต่บล็อกมีวันหมดอายุ ส่วนแท็บไม่มี
 * **วันที่ 1 ต.ค. 2569 บล็อกจะหายตามที่ตั้งใจ แล้วแท็บจะเหลือเป็นลิงก์ที่ชี้ไปที่ว่าง
 * โดยไม่มีใครแตะโค้ดสักบรรทัด** กติกาพังตัวเองตามปฏิทิน ซึ่งเทสต์หกข้อของก้อนนั้น
 * ไม่มีข้อไหนเฝ้าอยู่เลย
 *
 * บทเรียนที่ด่านนี้ถือไว้: **ลิงก์กับปลายทางไม่ได้แค่เกิดพร้อมกัน มันต้องตายพร้อมกันด้วย**
 * และของที่ตายตามปฏิทินต้องมีด่านเฝ้า เพราะไม่มีใครทำอะไรผิดในวันที่มันพัง
 *
 * **สิ่งที่ด่านนี้จับไม่ได้** คือหน้าจอจริง ว่าแท็บหายจริงไหมในวันนั้น ค่านั้นต้องวัดใน
 * เบราว์เซอร์ตอนตรวจงาน — บทเรียนเดียวกับด่านปุ่มและด่านฟอนต์ตัวเลข
 */

const PAGE = "src/app/page.tsx";
const BAR = "src/components/landing/v3/category-bar.tsx";

function read(relative: string): string {
  return readFileSync(join(process.cwd(), relative), "utf8");
}

/** คอมเมนต์ไม่ใช่การประกาศ — บทเรียนเดียวกับรั้วสีที่เคยจับคำอธิบายของตัวเองผิด */
function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
}

describe("แท็บโปรโมชั่นกับบล็อกโปรโมชั่น", () => {
  it("เลยวันหมดอายุไปหนึ่งวินาที ค่าที่ตัดสินทั้งสองที่เป็นเท็จ", () => {
    const justAfter = new Date(new Date(promoEndsAt).getTime() + 1000);
    expect(isPromoLive(justAfter)).toBe(false);
  });

  it("หน้าแรกส่งค่าตัวเดียวกันให้ทั้งแถบหมวดและบล็อก", () => {
    const page = stripComments(read(PAGE));

    const toTab = /<CategoryBar\s+promoIsLive=\{(\w+)\}/.exec(page);
    const toBlock = /\{\s*(\w+)\s*\?\s*<PromoRow/.exec(page);

    expect(toTab, "หาค่าที่ส่งให้ <CategoryBar> ไม่เจอ").not.toBeNull();
    expect(toBlock, "หาค่าที่คุม <PromoRow> ไม่เจอ").not.toBeNull();
    /* ถ้าสองที่นี้อ่านคนละค่า วันหนึ่งจะมีคนแก้ที่หนึ่งแล้วลืมอีกที่ */
    expect(toBlock?.[1]).toBe(toTab?.[1]);
  });

  it("ค่านั้นมาจาก isPromoLive ไม่ใช่ธงที่คนตั้งเอง", () => {
    const page = stripComments(read(PAGE));
    const name = /<CategoryBar\s+promoIsLive=\{(\w+)\}/.exec(page)?.[1];

    expect(name).toBeDefined();
    expect(new RegExp(`const\\s+${name}\\s*=\\s*isPromoLive\\(`).test(page)).toBe(true);
  });

  it("แถบหมวดไม่มีลิงก์ไป #promo ที่ขึ้นตลอดโดยไม่ถามวันหมดอายุ", () => {
    const bar = stripComments(read(BAR));
    const lines = bar.split("\n").filter((line) => line.includes("#promo"));

    /* ถ้าไม่เจอเลย แปลว่าแท็บถูกถอนออกไปแล้ว หรือถูกย้ายไปเขียนที่อื่น
       ทั้งสองอย่างทำให้ด่านนี้เฝ้าของที่ไม่มีอยู่ จึงต้องแดงให้คนมาอ่านใหม่ */
    expect(lines.length, "ไม่เจอลิงก์ #promo ในแถบหมวด").toBeGreaterThan(0);
    for (const line of lines) {
      expect(line, `ลิงก์ #promo ขึ้นโดยไม่ถามวันหมดอายุ: ${line.trim()}`).toMatch(/promoIsLive\s*\?/);
    }
  });

  it("แถบหมวดรับวันหมดอายุมาเป็น prop ไม่ได้อ่านนาฬิกาเอง", () => {
    const bar = stripComments(read(BAR));

    /* อ่านเองสองที่ = สองคำตัดสินที่บังเอิญตรงกัน ไม่ใช่คำตัดสินเดียว */
    expect(bar).not.toMatch(/isPromoLive\s*\(/);
    expect(bar).toMatch(/promoIsLive\s*\}?\s*:\s*\{?\s*promoIsLive\s*:\s*boolean|promoIsLive\s*:\s*boolean/);
  });
});
