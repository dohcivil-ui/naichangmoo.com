import { describe, expect, it } from "vitest";
import { channelKinds, validateChannelValue } from "@/lib/platform-channels";

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

/**
 * เบอร์โทรเข้าทะเบียนเมื่อ 2026-09-07 · ต่างจากช่องทางอื่นตรงที่ **ผู้ดูแลพิมพ์ได้หลายรูป
 * แต่ต้องเก็บรูปเดียว** ไม่งั้นเบอร์เดียวกันจะมีหลายรูปในตารางเดียว แล้ววันที่มีคนเทียบว่า
 * เบอร์เปลี่ยนไหม จะเทียบไม่ได้เพราะข้อความไม่ตรงกันทั้งที่เบอร์เดิม
 *
 * และเบอร์เป็นช่องทางเดียวที่กดผิดแล้วไปโผล่ที่คนอื่นจริง ๆ ไม่ใช่แค่ลิงก์เสีย
 */
describe("เบอร์โทรในทะเบียนช่องทาง", () => {
  const phoneKind = channelKinds.find((kind) => kind.key === "phone");

  it("รับเบอร์ที่พิมพ์มาได้ทุกรูป แล้วเก็บเป็นตัวเลขล้วนรูปเดียว", () => {
    for (const typed of ["0849891456", "084-989-1456", "084 989 1456", " 084-989-1456 "]) {
      const result = validateChannelValue("phone", typed);
      expect(result.ok, `พิมพ์ว่า ${typed}`).toBe(true);
      if (result.ok) expect(result.value).toBe("0849891456");
    }
  });

  it("ปฏิเสธเบอร์ที่หลักไม่ครบ ไม่ขึ้นต้นด้วยศูนย์ หรือไม่ใช่เบอร์", () => {
    expect(validateChannelValue("phone", "084989145").ok).toBe(false);
    expect(validateChannelValue("phone", "08498914567").ok).toBe(false);
    expect(validateChannelValue("phone", "849891456").ok).toBe(false);
    expect(validateChannelValue("phone", "โทรหาเราได้เลย").ok).toBe(false);
  });

  /* ขีดกับ 0 นำทำให้กดโทรจากเครื่องที่ตั้งรหัสประเทศอื่นไม่ติด — ลิงก์จึงต้องเป็นรูปสากล */
  it("ลิงก์ตัดศูนย์นำแล้วเติมรหัสประเทศ", () => {
    expect(phoneKind?.toHref("0849891456")).toBe("tel:+66849891456");
  });

  /* รูปสองสี่สี่มาจากผืนออกแบบ `redesign/V3/Home Redesign v3.dc.html` บรรทัด 24 */
  it("รูปที่แสดงบนจอเป็นสองสี่สี่ตามผืนออกแบบ", () => {
    expect(phoneKind?.toDisplay?.("0849891456")).toBe("08 4989 1456");
  });
});
