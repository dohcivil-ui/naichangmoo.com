/**
 * ชั้นอ่านราคาวัสดุรายจังหวัดของ สนค.
 *
 * โจทย์ที่ชั้นนี้ต้องแก้มีสามข้อ และทั้งสามข้อมาจากลักษณะของข้อมูลจริง ไม่ใช่จากรสนิยมการออกแบบ
 *
 * 1. **เดือนที่ไม่มีราคาเป็นเรื่องปกติ** ในชุดตัวอย่างที่ดึงมา 85 จาก 144 รายการของส่วนกลาง
 *    มีเดือนที่ว่าง การเติมค่าเดือนก่อนหน้าลงไปแทนจะทำให้กราฟดูสวยขึ้นและผิดขึ้นพร้อมกัน
 *    ที่นี่ค่าที่ไม่มีคือ null เสมอ และผู้เรียกต้องรับมือกับ null
 * 2. **เดือนล่าสุดของแต่ละรายการไม่เท่ากัน** ทรายหยาบของส่วนกลางหยุดที่ 3/2569 ขณะที่
 *    ปูนซีเมนต์บางตัวมีถึง 7/2569 การประกาศ "ราคา ณ เดือน 7/2569" ทั้งหน้าจึงเป็นคำที่ไม่จริง
 *    ทุกฟังก์ชันที่คืนราคาจึงคืนเดือนของราคานั้นติดมาด้วยเสมอ
 * 3. **เงินต้องไม่ลอย** ราคาเก็บเป็นสตางค์จำนวนเต็มเหมือนที่ระบบงวดเงินทำ เพราะราคาต่อหน่วย
 *    จะถูกคูณด้วยปริมาณแล้วบวกกันเป็นค่างานต้นทุน ซึ่งเป็นจุดที่ทศนิยมลอยเริ่มสะสมความคลาดเคลื่อน
 */

import { THAI_MONTH_FULL } from "@/lib/thai-date";
export type MonthKey = string;
export type ProvinceCode = string;

export type CataloguePrices = Record<ProvinceCode, (number | null)[]>;

export type CatalogueItem = {
  code: string;
  name: string;
  unit: string;
  cat: string;
  catName: string;
  prices: CataloguePrices;
};

export type CatalogueProvince = { code: ProvinceCode; name: string };

export type CatalogueSource = {
  publisher: string;
  dataset: string;
  endpoint: string;
  /** เวลาที่ สนค. แก้ไขชุดข้อมูลล่าสุด ไม่ใช่เวลาที่เครื่องเราไปอ่าน */
  lastUpdated: string;
  latestPeriod: MonthKey;
  vatRate: number;
  retrievedAt: string;
  coverage: Record<ProvinceCode, number>;
};

export type PriceCatalogue = {
  source: CatalogueSource;
  months: MonthKey[];
  provinces: CatalogueProvince[];
  items: CatalogueItem[];
};

export type PriceReading = {
  monthIndex: number;
  month: MonthKey;
  satang: bigint;
};

export type PriceMovement = {
  previous: PriceReading;
  current: PriceReading;
  /** บวกคือราคาขยับขึ้น ลบคือขยับลง ศูนย์คือมีสองจุดแล้วเท่ากันพอดี */
  deltaSatang: bigint;
  /** เปอร์เซ็นต์สำหรับแสดงผลเท่านั้น การคิดเงินใช้ deltaSatang */
  percent: number;
  direction: "rise" | "fall" | "flat";
};

const SATANG_PER_BAHT = 100n;

/**
 * ทศนิยมจาก JSON เข้าสู่โลกจำนวนเต็ม
 *
 * ต้นทางส่งมาไม่เกินสองตำแหน่ง (ตรวจแล้วทั้งชุด) จึงคูณร้อยแล้วปัดครึ่งขึ้นได้ตรง ๆ
 * ใช้ Math.round กับผลคูณ ไม่ใช่กับสตริง เพราะ 508.33 * 100 ให้ 50832.999999 ในเลขทศนิยมลอย
 */
export function toSatang(baht: number): bigint {
  return BigInt(Math.round(baht * 100));
}

export function satangToBaht(satang: bigint): number {
  return Number(satang) / 100;
}

/** ราคารวมภาษีมูลค่าเพิ่ม ปัดครึ่งขึ้นที่สตางค์ ให้ตรงกับ priceVAT ที่ สนค. ส่งมาเอง */
export function withVat(satang: bigint, rate: number): bigint {
  return BigInt(Math.round(Number(satang) * (1 + rate)));
}

/**
 * ราคาล่าสุดที่ "มีจริง" โดยไม่เกินเดือนที่ผู้ใช้เลือก
 *
 * ไม่ใช่ราคาของเดือนที่เลือก — ถ้าเดือนที่เลือกว่าง ฟังก์ชันนี้จะถอยหลังไปหาเดือนที่มีค่า
 * แล้วบอกมาว่าเดือนไหน หน้าจอมีหน้าที่พูดความจริงข้อนั้นออกไป ไม่ใช่กลบมัน
 */
export function latestReading(
  catalogue: PriceCatalogue,
  item: CatalogueItem,
  province: ProvinceCode,
  upToIndex: number = catalogue.months.length - 1
): PriceReading | null {
  const series = item.prices[province];
  if (!series) return null;
  const start = Math.min(upToIndex, series.length - 1);
  for (let i = start; i >= 0; i -= 1) {
    const value = series[i];
    if (value === null || value === undefined) continue;
    return { monthIndex: i, month: catalogue.months[i], satang: toSatang(value) };
  }
  return null;
}

/**
 * การขยับของราคา เทียบกับจุดที่มีข้อมูลก่อนหน้าจุดล่าสุด
 *
 * จงใจไม่เทียบกับ "เดือนก่อนหน้า" ตามปฏิทิน เพราะเดือนก่อนหน้าอาจว่าง แล้วผลจะกลายเป็น
 * "ไม่มีการเปลี่ยนแปลง" ทั้งที่ความจริงคือไม่มีข้อมูลให้เทียบ ซึ่งเป็นคนละเรื่องกัน
 */
export function movement(
  catalogue: PriceCatalogue,
  item: CatalogueItem,
  province: ProvinceCode,
  upToIndex: number = catalogue.months.length - 1
): PriceMovement | null {
  const current = latestReading(catalogue, item, province, upToIndex);
  if (!current || current.monthIndex === 0) return null;
  const previous = latestReading(catalogue, item, province, current.monthIndex - 1);
  if (!previous) return null;
  const deltaSatang = current.satang - previous.satang;
  const percent = previous.satang === 0n ? 0 : (Number(deltaSatang) / Number(previous.satang)) * 100;
  return {
    previous,
    current,
    deltaSatang,
    percent,
    direction: deltaSatang > 0n ? "rise" : deltaSatang < 0n ? "fall" : "flat"
  };
}

/** ค่าวัสดุของรายการหนึ่งตามปริมาณที่ระบุ ปริมาณเป็นทศนิยมได้ ผลลัพธ์ปัดที่สตางค์ */
export function lineCost(unitSatang: bigint, quantity: number): bigint {
  return BigInt(Math.round(Number(unitSatang) * quantity));
}

export function sumSatang(values: bigint[]): bigint {
  return values.reduce((total, value) => total + value, 0n);
}

/**
 * ค้นหาแบบที่ผู้ใช้พิมพ์จริง
 *
 * ผู้ใช้พิมพ์ "ทรายหยาบ" หรือรหัสสินค้าบางส่วน คำค้นถูกตัดเป็นคำ ๆ แล้วต้องเจอครบทุกคำ
 * จึงหา "ปูน ช้าง" ได้โดยไม่ต้องรู้ว่าชื่อเต็มเรียงยังไง
 */
export function searchCatalogue(items: CatalogueItem[], query: string): CatalogueItem[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return items;
  return items.filter((item) => {
    const haystack = `${item.name} ${item.code} ${item.catName} ${item.unit}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

export function itemsWithPriceIn(items: CatalogueItem[], province: ProvinceCode): CatalogueItem[] {
  return items.filter((item) => {
    const series = item.prices[province];
    return Boolean(series && series.some((value) => value !== null && value !== undefined));
  });
}

export function categoryTally(items: CatalogueItem[]): { cat: string; catName: string; count: number }[] {
  const tally = new Map<string, { cat: string; catName: string; count: number }>();
  items.forEach((item) => {
    const entry = tally.get(item.cat) || { cat: item.cat, catName: item.catName, count: 0 };
    entry.count += 1;
    tally.set(item.cat, entry);
  });
  return [...tally.values()].sort((a, b) => a.cat.localeCompare(b.cat));
}

export type SparkGeometry = {
  /** เส้นถูกตัดเป็นท่อน ๆ ตามช่องว่างของข้อมูล ห้ามลากเชื่อมข้ามเดือนที่ไม่มีราคา */
  segments: string[];
  points: { x: number; y: number; index: number }[];
  min: number;
  max: number;
};

/**
 * เรขาคณิตของเส้นแนวโน้ม แยกออกจาก React เพื่อให้ทดสอบได้โดยไม่ต้อง render
 *
 * ช่องว่างถูกทำให้เป็นช่องว่างจริง ๆ ที่นี่ ไม่ใช่ที่ชั้นวาด เพราะถ้าปล่อยให้ชั้นวาดตัดสินใจ
 * วันหนึ่งจะมีคนแก้ให้เส้นต่อกันเพื่อความสวย แล้วไม่มีเทสต์ตัวไหนจับได้
 */
export function sparkGeometry(series: (number | null)[], width: number, height: number, padding = 2): SparkGeometry {
  const values = series.filter((value): value is number => value !== null && value !== undefined);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const span = max - min || 1;
  const stepX = series.length > 1 ? (width - padding * 2) / (series.length - 1) : 0;
  const points: { x: number; y: number; index: number }[] = [];
  const segments: string[] = [];
  let current: string[] = [];

  series.forEach((value, index) => {
    if (value === null || value === undefined) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      return;
    }
    const x = padding + stepX * index;
    const y = padding + (height - padding * 2) * (1 - (value - min) / span);
    points.push({ x, y, index });
    current.push(`${current.length === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
  });
  if (current.length > 1) segments.push(current.join(" "));

  return { segments, points, min, max };
}

/** "2569-07" เป็น "ก.ค. 69" — ปีในชุดข้อมูลเป็น พ.ศ. อยู่แล้ว ห้ามแปลงซ้ำ */
const THAI_MONTH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function formatMonthKey(month: MonthKey): string {
  const [year, monthNumber] = month.split("-");
  const index = Number(monthNumber) - 1;
  if (!THAI_MONTH_ABBR[index]) return month;
  return `${THAI_MONTH_ABBR[index]} ${year.slice(-2)}`;
}

export function formatMonthKeyLong(month: MonthKey): string {
  const [year, monthNumber] = month.split("-");
  const index = Number(monthNumber) - 1;
  if (!THAI_MONTH_FULL[index]) return month;
  return `${THAI_MONTH_FULL[index]} ${year}`;
}

/** ราคาสำหรับอ่าน ไม่ใช่สำหรับคำนวณ — การคำนวณใช้สตางค์เสมอ */
export function formatPrice(satang: bigint): string {
  const hasSatang = satang % SATANG_PER_BAHT !== 0n;
  return satangToBaht(satang).toLocaleString("th-TH", {
    minimumFractionDigits: hasSatang ? 2 : 0,
    maximumFractionDigits: 2
  });
}

/**
 * ปัดแบบสมมาตรรอบศูนย์ Math.round ปัด -1.25 ไปเป็น -1.2 แต่ปัด 1.25 ไปเป็น 1.3
 * ซึ่งทำให้ราคาขึ้นกับราคาลงขนาดเท่ากันแสดงตัวเลขไม่เท่ากัน
 */
export function formatPercent(value: number): string {
  const magnitude = Math.round(Math.abs(value) * 10) / 10;
  const rounded = value < 0 ? -magnitude : magnitude;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toLocaleString("th-TH", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
