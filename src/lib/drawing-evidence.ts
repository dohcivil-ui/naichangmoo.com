/**
 * รูปทรงของหลักฐานที่แขวนไว้กับบรรทัดใน backup sheet ซึ่งมาจากการวาดบนแบบ (IP-234)
 *
 * **สเกลถูกก๊อป ณ ตอนส่ง ไม่ใช่อ้างแถว calibration** วันที่คนแก้สเกลของหน้านั้นทีหลัง หลักฐานของ
 * ค่าที่ส่งไปแล้วต้องยังบอกได้ว่าตอนนั้นคูณด้วยอะไร เหตุผลเดียวกับ `conversionNote` ของแถวที่พิมพ์
 * ค่าที่อ้างแถวอื่นจะเปลี่ยนความหมายเงียบ ๆ เมื่อแถวนั้นเปลี่ยน
 *
 * `scale` เป็น null ได้เฉพาะการนับจำนวน ซึ่งไม่ใช้สเกล
 *
 * แผนแม่ออกแบบ `EvidenceGeometry` เป็น union หลายชนิด (grid-node, text-span) รอบนี้ทำเฉพาะ
 * `measurement` ที่ต้องใช้ ชนิดอื่นเพิ่มเมื่อถึงคิว ไม่ประกาศล่วงหน้าให้ว่างเปล่า
 *
 * ไฟล์นี้ไม่รู้จัก React และไม่รู้จักฐานข้อมูล
 */

import { isMeasurementKind, isMeasurementOrigin, type MeasurementKind, type MeasurementOrigin } from "@/lib/drawing-measurement";
import type { PagePoint } from "@/lib/drawing-scale";

export type EvidenceGeometry = {
  kind: "measurement";
  version: 1;
  page: number;
  measurementKind: MeasurementKind;
  origin: MeasurementOrigin;
  /** จุดตามที่คนชี้ ไม่ใช่มุมที่กางแล้ว — สี่เหลี่ยมจึงเป็นสองจุดตรงข้าม เหมือนใน `Measurement` */
  points: PagePoint[];
  scale: { metresPerPoint: number } | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
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

/**
 * อ่านค่าที่ออกจากคอลัมน์ `geometry` ให้เป็นรูปทรงที่เชื่อได้ — ทุกอย่างที่ออกจาก jsonb คือ `unknown`
 * สมาชิกผิดรูปตัวเดียวคืน null ทั้งก้อน ไม่กรองทิ้งเงียบ กติกาเดียวกับ `drawing-state.ts`
 */
export function parseEvidenceGeometry(value: unknown): EvidenceGeometry | null {
  const raw = asRecord(value);
  if (!raw || raw.kind !== "measurement" || raw.version !== 1) return null;

  const page = raw.page;
  if (typeof page !== "number" || !Number.isInteger(page) || page < 1) return null;

  if (typeof raw.measurementKind !== "string" || !isMeasurementKind(raw.measurementKind)) return null;
  if (typeof raw.origin !== "string" || !isMeasurementOrigin(raw.origin)) return null;

  if (!Array.isArray(raw.points) || raw.points.length === 0) return null;
  const points: PagePoint[] = [];
  for (const item of raw.points) {
    const point = parsePagePoint(item);
    if (!point) return null;
    points.push(point);
  }

  let scale: EvidenceGeometry["scale"] = null;
  if (raw.scale !== null && raw.scale !== undefined) {
    const scaleRaw = asRecord(raw.scale);
    const metresPerPoint = scaleRaw ? finiteNumber(scaleRaw.metresPerPoint) : null;
    if (metresPerPoint === null || metresPerPoint <= 0) return null;
    scale = { metresPerPoint };
  }
  // ทุกชนิดยกเว้นการนับต้องมีสเกลติดมา ไม่งั้นตัวเลขในบรรทัดนั้นย้อนกลับไม่ได้ว่าคูณด้วยอะไร
  if (scale === null && raw.measurementKind !== "count") return null;

  return { kind: "measurement", version: 1, page, measurementKind: raw.measurementKind, origin: raw.origin, points, scale };
}
