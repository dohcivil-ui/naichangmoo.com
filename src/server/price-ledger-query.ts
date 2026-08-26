import "server-only";
import { LEDGER_WINDOW_MONTHS, readMaster, readSnapshot, type LedgerRow, type LedgerSnapshot, type TpsoPeriod } from "@/server/tpso-prices";
import fallbackCatalogue from "@/data/tpso/cmip-sample-2569-07.json";

/**
 * ชั้นตอบคำถามของแผงบัญชีราคา
 *
 * แยกจาก `tpso-prices.ts` เพราะโมดูลนั้นรู้จักแต่ สนค. ส่วนโมดูลนี้รู้ว่าหน้าจอถามอะไร
 * คือ ค้นหา กรองหมวด แบ่งหน้า และต้องมีอะไรตอบกลับเสมอแม้ต้นทางล่ม
 */

/**
 * หมวดหนึ่งหมวดพร้อมสิ่งที่ควรรู้ก่อนเข้าไป
 *
 * ไม่ใช่แค่จำนวนรายการ เพราะจำนวนอย่างเดียวไม่ได้บอกว่าหมวดนี้เดือนนี้มีอะไรเกิดขึ้น
 * สามตัวเลขที่ตามมาคือจำนวนรายการที่ราคาขึ้น ลง และเท่าเดิม เทียบกับจุดที่มีข้อมูลก่อนหน้า
 * ซึ่งเป็นคำถามแรกของคนประมาณราคาเสมอ คือหมวดที่ผมต้องใช้ ขยับไปทางไหนแล้วบ้าง
 */
export type LedgerFacet = { cat: string; catName: string; count: number; rise: number; fall: number; flat: number };

export type LedgerAnswer = {
  province: string;
  period: TpsoPeriod;
  months: string[];
  lastUpdated: string;
  fetchedAt: string;
  /** จริงเมื่อคำตอบนี้มาจากไฟล์สำรองในรีโป ไม่ใช่จาก สนค. */
  stale: boolean;
  staleReason?: string;
  total: number;
  matched: number;
  page: number;
  pageSize: number;
  facets: LedgerFacet[];
  rows: LedgerRow[];
};

export const PAGE_SIZE = 40;

/**
 * ไฟล์สำรองในรีโป ใช้เมื่อ สนค. ล่มหรือช้าเกินรอ
 *
 * ยอมให้หน้าจอมีของเก่าที่ติดป้ายว่าเก่า ดีกว่าหน้าว่างที่ไม่บอกอะไรเลย แต่ห้ามเงียบ
 * ทุกคำตอบที่มาจากไฟล์นี้ติดธง stale กลับไปเสมอ และหน้าจอมีหน้าที่พูดออกไป
 */
function fallbackRows(province: string): { rows: LedgerRow[]; period: TpsoPeriod; months: string[]; lastUpdated: string } {
  const data = fallbackCatalogue as unknown as {
    months: string[];
    source: { lastUpdated: string; latestPeriod: string; vatRate: number };
    items: { code: string; name: string; unit: string; cat: string; catName: string; prices: Record<string, (number | null)[]> }[];
  };
  const window = data.months.slice(-LEDGER_WINDOW_MONTHS);
  const offset = data.months.length - window.length;
  const rows: LedgerRow[] = [];

  for (const item of data.items) {
    const full = item.prices[province];
    if (!full) continue;
    const series = full.slice(offset);

    let latest = -1;
    for (let i = series.length - 1; i >= 0; i -= 1) {
      if (series[i] !== null && series[i] !== undefined) {
        latest = i;
        break;
      }
    }
    if (latest < 0) continue;
    let previous = -1;
    for (let i = latest - 1; i >= 0; i -= 1) {
      if (series[i] !== null && series[i] !== undefined) {
        previous = i;
        break;
      }
    }

    const price = series[latest] as number;
    rows.push({
      code: item.code,
      name: item.name,
      unit: item.unit,
      cat: item.cat,
      catName: item.catName,
      price,
      priceVat: Math.round(price * (1 + data.source.vatRate) * 100) / 100,
      month: window[latest],
      previousPrice: previous >= 0 ? (series[previous] as number) : null,
      previousMonth: previous >= 0 ? window[previous] : null,
      series
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name, "th"));
  const [year, month] = data.source.latestPeriod.split("-").map(Number);
  return { rows, period: { year, month }, months: window, lastUpdated: data.source.lastUpdated };
}

function matches(row: LedgerRow, terms: string[]) {
  if (terms.length === 0) return true;
  const haystack = `${row.name} ${row.code} ${row.catName} ${row.unit}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

export function tally(rows: LedgerRow[]): LedgerFacet[] {
  const facets = new Map<string, LedgerFacet>();
  rows.forEach((row) => {
    const entry = facets.get(row.cat) ?? { cat: row.cat, catName: row.catName, count: 0, rise: 0, fall: 0, flat: 0 };
    entry.count += 1;
    if (row.previousPrice === null || row.previousPrice === row.price) entry.flat += 1;
    else if (row.price > row.previousPrice) entry.rise += 1;
    else entry.fall += 1;
    facets.set(row.cat, entry);
  });
  return [...facets.values()].sort((a, b) => a.cat.localeCompare(b.cat));
}

export type LedgerQuery = {
  province?: string;
  year?: number;
  month?: number;
  query?: string;
  cat?: string;
  sort?: "name" | "price-desc" | "price-asc";
  page?: number;
};

export async function answerLedger(request: LedgerQuery): Promise<LedgerAnswer> {
  const province = request.province || "10";
  const period = request.year && request.month ? { year: request.year, month: request.month } : undefined;

  let snapshot: LedgerSnapshot;
  try {
    snapshot = await readSnapshot(province, period);
  } catch (error) {
    const fallback = fallbackRows(province);
    snapshot = {
      province,
      period: fallback.period,
      months: fallback.months,
      lastUpdated: fallback.lastUpdated,
      rows: fallback.rows,
      stale: true,
      fetchedAt: new Date().toISOString()
    };
    return shape(snapshot, request, error instanceof Error ? error.message : "ต้นทางไม่ตอบ");
  }
  return shape(snapshot, request);
}

function shape(snapshot: LedgerSnapshot, request: LedgerQuery, staleReason?: string): LedgerAnswer {
  const terms = (request.query ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const withinCategory = request.cat && request.cat !== "all" ? snapshot.rows.filter((row) => row.cat === request.cat) : snapshot.rows;
  const found = withinCategory.filter((row) => matches(row, terms));

  const sorted = [...found];
  if (request.sort === "price-desc") sorted.sort((a, b) => b.price - a.price);
  if (request.sort === "price-asc") sorted.sort((a, b) => a.price - b.price);

  const page = Math.max(0, request.page ?? 0);
  const start = page * PAGE_SIZE;

  return {
    province: snapshot.province,
    period: snapshot.period,
    months: snapshot.months,
    lastUpdated: snapshot.lastUpdated,
    fetchedAt: snapshot.fetchedAt,
    stale: snapshot.stale,
    staleReason,
    total: snapshot.rows.length,
    matched: sorted.length,
    page,
    pageSize: PAGE_SIZE,
    // หมวดนับจากผลการค้นหา ไม่ใช่จากทั้งจังหวัด ตัวเลขบนชิปจึงตรงกับสิ่งที่จะได้จริงเมื่อกด
    facets: tally(snapshot.rows.filter((row) => matches(row, terms))),
    rows: sorted.slice(start, start + PAGE_SIZE)
  };
}

export async function readProvinces() {
  try {
    const master = await readMaster();
    return { provinces: master.provinces, period: master.period, lastUpdated: master.lastUpdated, live: true };
  } catch {
    const data = fallbackCatalogue as unknown as { provinces: { code: string; name: string }[]; source: { latestPeriod: string; lastUpdated: string } };
    const [year, month] = data.source.latestPeriod.split("-").map(Number);
    return {
      provinces: data.provinces,
      period: { start: { year: 2545, month: 1 }, end: { year, month } },
      lastUpdated: data.source.lastUpdated,
      live: false
    };
  }
}
