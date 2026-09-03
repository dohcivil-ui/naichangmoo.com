import { describe, expect, it } from "vitest";

import {
  parseCalibrationReference,
  parseDimensionsPayload,
  parseGridPayload,
  parseViewPayload
} from "@/lib/drawing-state";

/**
 * เทสต์ของด่านอ่าน jsonb (IP-233)
 *
 * กลุ่มที่สำคัญที่สุดคือ "สมาชิกผิดรูปหนึ่งตัวทำให้ทั้งก้อนตก" เพราะมันเฝ้าการตัดสินใจ
 * ไม่ใช่เฝ้าโค้ด — วันที่มีคนแก้ให้กรองตัวเสียทิ้งเงียบ ๆ เทสต์ต้องแดง
 */

const referenceRow = {
  version: 1,
  a: { x: 10, y: 20 },
  b: { x: 110, y: 20 },
  realDistance: 5,
  unit: "m"
};

const gridRow = {
  version: 1,
  lines: [
    { id: "g1", page: 7, a: { x: 0, y: 0 }, b: { x: 0, y: 500 } },
    { id: "g2", page: 7, a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, label: "ก" }
  ]
};

const dimensionsRow = {
  version: 1,
  items: [{ id: "d1", page: 7, a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, valueM: 5 }]
};

const viewRow = { version: 1, scale: 2.5, x: -120, y: 340 };

describe("จุดอ้างอิงของสเกล", () => {
  it("อ่านกลับได้เท่าที่เก็บไป", () => {
    expect(parseCalibrationReference(referenceRow)).toEqual({
      version: 1,
      a: { x: 10, y: 20 },
      b: { x: 110, y: 20 },
      realDistance: 5,
      unit: "m"
    });
  });

  it("ผ่าน JSON ไปกลับแล้วยังเท่าเดิม", () => {
    const roundTripped: unknown = JSON.parse(JSON.stringify(referenceRow));
    expect(parseCalibrationReference(roundTripped)).toEqual(referenceRow);
  });

  it("ปฏิเสธ version ที่ไม่ใช่หนึ่ง", () => {
    expect(parseCalibrationReference({ ...referenceRow, version: 2 })).toBeNull();
    expect(parseCalibrationReference({ ...referenceRow, version: "1" })).toBeNull();
  });

  it("ปฏิเสธเลขที่ไม่ finite", () => {
    expect(parseCalibrationReference({ ...referenceRow, realDistance: Number.NaN })).toBeNull();
    expect(parseCalibrationReference({ ...referenceRow, a: { x: Number.POSITIVE_INFINITY, y: 0 } })).toBeNull();
  });

  it("ปฏิเสธระยะจริงที่ไม่มากกว่าศูนย์", () => {
    expect(parseCalibrationReference({ ...referenceRow, realDistance: 0 })).toBeNull();
    expect(parseCalibrationReference({ ...referenceRow, realDistance: -5 })).toBeNull();
  });

  it("ปฏิเสธหน่วยนอกรายการ", () => {
    expect(parseCalibrationReference({ ...referenceRow, unit: "km" })).toBeNull();
    expect(parseCalibrationReference({ ...referenceRow, unit: 1 })).toBeNull();
  });

  it("ปฏิเสธเมื่อขาดจุดปลาย", () => {
    expect(parseCalibrationReference({ ...referenceRow, b: undefined })).toBeNull();
    expect(parseCalibrationReference({ ...referenceRow, b: { x: 1 } })).toBeNull();
  });

  it("ไม่ยกช่องแปลกปลอมติดมา", () => {
    const parsed = parseCalibrationReference({ ...referenceRow, note: "เผลอเก็บมา", ratio: 125 });
    expect(parsed).not.toBeNull();
    expect(Object.keys(parsed ?? {}).sort()).toEqual(["a", "b", "realDistance", "unit", "version"]);
  });

  it("ปฏิเสธค่าที่ไม่ใช่ออบเจกต์", () => {
    expect(parseCalibrationReference(null)).toBeNull();
    expect(parseCalibrationReference("อะไรสักอย่าง")).toBeNull();
    expect(parseCalibrationReference([referenceRow])).toBeNull();
  });
});

describe("ก้อนเส้นกริด", () => {
  it("อ่านกลับได้ทั้งเส้นที่มีชื่อพิมพ์ทับและเส้นที่ไม่มี", () => {
    expect(parseGridPayload(gridRow)).toEqual(gridRow);
  });

  it("รับกริดว่างได้ เพราะว่างกับผิดรูปคนละความหมาย", () => {
    expect(parseGridPayload({ version: 1, lines: [] })).toEqual({ version: 1, lines: [] });
  });

  it("ปฏิเสธทั้งก้อนเมื่อมีสมาชิกผิดรูปหนึ่งตัว", () => {
    expect(
      parseGridPayload({
        version: 1,
        lines: [gridRow.lines[0], { id: "g3", page: 7, a: { x: 0, y: 0 } }]
      })
    ).toBeNull();
  });

  it("ปฏิเสธเส้นที่ id ว่าง หรือเลขหน้าไม่ใช่จำนวนเต็มตั้งแต่หนึ่ง", () => {
    expect(parseGridPayload({ version: 1, lines: [{ ...gridRow.lines[0], id: "" }] })).toBeNull();
    expect(parseGridPayload({ version: 1, lines: [{ ...gridRow.lines[0], page: 0 }] })).toBeNull();
    expect(parseGridPayload({ version: 1, lines: [{ ...gridRow.lines[0], page: 1.5 }] })).toBeNull();
  });

  it("ปฏิเสธชื่อที่ไม่ใช่ข้อความ", () => {
    expect(parseGridPayload({ version: 1, lines: [{ ...gridRow.lines[0], label: 3 }] })).toBeNull();
    expect(parseGridPayload({ version: 1, lines: [{ ...gridRow.lines[0], label: null }] })).toBeNull();
  });

  it("ปฏิเสธเมื่อ lines ไม่ใช่รายการ", () => {
    expect(parseGridPayload({ version: 1, lines: {} })).toBeNull();
    expect(parseGridPayload({ version: 1 })).toBeNull();
  });

  it("ไม่ยกช่องแปลกปลอมของเส้นติดมา", () => {
    const parsed = parseGridPayload({
      version: 1,
      lines: [{ ...gridRow.lines[0], family: "number", autoLabel: "1" }]
    });
    expect(parsed?.lines[0]).toEqual(gridRow.lines[0]);
  });
});

describe("ก้อนระยะจริง", () => {
  it("อ่านกลับได้เท่าที่เก็บไป", () => {
    expect(parseDimensionsPayload(dimensionsRow)).toEqual(dimensionsRow);
  });

  it("ปฏิเสธค่าที่ไม่มากกว่าศูนย์", () => {
    expect(
      parseDimensionsPayload({ version: 1, items: [{ ...dimensionsRow.items[0], valueM: 0 }] })
    ).toBeNull();
    expect(
      parseDimensionsPayload({ version: 1, items: [{ ...dimensionsRow.items[0], valueM: -1 }] })
    ).toBeNull();
  });

  it("ปฏิเสธทั้งก้อนเมื่อมีสมาชิกผิดรูปหนึ่งตัว", () => {
    expect(
      parseDimensionsPayload({
        version: 1,
        items: [dimensionsRow.items[0], { ...dimensionsRow.items[0], id: "d2", valueM: "5" }]
      })
    ).toBeNull();
  });

  it("ไม่ยกช่องแปลกปลอมติดมา", () => {
    const parsed = parseDimensionsPayload({
      version: 1,
      items: [{ ...dimensionsRow.items[0], measuredM: 4.98 }]
    });
    expect(parsed?.items[0]).toEqual(dimensionsRow.items[0]);
  });
});

describe("จุดที่ค้างอยู่", () => {
  it("อ่านกลับได้เท่าที่เก็บไป รวมค่าติดลบของการเลื่อน", () => {
    expect(parseViewPayload(viewRow)).toEqual(viewRow);
  });

  it("ปฏิเสธเลขที่ไม่ finite", () => {
    expect(parseViewPayload({ ...viewRow, x: Number.NaN })).toBeNull();
    expect(parseViewPayload({ ...viewRow, scale: Number.POSITIVE_INFINITY })).toBeNull();
  });

  it("ปฏิเสธเมื่อขาดช่อง", () => {
    expect(parseViewPayload({ version: 1, scale: 1, x: 0 })).toBeNull();
  });

  it("ปฏิเสธ version ผิด", () => {
    expect(parseViewPayload({ ...viewRow, version: 2 })).toBeNull();
  });

  it("ไม่ยกช่องแปลกปลอมติดมา", () => {
    const parsed = parseViewPayload({ ...viewRow, page: 7 });
    expect(Object.keys(parsed ?? {}).sort()).toEqual(["scale", "version", "x", "y"]);
  });
});
