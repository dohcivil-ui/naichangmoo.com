import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { and, eq, like } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { readStoredLedger, readStoredPeriod, readStoredVersion, storeLedger, TPSO_SOURCE_ID } from "@/server/price-archive";
import type { LedgerRow } from "@/server/tpso-prices";

/** ตัวอ่าน .env อย่างย่อ ให้ไฟล์นี้ไปถึงฐานข้อมูลในเครื่องได้โดยไม่ต้องพึ่งของตอนรัน */
function loadLocalEnv() {
  const file = path.join(process.cwd(), ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (process.env[key] !== undefined) continue;
    process.env[key] = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
  }
}

/**
 * เทสต์ที่แตะฐานข้อมูลจริงของคลังราคา (IP-162)
 *
 * เปิดด้วยธงเสมอ เพราะมันเขียนลงฐานข้อมูลที่ DATABASE_URL ชี้อยู่ ให้รันกับฐานข้อมูลในเครื่องเท่านั้น
 *   $env:PRICE_ARCHIVE_DB_TESTS=1 ; pnpm vitest run src/server/price-archive.integration.test.ts
 *
 * ทุกแถวที่ไฟล์นี้สร้างใช้จังหวัดสมมติและรหัสสินค้าที่ขึ้นต้นด้วย TEST- แล้วลบตัวเองทิ้งท้ายเทสต์
 * แถวแหล่ง สนค. ไม่ถูกลบ เพราะเป็นข้อมูลอ้างอิงจริงที่ระบบต้องมีอยู่แล้ว ไม่ใช่ขยะของเทสต์
 */
const enabled = process.env.PRICE_ARCHIVE_DB_TESTS === "1";

const PROVINCE = "test-zz";
const MONTHS = ["2569-02", "2569-03", "2569-04", "2569-05", "2569-06", "2569-07"];
const PERIOD = { year: 2569, month: 7 };

function row(overrides: Partial<LedgerRow> & { code: string; series: (number | null)[] }): LedgerRow {
  const latest = overrides.series.reduce<number>((found, value, index) => (value === null ? found : index), -1);
  return {
    name: "ทรายหยาบทดสอบ",
    unit: "ลบ.ม.",
    cat: "01",
    catName: "วัสดุก่อสร้างทดสอบ",
    price: overrides.series[latest] as number,
    priceVat: Math.round((overrides.series[latest] as number) * 107) / 100,
    month: MONTHS[latest],
    previousPrice: null,
    previousMonth: null,
    ...overrides
  };
}

describe.skipIf(!enabled)("คลังราคาบน PostgreSQL จริง", () => {
  loadLocalEnv();

  afterAll(async () => {
    if (!enabled) return;
    const { getDb } = await import("@/db");
    const { priceCatalogueItems, priceObservations } = await import("@/db/schema");
    const db = getDb();
    await db.delete(priceObservations).where(and(eq(priceObservations.sourceId, TPSO_SOURCE_ID), eq(priceObservations.provinceCode, PROVINCE)));
    await db.delete(priceCatalogueItems).where(and(eq(priceCatalogueItems.sourceId, TPSO_SOURCE_ID), like(priceCatalogueItems.catalogCode, "TEST-%")));
  });

  it("เก็บแล้วอ่านกลับได้เป็นตารางเดิม รวมทั้งเดือนที่ว่างและราคารวมภาษีของต้นทาง", async () => {
    await storeLedger({
      province: PROVINCE,
      period: PERIOD,
      months: MONTHS,
      version: "2026-08-20T09:00:00.000Z",
      payloadHash: "hash-รอบแรก",
      rows: [
        row({ code: "TEST-0001", series: [null, 410, null, null, null, 455.5], priceVat: 487.39, month: "2569-07", previousPrice: 410, previousMonth: "2569-03" })
      ]
    });

    const stored = await readStoredLedger(PROVINCE, MONTHS);
    expect(stored).not.toBeNull();
    expect(stored!.rows).toHaveLength(1);

    const read = stored!.rows[0];
    expect(read.series).toEqual([null, 410, null, null, null, 455.5]);
    expect(read.price).toBe(455.5);
    expect(read.priceVat).toBe(487.39);
    expect(read.previousPrice).toBe(410);
    expect(read.previousMonth).toBe("2569-03");
    expect(read.name).toBe("ทรายหยาบทดสอบ");
    expect(stored!.version).toBe("2026-08-20T09:00:00.000Z");
  });

  it("รุ่นที่เก็บไว้ตอบได้โดยไม่ต้องอ่านราคาทั้งชุด", async () => {
    const known = await readStoredVersion(PROVINCE, PERIOD);
    expect(known?.version).toBe("2026-08-20T09:00:00.000Z");
  });

  it("เดือนล่าสุดที่คลังรู้จัก ตอบได้แม้ต้นทางเงียบ", async () => {
    expect(await readStoredPeriod(PROVINCE)).toEqual(PERIOD);
  });

  it("เก็บซ้ำด้วยรุ่นใหม่คือทับของเดิม ไม่ใช่งอกแถวใหม่ซ้อน", async () => {
    await storeLedger({
      province: PROVINCE,
      period: PERIOD,
      months: MONTHS,
      version: "2026-09-20T09:00:00.000Z",
      payloadHash: "hash-รอบสอง",
      rows: [row({ code: "TEST-0001", series: [null, 410, null, null, null, 470], priceVat: 502.9, month: "2569-07", previousPrice: 410, previousMonth: "2569-03" })]
    });

    const stored = await readStoredLedger(PROVINCE, MONTHS);
    expect(stored!.rows).toHaveLength(1);
    expect(stored!.rows[0].price).toBe(470);
    expect(stored!.version).toBe("2026-09-20T09:00:00.000Z");
  });

  it("ชื่อที่ต้นทางแก้ ตามมาถึงสารบัญด้วย ไม่ใช่ค้างชื่อเดิมตลอดไป", async () => {
    await storeLedger({
      province: PROVINCE,
      period: PERIOD,
      months: MONTHS,
      version: "2026-09-20T09:00:00.000Z",
      payloadHash: "hash-รอบสาม",
      rows: [row({ code: "TEST-0001", series: [null, null, null, null, null, 470], name: "ทรายหยาบทดสอบ ชื่อใหม่" })]
    });

    const stored = await readStoredLedger(PROVINCE, MONTHS);
    expect(stored!.rows[0].name).toBe("ทรายหยาบทดสอบ ชื่อใหม่");
  });

  it("จังหวัดที่ไม่เคยเก็บ ตอบ null ไม่ใช่ตารางเปล่า", async () => {
    expect(await readStoredLedger("test-ไม่มีจริง", MONTHS)).toBeNull();
    expect(await readStoredVersion("test-ไม่มีจริง", PERIOD)).toBeNull();
  });
});
