import { describe, expect, it } from "vitest";
import {
  paginate,
  PAGE_CONTENT_HEIGHT_MM,
  PAGE_CONTENT_WIDTH_MM,
  PX_PER_MM,
  type PageBlock
} from "./paper-pagination";

const atom = (id: string, height: number): PageBlock => ({ kind: "atom", id, height });

const heading = (id: string, height: number): PageBlock => ({ kind: "atom", id, height, keepWithNext: true });

const rows = (id: string, count: number, rowHeight: number, headerHeight = 20, footerHeight = 20): PageBlock => ({
  kind: "rows",
  id,
  headerHeight,
  footerHeight,
  rows: Array.from({ length: count }, (_unused, index) => ({ id: `${id}-${index + 1}`, height: rowHeight }))
});

describe("ขนาดพื้นที่พิมพ์", () => {
  it("ตรงกับ A4 หักระยะขอบที่ใช้จริง ขอบบน 15 มม. ตามที่เจ้าของงานสั่ง ที่เหลือตามไฟล์ต้นแบบ", () => {
    expect(PAGE_CONTENT_HEIGHT_MM).toBe(267);
    expect(PAGE_CONTENT_WIDTH_MM).toBe(170);
    expect(Math.round(210 * PX_PER_MM)).toBe(794);
  });
});

describe("บล็อกที่แตกไม่ได้", () => {
  it("ทุกอย่างลงหน้าเดียวเมื่อพื้นที่พอ", () => {
    const result = paginate([atom("a", 100), atom("b", 100)], 1000);
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]).toEqual([{ kind: "atom", id: "a" }, { kind: "atom", id: "b" }]);
    expect(result.overflowing).toEqual([]);
  });

  it("ขึ้นหน้าใหม่เมื่อของชิ้นถัดไปไม่พอ ไม่ยืดหน้าเดิม", () => {
    const result = paginate([atom("a", 600), atom("b", 600)], 1000);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]).toEqual([{ kind: "atom", id: "a" }]);
    expect(result.pages[1]).toEqual([{ kind: "atom", id: "b" }]);
  });

  it("รักษาลำดับเดิมเสมอ ไม่สลับเพื่อให้หน้าดูเต็ม", () => {
    const result = paginate([atom("a", 600), atom("b", 300), atom("c", 300)], 1000);
    expect(result.pages.flat().map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("บล็อกที่สูงเกินหนึ่งหน้าได้หน้าของตัวเอง และถูกรายงานว่าล้น", () => {
    const result = paginate([atom("a", 100), atom("ยักษ์", 2000)], 1000);
    expect(result.overflowing).toEqual(["ยักษ์"]);
    expect(result.pages[1]).toEqual([{ kind: "atom", id: "ยักษ์" }]);
  });

  it("ไม่มีบล็อกเลยก็ยังได้กระดาษหนึ่งแผ่น ไม่ใช่ศูนย์แผ่น", () => {
    expect(paginate([], 1000).pages).toEqual([[]]);
  });
});

describe("ตารางที่แตกข้ามหน้าได้", () => {
  it("ตารางสั้นอยู่หน้าเดียวพร้อมท้ายตาราง", () => {
    const result = paginate([rows("t", 3, 50)], 1000);
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]).toEqual([{ kind: "rows", id: "t", from: 0, to: 3, withFooter: true }]);
  });

  it("ตารางยาวถูกตัดทีละแถว และแถวไม่หายไปสักแถว", () => {
    const result = paginate([rows("t", 40, 50)], 1000);
    const placed = result.pages.flat().filter((item) => item.kind === "rows");
    const covered = placed.reduce((total, item) => total + (item.to - item.from), 0);
    expect(covered).toBe(40);
    expect(result.pages.length).toBeGreaterThan(1);
    // ทุกหน้าที่มีตารางต้องเว้นที่ให้หัวตารางเสมอ จึงใส่แถวได้ไม่เกินสิบเก้าแถว
    for (const page of result.pages) {
      const chunk = page.find((item) => item.kind === "rows");
      if (chunk && chunk.kind === "rows") expect(chunk.to - chunk.from).toBeLessThanOrEqual(19);
    }
  });

  it("แถวไม่ถูกตัดครึ่ง ช่วงของแต่ละหน้าต่อกันพอดีไม่ทับกัน", () => {
    const result = paginate([rows("t", 25, 60)], 800);
    const chunks = result.pages.flat().filter((item) => item.kind === "rows");
    let expected = 0;
    for (const chunk of chunks) {
      if (chunk.kind !== "rows") continue;
      expect(chunk.from).toBe(expected);
      expected = chunk.to;
    }
    expect(expected).toBe(25);
  });

  it("ท้ายตารางที่ไม่พอในหน้าสุดท้าย ยกไปหน้าถัดไปโดยยังมีหัวตารางกำกับ", () => {
    // หัว 20 แถวละ 100 ท้าย 200 หน้าละ 1000: แถวที่สิบเต็มพอดีจนท้ายตารางไม่เหลือที่
    const result = paginate([rows("t", 10, 98, 20, 200)], 1000);
    const last = result.pages[result.pages.length - 1]!;
    const tail = last.find((item) => item.kind === "rows");
    expect(tail).toBeDefined();
    expect(tail && tail.kind === "rows" && tail.withFooter).toBe(true);
    const withFooter = result.pages.flat().filter((item) => item.kind === "rows" && item.withFooter);
    expect(withFooter).toHaveLength(1);
  });

  it("อยู่ต่อจากบล็อกอื่นในหน้าเดียวกันได้ ถ้าที่ยังเหลือพอ", () => {
    const result = paginate([atom("หัว", 200), rows("t", 5, 100)], 1000);
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]![0]).toEqual({ kind: "atom", id: "หัว" });
  });

  it("ที่เหลือน้อยจนใส่แถวไม่ได้สักแถว ให้ตารางเริ่มที่หน้าถัดไปทั้งตาราง", () => {
    const result = paginate([atom("หัว", 950), rows("t", 3, 100)], 1000);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]).toEqual([{ kind: "atom", id: "หัว" }]);
    expect(result.pages[1]![0]).toEqual({ kind: "rows", id: "t", from: 0, to: 3, withFooter: true });
  });

  it("แถวเดียวที่สูงเกินหนึ่งหน้าถูกวางและถูกรายงาน ไม่หายไปเงียบ ๆ", () => {
    const result = paginate([rows("t", 1, 5000)], 1000);
    expect(result.overflowing).toEqual(["t-1"]);
    // แถวยักษ์อยู่หน้าแรก ส่วนยอดรวมที่ไม่เหลือที่ไปอยู่หน้าถัดไปพร้อมหัวตารางกำกับ
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]).toEqual([{ kind: "rows", id: "t", from: 0, to: 1, withFooter: false }]);
    expect(result.pages[1]).toEqual([{ kind: "rows", id: "t", from: 1, to: 1, withFooter: true }]);
  });
});

describe("หัวข้อต้องไม่ค้างท้ายหน้าโดยเนื้อหาไปอยู่หน้าถัดไป", () => {
  it("หัวข้อถูกยกไปหน้าถัดไปพร้อมเนื้อหาของมัน", () => {
    const result = paginate([atom("เนื้อหา", 850), heading("หัวข้อ", 100), atom("ของใต้หัวข้อ", 200)], 1000);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]).toEqual([{ kind: "atom", id: "เนื้อหา" }]);
    expect(result.pages[1]).toEqual([{ kind: "atom", id: "หัวข้อ" }, { kind: "atom", id: "ของใต้หัวข้อ" }]);
  });

  it("หัวข้อที่เนื้อหาตามได้ในหน้าเดียวกัน ไม่ถูกยกไปไหน", () => {
    const result = paginate([heading("หัวข้อ", 100), atom("ของใต้หัวข้อ", 200)], 1000);
    expect(result.pages).toHaveLength(1);
  });

  it("หัวข้อที่ตามด้วยตาราง ก็ถูกยกไปพร้อมกัน", () => {
    const result = paginate([atom("เนื้อหา", 800), heading("หัวข้อ", 100), rows("t", 4, 100)], 1000);
    const firstPageIds = result.pages[0]!.map((item) => item.id);
    expect(firstPageIds).not.toContain("หัวข้อ");
    expect(result.pages[1]![0]).toEqual({ kind: "atom", id: "หัวข้อ" });
  });

  it("หัวข้อซ้อนกันสองอันที่ค้างท้ายหน้า ถูกยกไปทั้งคู่", () => {
    const result = paginate([atom("เนื้อหา", 700), heading("บน", 100), heading("ล่าง", 100), atom("ของ", 200)], 1000);
    expect(result.pages[0]).toEqual([{ kind: "atom", id: "เนื้อหา" }]);
    expect(result.pages[1]!.map((item) => item.id)).toEqual(["บน", "ล่าง", "ของ"]);
  });
});

describe("ตารางงวดงานยาว ๆ ตามที่เจ้าของงานอธิบายไว้", () => {
  /** หัวเอกสาร หัวข้อ 1 ตารางข้อเท็จจริง หัวข้อ 2 แล้วตารางงวด แล้วหัวข้อ 3 กับ 4 */
  const annex = (milestones: number): PageBlock[] => [
    atom("หัวเอกสาร", 120),
    heading("ข้อ 1", 60),
    atom("ตารางข้อมูลสัญญา", 200),
    heading("ข้อ 2", 60),
    rows("งวด", milestones, 60, 40, 40),
    atom("ยอดตัวอักษร", 40),
    heading("ข้อ 3", 60),
    atom("หมายเหตุ", 120),
    heading("ข้อ 4", 60),
    atom("ลงนาม", 200)
  ];

  it("งวดน้อยอยู่หน้าเดียวจบ", () => {
    // สองงวดรวมทุกบล็อกได้ 1,120 หน้ากระดาษจึงต้องสูงกว่านั้นถึงจะจบในหน้าเดียว
    expect(paginate(annex(2), 1200).pages).toHaveLength(1);
    // และถ้ากระดาษเตี้ยกว่าเนื้อหา มันต้องขึ้นหน้าใหม่ ไม่ใช่ยัดลงไปให้ล้น
    expect(paginate(annex(2), 1000).pages.length).toBeGreaterThan(1);
  });

  it("งวดมากดันลงมาจนสุดขอบแล้วขึ้นหน้าใหม่ โดยไม่ทิ้งงวดไหนไว้", () => {
    const result = paginate(annex(24), 1000);
    const chunks = result.pages.flat().filter((item) => item.kind === "rows");
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.reduce((total, c) => total + (c.kind === "rows" ? c.to - c.from : 0), 0)).toBe(24);
  });

  it("ทุกหน้าที่ตารางไปโผล่ต้องได้หัวตารางของตัวเอง", () => {
    const result = paginate(annex(24), 1000);
    // แต่ละหน้ามีชิ้นส่วนตารางได้ไม่เกินหนึ่งชิ้น และชิ้นส่วนคือหน่วยที่ผูกกับหัวตารางหนึ่งอัน
    for (const page of result.pages) {
      expect(page.filter((item) => item.kind === "rows").length).toBeLessThanOrEqual(1);
    }
    const pagesWithRows = result.pages.filter((page) => page.some((item) => item.kind === "rows"));
    expect(pagesWithRows.length).toBe(result.pages.flat().filter((item) => item.kind === "rows").length);
  });

  it("ข้อ 3 ไม่โผล่ก่อนงวดสุดท้าย ไม่ว่าจะมีกี่งวด", () => {
    for (const count of [2, 9, 10, 11, 24, 60]) {
      const flat = paginate(annex(count), 1000).pages.flat();
      const lastRow = flat.map((item) => item.kind).lastIndexOf("rows");
      const notes = flat.findIndex((item) => item.id === "ข้อ 3");
      expect(notes, `งวด ${count}`).toBeGreaterThan(lastRow);
    }
  });

  it("แถวรวมทั้งสิ้นอยู่กับชิ้นส่วนสุดท้ายของตารางเสมอ และมีอันเดียว", () => {
    for (const count of [2, 24, 60]) {
      const chunks = paginate(annex(count), 1000).pages.flat().filter((item) => item.kind === "rows");
      const withFooter = chunks.filter((c) => c.kind === "rows" && c.withFooter);
      expect(withFooter, `งวด ${count}`).toHaveLength(1);
      expect(chunks[chunks.length - 1], `งวด ${count}`).toBe(withFooter[0]);
    }
  });
});
