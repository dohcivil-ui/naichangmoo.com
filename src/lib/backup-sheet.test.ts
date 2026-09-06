import { describe, expect, it } from "vitest";
import {
  buildBackupSheet,
  pagesAwaitingScale,
  type BackupSheetSourceDocument
} from "@/lib/backup-sheet";
import { measure, type Measurement } from "@/lib/drawing-measurement";
import type { PageScale } from "@/lib/drawing-scale";

/** สเกล 1:125.29 ของหน้า 7 ในแบบทดสอบ — หนึ่งจุดกระดาษเท่ากับ 0.0442 เมตรจริง */
const scale: PageScale = { metresPerPoint: 0.044198895, ratio: 125.29 };

function room(id: string, name: string): Measurement {
  return {
    id,
    page: 7,
    kind: "area",
    name,
    points: [
      { x: 589.75, y: 481 },
      { x: 642.25, y: 481 },
      { x: 642.25, y: 522 },
      { x: 589.75, y: 522 }
    ],
    // รั้วสี ADR 0021 ห้ามฝังเลขสีดิบแม้ในข้อมูลจำลอง
    colour: "var(--orange)",
    origin: "region_trace"
  };
}

function page(overrides: Partial<BackupSheetSourceDocument["pages"][number]> = {}) {
  return {
    pageNumber: 7,
    scale,
    method: "two_point" as const,
    confirmedAt: new Date("2026-09-05T00:39:00Z"),
    dimensions: [],
    marks: [room("m1", "ห้องน้ำผู้ป่วยชาย")],
    ...overrides
  };
}

const document = (pages: BackupSheetSourceDocument["pages"]): BackupSheetSourceDocument => ({
  documentId: "doc1",
  checksum: "a1b2c3",
  pages
});

describe("การรวม backup sheet ของทั้งโครงการ", () => {
  it("ตัวเลขในเอกสารต้องเป็นตัวเดียวกับที่หน้าแบบคำนวณ ไม่ใช่เลขชุดที่สอง", () => {
    const mark = room("m1", "ห้องน้ำผู้ป่วยชาย");
    const sheet = buildBackupSheet([document([page({ marks: [mark] })])]);
    const row = sheet.drawings[0].pages[0].rows[0];
    expect(row.value).toEqual(measure(mark, scale));
    expect(sheet.totalAreaSquareMetres).toBe(measure(mark, scale).areaSquareMetres);
  });

  it("กางวิธีคิดให้ทุกแถว ไม่ใช่เฉพาะแถวแรก", () => {
    const sheet = buildBackupSheet([
      document([page({ marks: [room("m1", "ห้องหนึ่ง"), room("m2", "ห้องสอง")] })])
    ]);
    const rows = sheet.drawings[0].pages[0].rows;
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.evidence?.steps.map((step) => step.question)).toContain("เลขที่รายงานคิดออกมาได้ยังไง");
    }
  });

  /**
   * รอยที่ยังวาดไม่ครบจุดขั้นต่ำไม่ใช่ปริมาณ มันคือของที่ค้างมือ
   * เอกสารที่นับของค้างมือเข้ายอดรวมจะให้ยอดที่ไม่ตรงกับที่จอบอก
   */
  it("ไม่นับรอยที่ยังวาดไม่ครบเข้ายอดรวม", () => {
    const halfDrawn: Measurement = { ...room("m2", "ยังวาดไม่เสร็จ"), points: [{ x: 0, y: 0 }] };
    const sheet = buildBackupSheet([
      document([page({ marks: [room("m1", "ห้องน้ำผู้ป่วยชาย"), halfDrawn] })])
    ]);
    expect(sheet.rowCount).toBe(1);
    expect(sheet.drawings[0].pages[0].rows.map((row) => row.id)).toEqual(["m1"]);
  });

  /**
   * **หน้าที่มีรอยวัดแต่ยังไม่มีสเกลต้องขึ้นให้เห็น** เอกสารที่ตัดหน้าที่ยังทำไม่เสร็จทิ้ง
   * จะอ่านเหมือนงานเสร็จครบแล้ว ซึ่งเป็นการโกหกด้วยการละเว้น
   */
  it("หน้าที่มีรอยวัดแต่ยังไม่มีสเกล ยังต้องอยู่ในเอกสารและถูกชี้ว่าค้าง", () => {
    const sheet = buildBackupSheet([
      document([page({ pageNumber: 9, scale: null, method: null, confirmedAt: null })])
    ]);
    expect(sheet.drawings[0].pages.map((p) => p.pageNumber)).toEqual([9]);
    expect(pagesAwaitingScale(sheet)).toEqual([9]);
    expect(sheet.openQuestions.join(" ")).toContain("ยังไม่ได้ตั้งสเกล");
    // และยอดของหน้านั้นยังเป็นศูนย์ เพราะยังคูณเป็นเมตรไม่ได้
    expect(sheet.totalAreaSquareMetres).toBe(0);
  });

  it("หน้าที่ไม่มีทั้งรอยวัดและสเกล ไม่ต้องกินที่ในเอกสาร", () => {
    const sheet = buildBackupSheet([
      document([page(), page({ pageNumber: 8, scale: null, method: null, confirmedAt: null, marks: [] })])
    ]);
    expect(sheet.drawings[0].pages.map((p) => p.pageNumber)).toEqual([7]);
  });

  it("ไฟล์แบบที่ยังไม่มีใครแตะเลย ไม่ขึ้นเป็นหัวข้อว่าง", () => {
    const sheet = buildBackupSheet([
      document([page()]),
      { documentId: "doc2", checksum: "ffff", pages: [] }
    ]);
    expect(sheet.drawings.map((d) => d.documentId)).toEqual(["doc1"]);
  });

  it("เรียงหน้าตามเลขหน้าเสมอ ไม่ใช่ตามลำดับที่ฐานส่งมา", () => {
    const sheet = buildBackupSheet([
      document([
        page({ pageNumber: 12 }),
        page({ pageNumber: 3 }),
        page({ pageNumber: 7 })
      ])
    ]);
    expect(sheet.drawings[0].pages.map((p) => p.pageNumber)).toEqual([3, 7, 12]);
  });

  /**
   * คนอ่านเอกสารพิมพ์อยากรู้ก่อนอ่านว่ามีอะไรค้างบ้าง ไม่ใช่ไล่เจอทีละแถวจนหน้าสุดท้าย
   * · และข้อเดียวกันที่ค้างอยู่สิบแถวต้องขึ้นครั้งเดียว ไม่ใช่สิบครั้ง
   */
  it("รวมสิ่งที่ยังตอบไม่ได้ไว้ที่เดียว แล้วตัดตัวซ้ำออก", () => {
    const sheet = buildBackupSheet([
      document([
        page({
          pageNumber: 9,
          scale: null,
          method: null,
          confirmedAt: null,
          marks: [room("m1", "ห้องหนึ่ง"), room("m2", "ห้องสอง"), room("m3", "ห้องสาม")]
        })
      ])
    ]);
    const awaiting = sheet.openQuestions.filter((q) => q.includes("ยังไม่ได้ตั้งสเกล"));
    expect(awaiting).toHaveLength(1);
  });

  it("รวมยอดข้ามหน้าและข้ามไฟล์แบบ", () => {
    const one = measure(room("m1", "ห้อง"), scale).areaSquareMetres ?? 0;
    const sheet = buildBackupSheet([
      document([page(), page({ pageNumber: 8 })]),
      { documentId: "doc2", checksum: "ffff", pages: [page({ pageNumber: 2 })] }
    ]);
    expect(sheet.rowCount).toBe(3);
    expect(sheet.totalAreaSquareMetres).toBeCloseTo(one * 3, 6);
  });

  it("โครงการที่ยังไม่เคยเปิดแบบ ได้เอกสารเปล่าที่ไม่พัง", () => {
    const sheet = buildBackupSheet([]);
    expect(sheet.drawings).toEqual([]);
    expect(sheet.rowCount).toBe(0);
    expect(pagesAwaitingScale(sheet)).toEqual([]);
  });
});
