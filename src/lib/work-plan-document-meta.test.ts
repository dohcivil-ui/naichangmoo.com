import { describe, expect, it } from "vitest";
import {
  acceptLogo,
  dataUriBytes,
  defaultDocumentMeta,
  logoVisible,
  MAX_LOGO_BYTES,
  mimeOfDataUri,
  signatureName,
  signaturePosition
} from "./work-plan-document-meta";

/** data URI ฐาน 64 ที่มีขนาดจริงตามจำนวนไบต์ที่สั่ง */
const logoOf = (bytes: number, mime = "image/png") => {
  const base64 = Buffer.alloc(bytes, 7).toString("base64");
  return `data:${mime};base64,${base64}`;
};

describe("dataUriBytes", () => {
  it("บอกขนาดจริงเป็นไบต์ ไม่ใช่ความยาวของข้อความฐาน 64", () => {
    expect(dataUriBytes(logoOf(1))).toBe(1);
    expect(dataUriBytes(logoOf(2))).toBe(2);
    expect(dataUriBytes(logoOf(3))).toBe(3);
    expect(dataUriBytes(logoOf(1024))).toBe(1024);
    expect(dataUriBytes(logoOf(200_000))).toBe(200_000);
  });

  it("หักตัวเติมท้ายออกถูกต้องทั้งกรณีหนึ่งตัวและสองตัว", () => {
    // 1 ไบต์ลงท้ายด้วย == และ 2 ไบต์ลงท้ายด้วย = เป็นสองกรณีที่คำนวณพลาดกันบ่อย
    expect(logoOf(1).endsWith("==")).toBe(true);
    expect(logoOf(2).endsWith("=")).toBe(true);
    expect(logoOf(2).endsWith("==")).toBe(false);
    expect(dataUriBytes(logoOf(1))).toBe(1);
    expect(dataUriBytes(logoOf(2))).toBe(2);
  });

  it("ข้อความที่ไม่ใช่ data URI ได้ศูนย์ ไม่โยน error ใส่หน้าจอ", () => {
    expect(dataUriBytes("")).toBe(0);
    expect(dataUriBytes("ไม่ใช่รูป")).toBe(0);
    expect(dataUriBytes("data:image/png;base64,")).toBe(0);
  });
});

describe("mimeOfDataUri", () => {
  it("อ่านชนิดไฟล์ออกได้ทั้งแบบมีและไม่มี base64", () => {
    expect(mimeOfDataUri("data:image/png;base64,AAAA")).toBe("image/png");
    expect(mimeOfDataUri("data:image/webp,AAAA")).toBe("image/webp");
  });

  it("ข้อความที่ไม่ใช่ data URI คืนค่าว่าง", () => {
    expect(mimeOfDataUri("https://example.com/logo.png")).toBe("");
    expect(mimeOfDataUri("")).toBe("");
  });
});

describe("acceptLogo", () => {
  it("รับ PNG JPG WEBP ที่ขนาดไม่เกินเพดาน", () => {
    for (const mime of ["image/png", "image/jpeg", "image/webp"]) {
      const result = acceptLogo(logoOf(50_000, mime));
      expect(result.ok, mime).toBe(true);
    }
  });

  it("ปฏิเสธ SVG เพราะพาสคริปต์เข้ามาในเอกสารได้", () => {
    const result = acceptLogo(logoOf(500, "image/svg+xml"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("PNG");
  });

  it("ปฏิเสธรูปที่ใหญ่เกินเพดาน และสองตัวเลขในข้อความต้องไม่เท่ากันจนอ่านแล้วงง", () => {
    const result = acceptLogo(logoOf(MAX_LOGO_BYTES + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // เกินเพดานมาไบต์เดียว ข้อความต้องยังบอกได้ว่าอันไหนใหญ่กว่าอันไหน
      expect(result.reason).toContain("201");
      expect(result.reason).toContain("200");
      expect(result.reason).toContain("เซฟไม่ได้");
    }
  });

  it("รับที่ขนาดเท่าเพดานพอดี ไม่ปัดออก", () => {
    expect(acceptLogo(logoOf(MAX_LOGO_BYTES)).ok).toBe(true);
  });

  it("ปฏิเสธไฟล์ว่างและข้อความที่ไม่ใช่รูป", () => {
    expect(acceptLogo("data:image/png;base64,").ok).toBe(false);
    expect(acceptLogo("ไม่ใช่รูป").ok).toBe(false);
  });
});

describe("ช่องลงนาม", () => {
  it("ยังไม่กรอกชื่อ ต้องได้ช่องว่างที่กว้างพอเขียนด้วยปากกา ไม่ใช่ขีดหรือคำว่าไม่ระบุ", () => {
    const blank = signatureName({ name: "", position: "" });
    expect(blank.trim()).toBe("");
    expect(blank.length).toBeGreaterThanOrEqual(20);
  });

  it("กรอกชื่อแล้วได้ชื่อที่ตัดช่องว่างหัวท้าย", () => {
    expect(signatureName({ name: "  นายสมชาย ใจดี  ", position: "" })).toBe("นายสมชาย ใจดี");
  });

  it("ตำแหน่งที่ยังไม่กรอกคืนค่าว่าง ไม่ขึ้นคำแทน", () => {
    expect(signaturePosition({ name: "ก", position: "   " })).toBe("");
    expect(signaturePosition({ name: "ก", position: " กรรมการผู้จัดการ " })).toBe("กรรมการผู้จัดการ");
  });
});

describe("logoVisible", () => {
  it("ไม่มีรูปก็ไม่แสดง แม้จะเปิดสวิตช์ไว้", () => {
    expect(logoVisible({ ...defaultDocumentMeta(), showLogo: true, logoDataUri: "" })).toBe(false);
  });

  it("มีรูปแต่สั่งซ่อน ต้องไม่แสดง และรูปยังอยู่ให้เปิดกลับได้", () => {
    const meta = { ...defaultDocumentMeta(), showLogo: false, logoDataUri: logoOf(100) };
    expect(logoVisible(meta)).toBe(false);
    expect(meta.logoDataUri).not.toBe("");
  });

  it("มีรูปและเปิดสวิตช์ จึงแสดง", () => {
    expect(logoVisible({ ...defaultDocumentMeta(), showLogo: true, logoDataUri: logoOf(100) })).toBe(true);
  });
});
