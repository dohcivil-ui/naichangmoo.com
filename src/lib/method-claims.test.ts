import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { claimsForApp, methodClaims } from "@/lib/method-claims";
import { platformApps } from "@/lib/platform";

/**
 * รั้วของคำโฆษณา — คำแนะนำทุกข้อต้องมีของจริงรองรับ
 *
 * ไฟล์นี้มีเพราะคำโฆษณาเป็นข้อความชนิดเดียวในรีโปที่ไม่มีอะไรทำให้มันแดงเมื่อมันเริ่มไม่จริง
 * โค้ดที่ผิดทำให้เทสต์ตก ตัวเลขที่ผิดทำให้ยอดไม่ตรง แต่ประโยคที่เคยจริงเมื่อสองเดือนก่อน
 * แล้ววันนี้ไม่จริงแล้ว จะอยู่บนหน้าเว็บต่อไปเงียบ ๆ จนกว่าจะมีลูกค้าเป็นคนพบ
 */
describe("คำแนะนำเรื่องวิธีทำงาน", () => {
  it("ทุกข้อชี้ไฟล์เทสต์ที่มีอยู่จริง — ข้ออ้างที่ไม่มีของพิสูจน์คือข้ออ้างลอย", () => {
    for (const claim of methodClaims) {
      expect(existsSync(join(process.cwd(), claim.provenBy)), `${claim.title} อ้าง ${claim.provenBy} ที่ไม่มีอยู่`).toBe(true);
    }
  });

  /**
   * ADR 0015 ข้อ 2 แยกการแนะนำออกจากคำแถลง สิทธิ์ ราคา และความพร้อมเป็นของทะเบียนเท่านั้น
   * ไฟล์นี้อยู่ใน source จึงพูดเรื่องพวกนั้นไม่ได้ ต่อให้ประโยคจะจริงในวันที่เขียนก็ตาม
   */
  it("ไม่แตะเรื่องสิทธิ์ ราคา หรือความพร้อม ซึ่งเป็นของทะเบียน", () => {
    const reserved = /ฟรี|ทดลองใช้|ราคา\s*\d|บาท\s*ต่อ|สมัคร|เปิดให้ใช้|พร้อมใช้งาน/;
    for (const claim of methodClaims) {
      const text = `${claim.title} ${claim.body}`;
      expect(reserved.test(text), `${claim.title} พูดเรื่องที่เป็นของทะเบียน`).toBe(false);
    }
  });

  /**
   * ตัวเลขเปอร์เซ็นต์ในคำโฆษณาต้องมาจากการวัดกับงานจริงหลายโครงการ ซึ่งยังไม่เคยทำ
   * ADR 0015 ปฏิเสธเปอร์เซ็นต์ความคืบหน้าด้วยเหตุผลเดียวกัน คือมันพิสูจน์อะไรไม่ได้เลย
   */
  it("ไม่มีคำสัญญาเป็นเปอร์เซ็นต์หรือจำนวนเท่า ตราบใดที่ยังไม่ได้วัดกับงานจริง", () => {
    const unmeasured = /\d+\s*(?:%|เปอร์เซ็นต์|เท่า)/;
    for (const claim of methodClaims) {
      expect(unmeasured.test(`${claim.title} ${claim.body}`), `${claim.title} มีตัวเลขที่ยังไม่ได้วัด`).toBe(false);
    }
  });

  it("ไม่มีอีโมจิ ตามกฎหน้าจอของโปรเจกต์", () => {
    for (const claim of methodClaims) {
      expect(/\p{Extended_Pictographic}/u.test(`${claim.title} ${claim.body}`)).toBe(false);
    }
  });

  /**
   * ข้อที่กันคำโฆษณาไหลไปขึ้นบนแอปที่ไม่มีกลไกนั้น
   *
   * แผงนี้อยู่บนหน้า `/market/[slug]` ซึ่งเรนเดอร์ให้ทุกแอป ถ้าไม่ผูกข้ออ้างกับ slug
   * ประโยคเรื่องการจับคู่ราคาจะไปโผล่บนหน้าของแอปค่า K ที่ไม่มีเรื่องนั้นอยู่เลย
   */
  it("ทุกข้อผูกกับแอปที่มีอยู่จริงในทะเบียน และไม่มีข้อไหนไม่ผูกกับแอปใดเลย", () => {
    const slugs = new Set(platformApps.map((app) => app.slug));
    for (const claim of methodClaims) {
      expect(claim.appliesTo.length, `${claim.title} ไม่ได้ผูกกับแอปไหนเลย`).toBeGreaterThan(0);
      for (const slug of claim.appliesTo) {
        expect(slugs.has(slug), `${claim.title} อ้างแอป ${slug} ที่ไม่มีในทะเบียน`).toBe(true);
      }
    }
  });

  it("แอปที่ไม่มีกลไกนี้ต้องไม่ได้คำโฆษณาของแอปอื่นไปแสดง", () => {
    const matchingClaim = "หนึ่งรายการต่อหนึ่งราคา รับประกันด้วยคณิตศาสตร์";
    expect(claimsForApp("estimeter").map((claim) => claim.title)).toContain(matchingClaim);
    expect(claimsForApp("escalation-k").map((claim) => claim.title)).not.toContain(matchingClaim);
    expect(claimsForApp("แอปที่ไม่มีอยู่จริง")).toEqual([]);
  });

  it("พาดหัวไม่ซ้ำกัน และทุกข้อมีเนื้อความ", () => {
    expect(new Set(methodClaims.map((claim) => claim.title)).size).toBe(methodClaims.length);
    for (const claim of methodClaims) {
      expect(claim.body.trim().length).toBeGreaterThan(40);
    }
  });
});
