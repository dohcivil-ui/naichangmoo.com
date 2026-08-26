import "server-only";

/**
 * เส้นข้อมูลราคาวัสดุก่อสร้างรายจังหวัดของ สนค.
 *
 * ที่มาและข้อจำกัดของ API บันทึกไว้ที่ docs/research/tpso-cmip-api-2026-08-26.md
 * สามข้อที่กำหนดรูปร่างของโมดูลนี้
 *
 * 1. **เพดานอัตราเรียกคือ 40 ครั้งต่อ 10 วินาที ต่อไอพี** ไม่ใช่ต่อผู้ใช้ ถ้าปล่อยให้เบราว์เซอร์
 *    ของผู้ใช้ยิงเอง ผู้ใช้สิบคนก็ทำให้ทั้งเว็บโดนปิดประตู ทุกคำขอจึงออกจากเซิร์ฟเวอร์เราที่เดียว
 * 2. **ราคาหนึ่งเดือนของหนึ่งจังหวัดหนัก 3.3 MB** ส่งลงเบราว์เซอร์ทั้งก้อนไม่ได้ ชั้นนี้จึงเก็บ
 *    สแนปช็อตไว้ในหน่วยความจำแล้วตอบเฉพาะหน้าที่ผู้ใช้ขอ
 * 3. **ต้นทางขยับเดือนละครั้ง** อายุแคชหนึ่งชั่วโมงตามมติเจ้าของงานจึงเหลือเฟือ และรอบที่ไม่เจอ
 *    ของใหม่คือรอบปกติ ไม่ใช่ความผิดพลาด
 */

const BASE = "https://index.tpso.go.th";
const CACHE_TTL_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 45_000;
/** หน้าต่างเวลาของแผงบัญชีราคา เหตุผลของเลขหกอยู่ในหัวข้อของ readLedger */
export const LEDGER_WINDOW_MONTHS = 6;

export type TpsoPeriod = { year: number; month: number };

export type TpsoProvince = { code: string; name: string };

export type TpsoCategory = { code: string; name: string };

export type TpsoMaster = {
  provinces: TpsoProvince[];
  categories: TpsoCategory[];
  /** เดือนแรกและเดือนล่าสุดที่ระบบมีข้อมูล ปีเป็น พ.ศ. มาแต่ต้นทาง ห้ามแปลงซ้ำ */
  period: { start: TpsoPeriod; end: TpsoPeriod };
  lastUpdated: string;
};

export type LedgerRow = {
  code: string;
  name: string;
  unit: string;
  cat: string;
  catName: string;
  /** ราคาก่อนภาษีมูลค่าเพิ่ม หน่วยเป็นบาท ทศนิยมไม่เกินสองตำแหน่งตามที่ต้นทางส่งมา */
  price: number;
  priceVat: number;
  /** เดือนของราคานี้ ไม่ใช่เดือนที่ผู้ใช้เลือก สองอย่างนี้ต่างกันได้และต้องพูดออกไปว่าต่าง */
  month: string;
  previousPrice: number | null;
  previousMonth: string | null;
  /** ราคาตามช่วงเวลาของสแนปช็อต ช่องที่ไม่มีข้อมูลเป็น null และต้องคงเป็น null */
  series: (number | null)[];
};

export type LedgerSnapshot = {
  province: string;
  period: TpsoPeriod;
  /** เดือนทั้งหมดที่สแนปช็อตนี้ครอบคลุม เรียงจากเก่าไปใหม่ ใช้เป็นแกนของเส้นย่อในแถว */
  months: string[];
  lastUpdated: string;
  rows: LedgerRow[];
  /** จริงเมื่อชุดนี้มาจากไฟล์สำรอง ไม่ใช่จาก สนค. — หน้าจอต้องบอกผู้ใช้ ไม่ใช่เงียบ */
  stale: boolean;
  fetchedAt: string;
};

export type PriceHistory = {
  code: string;
  months: string[];
  values: (number | null)[];
};

type CacheEntry<T> = { at: number; value: T };
const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

/**
 * แคชที่กันการยิงซ้ำซ้อน
 *
 * ผู้ใช้สามคนเปิดหน้าพร้อมกันตอนแคชหมดอายุพอดี ต้องได้คำขอออกไปแค่ครั้งเดียว ไม่ใช่สามครั้ง
 * เพราะคำขอหนึ่งครั้งกินเวลาถึงสองวินาทีและกินโควตาของทั้งไอพี
 */
async function cached<T>(key: string, produce: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  const running = inflight.get(key);
  if (running) return running as Promise<T>;

  const promise = produce()
    .then((value) => {
      cache.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

async function postFilter(body: Record<string, unknown>): Promise<TpsoFilterItem[]> {
  const response = await fetch(`${BASE}/api/cmip/filter`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`tpso filter ${response.status}`);
  return (await response.json()) as TpsoFilterItem[];
}

type TpsoFilterItem = {
  commodityCode: string;
  commodityNameTH: string;
  unitName: string | null;
  headCategory: string;
  headCategoryName: string;
  years: { year: number; months: { month: number; priceCur: number | null; priceVAT: number | null }[] }[];
};

export async function readMaster(): Promise<TpsoMaster> {
  return cached("master", async () => {
    const response = await fetch(`${BASE}/api/cmip/master`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    if (!response.ok) throw new Error(`tpso master ${response.status}`);
    const data = (await response.json()) as {
      types: { type: string; typeName: string }[];
      headCategories: { code: string; name: string }[];
      period: { start: TpsoPeriod; end: TpsoPeriod };
      lastUpdated: string;
    };
    return {
      provinces: data.types.map((entry) => ({ code: entry.type, name: entry.typeName })),
      categories: data.headCategories.map((entry) => ({ code: entry.code, name: entry.name })),
      period: data.period,
      lastUpdated: data.lastUpdated
    };
  });
}

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

/** เดือนย้อนหลังไล่จากเดือนปลาย เป็นรายการคีย์เรียงจากเก่าไปใหม่ */
function timelineOf(end: TpsoPeriod, months: number) {
  const startIndex = end.year * 12 + (end.month - 1) - (months - 1);
  const keys: string[] = [];
  for (let i = 0; i < months; i += 1) {
    const cursor = startIndex + i;
    keys.push(monthKey(Math.floor(cursor / 12), (cursor % 12) + 1));
  }
  return { keys, start: { year: Math.floor(startIndex / 12), month: (startIndex % 12) + 1 } };
}

/**
 * ดัชนีราคาของทั้งจังหวัด ใช้เป็นข้อมูลของแผงบัญชีราคา
 *
 * **ทำไมต้องขอย้อนหลังหลายเดือน ไม่ใช่เดือนเดียว** วัดจากของจริงของส่วนกลาง เดือนล่าสุดเดือนเดียว
 * มีราคาแค่ 5,511 จาก 6,662 รายการ ถ้าเอาแค่เดือนเดียว คนที่ค้นคำว่าทรายหยาบจะได้หน้าว่าง
 * ทั้งที่ราคามีอยู่จริงเมื่อสี่เดือนก่อน ซึ่งเป็นคำตอบที่ผิด หน้าต่างหกเดือนครอบคลุม 6,430 รายการ
 * และได้ราคาก่อนหน้าสำหรับคิดการขยับมาในคำขอเดียวกัน ไม่ต้องยิงซ้ำ
 */
export async function readLedger(province: string, period: TpsoPeriod, windowMonths = LEDGER_WINDOW_MONTHS): Promise<LedgerRow[]> {
  return cached(`ledger:${province}:${monthKey(period.year, period.month)}:${windowMonths}`, async () => {
    const { keys, start } = timelineOf(period, windowMonths);
    const items = await postFilter({
      YearBase: 2558,
      Categories: [],
      Search: "",
      Types: [province],
      HeadCategories: [],
      TimeOption: true,
      Period: { StartYear: start.year, StartMonth: start.month, EndYear: period.year, EndMonth: period.month }
    });

    const rows: LedgerRow[] = [];
    for (const item of items) {
      const series: (number | null)[] = keys.map(() => null);
      const vat: (number | null)[] = keys.map(() => null);
      item.years.forEach((year) =>
        year.months.forEach((entry) => {
          const index = keys.indexOf(monthKey(year.year, entry.month));
          if (index < 0) return;
          series[index] = entry.priceCur;
          vat[index] = entry.priceVAT;
        })
      );

      let latest = -1;
      for (let i = series.length - 1; i >= 0; i -= 1) {
        if (series[i] !== null) {
          latest = i;
          break;
        }
      }
      if (latest < 0) continue;

      let previous = -1;
      for (let i = latest - 1; i >= 0; i -= 1) {
        if (series[i] !== null) {
          previous = i;
          break;
        }
      }

      const price = series[latest] as number;
      rows.push({
        code: item.commodityCode,
        name: item.commodityNameTH.replace(/\s+/g, " ").trim(),
        unit: item.unitName?.trim() || "-",
        cat: item.headCategory,
        catName: item.headCategoryName,
        price,
        priceVat: vat[latest] ?? Math.round(price * 107) / 100,
        month: keys[latest],
        previousPrice: previous >= 0 ? (series[previous] as number) : null,
        previousMonth: previous >= 0 ? keys[previous] : null,
        series
      });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name, "th"));
    return rows;
  });
}

/**
 * ประวัติของรายการที่อยู่บนจอ ขอทีเดียวหลายรหัส
 *
 * `Categories` ของ API ตัวนี้รับรหัสสินค้าเป็นชุดได้ ขอสามสิบรายการพร้อมกันย้อนหลังยี่สิบสี่เดือน
 * ใช้เวลาราวสองวินาทีและได้กลับมาไม่กี่สิบกิโลไบต์ จึงถูกกว่าการดึงทั้งหมวดหลายเท่า
 */
export async function readHistory(province: string, codes: string[], end: TpsoPeriod, months = 24): Promise<PriceHistory[]> {
  if (codes.length === 0) return [];
  const { keys: timeline, start } = timelineOf(end, months);

  const key = `history:${province}:${monthKey(end.year, end.month)}:${months}:${[...codes].sort().join(",")}`;
  return cached(key, async () => {
    const items = await postFilter({
      YearBase: 2558,
      Categories: codes,
      Search: "",
      Types: [province],
      HeadCategories: [],
      TimeOption: true,
      Period: { StartYear: start.year, StartMonth: start.month, EndYear: end.year, EndMonth: end.month }
    });
    return items.map((item) => {
      const values: (number | null)[] = timeline.map(() => null);
      item.years.forEach((year) =>
        year.months.forEach((entry) => {
          const index = timeline.indexOf(monthKey(year.year, entry.month));
          if (index >= 0) values[index] = entry.priceCur;
        })
      );
      return { code: item.commodityCode, months: timeline, values };
    });
  });
}

/**
 * สแนปช็อตพร้อมใช้ของจังหวัดหนึ่ง โดยตั้งต้นที่เดือนล่าสุดที่ต้นทางมีจริง
 *
 * ไม่ใช้เดือนตามนาฬิกาเครื่อง เพราะ สนค. ประกาศเดือนหนึ่งช้ากว่าปฏิทินราวหนึ่งเดือนครึ่ง
 * การถามหาเดือนปัจจุบันตามนาฬิกาจึงได้หน้าว่างทุกต้นเดือน ซึ่งดูเหมือนระบบพัง
 */
export async function readSnapshot(province: string, period?: TpsoPeriod): Promise<LedgerSnapshot> {
  const master = await readMaster();
  const target = period ?? master.period.end;
  const rows = await readLedger(province, target);
  return {
    province,
    period: target,
    months: timelineOf(target, LEDGER_WINDOW_MONTHS).keys,
    lastUpdated: master.lastUpdated,
    rows,
    stale: false,
    fetchedAt: new Date().toISOString()
  };
}
