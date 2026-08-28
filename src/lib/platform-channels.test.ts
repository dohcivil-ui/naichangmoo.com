import { describe, expect, it } from "vitest";
import { validateChannelValue } from "@/lib/platform-channels";

/**
 * ลิงก์ผิดตัวเดียวขึ้นทุกหน้าพร้อมกัน — กติกาตรวจจึงต้องมีเทสต์คุม โดยเฉพาะเคสหลอก:
 * โดเมนปลอมที่แค่ขึ้นต้นเหมือน และลิงก์ http ที่ browser จะเตือนลูกค้า
 */
describe("กติกาตรวจค่าช่องทางติดต่อ", () => {
  it("รับลิงก์ LINE ของจริงทุกรูปแบบที่ LINE ใช้", () => {
    expect(validateChannelValue("line_oa", "https://lin.ee/abc123").ok).toBe(true);
    expect(validateChannelValue("line_oa", "https://page.line.me/naichangmoo").ok).toBe(true);
    expect(validateChannelValue("line_oa", "  https://line.me/R/ti/p/@abc  ").ok).toBe(true);
  });

  it("ปฏิเสธโดเมนปลอมที่ขึ้นต้นเหมือน LINE และลิงก์ที่ไม่ใช่ https", () => {
    expect(validateChannelValue("line_oa", "https://line.me.evil.com/x").ok).toBe(false);
    expect(validateChannelValue("line_oa", "http://lin.ee/abc").ok).toBe(false);
    expect(validateChannelValue("line_oa", "@naichangmoo").ok).toBe(false);
  });

  it("รับเพจ Facebook จริง และปฏิเสธโดเมนเลียนแบบ", () => {
    expect(validateChannelValue("facebook", "https://www.facebook.com/naichangmoo").ok).toBe(true);
    expect(validateChannelValue("facebook", "https://facebook.com.evil.com/x").ok).toBe(false);
  });

  it("รับอีเมลรูปแบบถูกต้อง และปฏิเสธข้อความที่ไม่ใช่อีเมล", () => {
    expect(validateChannelValue("email", "contact@naichangmoo.com").ok).toBe(true);
    expect(validateChannelValue("email", "ทักไลน์มา").ok).toBe(false);
    expect(validateChannelValue("email", "a@b").ok).toBe(false);
  });

  it("ค่าว่างถูกปัดไปทางปุ่มล้างค่า ไม่ใช่บันทึกเงียบ", () => {
    expect(validateChannelValue("email", "   ").ok).toBe(false);
  });
});
