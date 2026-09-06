/**
 * รวมหลักฐานการคำนวณของทั้งโครงการให้เป็นเอกสารหนึ่งฉบับที่พิมพ์ออกได้ (IP-243)
 *
 * **ทำไมต้องมีทั้งสองที่** แผงกางต่อหนึ่งแถวในหน้าแบบตอบคนที่กำลังทำงานอยู่ตรงนั้น
 * ส่วนเอกสารฉบับนี้ตอบคนที่ไม่ได้นั่งอยู่หน้าจอ — ผู้ตรวจ เจ้าของงาน คนที่เถียงตัวเลข
 * ในห้องประชุม · เจ้าของงานเคาะเมื่อ 2026-09-05 ว่าเอา **ทั้งสองที่**
 *
 * **ไฟล์นี้ไม่คำนวณอะไรใหม่เลยสักตัว** พื้นที่กับความยาวมาจาก `measure()` วิธีคิดมาจาก
 * `explainMeasurement()` ความคลาดของสเกลมาจาก `worstScaleGap()` ทั้งหมดเป็นตัวเดียวกับ
 * ที่หน้าแบบใช้ · ถ้าที่นี่คิดเอง เอกสารที่พิมพ์ออกไปจะเป็นเลขชุดที่สองที่อาจไม่ตรงกับจอ
 * ซึ่งคือความผิดพลาดที่ร้ายที่สุดที่หน้าหลักฐานจะทำได้
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
export type EvidenceSourcePage = {
  pageNumber: number;
  /** null เมื่อหน้านั้นยังไม่ได้ยืนยันสเกล */
  scale: PageScale | null;
  method: CalibrationMethod | null;
  confirmedAt: Date | null;
  dimensions: readonly StatedDimension[];
  marks: readonly Measurement[];
};

export type EvidenceSourceDocument = {
  documentId: string;
  /** ลายนิ้วมือของไฟล์ · ระบบไม่เก็บชื่อไฟล์ ดูเหตุผลที่ `ProjectEvidenceDocument` */
  checksum: string;
  pages: readonly EvidenceSourcePage[];
};

export type EvidenceRow = {
  id: string;
  /** ชื่อที่คนตั้ง · ว่างได้ ซึ่งเอกสารต้องแสดงเป็นชื่อชนิดแทน ไม่ใช่ช่องว่าง */
  name: string;
  kind: MeasurementKind;
  kindLabel: string;
  value: MeasurementValue;
  /** null เมื่อรูปไม่มีจุดเลย ซึ่งไม่ควรเกิดกับรอยที่ผ่าน `isComplete` แล้ว */
  evidence: MeasurementEvidence | null;
};

export type EvidencePage = {
  pageNumber: number;
  scale: PageScale | null;
  method: CalibrationMethod | null;
  confirmedAt: Date | null;
  dimensionCount: number;
  /** เส้นบอกระยะที่สเกลคลาดจากมันมากที่สุด · null เมื่อหน้านั้นไม่มีเส้นให้เทียบ */
  worstGap: ReturnType<typeof worstScaleGap>;
  rows: EvidenceRow[];
  totalLengthMetres: number;
  totalAreaSquareMetres: number;
  totalCount: number;
};

export type EvidenceDocument = {
  documentId: string;
  checksum: string;
  pages: EvidencePage[];
};

export type ProjectEvidence = {
  documents: EvidenceDocument[];
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
export function pagesAwaitingScale(evidence: ProjectEvidence): number[] {
  const pages = new Set<number>();
  for (const document of evidence.documents) {
    for (const page of document.pages) {
      if (!page.scale && page.rows.length > 0) pages.add(page.pageNumber);
    }
  }
  return [...pages].sort((a, b) => a - b);
}

export function buildProjectEvidence(documents: readonly EvidenceSourceDocument[]): ProjectEvidence {
  const built: EvidenceDocument[] = [];
  const openQuestions = new Set<string>();
  let rowCount = 0;
  let totalLengthMetres = 0;
  let totalAreaSquareMetres = 0;
  let totalCount = 0;

  for (const document of documents) {
    const pages: EvidencePage[] = [];

    for (const source of [...document.pages].sort((a, b) => a.pageNumber - b.pageNumber)) {
      const rows: EvidenceRow[] = [];
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

      // หน้าที่ไม่มีรอยวัดและไม่มีสเกล ไม่มีอะไรให้เป็นหลักฐาน จึงไม่ต้องกินที่ในเอกสาร
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
    built.push({ documentId: document.documentId, checksum: document.checksum, pages });
  }

  return {
    documents: built,
    rowCount,
    totalLengthMetres,
    totalAreaSquareMetres,
    totalCount,
    openQuestions: [...openQuestions]
  };
}
