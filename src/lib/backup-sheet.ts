/**
 * รวม backup sheet ของทั้งโครงการให้เป็นเอกสารหนึ่งฉบับที่พิมพ์ออกได้ (IP-243)
 *
 * **backup sheet คือคำที่วงการประมาณราคาใช้จริง** และเป็นคำที่เจ้าของงานใช้เรียกชั้นนี้
 * มาตั้งแต่ต้น (`~/.claude/thai-terms.md` · ADR และโค้ดเดิมใช้คำนี้อยู่แล้วตั้งแต่ IP-234)
 * มันคือแผ่นที่กางว่าปริมาณหนึ่งตัวมาจากไหน สำหรับให้คนอื่นตรวจตามได้
 *
 * **ขอบเขตของฉบับนี้คือรอยวัดบนแบบ ไม่ใช่บรรทัดในตารางถอดปริมาณ** สองอย่างนี้เป็นชั้น
 * คนละชั้นของงานเดียวกัน — รอยวัดเกิดตอนคนลากบนแบบ ส่วนบรรทัดใน `takeoff_measurements`
 * เกิดตอนคนส่งรอยนั้นเข้าถอดปริมาณแล้วเลือกหมวดงานกับหน่วยให้มัน · ฉบับนี้พิมพ์ชั้นแรก
 * ซึ่งมีของที่ชั้นหลังไม่มี คือสเกล ความคลาดของสเกล และวิธีที่ขอบห้องถูกไล่มา
 *
 * **ทำไมต้องมีทั้งสองที่** แผงกางต่อหนึ่งแถวในหน้าแบบตอบคนที่กำลังทำงานอยู่ตรงนั้น
 * ส่วนเอกสารฉบับนี้ตอบคนที่ไม่ได้นั่งอยู่หน้าจอ — ผู้ตรวจ เจ้าของงาน คนที่เถียงตัวเลข
 * ในห้องประชุม · เจ้าของงานเคาะเมื่อ 2026-09-05 ว่าเอา **ทั้งสองที่**
 *
 * **ไฟล์นี้ไม่คำนวณอะไรใหม่เลยสักตัว** พื้นที่กับความยาวมาจาก `measure()` วิธีคิดมาจาก
 * `explainMeasurement()` ความคลาดของสเกลมาจาก `worstScaleGap()` ทั้งหมดเป็นตัวเดียวกับ
 * ที่หน้าแบบใช้ · ถ้าที่นี่คิดเอง เอกสารที่พิมพ์ออกไปจะเป็นเลขชุดที่สองที่อาจไม่ตรงกับจอ
 * ซึ่งคือความผิดพลาดที่ร้ายที่สุดที่ backup sheet จะทำได้
 *
 * **นับเฉพาะรอยที่วัดได้จริง** รอยที่ยังวาดไม่ครบจุดขั้นต่ำไม่ใช่ปริมาณ มันคือของที่ค้างมือ
 * · เอกสารที่นับของค้างมือเข้าไปในยอดรวมจะให้ยอดที่ไม่ตรงกับที่จอบอก
 *
 * **หน้าที่มีรอยวัดแต่ยังไม่มีสเกลต้องขึ้นให้เห็น ไม่ใช่หายไปเงียบ ๆ** เอกสารที่ตัดหน้าที่ยัง
 * ทำไม่เสร็จทิ้ง จะอ่านเหมือนงานเสร็จครบแล้ว ซึ่งเป็นการโกหกด้วยการละเว้น
 *
 * ไฟล์นี้ไม่รู้จัก React ไม่รู้จักฐานข้อมูล และไม่รู้จัก pdf.js
 */

import type { CalibrationMethod } from "@/lib/drawing-calibration-method";
import {
  isComplete,
  measure,
  measurementKindLabel,
  type Measurement,
  type MeasurementKind,
  type MeasurementValue
} from "@/lib/drawing-measurement";
import type { PageScale, StatedDimension } from "@/lib/drawing-scale";
import {
  explainMeasurement,
  worstScaleGap,
  type MeasurementEvidence
} from "@/lib/measurement-evidence";

/** หนึ่งหน้าของแบบหนึ่งไฟล์ ตามที่เก็บไว้ — รูปทรงนี้คือสิ่งที่ชั้นฐานข้อมูลส่งลงมา */
export type BackupSheetSourcePage = {
  pageNumber: number;
  /** null เมื่อหน้านั้นยังไม่ได้ยืนยันสเกล */
  scale: PageScale | null;
  method: CalibrationMethod | null;
  confirmedAt: Date | null;
  dimensions: readonly StatedDimension[];
  marks: readonly Measurement[];
};

export type BackupSheetSourceDocument = {
  documentId: string;
  /** ลายนิ้วมือของไฟล์ · ระบบไม่เก็บชื่อไฟล์ ดูเหตุผลที่ `BackupSheetSource` */
  checksum: string;
  pages: readonly BackupSheetSourcePage[];
};

export type BackupSheetRow = {
  id: string;
  /** ชื่อที่คนตั้ง · ว่างได้ ซึ่งเอกสารต้องแสดงเป็นชื่อชนิดแทน ไม่ใช่ช่องว่าง */
  name: string;
  kind: MeasurementKind;
  kindLabel: string;
  value: MeasurementValue;
  /** null เมื่อรูปไม่มีจุดเลย ซึ่งไม่ควรเกิดกับรอยที่ผ่าน `isComplete` แล้ว */
  evidence: MeasurementEvidence | null;
};

export type BackupSheetPage = {
  pageNumber: number;
  scale: PageScale | null;
  method: CalibrationMethod | null;
  confirmedAt: Date | null;
  dimensionCount: number;
  /** เส้นบอกระยะที่สเกลคลาดจากมันมากที่สุด · null เมื่อหน้านั้นไม่มีเส้นให้เทียบ */
  worstGap: ReturnType<typeof worstScaleGap>;
  rows: BackupSheetRow[];
  totalLengthMetres: number;
  totalAreaSquareMetres: number;
  totalCount: number;
};

/** แบบหนึ่งไฟล์ พร้อมทุกหน้าของมันที่มีอะไรให้เป็น backup */
export type BackupSheetDrawing = {
  documentId: string;
  checksum: string;
  pages: BackupSheetPage[];
};

export type BackupSheet = {
  drawings: BackupSheetDrawing[];
  /** จำนวนรายการวัดทั้งโครงการ */
  rowCount: number;
  totalLengthMetres: number;
  totalAreaSquareMetres: number;
  totalCount: number;
  /**
   * สิ่งที่เอกสารฉบับนี้ยังตอบไม่ได้ รวมจากทุกแถวแล้วตัดตัวซ้ำออก
   *
   * รวมไว้ที่เดียวเพราะคนอ่านเอกสารพิมพ์อยากรู้ก่อนอ่านว่ามีอะไรค้างบ้าง ไม่ใช่ไล่เจอ
   * ทีละแถวจนถึงหน้าสุดท้าย · ในแถวยังมีของมันเองครบเหมือนเดิม
   */
  openQuestions: string[];
};

/**
 * หนึ่งหน้าที่มีรอยวัดแล้วแต่ยังไม่ยืนยันสเกล — ยอดของหน้านั้นจึงยังนับไม่ได้
 *
 * แยกออกมาเป็นฟังก์ชันเพราะทั้งหัวเอกสารและตัวหน้าต้องรู้เรื่องเดียวกันนี้
 */
export function pagesAwaitingScale(sheet: BackupSheet): number[] {
  const pages = new Set<number>();
  for (const drawing of sheet.drawings) {
    for (const page of drawing.pages) {
      if (!page.scale && page.rows.length > 0) pages.add(page.pageNumber);
    }
  }
  return [...pages].sort((a, b) => a - b);
}

export function buildBackupSheet(documents: readonly BackupSheetSourceDocument[]): BackupSheet {
  const drawings: BackupSheetDrawing[] = [];
  const openQuestions = new Set<string>();
  let rowCount = 0;
  let totalLengthMetres = 0;
  let totalAreaSquareMetres = 0;
  let totalCount = 0;

  for (const document of documents) {
    const pages: BackupSheetPage[] = [];

    for (const source of [...document.pages].sort((a, b) => a.pageNumber - b.pageNumber)) {
      const rows: BackupSheetRow[] = [];
      let pageLength = 0;
      let pageArea = 0;
      let pageCount = 0;

      for (const mark of source.marks) {
        // รอยที่ยังวาดไม่ครบไม่ใช่ปริมาณ มันคือของที่ค้างมือ ดูเหตุผลที่หัวไฟล์
        if (!isComplete(mark)) continue;

        const value = measure(mark, source.scale);
        const evidence = explainMeasurement({
          measurement: mark,
          value,
          scale: source.scale,
          method: source.method,
          dimensions: source.dimensions
        });

        rows.push({
          id: mark.id,
          name: mark.name,
          kind: mark.kind,
          kindLabel: measurementKindLabel[mark.kind],
          value,
          evidence
        });

        for (const question of evidence?.openQuestions ?? []) openQuestions.add(question);

        pageLength += value.lengthMetres ?? 0;
        pageArea += value.areaSquareMetres ?? 0;
        pageCount += value.count ?? 0;
      }

      // หน้าที่ไม่มีรอยวัดและไม่มีสเกล ไม่มีอะไรให้เป็น backup จึงไม่ต้องกินที่ในเอกสาร
      if (rows.length === 0 && !source.scale) continue;

      pages.push({
        pageNumber: source.pageNumber,
        scale: source.scale,
        method: source.method,
        confirmedAt: source.confirmedAt,
        dimensionCount: source.dimensions.length,
        worstGap: worstScaleGap(source.dimensions, source.scale),
        rows,
        totalLengthMetres: pageLength,
        totalAreaSquareMetres: pageArea,
        totalCount: pageCount
      });

      rowCount += rows.length;
      totalLengthMetres += pageLength;
      totalAreaSquareMetres += pageArea;
      totalCount += pageCount;
    }

    // ไฟล์ที่ยังไม่มีหน้าไหนถูกแตะเลย ไม่ต้องขึ้นเป็นหัวข้อว่างในเอกสาร
    if (pages.length === 0) continue;
    drawings.push({ documentId: document.documentId, checksum: document.checksum, pages });
  }

  return {
    drawings,
    rowCount,
    totalLengthMetres,
    totalAreaSquareMetres,
    totalCount,
    openQuestions: [...openQuestions]
  };
}
