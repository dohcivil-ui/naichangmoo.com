/**
 * รูปทรงของงานวาดที่ลงคอลัมน์ jsonb และตัวอ่านกลับที่เชื่อได้ (IP-233)
 *
 * **ทำไมต้องมีไฟล์นี้** สี่ช่องของตาราง `drawing_calibrations` และ `drawing_view_states`
 * เป็น jsonb ซึ่งฐานข้อมูลไม่รับประกันรูปทรงให้เลย ทุกอย่างที่ออกมาจากช่องพวกนั้นคือ
 * `unknown` เสมอ ไฟล์นี้จึงเป็นด่านเดียวที่แปลง `unknown` ให้เป็นชนิดที่ใช้ต่อได้
 * รูปทรงเดียวกับ `parseMethodContext` ใน `quantity-provenance.ts` และด้วยเหตุผลเดียวกัน
 *
 * **`version` ตายตัวทุกก้อน** เพราะ jsonb ไม่มี migration ให้ วันที่รูปทรงต้องเปลี่ยนจริง
 * ให้เพิ่มเลขรุ่นใหม่แล้วอ่านได้ทั้งสองรุ่น ไม่ใช่แก้ความหมายของรุ่นเดิมจนข้อมูลเก่าอ่านผิด
 *
 * **สมาชิกผิดรูปแม้ตัวเดียว คืน `null` ทั้งก้อน** ไม่กรองตัวเสียทิ้งเงียบ ๆ เพราะกริดที่หาย
 * ไปหนึ่งเส้นโดยไม่มีใครรู้ อันตรายกว่ากริดที่ไม่ขึ้นเลยแล้วคนเห็นว่าไม่ขึ้น
 *
 * ไฟล์นี้ไม่รู้จัก React ไม่รู้จัก pdf.js และไม่รู้จักฐานข้อมูล
 */

import {
  isMeasurementKind,
  isMeasurementOrigin,
  minimumPoints,
  type Measurement,
  type MeasurementOrigin
} from "@/lib/drawing-measurement";
import type { DraftedGridLine } from "@/lib/drawing-grid";
import { SCALE_UNITS, type PagePoint, type ScaleUnit, type StatedDimension } from "@/lib/drawing-scale";

/** จุดอ้างอิงและระยะจริงที่คนใช้ตั้งสเกลของหน้านั้น — คู่กับคอลัมน์ `reference_geometry` */
export type CalibrationReference = {
  version: 1;
  a: PagePoint;
  b: PagePoint;
  realDistance: number;
  unit: ScaleUnit;
};

/** เส้นกริดทั้งหมดของหน้าหนึ่ง — คู่กับคอลัมน์ `grid` (null แปลว่ายังไม่มีใครร่าง) */
export type GridPayload = { version: 1; lines: DraftedGridLine[] };

/** ระยะจริงทุกช่วงของหน้าหนึ่ง — คู่กับคอลัมน์ `dimensions` (null แปลว่ายังไม่มีใครใส่) */
export type DimensionsPayload = { version: 1; items: StatedDimension[] };

/** ระดับซูมและตำแหน่งที่เลื่อนไป — คู่กับคอลัมน์ `view` ของ `drawing_view_states` */
export type ViewPayload = { version: 1; scale: number; x: number; y: number };

/** ร่องรอยว่ารอยวัดนี้ถูกส่งเข้าถอดปริมาณแล้ว ชี้กลับได้ทั้งสามชั้น */
export type MarkFiling = { itemId: string; measurementId: string; evidenceId: string };

/**
 * รอยที่คนวาดไว้หนึ่งชิ้น — คือ `Measurement` บวกร่องรอยการส่งเข้าถอดปริมาณและชั้นที่สังกัด
 *
 * `filed` เป็น null แปลว่ายังเป็นแค่รอยบนแบบ ยังไม่มีบรรทัดใน backup sheet
 * `layerId` เป็น null แปลว่ายังไม่จัดชั้น ซึ่งเป็นค่าของทุกแถวจนกว่างาน layer จะลง
 */
export type StoredMark = Measurement & { filed: MarkFiling | null; layerId: string | null };

/** รอยทั้งหมดของหน้าหนึ่ง — คู่กับคอลัมน์ `marks` ของ `drawing_marks` */
export type MarksPayload = { version: 1; items: StoredMark[] };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function versionOne(value: unknown): Record<string, unknown> | null {
  const raw = asRecord(value);
  if (!raw || raw.version !== 1) return null;
  return raw;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function parsePagePoint(value: unknown): PagePoint | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const x = finiteNumber(raw.x);
  const y = finiteNumber(raw.y);
  if (x === null || y === null) return null;
  return { x, y };
}

/** เลขหน้าที่ใช้อ้างได้จริง — จำนวนเต็มตั้งแต่หนึ่งขึ้นไป ตรงกับ CHECK ของทั้งสองตาราง */
function pageNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) return null;
  return value;
}

function nonEmptyId(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return value;
}

function scaleUnit(value: unknown): ScaleUnit | null {
  if (typeof value !== "string") return null;
  return SCALE_UNITS.find((unit) => unit === value) ?? null;
}

export function parseCalibrationReference(value: unknown): CalibrationReference | null {
  const raw = versionOne(value);
  if (!raw) return null;

  const a = parsePagePoint(raw.a);
  const b = parsePagePoint(raw.b);
  if (!a || !b) return null;

  const realDistance = finiteNumber(raw.realDistance);
  if (realDistance === null || realDistance <= 0) return null;

  const unit = scaleUnit(raw.unit);
  if (!unit) return null;

  return { version: 1, a, b, realDistance, unit };
}

function parseGridLine(value: unknown): DraftedGridLine | null {
  const raw = asRecord(value);
  if (!raw) return null;

  const id = nonEmptyId(raw.id);
  const page = pageNumber(raw.page);
  const a = parsePagePoint(raw.a);
  const b = parsePagePoint(raw.b);
  if (id === null || page === null || !a || !b) return null;

  const line: DraftedGridLine = { id, page, a, b };
  if (raw.label !== undefined) {
    if (typeof raw.label !== "string") return null;
    line.label = raw.label;
  }
  return line;
}

function parseStatedDimension(value: unknown): StatedDimension | null {
  const raw = asRecord(value);
  if (!raw) return null;

  const id = nonEmptyId(raw.id);
  const page = pageNumber(raw.page);
  const a = parsePagePoint(raw.a);
  const b = parsePagePoint(raw.b);
  const valueM = finiteNumber(raw.valueM);
  if (id === null || page === null || !a || !b || valueM === null || valueM <= 0) return null;

  return { id, page, a, b, valueM };
}

function parseAll<T>(value: unknown, parseOne: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const parsed: T[] = [];
  for (const item of value) {
    const one = parseOne(item);
    if (!one) return null;
    parsed.push(one);
  }
  return parsed;
}

export function parseGridPayload(value: unknown): GridPayload | null {
  const raw = versionOne(value);
  if (!raw) return null;
  const lines = parseAll(raw.lines, parseGridLine);
  if (!lines) return null;
  return { version: 1, lines };
}

export function parseDimensionsPayload(value: unknown): DimensionsPayload | null {
  const raw = versionOne(value);
  if (!raw) return null;
  const items = parseAll(raw.items, parseStatedDimension);
  if (!items) return null;
  return { version: 1, items };
}

function parseMarkFiling(value: unknown): MarkFiling | null {
  const raw = asRecord(value);
  if (!raw) return null;

  const itemId = nonEmptyId(raw.itemId);
  const measurementId = nonEmptyId(raw.measurementId);
  const evidenceId = nonEmptyId(raw.evidenceId);
  if (itemId === null || measurementId === null || evidenceId === null) return null;

  return { itemId, measurementId, evidenceId };
}

function parseStoredMark(value: unknown): StoredMark | null {
  const raw = asRecord(value);
  if (!raw) return null;

  const id = nonEmptyId(raw.id);
  const page = pageNumber(raw.page);
  const colour = nonEmptyId(raw.colour);
  if (id === null || page === null || colour === null) return null;

  if (typeof raw.kind !== "string" || !isMeasurementKind(raw.kind)) return null;
  if (typeof raw.name !== "string") return null;

  const points = parseAll(raw.points, parsePagePoint);
  if (!points || points.length < minimumPoints(raw.kind)) return null;

  /**
   * `origin` ที่หายไปอ่านเป็น `pointer` เพราะก่อนช่องนี้เกิด ทุกอย่างคือคนชี้เอง (การไล่ห้องยัง
   * ไม่เคยถูกเซฟ) ส่วนค่าที่มีแต่ไม่อยู่ในทะเบียนคืน null ทั้งก้อน กติกาเดียวกับ `kind`
   */
  let origin: MeasurementOrigin = "pointer";
  if (raw.origin !== undefined) {
    if (typeof raw.origin !== "string" || !isMeasurementOrigin(raw.origin)) return null;
    origin = raw.origin;
  }

  /**
   * `filed` ที่หายไปทั้งช่องอ่านเป็น null ได้ แต่ค่าที่มีอยู่แล้วผิดรูปคืน null ทั้งก้อน
   *
   * เหตุผลไม่เหมือนกันสองกรณี ช่องที่ไม่มีคือแถวที่เขียนก่อนช่องนี้เกิด ซึ่งอ่านต่อได้อย่าง
   * ปลอดภัยเพราะความหมายของการไม่มีคือ "ยังไม่ได้ส่ง" ส่วนช่องที่มีแต่ผิดรูปคือข้อมูลที่เชื่อไม่ได้
   * จะแปลว่ายังไม่ได้ส่งก็ไม่จริง จะแปลว่าส่งแล้วก็ชี้กลับไม่ได้ — เงียบไม่ได้ทั้งสองทาง
   */
  let filed: MarkFiling | null = null;
  if (raw.filed !== undefined && raw.filed !== null) {
    filed = parseMarkFiling(raw.filed);
    if (!filed) return null;
  }

  /** `layerId` กติกาเดียวกับ `filed` — ไม่มีช่องคือยังไม่จัดชั้น มีแต่ผิดรูปคือเชื่อไม่ได้ */
  let layerId: string | null = null;
  if (raw.layerId !== undefined && raw.layerId !== null) {
    layerId = nonEmptyId(raw.layerId);
    if (layerId === null) return null;
  }

  return { id, page, kind: raw.kind, name: raw.name, points, colour, origin, filed, layerId };
}

export function parseMarksPayload(value: unknown): MarksPayload | null {
  const raw = versionOne(value);
  if (!raw) return null;
  const items = parseAll(raw.items, parseStoredMark);
  if (!items) return null;
  return { version: 1, items };
}

export function parseViewPayload(value: unknown): ViewPayload | null {
  const raw = versionOne(value);
  if (!raw) return null;
  const scale = finiteNumber(raw.scale);
  const x = finiteNumber(raw.x);
  const y = finiteNumber(raw.y);
  if (scale === null || x === null || y === null) return null;
  return { version: 1, scale, x, y };
}
