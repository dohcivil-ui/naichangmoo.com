/**
 * แปลงรอยวัดบนแบบให้เป็นบรรทัดใน backup sheet (IP-234 ขั้น 3)
 *
 * รอยวัดคือจุดบนกระดาษ บรรทัดใน backup sheet คือ ป้าย จำนวน ตัวประกอบ และหน่วย — ไฟล์นี้
 * เป็นสะพานเดียวระหว่างสองโลกนั้น และ **ห้ามคำนวณตัวเลขซ้ำ** ทุกตัวเลขมาจาก `measure()` ของ
 * `drawing-measurement.ts` ที่หน้าจอใช้แสดงอยู่แล้ว เพื่อให้เลขที่คนเห็นบนหน้าวาดกับเลขที่ลงฐาน
 * เป็นเลขเดียวกันในระดับที่พิสูจน์ด้วยเทสต์
 *
 * ผลลัพธ์**ไม่มีเงิน ไม่มีราคา** ตามกฎร่วมของชั้นผู้ช่วยและ ADR 0008 — ปริมาณกับราคาเป็นคนละชั้น
 *
 * ไฟล์นี้ไม่รู้จัก React และไม่รู้จักฐานข้อมูล
 */

import type { EvidenceGeometry } from "@/lib/drawing-evidence";
import { measure, measurementKindLabel, minimumPoints, needsScale, type Measurement } from "@/lib/drawing-measurement";
import type { PageScale } from "@/lib/drawing-scale";
import type { QuantityMethod } from "@/lib/quantity-provenance";
import type { MeasurementInput } from "@/lib/takeoff-measurement";

/** คอลัมน์ `numeric(18,6)` รับหกตำแหน่ง ส่งมากกว่านั้นฐานจะปัดเองโดยไม่บอก จึงปัดที่นี่ให้เห็น */
const DECIMALS = 6;

export type FiledLine = {
  /** บอกฟอร์มว่าหน่วยเลือกได้แค่ไหน — ความยาวมีแค่ ม. พื้นที่มีแค่ ตร.ม. การนับเลือกได้หลายหน่วย */
  unitDimension: "length" | "area" | "count";
  method: QuantityMethod;
  measurement: MeasurementInput;
  geometry: EvidenceGeometry;
};

export type FiledLineRejection = "needs_scale" | "too_few_points";
export type FiledLineResult = { ok: true; line: FiledLine } | { ok: false; reason: FiledLineRejection };

export const filedLineRejectionMessage: Record<FiledLineRejection, string> = {
  needs_scale: "หน้านี้ยังไม่ได้ตั้งสเกล ตั้งสเกลก่อนจึงส่งเข้าถอดปริมาณได้",
  too_few_points: "รายการนี้ยังวาดไม่ครบ จึงยังไม่มีตัวเลขให้ส่ง"
};

function fixed(value: number): string {
  return value.toFixed(DECIMALS);
}

/**
 * ตารางแปลงตามสเปก IP-234 ขั้น 3
 *
 * | kind | method | count | dimensions |
 * |---|---|---|---|
 * | length, polyline | pointer | 1 | [ความยาว] |
 * | rect | pointer | 1 | [กว้าง, ยาว] |
 * | area ที่คนลากเอง | pointer | 1 | [พื้นที่] |
 * | area ที่ระบบไล่ห้อง | region_trace | 1 | [พื้นที่] |
 * | count | pointer_count | จำนวนจุด | [] |
 */
export function toFiledLine(mark: Measurement, scale: PageScale | null): FiledLineResult {
  if (mark.points.length < minimumPoints(mark.kind)) return { ok: false, reason: "too_few_points" };
  if (needsScale(mark.kind) && !scale) return { ok: false, reason: "needs_scale" };

  const value = measure(mark, scale);
  const label = `หน้า ${mark.page} · ${measurementKindLabel[mark.kind]}`;
  const geometry: EvidenceGeometry = {
    kind: "measurement",
    version: 1,
    page: mark.page,
    measurementKind: mark.kind,
    origin: mark.origin,
    points: mark.points.map((point) => ({ x: point.x, y: point.y })),
    scale: scale ? { metresPerPoint: scale.metresPerPoint } : null
  };
  const base = { label, conversionFactor: null, conversionNote: null };

  switch (mark.kind) {
    case "length":
    case "polyline":
      return {
        ok: true,
        line: {
          unitDimension: "length",
          method: "pointer",
          measurement: { ...base, count: 1, dimensions: [fixed(value.lengthMetres ?? 0)] },
          geometry
        }
      };
    case "rect":
      // สี่เหลี่ยมมีกว้างกับยาวจริง จึงส่งสองตัวประกอบเหมือนแถวที่คนพิมพ์ — ด้านแรกกับด้านที่สอง
      // ของเส้นรอบรูปที่ measure() กางจากสองมุมตรงข้าม
      return {
        ok: true,
        line: {
          unitDimension: "area",
          method: "pointer",
          measurement: {
            ...base,
            count: 1,
            dimensions: [fixed(value.segmentsMetres[0] ?? 0), fixed(value.segmentsMetres[1] ?? 0)]
          },
          geometry
        }
      };
    case "area":
      return {
        ok: true,
        line: {
          unitDimension: "area",
          method: mark.origin === "region_trace" ? "region_trace" : "pointer",
          measurement: { ...base, count: 1, dimensions: [fixed(value.areaSquareMetres ?? 0)] },
          geometry
        }
      };
    case "count":
      return {
        ok: true,
        line: {
          unitDimension: "count",
          method: "pointer_count",
          measurement: { ...base, count: value.count ?? mark.points.length, dimensions: [] },
          geometry
        }
      };
  }
}
