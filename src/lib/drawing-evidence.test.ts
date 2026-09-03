import { describe, expect, it } from "vitest";

import { parseEvidenceGeometry } from "@/lib/drawing-evidence";

/**
 * หลักฐานเรขาคณิตของบรรทัดที่มาจากการวาด (IP-234)
 *
 * ข้อที่เฝ้าการตัดสินใจคือ "สเกลต้องติดมากับหลักฐาน ยกเว้นการนับ" — วันที่มีคนทำให้สเกลเป็น
 * ตัวเลือกเพื่อความสะดวก เทสต์ต้องแดง เพราะบรรทัดนั้นจะย้อนไม่ได้ว่าคูณด้วยอะไร
 */

const row = {
  kind: "measurement",
  version: 1,
  page: 7,
  measurementKind: "length",
  origin: "pointer",
  points: [{ x: 178.1, y: 294 }, { x: 291.3, y: 294 }],
  scale: { metresPerPoint: 0.044156 }
};

describe("หลักฐานเรขาคณิตของบรรทัดที่วาด", () => {
  it("อ่านกลับได้เท่าที่เก็บไป", () => {
    expect(parseEvidenceGeometry(row)).toEqual(row);
  });

  it("การนับจำนวนไม่ต้องมีสเกล และรับ scale ที่หายไปทั้งช่อง", () => {
    const count = { ...row, measurementKind: "count", points: [{ x: 1, y: 1 }], scale: null };
    expect(parseEvidenceGeometry(count)?.scale).toBeNull();
    const noField = { ...count } as Record<string, unknown>;
    delete noField.scale;
    expect(parseEvidenceGeometry(noField)?.scale).toBeNull();
  });

  it("ชนิดที่ต้องใช้สเกลแต่สเกลหายไป คืน null ทั้งก้อน", () => {
    expect(parseEvidenceGeometry({ ...row, scale: null })).toBeNull();
    expect(parseEvidenceGeometry({ ...row, scale: { metresPerPoint: 0 } })).toBeNull();
  });

  it("ปฏิเสธ kind version measurementKind และ origin ที่ผิด", () => {
    expect(parseEvidenceGeometry({ ...row, kind: "grid-node" })).toBeNull();
    expect(parseEvidenceGeometry({ ...row, version: 2 })).toBeNull();
    expect(parseEvidenceGeometry({ ...row, measurementKind: "volume" })).toBeNull();
    expect(parseEvidenceGeometry({ ...row, origin: "magic" })).toBeNull();
  });

  it("จุดผิดรูปตัวเดียวหรือไม่มีจุดเลย คืน null ทั้งก้อน", () => {
    expect(parseEvidenceGeometry({ ...row, points: [] })).toBeNull();
    expect(parseEvidenceGeometry({ ...row, points: [{ x: 1, y: 1 }, { x: Number.NaN, y: 2 }] })).toBeNull();
  });

  it("ไม่ยกช่องแปลกปลอมติดมา", () => {
    const parsed = parseEvidenceGeometry({ ...row, price: 100 });
    expect(Object.keys(parsed ?? {}).sort())
      .toEqual(["kind", "measurementKind", "origin", "page", "points", "scale", "version"]);
  });
});
