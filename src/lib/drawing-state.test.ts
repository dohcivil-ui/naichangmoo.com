import { describe, expect, it } from "vitest";

import {
  parseCalibrationReference,
  parseDimensionsPayload,
  parseGridPayload,
  parseMarksPayload,
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

const markRow = {
  version: 1,
  items: [
    {
      id: "m1",
      page: 7,
      kind: "length",
      name: "แนวผนังทิศเหนือ",
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      colour: "var(--teal)",
      origin: "pointer",
      filed: null,
      layerId: null
    }
  ]
};

const filedMark = {
  ...markRow.items[0],
  id: "m2",
  filed: { itemId: "i1", measurementId: "ms1", evidenceId: "e1" },
  layerId: "layer-1"
};

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

/**
 * รอยที่คนวาดไว้ (IP-234)
 *
 * กลุ่มที่เฝ้าการตัดสินใจจริงคือสองข้อล่างสุด — ช่องที่หายไปกับช่องที่มีแต่ผิดรูปต้องได้ผลต่างกัน
 * เพราะแถวที่เขียนก่อนช่องนั้นเกิดอ่านต่อได้ แต่แถวที่บอกว่าส่งเข้าถอดปริมาณแล้วโดยชี้กลับไม่ได้
 * เชื่อไม่ได้ทั้งก้อน
 */
describe("รอยที่คนวาดไว้", () => {
  it("อ่านกลับได้เท่าที่เก็บไป", () => {
    expect(parseMarksPayload(markRow)).toEqual(markRow);
  });

  it("อ่านรอยที่ส่งเข้าถอดปริมาณแล้วและจัดชั้นแล้วได้ครบ", () => {
    const parsed = parseMarksPayload({ version: 1, items: [filedMark] });
    expect(parsed?.items[0].filed).toEqual({ itemId: "i1", measurementId: "ms1", evidenceId: "e1" });
    expect(parsed?.items[0].layerId).toBe("layer-1");
  });

  it("ปฏิเสธ version ผิด", () => {
    expect(parseMarksPayload({ ...markRow, version: 2 })).toBeNull();
  });

  it("ปฏิเสธชนิดที่ไม่อยู่ในทะเบียน", () => {
    expect(parseMarksPayload({ version: 1, items: [{ ...markRow.items[0], kind: "volume" }] })).toBeNull();
  });

  it("ปฏิเสธเมื่อจุดน้อยกว่าที่ชนิดนั้นต้องใช้", () => {
    expect(parseMarksPayload({
      version: 1,
      items: [{ ...markRow.items[0], points: [{ x: 0, y: 0 }] }]
    })).toBeNull();
  });

  it("ปฏิเสธสีว่างและเลขหน้าที่ไม่ใช่จำนวนเต็มตั้งแต่หนึ่ง", () => {
    expect(parseMarksPayload({ version: 1, items: [{ ...markRow.items[0], colour: "" }] })).toBeNull();
    expect(parseMarksPayload({ version: 1, items: [{ ...markRow.items[0], page: 0 }] })).toBeNull();
  });

  it("สมาชิกผิดรูปหนึ่งตัวทำให้ทั้งก้อนตก ไม่กรองตัวเสียทิ้งเงียบ", () => {
    expect(parseMarksPayload({
      version: 1,
      items: [markRow.items[0], { ...markRow.items[0], id: "" }]
    })).toBeNull();
  });

  it("ช่อง filed กับ layerId ที่หายไปทั้งช่องอ่านเป็น null ได้ และ origin ที่หายไปคือคนชี้เอง", () => {
    const legacy = { ...markRow.items[0] } as Record<string, unknown>;
    delete legacy.filed;
    delete legacy.layerId;
    delete legacy.origin;
    const parsed = parseMarksPayload({ version: 1, items: [legacy] });
    expect(parsed?.items[0].filed).toBeNull();
    expect(parsed?.items[0].layerId).toBeNull();
    expect(parsed?.items[0].origin).toBe("pointer");
  });

  it("origin ที่ไม่อยู่ในทะเบียนคืน null ทั้งก้อน ส่วน region_trace อ่านกลับได้", () => {
    expect(parseMarksPayload({ version: 1, items: [{ ...markRow.items[0], origin: "magic" }] })).toBeNull();
    const parsed = parseMarksPayload({ version: 1, items: [{ ...markRow.items[0], origin: "region_trace" }] });
    expect(parsed?.items[0].origin).toBe("region_trace");
  });

  it("ช่อง filed หรือ layerId ที่มีอยู่แต่ผิดรูปคืน null ทั้งก้อน", () => {
    expect(parseMarksPayload({
      version: 1,
      items: [{ ...markRow.items[0], filed: { itemId: "i1", measurementId: "ms1" } }]
    })).toBeNull();
    expect(parseMarksPayload({
      version: 1,
      items: [{ ...markRow.items[0], layerId: "" }]
    })).toBeNull();
  });

  it("ไม่ยกช่องแปลกปลอมติดมา", () => {
    const parsed = parseMarksPayload({
      version: 1,
      items: [{ ...markRow.items[0], scanState: "pending" }]
    });
    expect(Object.keys(parsed?.items[0] ?? {}).sort())
      .toEqual(["colour", "filed", "id", "kind", "layerId", "name", "origin", "page", "points"]);
  });
});
