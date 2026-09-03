import { describe, expect, it } from "vitest";

import {
  QUANTITY_METHODS,
  type QuantityMethod,
  isQuantityMethod,
  methodNeedsDisclosure,
  methodRequiresProposal,
  parseMethodContext,
  quantityMethodKind
} from "@/lib/quantity-provenance";

/**
 * เทสต์ของทะเบียนที่มาของปริมาณ (IP-232)
 *
 * ตัวที่สำคัญที่สุดคือกลุ่ม "ห้ามเก็บคำตัดสิน" ซึ่งเฝ้าหลักการของทั้งเรื่อง ไม่ใช่เฝ้าโค้ด
 * ถ้าวันหนึ่งมีคนเพิ่มช่องคะแนนความน่าเชื่อถือเข้าทะเบียน เทสต์ต้องแดงทันที
 */

const ALL_METHODS: QuantityMethod[] = [
  "typed",
  "pointer",
  "pointer_count",
  "region_trace",
  "model"
];

describe("ทะเบียนวิธีที่มาของปริมาณ", () => {
  it("มีครบทุกค่าของ union และไม่มีค่าเกิน", () => {
    const keys = QUANTITY_METHODS.map((kind) => kind.key);
    expect([...keys].sort()).toEqual([...ALL_METHODS].sort());
  });

  it("คีย์ไม่ซ้ำกัน", () => {
    const keys = QUANTITY_METHODS.map((kind) => kind.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("ทุกข้อมีป้ายไทยและคำอธิบายที่ไม่ว่าง", () => {
    for (const kind of QUANTITY_METHODS) {
      expect(kind.label.trim().length).toBeGreaterThan(0);
      expect(kind.description.trim().length).toBeGreaterThan(20);
    }
  });

  it("ป้ายที่ผู้ใช้เห็นไม่มีชื่อช่องภาษาอังกฤษปน ตาม G14", () => {
    for (const kind of QUANTITY_METHODS) {
      expect(kind.label).not.toMatch(/[A-Za-z]/);
    }
  });

  it("ป้ายไม่ซ้ำกัน เพราะสองแถวในตารางที่เขียนเหมือนกันแยกไม่ออก", () => {
    const labels = QUANTITY_METHODS.map((kind) => kind.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("ทะเบียนห้ามเก็บคำตัดสินว่าแม่นหรือไม่แม่น", () => {
  /**
   * หลักการของ IP-232 ทั้งข้ออยู่ในเทสต์สองตัวนี้ — เก็บว่าได้มาอย่างไร ไม่ตีตราว่าแม่น
   * `boq_items.match_confidence` คือตัวอย่างของการทำผิดทางที่มีอยู่แล้วในรีโปนี้
   */
  it("ไม่มีช่องไหนในทะเบียนที่เก็บระดับความเชื่อถือ", () => {
    const forbidden = ["confidence", "accuracy", "score", "trust", "reliability", "grade", "rank"];
    for (const kind of QUANTITY_METHODS) {
      for (const field of Object.keys(kind)) {
        expect(forbidden).not.toContain(field.toLowerCase());
      }
    }
  });

  it("คำอธิบายไม่ตัดสินว่าวิธีไหนแม่นกว่าวิธีไหน", () => {
    for (const kind of QUANTITY_METHODS) {
      expect(kind.description).not.toMatch(/แม่นกว่า|แม่นน้อย|เชื่อถือได้มากกว่า|ด้อยกว่า|ดีกว่า/);
    }
  });
});

describe("การผูกกับข้อเสนอของผู้ช่วย", () => {
  it("เฉพาะวิธีที่โมเดลเป็นคนเสนอเท่านั้นที่ต้องผูกข้อเสนอ", () => {
    const needing = QUANTITY_METHODS.filter((kind) => kind.requiresProposal).map((k) => k.key);
    expect(needing).toEqual(["model"]);
  });

  it("methodRequiresProposal ตอบตรงกับทะเบียนทุกค่า", () => {
    for (const kind of QUANTITY_METHODS) {
      expect(methodRequiresProposal(kind.key)).toBe(kind.requiresProposal);
    }
  });
});

describe("เกณฑ์การกำกับที่มา ซึ่งเป็นที่เดียวที่ต้องแก้เมื่อเกณฑ์เปลี่ยน", () => {
  it("วันนี้กำกับเฉพาะค่าที่โมเดลเสนอ", () => {
    expect(methodNeedsDisclosure("model")).toBe(true);
    for (const method of ALL_METHODS.filter((m) => m !== "model")) {
      expect(methodNeedsDisclosure(method)).toBe(false);
    }
  });

  it("งานที่คนทำเองบนอุปกรณ์ไหนก็ไม่ต้องกำกับเหมือนกัน", () => {
    // อุปกรณ์ไม่ได้อยู่ในวิธี จึงไม่มีทางที่มือถือจะถูกกำกับเพราะเป็นมือถือ
    expect(methodNeedsDisclosure("typed")).toBe(false);
    expect(methodNeedsDisclosure("pointer_count")).toBe(false);
  });
});

describe("isQuantityMethod และ quantityMethodKind", () => {
  it("รับเฉพาะค่าที่อยู่ในทะเบียน", () => {
    expect(isQuantityMethod("model")).toBe(true);
    expect(isQuantityMethod("ai")).toBe(false);
    expect(isQuantityMethod("")).toBe(false);
    expect(isQuantityMethod("MODEL")).toBe(false);
  });

  it("คืนรายการที่ตรงกับคีย์", () => {
    expect(quantityMethodKind("region_trace").key).toBe("region_trace");
  });
});

describe("parseMethodContext อ่านค่าที่ออกจาก jsonb", () => {
  it("คืน null เมื่อไม่ใช่วัตถุ", () => {
    expect(parseMethodContext(null)).toBeNull();
    expect(parseMethodContext(undefined)).toBeNull();
    expect(parseMethodContext("touch")).toBeNull();
    expect(parseMethodContext(1)).toBeNull();
  });

  it("คืน null เมื่อเลขรุ่นไม่ใช่ 1", () => {
    expect(parseMethodContext({ version: 2, pointerType: "pen" })).toBeNull();
    expect(parseMethodContext({ pointerType: "pen" })).toBeNull();
  });

  it("อ่านชนิดอุปกรณ์ที่รู้จักได้", () => {
    expect(parseMethodContext({ version: 1, pointerType: "pen" })).toEqual({
      version: 1,
      pointerType: "pen"
    });
  });

  it("คืน null เมื่อชนิดอุปกรณ์ไม่อยู่ในรายการ แทนที่จะเงียบแล้วทิ้งค่า", () => {
    expect(parseMethodContext({ version: 1, pointerType: "stylus" })).toBeNull();
  });

  it("อ่านรหัสสเกลที่ใช้แปลงหน่วยได้ และปฏิเสธค่าว่าง", () => {
    expect(parseMethodContext({ version: 1, calibrationId: "cal_1" })).toEqual({
      version: 1,
      calibrationId: "cal_1"
    });
    expect(parseMethodContext({ version: 1, calibrationId: "" })).toBeNull();
  });

  it("วัตถุที่มีแค่เลขรุ่นก็ถูกต้อง เพราะทุกช่องเป็นช่องเสริม", () => {
    expect(parseMethodContext({ version: 1 })).toEqual({ version: 1 });
  });

  it("ไม่ยกช่องที่ไม่รู้จักติดมาด้วย", () => {
    const parsed = parseMethodContext({ version: 1, confidence: 0.9 });
    expect(parsed).toEqual({ version: 1 });
  });
});
