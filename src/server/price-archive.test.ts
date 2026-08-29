import { describe, expect, it } from "vitest";
import { assemble, type StoredReading } from "@/server/price-archive";
import { anchorSeries } from "@/lib/price-catalogue";

/**
 * เทสต์ของคลังราคา (IP-162)
 *
 * ที่นี่ตรวจส่วนที่ผิดแล้วไม่มีใครเห็น คือการประกอบเส้นราคากลับจากแถวในฐานข้อมูล
 * ส่วนการต่อฐานข้อมูลไม่ได้อยู่ในไฟล์นี้ เพราะมันผิดแล้วเห็นทันที และมีเทสต์ที่แตะของจริงคุมอยู่
 * ที่ `price-archive.integration.test.ts` ซึ่งเปิดด้วยธงต่างหาก
 *
 * ตัวเลขที่ใช้ในไฟล์นี้ไม่ใช่ตัวเลขสมมติเปล่า ๆ แต่เป็นรูปร่างที่วัดได้จากของจริง คือรายการหนึ่ง
 * มีเดือนว่างคั่นกลางได้ และเดือนล่าสุดของแต่ละรายการไม่เท่ากัน
 */

const MONTHS = ["2569-02", "2569-03", "2569-04", "2569-05", "2569-06", "2569-07"];

function reading(overrides: Partial<StoredReading> & { code: string; month: string; price: string }): StoredReading {
  return {
    priceVat: null,
    version: "2026-08-20T09:00:00.000Z",
    storedAt: new Date("2026-08-28T02:00:00.000Z"),
    name: "ทรายหยาบ",
    unit: "ลบ.ม.",
    cat: "01",
    catName: "วัสดุก่อสร้าง",
    ...overrides
  };
}

describe("anchorSeries — จุดยึดของเส้นราคา", () => {
  it("จุดล่าสุดคือจุดที่มีค่าจริง ไม่ใช่ช่องสุดท้ายของเส้น", () => {
    expect(anchorSeries([100, 110, null, null])).toEqual({ latest: 1, previous: 0 });
  });

  it("จุดก่อนหน้าข้ามเดือนว่าง ไม่ใช่เดือนติดกันตามปฏิทิน", () => {
    expect(anchorSeries([100, null, null, 130])).toEqual({ latest: 3, previous: 0 });
  });

  it("มีค่าจุดเดียวแปลว่าเทียบการขยับไม่ได้ ไม่ใช่ขยับเป็นศูนย์", () => {
    expect(anchorSeries([null, null, 130])).toEqual({ latest: 2, previous: null });
  });

  it("เส้นที่ไม่มีค่าเลยคืน null เพื่อให้ผู้เรียกตัดรายการนั้นทิ้ง ไม่ใช่แสดงราคาศูนย์", () => {
    expect(anchorSeries([null, null, null])).toBeNull();
    expect(anchorSeries([])).toBeNull();
  });

  it("ศูนย์เป็นราคาที่มีอยู่จริง ไม่ใช่ช่องว่าง", () => {
    expect(anchorSeries([null, 0])).toEqual({ latest: 1, previous: null });
  });
});

describe("assemble — ประกอบตารางกลับจากคลัง", () => {
  it("วางราคาลงตรงช่องเดือนของมัน และปล่อยเดือนที่ไม่มีของไว้เป็นช่องว่าง", () => {
    const ledger = assemble(
      [
        reading({ code: "0101", month: "2569-03", price: "410.0000" }),
        reading({ code: "0101", month: "2569-07", price: "455.5000", priceVat: "487.3900" })
      ],
      MONTHS
    );

    expect(ledger).not.toBeNull();
    const row = ledger!.rows[0];
    expect(row.series).toEqual([null, 410, null, null, null, 455.5]);
    expect(row.price).toBe(455.5);
    expect(row.month).toBe("2569-07");
    expect(row.previousPrice).toBe(410);
    expect(row.previousMonth).toBe("2569-03");
  });

  it("ราคารวมภาษีใช้ค่าที่ต้นทางส่งมา ไม่ใช่ค่าที่เราคูณเอง", () => {
    const ledger = assemble([reading({ code: "0101", month: "2569-07", price: "455.5000", priceVat: "487.3900" })], MONTHS);
    // 455.50 x 1.07 ได้ 487.385 ซึ่งไม่เท่ากับที่ต้นทางส่งมา ค่าที่ตอบออกไปต้องเป็นของต้นทาง
    expect(ledger!.rows[0].priceVat).toBe(487.39);
  });

  it("รายการที่ต้นทางไม่เคยส่งราคารวมภาษีมา ยอมคำนวณให้ ไม่ใช่ปล่อยว่างบนจอ", () => {
    const ledger = assemble([reading({ code: "0101", month: "2569-07", price: "100.0000" })], MONTHS);
    expect(ledger!.rows[0].priceVat).toBe(107);
  });

  it("แถวที่อยู่นอกหน้าต่างเดือนถูกทิ้ง ไม่ใช่ลากเข้ามาให้เส้นยาวผิด", () => {
    const ledger = assemble(
      [
        reading({ code: "0101", month: "2568-11", price: "300.0000" }),
        reading({ code: "0101", month: "2569-07", price: "455.5000" })
      ],
      MONTHS
    );
    expect(ledger!.rows[0].series).toEqual([null, null, null, null, null, 455.5]);
    expect(ledger!.rows[0].previousPrice).toBeNull();
  });

  it("เรียงตามชื่อไทย ไม่ใช่ตามลำดับที่ฐานข้อมูลคืนมา", () => {
    const ledger = assemble(
      [
        reading({ code: "0102", month: "2569-07", price: "10.0000", name: "หินคลุก" }),
        reading({ code: "0101", month: "2569-07", price: "20.0000", name: "ทรายหยาบ" })
      ],
      MONTHS
    );
    expect(ledger!.rows.map((row) => row.name)).toEqual(["ทรายหยาบ", "หินคลุก"]);
  });

  it("รุ่นที่รายงานออกไปคือรุ่นของแถวที่เขียนล่าสุด ไม่ใช่แถวแรกที่บังเอิญเจอ", () => {
    const ledger = assemble(
      [
        reading({ code: "0101", month: "2569-06", price: "400.0000", version: "เก่า", storedAt: new Date("2026-08-01T00:00:00.000Z") }),
        reading({ code: "0101", month: "2569-07", price: "455.5000", version: "ใหม่", storedAt: new Date("2026-08-28T00:00:00.000Z") })
      ],
      MONTHS
    );
    expect(ledger!.version).toBe("ใหม่");
    expect(ledger!.storedAt).toBe("2026-08-28T00:00:00.000Z");
  });

  it("ไม่มีแถวไหนเหลือรอดเลย ถือว่าคลังตอบไม่ได้ ไม่ใช่ตอบตารางเปล่า", () => {
    expect(assemble([], MONTHS)).toBeNull();
    expect(assemble([reading({ code: "0101", month: "2560-01", price: "1.0000" })], MONTHS)).toBeNull();
  });
});
