import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { priceCatalogueItems, priceObservations, priceSources } from "@/db/schema";
import { anchorSeries } from "@/lib/price-catalogue";
import type { LedgerRow, TpsoPeriod } from "@/server/tpso-prices";

/**
 * คลังราคา — สำเนาถาวรของราคาที่เราเคยดึงมาได้ (IP-162, ADR 0022)
 *
 * ก่อนหน้านี้ราคาอยู่ในหน่วยความจำของเซิร์ฟเวอร์อย่างเดียว รีสตาร์ตแล้วหายเกลี้ยง
 * ผู้ใช้คนแรกหลังรีสตาร์ตต้องรอต้นทางตอบก้อนสามเมกะไบต์ ซึ่งวัดจริงได้ถึงสิบสองวินาที
 *
 * สามข้อที่กำหนดรูปร่างของโมดูลนี้
 *
 * 1. **ห้ามโยน error ออกไปเด็ดขาด** หน้าราคาวันนี้ทำงานได้โดยไม่ต้องมีฐานข้อมูลเลย
 *    ถ้าคลังพังแล้วลากหน้าจอพังตาม เท่ากับรุ่นนี้ทำให้ของที่เคยดีแย่ลง ทุกทางออกจึงเป็น
 *    null หรือเงียบ แล้วปล่อยให้ชั้นบนไหลลงไปหาต้นทางหรือไฟล์ตัวอย่างต่อ
 * 2. **ชื่อของอยู่คนละตารางกับราคาของ** หนึ่งรหัสสินค้ามีชื่อเดียว แต่มีราคาหลายเดือน
 *    ถ้าเก็บชื่อซ้ำทุกเดือน วันหนึ่งชื่อเดียวกันจะไม่ตรงกันเองระหว่างเดือน
 * 3. **ราคารวมภาษีเก็บเท่าที่ต้นทางส่งมา** ต้นทางส่งมาเฉพาะจุดล่าสุดของแต่ละรายการ
 *    เดือนก่อนหน้าจึงว่างไว้อย่างตั้งใจ ห้ามคูณ 1.07 เติมลงไปเอง เพราะการปัดเศษเป็นของเขา
 */

/** รหัสแหล่งของ สนค. คงที่ ไม่สุ่ม เพื่อให้แถวเดิมถูก upsert ทับ ไม่ใช่งอกใหม่ทุกรอบ */
export const TPSO_SOURCE_ID = "src_tpso_cmip";

export type StoredLedger = {
  rows: LedgerRow[];
  months: string[];
  version: string;
  /** เวลาที่แถวชุดนี้ถูกเขียนลงคลังครั้งล่าสุด ไม่ใช่เวลาที่ต้นทางประกาศ */
  storedAt: string;
};

export type StoredVersion = { version: string; storedAt: string };

export type StoreLedgerInput = {
  province: string;
  period: TpsoPeriod;
  months: string[];
  version: string;
  payloadHash: string;
  rows: LedgerRow[];
};

const monthKey = (period: TpsoPeriod) => `${period.year}-${String(period.month).padStart(2, "0")}`;

/** จำนวนแถวต่อคำสั่งเขียนหนึ่งครั้ง หนึ่งจังหวัดหนึ่งรอบมีได้ถึงสามหมื่นแปดพันแถว */
const WRITE_CHUNK = 1000;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * รายงานความล้มเหลวหนึ่งบรรทัด ไม่ปล่อยให้เงียบสนิทและไม่ปล่อยให้ลาม
 *
 * เงียบสนิทแปลว่าวันที่คลังหยุดทำงาน จะไม่มีใครรู้จนกว่าจะมีคนสังเกตว่าหน้าช้าลง
 */
function report(what: string, error: unknown) {
  console.error(`[price-archive] ${what}:`, error instanceof Error ? error.message : error);
}

/**
 * ที่เก็บไว้เป็นรุ่นไหน เก็บเมื่อไร — คำถามเบาที่ถามก่อนตัดสินใจว่าจะยิงก้อนใหญ่ไหม
 *
 * ถามที่เดือนปลายของหน้าต่าง เพราะถ้าคลังมีหน้าต่างนั้นครบ เดือนปลายย่อมมีแถวอยู่
 * (วัดจากของจริง เดือนล่าสุดมีราคา 5,511 จาก 6,662 รายการ ไม่ใช่ศูนย์)
 */
export async function readStoredVersion(province: string, period: TpsoPeriod): Promise<StoredVersion | null> {
  try {
    const rows = await getDb()
      .select({ version: priceObservations.sourceVersion, storedAt: priceObservations.updatedAt })
      .from(priceObservations)
      .where(
        and(
          eq(priceObservations.sourceId, TPSO_SOURCE_ID),
          eq(priceObservations.provinceCode, province),
          eq(priceObservations.effectiveMonth, monthKey(period))
        )
      )
      .limit(1);

    const first = rows[0];
    return first ? { version: first.version, storedAt: first.storedAt.toISOString() } : null;
  } catch (error) {
    report(`อ่านรุ่นของจังหวัด ${province} ไม่ได้`, error);
    return null;
  }
}

/**
 * เดือนล่าสุดที่คลังมีของจังหวัดนี้
 *
 * ใช้ตอนที่ต้นทางเงียบสนิทจนเราไม่รู้ด้วยซ้ำว่าเดือนล่าสุดของโลกคือเดือนไหน
 * คลังตอบได้ว่าเดือนล่าสุด "ที่เรารู้จัก" คือเดือนไหน ซึ่งดีกว่าไม่ตอบอะไรเลย
 */
export async function readStoredPeriod(province: string): Promise<TpsoPeriod | null> {
  try {
    const rows = await getDb()
      .select({ month: sql<string>`max(${priceObservations.effectiveMonth})` })
      .from(priceObservations)
      .where(and(eq(priceObservations.sourceId, TPSO_SOURCE_ID), eq(priceObservations.provinceCode, province)));

    const month = rows[0]?.month;
    if (!month) return null;
    const [year, index] = month.split("-").map(Number);
    return Number.isFinite(year) && Number.isFinite(index) ? { year, month: index } : null;
  } catch (error) {
    report(`อ่านเดือนล่าสุดของจังหวัด ${province} จากคลังไม่ได้`, error);
    return null;
  }
}

/**
 * ประกอบตารางราคากลับจากคลัง
 *
 * ผลที่ได้ต้องเป็น `LedgerRow[]` ที่แยกไม่ออกจากของที่มาจากต้นทางสด ๆ เพราะชั้นบนกับหน้าจอ
 * ใช้ตัวเดียวกัน ความต่างมีอยู่ที่เดียวคือป้ายบอกที่มา ซึ่งเป็นหน้าที่ของชั้นบนไม่ใช่ที่นี่
 */
export async function readStoredLedger(province: string, months: string[]): Promise<StoredLedger | null> {
  if (months.length === 0) return null;

  try {
    const rows = await getDb()
      .select({
        code: priceObservations.catalogCode,
        month: priceObservations.effectiveMonth,
        price: priceObservations.priceExcludingVat,
        priceVat: priceObservations.priceIncludingVat,
        version: priceObservations.sourceVersion,
        storedAt: priceObservations.updatedAt,
        name: priceCatalogueItems.name,
        unit: priceCatalogueItems.unit,
        cat: priceCatalogueItems.categoryCode,
        catName: priceCatalogueItems.categoryName
      })
      .from(priceObservations)
      .innerJoin(
        priceCatalogueItems,
        and(eq(priceCatalogueItems.sourceId, priceObservations.sourceId), eq(priceCatalogueItems.catalogCode, priceObservations.catalogCode))
      )
      .where(
        and(
          eq(priceObservations.sourceId, TPSO_SOURCE_ID),
          eq(priceObservations.provinceCode, province),
          inArray(priceObservations.effectiveMonth, months)
        )
      );

    if (rows.length === 0) return null;
    return assemble(rows, months);
  } catch (error) {
    report(`อ่านราคาของจังหวัด ${province} จากคลังไม่ได้`, error);
    return null;
  }
}

/** รูปของแถวดิบที่อ่านออกมาได้ แยกชนิดไว้เพื่อให้เทสต์ประกอบตารางได้โดยไม่ต้องมีฐานข้อมูล */
export type StoredReading = {
  code: string;
  month: string;
  price: string;
  priceVat: string | null;
  version: string;
  storedAt: Date;
  name: string;
  unit: string;
  cat: string;
  catName: string;
};

/**
 * แถวดิบจากฐานข้อมูล ประกอบเป็นตารางที่หน้าจออ่านได้
 *
 * แยกออกมาเป็นฟังก์ชันบริสุทธิ์ เพราะนี่คือส่วนที่ผิดได้จริงและควรมีเทสต์คุม
 * ส่วนการต่อฐานข้อมูลเป็นงานที่ผิดแล้วเห็นทันที
 */
export function assemble(readings: StoredReading[], months: string[]): StoredLedger | null {
  const byCode = new Map<string, StoredReading[]>();
  for (const reading of readings) {
    const bucket = byCode.get(reading.code);
    if (bucket) bucket.push(reading);
    else byCode.set(reading.code, [reading]);
  }

  let version = "";
  let storedAt = 0;
  const rows: LedgerRow[] = [];

  for (const [code, group] of byCode) {
    const series: (number | null)[] = months.map(() => null);
    const vat: (number | null)[] = months.map(() => null);
    for (const reading of group) {
      const index = months.indexOf(reading.month);
      if (index < 0) continue;
      series[index] = Number(reading.price);
      vat[index] = reading.priceVat === null ? null : Number(reading.priceVat);
      // รุ่นที่รายงานออกไปคือรุ่นของแถวที่เขียนล่าสุด ไม่ใช่ของแถวแรกที่บังเอิญเจอ
      const at = reading.storedAt.getTime();
      if (at > storedAt) {
        storedAt = at;
        version = reading.version;
      }
    }

    const anchor = anchorSeries(series);
    if (!anchor) continue;
    const { latest, previous } = anchor;
    const head = group[0];

    rows.push({
      code,
      name: head.name,
      unit: head.unit,
      cat: head.cat,
      catName: head.catName,
      price: series[latest] as number,
      priceVat: vat[latest] ?? Math.round((series[latest] as number) * 107) / 100,
      month: months[latest],
      previousPrice: previous === null ? null : (series[previous] as number),
      previousMonth: previous === null ? null : months[previous],
      series
    });
  }

  if (rows.length === 0) return null;
  rows.sort((a, b) => a.name.localeCompare(b.name, "th"));
  return { rows, months, version, storedAt: new Date(storedAt).toISOString() };
}

/**
 * เขียนสิ่งที่เพิ่งดึงมาได้ลงคลัง
 *
 * เรียกแบบไม่ต้องรอ ผู้ใช้ได้คำตอบไปแล้วก่อนบรรทัดนี้จะเริ่มทำงาน และถ้าล้มก็ล้มเงียบ
 * เพราะความล้มเหลวของการเก็บสำเนาไม่ใช่ความล้มเหลวของคำขอที่ผู้ใช้ยิงเข้ามา
 */
export async function storeLedger(input: StoreLedgerInput): Promise<void> {
  if (input.rows.length === 0) return;

  try {
    const db = getDb();
    const now = new Date();

    await db
      .insert(priceSources)
      .values({
        id: TPSO_SOURCE_ID,
        name: "สำนักงานนโยบายและยุทธศาสตร์การค้า กระทรวงพาณิชย์",
        sourceType: "government_index",
        referenceUrl: "https://index.tpso.go.th",
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoNothing();

    const catalogue = input.rows.map((row) => ({
      id: `${TPSO_SOURCE_ID}:${row.code}`,
      sourceId: TPSO_SOURCE_ID,
      catalogCode: row.code,
      name: row.name,
      unit: row.unit,
      categoryCode: row.cat,
      categoryName: row.catName,
      createdAt: now,
      updatedAt: now
    }));

    for (const batch of chunk(catalogue, WRITE_CHUNK)) {
      await db
        .insert(priceCatalogueItems)
        .values(batch)
        .onConflictDoUpdate({
          target: [priceCatalogueItems.sourceId, priceCatalogueItems.catalogCode],
          set: {
            name: sql`excluded.name`,
            unit: sql`excluded.unit`,
            categoryCode: sql`excluded.category_code`,
            categoryName: sql`excluded.category_name`,
            updatedAt: now
          }
        });
    }

    const observations = input.rows.flatMap((row) =>
      input.months.flatMap((month, index) => {
        const value = row.series[index];
        if (value === null || value === undefined) return [];
        return [
          {
            id: `${TPSO_SOURCE_ID}:${input.province}:${row.code}:${month}`,
            sourceId: TPSO_SOURCE_ID,
            catalogCode: row.code,
            provinceCode: input.province,
            effectiveMonth: month,
            priceExcludingVat: value.toFixed(4),
            // ต้นทางส่งราคารวมภาษีมาเฉพาะจุดล่าสุดของแต่ละรายการ เดือนอื่นจึงว่างไว้ตามความจริง
            priceIncludingVat: month === row.month ? row.priceVat.toFixed(4) : null,
            currency: "THB",
            sourceVersion: input.version,
            rawPayloadHash: input.payloadHash,
            createdAt: now,
            updatedAt: now
          }
        ];
      })
    );

    for (const batch of chunk(observations, WRITE_CHUNK)) {
      await db
        .insert(priceObservations)
        .values(batch)
        .onConflictDoUpdate({
          target: [priceObservations.sourceId, priceObservations.catalogCode, priceObservations.provinceCode, priceObservations.effectiveMonth],
          set: {
            priceExcludingVat: sql`excluded.price_excluding_vat`,
            priceIncludingVat: sql`excluded.price_including_vat`,
            sourceVersion: sql`excluded.source_version`,
            rawPayloadHash: sql`excluded.raw_payload_hash`,
            updatedAt: now
          }
        });
    }
  } catch (error) {
    report(`เก็บราคาของจังหวัด ${input.province} ลงคลังไม่ได้`, error);
  }
}
