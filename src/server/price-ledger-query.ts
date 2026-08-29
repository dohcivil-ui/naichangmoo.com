import "server-only";
import { LEDGER_WINDOW_MONTHS, ledgerMonths, peekLedger, readMaster, readSnapshot, type LedgerRow, type LedgerSnapshot, type TpsoPeriod } from "@/server/tpso-prices";
import { readStoredLedger, readStoredPeriod, readStoredVersion, storeLedger, type StoredLedger } from "@/server/price-archive";
import { anchorSeries } from "@/lib/price-catalogue";
import fallbackCatalogue from "@/data/tpso/cmip-sample-2569-07.json";

/**
 * ชั้นตอบคำถามของแผงบัญชีราคา
 *
 * แยกจาก `tpso-prices.ts` เพราะโมดูลนั้นรู้จักแต่ สนค. ส่วนโมดูลนี้รู้ว่าหน้าจอถามอะไร
 * คือ ค้นหา กรองหมวด แบ่งหน้า และต้องมีอะไรตอบกลับเสมอแม้ต้นทางล่ม
 *
 * ตั้งแต่ IP-162 โมดูลนี้เป็นที่เดียวที่รู้ลำดับความเชื่อของสี่ที่มา ดูเหตุผลเต็มใน ADR 0022
 */

/**
 * หมวดหนึ่งหมวดพร้อมสิ่งที่ควรรู้ก่อนเข้าไป
 *
 * ไม่ใช่แค่จำนวนรายการ เพราะจำนวนอย่างเดียวไม่ได้บอกว่าหมวดนี้เดือนนี้มีอะไรเกิดขึ้น
 * สามตัวเลขที่ตามมาคือจำนวนรายการที่ราคาขึ้น ลง และเท่าเดิม เทียบกับจุดที่มีข้อมูลก่อนหน้า
 * ซึ่งเป็นคำถามแรกของคนประมาณราคาเสมอ คือหมวดที่ผมต้องใช้ ขยับไปทางไหนแล้วบ้าง
 */
export type LedgerFacet = { cat: string; catName: string; count: number; rise: number; fall: number; flat: number };

/**
 * ที่มาของคำตอบหนึ่งชุด — สามค่า ไม่ใช่ธงจริงเท็จ
 *
 * ก่อน IP-162 มีแค่สองที่มาจึงใช้ธงพอ พอคลังราคาเข้ามาเป็นที่มาที่สาม ธงจริงเท็จเริ่มโกหก
 * เพราะ "ไม่ใช่ไฟล์ตัวอย่าง" ไม่ได้แปลว่า "สดจากต้นทาง" อีกต่อไป
 *
 * - `live` ดึงจาก สนค. ในคำขอนี้เอง
 * - `stored` มาจากคลังของเรา ซึ่งเคยดึงมาจาก สนค. และรุ่นยังตรงกัน
 * - `sample` ไฟล์ตัวอย่างในรีโป ใช้เมื่อไม่เหลืออะไรแล้ว
 */
export type LedgerOrigin = "live" | "stored" | "sample";

export type LedgerAnswer = {
  province: string;
  period: TpsoPeriod;
  months: string[];
  lastUpdated: string;
  fetchedAt: string;
  origin: LedgerOrigin;
  /** เหตุผลที่ไม่ได้ของสด มีเมื่อที่มาไม่ใช่ `live` เท่านั้น หน้าจอมีหน้าที่พูดออกไป ไม่ใช่กลบ */
  originNote?: string;
  /** เวลาที่คำตอบชุดนี้ถูกเก็บลงคลัง มีเมื่อที่มาเป็น `stored` */
  storedAt?: string;
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
 * ทุกคำตอบที่มาจากไฟล์นี้ติดที่มา `sample` กลับไปเสมอ และหน้าจอมีหน้าที่พูดออกไป
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

    const anchor = anchorSeries(series);
    if (!anchor) continue;
    const { latest, previous } = anchor;

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
      previousPrice: previous === null ? null : (series[previous] as number),
      previousMonth: previous === null ? null : window[previous],
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

const why = (error: unknown, fallbackMessage: string) => (error instanceof Error ? error.message : fallbackMessage);

/**
 * คำตอบหนึ่งชุดของแผงบัญชีราคา ผ่านลำดับความเชื่อสี่ที่มา ห้าขั้น (ADR 0022)
 *
 * **ทำไมถาม `master` ก่อนเสมอ** เพราะคำถามที่ต้องตอบให้ได้ก่อนตัดสินใจคือ "สำเนาที่เรามี
 * ยังตรงกับต้นทางไหม" ซึ่งตอบจากสำเนาของตัวเองไม่ได้ `master` เป็นคำขอเล็กที่ตอบคำถามนั้น
 * โดยไม่ต้องลากก้อนสามเมกะไบต์ลงมา ถ้ารุ่นตรงกัน คำขอใหญ่ก็ไม่ต้องเกิดขึ้นเลย
 *
 * **ทำไมคลังมาก่อนต้นทาง** เพราะโจทย์ของ IP-162 คือรีสตาร์ตแล้วต้องไม่ช้าเหมือนเดิม
 * ถ้าให้คลังเป็นแค่ตาข่ายรับตอนต้นทางล่ม ผู้ใช้คนแรกหลังรีสตาร์ตก็ยังรอสิบสองวินาทีอยู่ดี
 */
export async function answerLedger(request: LedgerQuery): Promise<LedgerAnswer> {
  const province = request.province || "10";
  const asked = request.year && request.month ? { year: request.year, month: request.month } : undefined;

  const master = await readMaster().catch(() => null);
  const target = asked ?? master?.period.end ?? null;

  // ชั้นหนึ่ง ของร้อนในหน่วยความจำ — เร็วกว่าอ่านสามหมื่นแปดพันแถวจากคลังแล้วประกอบใหม่หลายเท่า
  // ของในแคชนี้มาจาก สนค. โดยตรงในชั่วโมงนี้ จึงยังเป็น live ตามความหมายเดิมก่อนรุ่นนี้ ไม่ใช่สำเนา
  if (master && target) {
    const hot = peekLedger(province, target);
    if (hot) {
      return shape(
        {
          province,
          period: target,
          months: ledgerMonths(target),
          lastUpdated: master.lastUpdated,
          rows: hot.rows,
          version: master.lastUpdated,
          payloadHash: hot.payloadHash,
          fetchedAt: new Date().toISOString()
        },
        request,
        "live"
      );
    }
  }

  // ชั้นสอง คลังของเรา — เข้าทางนี้เฉพาะเมื่อรู้รุ่นล่าสุดของต้นทางและรุ่นในคลังตรงกันเท่านั้น
  if (master && target) {
    const known = await readStoredVersion(province, target);
    if (known && known.version === master.lastUpdated) {
      const stored = await readStoredLedger(province, ledgerMonths(target));
      if (stored) return shapeStored(stored, province, target, master.lastUpdated, request);
    }
  }

  // ชั้นสาม ต้นทาง — ได้มาแล้วเก็บลงคลังทันที โดยไม่ให้ผู้ใช้รอการเก็บ
  try {
    const snapshot = await readSnapshot(province, asked);
    void storeLedger({
      province,
      period: snapshot.period,
      months: snapshot.months,
      version: snapshot.version,
      payloadHash: snapshot.payloadHash,
      rows: snapshot.rows
    });
    return shape(snapshot, request, "live");
  } catch (error) {
    // ชั้นสี่ คลังเท่าที่มี — ของจริงที่เคยดึงมาได้ ยังดีกว่าไฟล์ตัวอย่างชุดเดียวในรีโปเสมอ
    const period = target ?? (await readStoredPeriod(province));
    if (period) {
      const stored = await readStoredLedger(province, ledgerMonths(period));
      if (stored) {
        const note = master
          ? `ต้นทางไม่ตอบ ใช้สำเนาที่เก็บไว้ (${why(error, "ไม่ทราบสาเหตุ")})`
          : `ต้นทางไม่ตอบ ใช้สำเนาที่เก็บไว้ และตรวจไม่ได้ว่ามีรุ่นใหม่กว่านี้แล้วหรือยัง (${why(error, "ไม่ทราบสาเหตุ")})`;
        return shapeStored(stored, province, period, stored.version, request, note);
      }
    }

    // ชั้นห้า ไฟล์ตัวอย่างในรีโป
    const fallback = fallbackRows(province);
    const snapshot: LedgerSnapshot = {
      province,
      period: fallback.period,
      months: fallback.months,
      lastUpdated: fallback.lastUpdated,
      rows: fallback.rows,
      version: fallback.lastUpdated,
      payloadHash: "",
      fetchedAt: new Date().toISOString()
    };
    return shape(snapshot, request, "sample", why(error, "ต้นทางไม่ตอบ"));
  }
}

/** คลังราคาแปลงร่างเป็นสแนปช็อตหน้าตาเดียวกับของต้นทาง ชั้นล่างจากนี้ไปจึงแยกไม่ออกว่ามาจากไหน */
function shapeStored(
  stored: StoredLedger,
  province: string,
  period: TpsoPeriod,
  lastUpdated: string,
  request: LedgerQuery,
  note?: string
): LedgerAnswer {
  const snapshot: LedgerSnapshot = {
    province,
    period,
    months: stored.months,
    lastUpdated,
    rows: stored.rows,
    version: stored.version,
    payloadHash: "",
    fetchedAt: new Date().toISOString()
  };
  return shape(snapshot, request, "stored", note, stored.storedAt);
}

function shape(snapshot: LedgerSnapshot, request: LedgerQuery, origin: LedgerOrigin, originNote?: string, storedAt?: string): LedgerAnswer {
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
    origin,
    originNote,
    storedAt,
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
