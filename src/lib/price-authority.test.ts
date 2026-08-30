import { describe, expect, it } from "vitest";
import {
  authorityOfLines,
  authorityOfSource,
  costingMethodDenial,
  isCostingMethod
} from "@/lib/price-authority";

describe("แหล่งอำนาจของชุดราคา", () => {
  it("บัญชีที่รัฐประกาศทั้งสามแหล่งเป็นราคาทางการ", () => {
    expect(authorityOfSource("tpso")).toBe("official");
    expect(authorityOfSource("obec")).toBe("official");
    expect(authorityOfSource("cgd")).toBe("official");
  });

  it("ที่มาที่ไม่อยู่ในบัญชีของรัฐเป็นราคาขององค์กร", () => {
    expect(authorityOfSource("org_vendor_quote")).toBe("organization");
    expect(authorityOfSource("")).toBe("organization");
  });

  it("ทั้งชุดเป็นทางการก็ต่อเมื่อทุกบรรทัดเป็นทางการ", () => {
    expect(authorityOfLines(["tpso", "obec", "cgd"])).toBe("official");
    // บรรทัดเดียวที่ไม่ทางการทำให้ทั้งชุดไม่ทางการ เพราะยอดรวมของใบเดียวแยกกันไม่ได้
    expect(authorityOfLines(["tpso", "obec", "org_vendor_quote"])).toBe("organization");
  });

  it("ชุดที่ไม่มีบรรทัดเลยไม่ใช่ทางการ เพราะไม่มีหลักฐานรองรับคำกล่าวอ้าง", () => {
    expect(authorityOfLines([])).toBe("organization");
  });
});

describe("วิธีคิดราคาที่ชุดหนึ่งรองรับ", () => {
  it("Factor F ใช้ได้เฉพาะชุดที่มาจากแหล่งทางการ", () => {
    expect(costingMethodDenial("factor_f", "official")).toBeNull();
    expect(costingMethodDenial("factor_f", "organization")).not.toBeNull();
  });

  it("ต้นทุนผู้รับเหมาใช้ได้กับทั้งสองแหล่ง เพราะ ADR 0008 ห้ามทางเดียว", () => {
    expect(costingMethodDenial("contractor_cost", "official")).toBeNull();
    expect(costingMethodDenial("contractor_cost", "organization")).toBeNull();
  });

  it("รับเฉพาะสองค่าที่ ADR 0008 ตั้งไว้ ค่าที่ส่งมาจากภายนอกจึงเข้าฐานข้อมูลไม่ได้", () => {
    expect(isCostingMethod("factor_f")).toBe(true);
    expect(isCostingMethod("contractor_cost")).toBe(true);
    expect(isCostingMethod("government")).toBe(false);
    expect(isCostingMethod(null)).toBe(false);
  });
});
