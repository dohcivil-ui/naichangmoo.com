"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { THAI_MONTH_FULL } from "@/lib/thai-date";
import {
  formatMonthKey,
  formatMonthKeyLong,
  formatPercent,
  formatPrice,
  lineCost,
  sparkGeometry,
  sumSatang,
  toSatang,
  type MonthKey
} from "@/lib/price-catalogue";
import Image from "next/image";
import { MaterialCategoryIcon } from "@/components/icons/material-category-icons";

/**
 * ต้นแบบแอปราคาวัสดุและค่าแรง — แผงบัญชีราคา
 *
 * **หน่วยของหน้าจอคือแถว ไม่ใช่การ์ด** ของคู่แข่งเป็นกริดการ์ดที่เห็นได้สี่ใบต่อหน้าจอ แล้วทุกอย่าง
 * จบใน modal แผงบัญชีเห็นได้สิบกว่ารายการพร้อมกัน เลขเรียงเป็นคอลัมน์ให้สายตาไล่ลงมาเทียบกันได้
 * และรายละเอียดขึ้นที่แผงคำตอบด้านบนซึ่งอยู่ในสายตาเดียวกับรายการอื่น ไม่ใช่หน้าต่างที่บังทุกอย่าง
 *
 * ราคามาจาก API ของ สนค. ผ่านเซิร์ฟเวอร์เราเสมอ เบราว์เซอร์ผู้ใช้ไม่เคยคุยกับ สนค. โดยตรง
 * เหตุผลอยู่ที่ src/server/tpso-prices.ts
 */

type LedgerRow = {
  code: string;
  name: string;
  unit: string;
  cat: string;
  catName: string;
  price: number;
  priceVat: number;
  month: MonthKey;
  previousPrice: number | null;
  previousMonth: MonthKey | null;
  series: (number | null)[];
};

type LedgerAnswer = {
  province: string;
  period: { year: number; month: number };
  months: MonthKey[];
  lastUpdated: string;
  fetchedAt: string;
  /** ที่มาของตัวเลขชุดนี้ ประกาศโดยเซิร์ฟเวอร์เท่านั้น หน้าจอห้ามเดาเอง (IP-162) */
  origin: "live" | "stored" | "sample";
  originNote?: string;
  storedAt?: string;
  total: number;
  matched: number;
  page: number;
  pageSize: number;
  facets: { cat: string; catName: string; count: number; rise: number; fall: number; flat: number }[];
  rows: LedgerRow[];
};

type UnitPriceRow = {
  code: string;
  name: string;
  section: string;
  group: string;
  unit: string;
  materialBaht: number | null;
  labourBaht: number | null;
  allowancePercent: number | null;
  note: string;
  page: number;
};

type LabourRate = { unit: string; baht: number; condition: string; page: number };
type LabourVariant = { name: string; rates: LabourRate[] };
type LabourRow = { code: string; title: string; section: string; variants: LabourVariant[] };

type Province = { code: string; name: string };
type Desk = "market" | "unit" | "labour";
type ItemView = "card" | "row";
type SortKey = "name" | "price-desc" | "price-asc";

type BasketEntry = {
  key: string;
  name: string;
  unit: string;
  unitSatang: bigint;
  origin: string;
  quantity: number;
};

/**
 * สีประจำหมวดวัสดุ ยี่สิบเอ็ดค่า
 *
 * ทุกค่าอยู่ในช่วงเนื้อสี 148 ถึง 240 คือตั้งแต่เขียวอมฟ้าของแบรนด์ไปจนถึงน้ำเงินหมึก
 * จงใจไม่ใช้สายรุ้งเต็มวง เพราะหน้านี้ต้องอยู่ในธีมเดียวกับทั้งเว็บ ไม่ใช่หน้าที่มีจานสีของตัวเอง
 * ความอิ่มสีและความสว่างเท่ากันหมด ต่างกันแค่เนื้อสี ทั้งชุดจึงอ่านเป็นระบบเดียวกัน
 *
 * สีที่นี่บอกว่า "นี่คนละหมวดกัน" เท่านั้น ไม่ได้แปลว่าดีหรือแย่ ส่วนความหมายว่าราคาขึ้นหรือลง
 * ยังเป็นของเขียวกับแดงเหมือนเดิม และมีลูกศรกำกับเสมอสำหรับคนที่แยกสีไม่ได้
 */
const CATEGORY_HUES = [180, 196, 168, 208, 156, 220, 186, 232, 164, 202, 148, 214, 174, 226, 160, 190, 240, 152, 206, 178, 218];

function catStyle(cat: string) {
  const index = (Number(cat) - 1 + CATEGORY_HUES.length) % CATEGORY_HUES.length;
  const hue = CATEGORY_HUES[Number.isFinite(index) ? index : 0];
  return {
    "--cat": `hsl(${hue} 54% 31%)`,
    "--cat-soft": `hsl(${hue} 46% 58%)`,
    "--cat-wash": `hsl(${hue} 44% 94%)`
  } as React.CSSProperties;
}

// ชื่อเดือนไทยเต็มเป็นของกลางใน thai-date (IP-202) — เลิกถือสำเนาเอง
const THAI_MONTHS = THAI_MONTH_FULL;

function directionOf(row: LedgerRow): "rise" | "fall" | "flat" {
  if (row.previousPrice === null) return "flat";
  if (row.price > row.previousPrice) return "rise";
  if (row.price < row.previousPrice) return "fall";
  return "flat";
}

function percentOf(row: LedgerRow): number | null {
  if (row.previousPrice === null || row.previousPrice === 0) return null;
  return ((row.price - row.previousPrice) / row.previousPrice) * 100;
}

function useDebounced<T>(value: T, delay: number) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

/** ลูกศรบอกทิศของราคา เป็นเส้นวาด ไม่ใช่อักขระหรือ emoji และไม่ใช่สัญญาณเดียว มีตัวเลขกำกับเสมอ */
function MoveArrow({ direction }: { direction: "rise" | "fall" | "flat" }) {
  if (direction === "flat") {
    return (
      <svg className="gl-move__arrow" viewBox="0 0 16 16" aria-hidden="true">
        <line x1="3.5" y1="8" x2="12.5" y2="8" />
      </svg>
    );
  }
  const up = direction === "rise";
  return (
    <svg className="gl-move__arrow" viewBox="0 0 16 16" aria-hidden="true">
      <line x1="8" y1={up ? "13" : "3"} x2="8" y2={up ? "3" : "13"} />
      <polyline points={up ? "4 7.5 8 3.2 12 7.5" : "4 8.5 8 12.8 12 8.5"} />
    </svg>
  );
}

function MoveTag({ row, compact }: { row: LedgerRow; compact?: boolean }) {
  const direction = directionOf(row);
  const percent = percentOf(row);
  return (
    <span
      className={`gl-move gl-move--${direction}`}
      data-explain={
        percent === null
          ? "ยังไม่มีเดือนก่อนหน้าที่มีราคาให้เทียบในช่วงหกเดือนนี้ จึงยังบอกไม่ได้ว่าขยับไปทางไหน"
          : `เทียบราคาล่าสุด ${formatMonthKey(row.month)} กับราคาครั้งก่อนหน้าที่มีข้อมูล ${row.previousMonth ? formatMonthKey(row.previousMonth) : "—"} ไม่ใช่เทียบกับเดือนก่อนหน้าตามปฏิทิน เพราะบางเดือนไม่มีประกาศราคา`
      }
    >
      <MoveArrow direction={direction} />
      <strong>{percent === null ? "—" : formatPercent(percent)}</strong>
      {compact || row.previousMonth === null ? null : (
        <small>
          จาก {formatMonthKey(row.previousMonth)}
        </small>
      )}
    </span>
  );
}

function Spark({ series, direction, width = 84, height = 26 }: { series: (number | null)[]; direction: "rise" | "fall" | "flat"; width?: number; height?: number }) {
  const geometry = useMemo(() => sparkGeometry(series, width, height, 3), [series, width, height]);
  const readings = geometry.points.length;
  if (readings === 0) return <span className="gl-spark gl-spark--empty" aria-hidden="true" />;
  const head = geometry.points[readings - 1];
  const explain = `เส้นราคาย้อนหลังหกเดือนของรายการนี้ มีเดือนที่ประกาศราคาจริง ${readings} เดือน ช่วงที่เส้นขาดคือเดือนที่ไม่มีราคาประกาศ จึงไม่ลากเชื่อมให้`;
  return (
    <span className="gl-spark-wrap" data-explain={explain}>
    <svg className={`gl-spark gl-spark--${direction}`} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {geometry.segments.map((segment, index) => (
        <path key={index} className="gl-spark__line" d={segment} />
      ))}
      <circle className="gl-spark__head" cx={head.x} cy={head.y} r="2.6" />
    </svg>
    </span>
  );
}

/**
 * กราฟยาวของรายการที่กำลังโฟกัส
 *
 * เดือนที่ไม่มีราคาเป็นช่องว่างจริง เส้นขาดตรงนั้น และมีหมุดที่ทุกจุดที่มีข้อมูล
 * เพราะเมื่อเส้นขาดเป็นท่อน หมุดคือสิ่งเดียวที่บอกว่าเดือนไหนมีตัวเลขจริง
 */
function TrendChart({ series, months, unit }: { series: (number | null)[]; months: MonthKey[]; unit: string }) {
  const width = 720;
  const height = 176;
  const padLeft = 66;
  const plotWidth = width - padLeft - 14;
  const plotHeight = height - 40;
  const geometry = useMemo(() => sparkGeometry(series, plotWidth, plotHeight, 0), [series, plotWidth, plotHeight]);
  const readings = series.filter((value): value is number => value !== null);
  if (readings.length === 0) return <p className="gl-empty">ไม่มีราคาย้อนหลังของรายการนี้ในจังหวัดที่เลือก</p>;

  const shift = (path: string) => path.replace(/([ML])(-?[\d.]+) (-?[\d.]+)/g, (_, cmd, x, y) => `${cmd}${Number(x) + padLeft} ${Number(y) + 14}`);
  const ticks = [geometry.max, (geometry.max + geometry.min) / 2, geometry.min];
  const stepX = plotWidth / Math.max(1, series.length - 1);
  const monthTicks = months.map((month, index) => ({ month, index })).filter((entry) => entry.index % 6 === 0 || entry.index === months.length - 1);

  return (
    <figure className="gl-trend">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`ราคาย้อนหลัง ${months.length} เดือน ต่อ ${unit}`}>
        <defs>
          <linearGradient id="gl-trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--price-lead)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--price-lead)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((value, index) => {
          const y = 14 + plotHeight * (index / 2);
          return (
            <g key={index}>
              <line className="gl-trend__grid" x1={padLeft} y1={y} x2={width - 14} y2={y} />
              <text className="gl-trend__tick" x={padLeft - 10} y={y + 4} textAnchor="end">
                {formatPrice(toSatang(value))}
              </text>
            </g>
          );
        })}
        {geometry.segments.map((segment, index) => {
          const path = shift(segment);
          const first = path.match(/M(-?[\d.]+) (-?[\d.]+)/);
          const lastPoint = [...path.matchAll(/L(-?[\d.]+) (-?[\d.]+)/g)].pop();
          const area = first && lastPoint ? `${path} L${lastPoint[1]} ${14 + plotHeight} L${first[1]} ${14 + plotHeight} Z` : null;
          return (
            <g key={index}>
              {area ? <path className="gl-trend__area" d={area} fill="url(#gl-trend-fill)" /> : null}
              <path className="gl-trend__line" d={path} />
            </g>
          );
        })}
        {geometry.points.map((point) => (
          <circle key={point.index} className="gl-trend__dot" cx={point.x + padLeft} cy={point.y + 14} r="3.1">
            <title>{`${formatMonthKeyLong(months[point.index])} · ${formatPrice(toSatang(series[point.index] as number))} บาท/${unit}`}</title>
          </circle>
        ))}
        {monthTicks.map((entry) => (
          <text
            key={entry.month}
            className="gl-trend__tick"
            x={padLeft + stepX * entry.index}
            y={height - 6}
            textAnchor={entry.index === 0 ? "start" : entry.index === months.length - 1 ? "end" : "middle"}
          >
            {formatMonthKey(entry.month)}
          </text>
        ))}
      </svg>
      <figcaption>ทุกหมุดคือเดือนที่ประกาศราคาจริง เดือนที่ว่างคือเดือนที่ไม่มีข้อมูล เส้นจึงขาดตรงนั้น ไม่ลากเชื่อมให้ดูต่อเนื่อง</figcaption>
    </figure>
  );
}

export function PriceWorkspace({
  provinces,
  period,
  unitRows,
  labourRows,
  firstAnswer,
  artwork
}: {
  provinces: Province[];
  period: { start: { year: number; month: number }; end: { year: number; month: number } };
  unitRows: UnitPriceRow[];
  labourRows: LabourRow[];
  firstAnswer: LedgerAnswer | null;
  artwork: string[];
}) {
  const [desk, setDesk] = useState<Desk>("market");
  /** ค่าตั้งต้นเป็นการ์ดตามมติเจ้าของงาน 2026-08-26 แถวยังอยู่ให้กดเองสำหรับคนที่ไล่เทียบราคาทีละมาก ๆ */
  const [itemView, setItemView] = useState<ItemView>("card");
  const [province, setProvince] = useState("10");
  const [year, setYear] = useState(period.end.year);
  const [month, setMonth] = useState(period.end.month);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [page, setPage] = useState(0);
  const [answer, setAnswer] = useState<LedgerAnswer | null>(firstAnswer);
  const [loading, setLoading] = useState(firstAnswer === null);
  const [failed, setFailed] = useState<string | null>(null);
  const [focusCode, setFocusCode] = useState<string | null>(null);
  const [history, setHistory] = useState<{ code: string; months: MonthKey[]; values: (number | null)[] } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [basket, setBasket] = useState<BasketEntry[]>([]);
  const [basketOpen, setBasketOpen] = useState(false);
  const [floating, setFloating] = useState(false);
  /**
   * แถบลอยต้องเริ่มใต้แถบนำทางของเปลือกกลาง ซึ่งความสูงไม่คงที่ — บนจอแคบเมนูห่อได้หลายแถว
   * (วัดจริง: เดสก์ท็อป 85px มือถือ 390px ได้ 206px) ค่าคงที่ใน CSS จึงเดาผิดเสมอ วัดของจริงแทน
   */
  const [floatTop, setFloatTop] = useState(84);
  useEffect(() => {
    if (!floating) return;
    const measure = () => {
      const nav = document.querySelector(".site-nav");
      setFloatTop(nav ? Math.round(nav.getBoundingClientRect().height) : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [floating]);
  const controlsRef = useRef<HTMLDivElement>(null);

  /**
   * แถบลอยโผล่เมื่อแถบควบคุมจริงเลื่อนพ้นจอ
   *
   * ผูกกับตัวแถบเอง ไม่ใช่กับระยะ scroll ที่คำนวณจากความสูงของ hero เพราะความสูงนั้นเปลี่ยนตาม
   * ความยาวข้อความและขนาดจอ วิธีของคู่แข่งคือเช็ค heroBottom < 60 ซึ่งพังทันทีที่หัวเรื่องยาวขึ้นบรรทัด
   */
  useEffect(() => {
    const node = controlsRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    /**
     * ลอยเฉพาะเมื่อแถบควบคุม "เลื่อนพ้นขอบบน" ไปแล้ว (top < 0) ไม่ใช่แค่มองไม่เห็น —
     * บนจอเตี้ยแถบควบคุมเริ่มต้นอยู่ใต้ fold ถ้าเช็คแค่ไม่ intersect แถบลอยจะโผล่ตั้งแต่
     * ยังไม่เลื่อนสักนิด แล้วไปทับ breadcrumb ของเปลือกกลางพอดี (เจอจริงที่ 390px)
     */
    const observer = new IntersectionObserver(([entry]) => setFloating(!entry.isIntersecting && entry.boundingClientRect.top < 0), { rootMargin: "-8px 0px 0px 0px", threshold: 0 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const settledQuery = useDebounced(query, 320);

  /**
   * ระดับของหน้าจอคำนวณจากตัวกรอง ไม่ได้เก็บเป็นสถานะแยก
   *
   * ถ้าเก็บแยก จะมีสองแหล่งความจริงที่ขัดกันได้ เช่นเลือกหมวดแล้วแต่ยังอยู่หน้าแรก
   * หรือกดกลับแล้วแต่ตัวกรองยังค้าง ที่นี่ "อยู่ในหมวดไหน" คือคำตอบเดียวที่ตัดสินทุกอย่าง
   */
  const level: "cats" | "items" = cat !== "all" || query.trim() !== "" ? "items" : "cats";
  const currentCategory = answer?.facets.find((facet) => facet.cat === cat) ?? null;

  const backToCategories = () => {
    setCat("all");
    setQuery("");
    setPage(0);
    setFocusCode(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /**
   * กลับไปหน้าหลักของแอป จากตรงไหนก็ได้
   *
   * "หน้าหลัก" ของแอปนี้คือหน้าการ์ดหมวดของชุดราคาวัสดุ ซึ่งเป็นจุดที่เปิดแอปมาแล้วเจอ
   * ต้องกลับได้แม้อยู่คนละชุดข้อมูล เพราะแถบทางกลับเดิมขึ้นเฉพาะตอนอยู่ในหมวด
   * คนที่กดไปดูค่าแรงแล้วอยากกลับจึงหาปุ่มไม่เจอ ซึ่งเจ้าของงานเจอกับตัวเอง
   */
  const goHome = () => {
    setDesk("market");
    setCat("all");
    setQuery("");
    setPage(0);
    setFocusCode(null);
    setItemView("card");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const atHome = desk === "market" && level === "cats";
  const provinceName = provinces.find((entry) => entry.code === province)?.name ?? province;

  /**
   * ทุกคำขอราคาออกจากที่นี่ที่เดียว และยกเลิกคำขอเก่าเสมอเมื่อผู้ใช้เปลี่ยนใจ
   *
   * ตั้งสถานะกำลังโหลดหลัง await รอบแรก ไม่ใช่ในตัว effect ตรง ๆ เพราะการเรียก setState
   * แบบซิงโครนัสในตัว effect ทำให้เกิดการวาดซ้อนรอบ ซึ่ง lint ของโปรเจกต์นี้ห้ามไว้
   */
  useEffect(() => {
    if (desk !== "market") return;
    const controller = new AbortController();

    const run = async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoading(true);
      setFailed(null);
      const params = new URLSearchParams({ province, year: String(year), month: String(month), sort, page: String(page) });
      if (settledQuery.trim()) params.set("q", settledQuery.trim());
      if (cat !== "all") params.set("cat", cat);

      try {
        const response = await fetch(`/api/prototype/price-ledger?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        setAnswer((await response.json()) as LedgerAnswer);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed("อ่านราคาจาก สนค. ไม่สำเร็จในรอบนี้");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  }, [desk, province, year, month, settledQuery, cat, sort, page]);

  const focusRow = useMemo(() => answer?.rows.find((row) => row.code === focusCode) ?? null, [answer, focusCode]);
  const focusLabour = useMemo(() => labourRows.find((row) => row.code === focusCode) ?? null, [labourRows, focusCode]);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      if (!focusRow) {
        setHistory(null);
        return;
      }
      setHistoryLoading(true);
      try {
        const response = await fetch("/api/prototype/price-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ province, codes: [focusRow.code], year, month, months: 24 }),
          signal: controller.signal
        });
        const data = (await response.json()) as { series: { code: string; months: MonthKey[]; values: (number | null)[] }[] };
        setHistory(data.series.find((entry) => entry.code === focusRow.code) ?? null);
      } catch {
        if (!controller.signal.aborted) setHistory(null);
      } finally {
        if (!controller.signal.aborted) setHistoryLoading(false);
      }
    };
    void run();
    return () => controller.abort();
  }, [focusRow, province, year, month]);

  const unitSections = useMemo(() => {
    const tally = new Map<string, number>();
    unitRows.forEach((row) => tally.set(row.section, (tally.get(row.section) ?? 0) + 1));
    return [...tally.entries()].map(([section, count]) => ({ section, count })).sort((a, b) => a.section.localeCompare(b.section, "th"));
  }, [unitRows]);

  const visibleUnit = useMemo(() => {
    const terms = settledQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const found = unitRows.filter((row) => {
      if (cat !== "all" && row.section !== cat) return false;
      if (terms.length === 0) return true;
      return terms.every((term) => `${row.name} ${row.code} ${row.section} ${row.group} ${row.unit}`.toLowerCase().includes(term));
    });
    const total = (row: UnitPriceRow) => (row.materialBaht ?? 0) + (row.labourBaht ?? 0);
    const sorted = [...found];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "th"));
    if (sort === "price-desc") sorted.sort((a, b) => total(b) - total(a));
    if (sort === "price-asc") sorted.sort((a, b) => total(a) - total(b));
    /**
     * ประเภทงานเป็นชั้นเรียงแรกเสมอ การเรียงที่ผู้ใช้เลือกทำงานภายในกลุ่ม
     * ถ้าไม่ทำ การเรียงตามชื่อจะสลับประเภทงานไปมา แล้วหัวกลุ่มเดียวกันโผล่ซ้ำหลายก้อน
     * (sort ของ JS เสถียร ลำดับจากการเรียงรอบแรกจึงคงอยู่ภายในแต่ละกลุ่ม)
     */
    sorted.sort((a, b) => a.section.localeCompare(b.section, "th"));
    return sorted;
  }, [unitRows, settledQuery, cat, sort]);

  const labourSections = useMemo(() => {
    const tally = new Map<string, number>();
    labourRows.forEach((row) => tally.set(row.section, (tally.get(row.section) ?? 0) + 1));
    return [...tally.entries()].map(([section, count]) => ({ section, count })).sort((a, b) => a.section.localeCompare(b.section, "th"));
  }, [labourRows]);

  const visibleLabour = useMemo(() => {
    const terms = settledQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return labourRows.filter((row) => {
      if (cat !== "all" && row.section !== cat) return false;
      if (terms.length === 0) return true;
      const haystack = `${row.title} ${row.code} ${row.section} ${row.variants.map((entry) => entry.name).join(" ")}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [labourRows, settledQuery, cat]);

  const unitPage = visibleUnit.slice(page * 40, page * 40 + 40);
  const labourPage = visibleLabour.slice(page * 40, page * 40 + 40);
  const matched = desk === "market" ? answer?.matched ?? 0 : desk === "unit" ? visibleUnit.length : visibleLabour.length;

  /** ตู้หมวดของชุดที่เปิดอยู่ ใช้ร่วมกันทั้งสามชุดข้อมูล */
  const drawers = useMemo(() => {
    if (desk === "market") return (answer?.facets ?? []).map((facet) => ({ id: facet.cat, name: facet.catName, count: facet.count, icon: facet.cat }));
    if (desk === "unit") return unitSections.map((entry) => ({ id: entry.section, name: entry.section, count: entry.count, icon: null }));
    return labourSections.map((entry) => ({ id: entry.section, name: entry.section, count: entry.count, icon: null }));
  }, [desk, answer, unitSections, labourSections]);
  const drawerTotal = desk === "market" ? answer?.total ?? 0 : desk === "unit" ? unitRows.length : labourRows.length;
  const pageCount = Math.max(1, Math.ceil(matched / 40));

  const addToBasket = useCallback((entry: Omit<BasketEntry, "quantity">) => {
    setBasket((current) => (current.some((line) => line.key === entry.key) ? current : [...current, { ...entry, quantity: 1 }]));
    setBasketOpen(true);
  }, []);

  const basketTotal = sumSatang(basket.map((line) => lineCost(line.unitSatang, line.quantity)));
  const years = useMemo(() => {
    const list: number[] = [];
    for (let value = period.end.year; value >= Math.max(period.start.year, period.end.year - 9); value -= 1) list.push(value);
    return list;
  }, [period]);

  const switchDesk = (next: Desk) => {
    setDesk(next);
    setCat("all");
    setFocusCode(null);
    setPage(0);
  };

  return (
    <div className="gl-scope">
      <div className="gl-ambient" aria-hidden="true">
        <span className="gl-ambient__blob gl-ambient__blob--a" />
        <span className="gl-ambient__blob gl-ambient__blob--b" />
        <span className="gl-ambient__blob gl-ambient__blob--c" />
        <span className="gl-ambient__blob gl-ambient__blob--d" />
      </div>

      {/*
        แถบแพลตฟอร์มของหน้านี้มาจากเปลือกกลาง AppShell แล้ว (IP-157) — ห้ามสร้างแถบของตัวเอง
        คำวินิจฉัย 2026-08-26 เรื่องปุ่มบ้าน+ป้ายหน้าที่ ย้ายไปอยู่ที่เปลือกกลางพร้อมกัน
      */}
      {floating ? (
        <div className="gl-floatbar" style={{ top: floatTop }}>
          <div className="container gl-floatbar__inner">
            <button type="button" className="gl-back gl-back--float" onClick={goHome} disabled={atHome}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 11 12 4l8 7" />
                <path d="M6 10v9h12v-9" />
              </svg>
              {atHome ? "PRICEMETR" : "หน้าหลัก"}
            </button>
            <label className="gl-search gl-search--float">
              <span className="gl-sr">ค้นหา</span>
              <svg className="gl-search__icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
                placeholder="ค้นหาวัสดุหรือรหัสสินค้า"
              />
            </label>
            {desk === "market" ? (
              <>
                <label className="gl-floatbar__field">
                  <span className="gl-sr">จังหวัด</span>
                  <select
                    value={province}
                    onChange={(event) => {
                      setProvince(event.target.value);
                      setPage(0);
                      setFocusCode(null);
                    }}
                  >
                    {provinces.map((entry) => (
                      <option key={entry.code} value={entry.code}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="gl-floatbar__field">
                  <span className="gl-sr">เดือน</span>
                  <select
                    value={month}
                    onChange={(event) => {
                      setMonth(Number(event.target.value));
                      setPage(0);
                    }}
                  >
                    {THAI_MONTHS.map((name, index) => (
                      <option key={name} value={index + 1}>
                        {name} {year}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
            {level === "items" ? (
              <div className="gl-view gl-view--float" role="group" aria-label="รูปแบบรายการ">
                <button type="button" className={itemView === "card" ? "is-on" : undefined} onClick={() => setItemView("card")} aria-pressed={itemView === "card"}>
                  การ์ด
                </button>
                <button type="button" className={itemView === "row" ? "is-on" : undefined} onClick={() => setItemView("row")} aria-pressed={itemView === "row"}>
                  แถว
                </button>
              </div>
            ) : null}
            <span className="gl-floatbar__count">{matched.toLocaleString("th-TH")} รายการ</span>
          </div>
        </div>
      ) : null}

      <section className="gl-desk">
        <div className="container">
          <header className="gl-head">
            <div>
              <p className="eyebrow">ต้นแบบ · หมวดราคาและต้นทุน</p>
              <h1>
                <button type="button" className="gl-home" onClick={goHome}>
                  PRICEMETR
                </button>
                <span className="gl-head__tail">ราคาวัสดุและค่าแรง</span>
              </h1>
              <p className="gl-head__lead">
                เปิดมาเจอราคาล่าสุดของ กทม. และปริมณฑลทันที ไม่ต้องกรอกอะไรก่อน
                แล้วค่อยเปลี่ยนจังหวัด ปี เดือน เอาเองเมื่อต้องการ
              </p>
              {/*
                ป้ายสถานะข้อมูลอยู่ตรงนี้ ใต้คำนำ ชิดซ้าย โดยเจตนา
                มุมขวาบนคือตำแหน่งป้าย "ราคาสด · ตรวจ" ของคู่แข่ง ทั้งคำทั้งที่วางเหมือนกันจนเจ้าของงาน
                สั่งรื้อเมื่อ 2026-08-26 ห้ามย้ายกลับไปมุมนั้นและห้ามใช้คำว่า ราคาสด กับ ตรวจ อีก
              */}
              <LiveStamp answer={answer} loading={loading} failed={failed} provinceName={provinceName} />
            </div>
          </header>

          <nav className="gl-decks" aria-label="ชุดข้อมูล">
            <button type="button" className={desk === "market" ? "gl-deck is-active" : "gl-deck"} onClick={() => switchDesk("market")} aria-pressed={desk === "market"}>
              <span className="gl-deck__name">ราคาวัสดุรายจังหวัด</span>
              {/* คำท้ายบรรทัดตามที่มาจริงของคำตอบ ไม่ใช่คำตายตัว — ป้ายที่พูดว่า "ดึงสด"
                  ขณะที่คำตอบมาจากคลังของเรา คือป้ายที่ไม่ตรงกับเซิร์ฟเวอร์ (IP-162) */}
              <span className="gl-deck__origin">
                สนค. กระทรวงพาณิชย์ · {answer?.origin === "stored" ? "จากคลัง" : answer?.origin === "sample" ? "ชุดตัวอย่าง" : "ดึงสด"}
              </span>
            </button>
            <button type="button" className={desk === "unit" ? "gl-deck is-active" : "gl-deck"} onClick={() => switchDesk("unit")} aria-pressed={desk === "unit"}>
              <span className="gl-deck__name">ค่าวัสดุและค่าแรงต่อหน่วยงาน</span>
              <span className="gl-deck__origin">บัญชีราคา สพฐ. ปีงบประมาณ 2569</span>
            </button>
            <button type="button" className={desk === "labour" ? "gl-deck is-active" : "gl-deck"} onClick={() => switchDesk("labour")} aria-pressed={desk === "labour"}>
              <span className="gl-deck__name">ค่าแรงสำหรับถอดแบบราคากลาง</span>
              <span className="gl-deck__origin">กรมบัญชีกลาง ว809 · 14 พ.ย. 2568</span>
            </button>
          </nav>

          {desk === "market" && focusRow ? (
            <FocusPanel
              row={focusRow}
              provinceName={provinceName}
              history={history}
              historyLoading={historyLoading}
              windowMonths={answer?.months ?? []}
              onClose={() => setFocusCode(null)}
              onAdd={() =>
                addToBasket({
                  key: `market:${focusRow.code}`,
                  name: focusRow.name,
                  unit: focusRow.unit,
                  unitSatang: toSatang(focusRow.price),
                  origin: `สนค. · ${provinceName} · ${formatMonthKeyLong(focusRow.month)}`
                })
              }
              inBasket={basket.some((line) => line.key === `market:${focusRow.code}`)}
            />
          ) : null}

          {desk === "labour" && focusLabour ? (
            <LabourFocus
              row={focusLabour}
              onClose={() => setFocusCode(null)}
              onAdd={(row, variant, rate) =>
                addToBasket({
                  key: `labour:${row.code}:${variant.name}:${rate.condition}:${rate.baht}`,
                  name: `${row.title}${variant.name ? ` · ${variant.name}` : ""}`,
                  unit: rate.unit,
                  unitSatang: toSatang(rate.baht),
                  origin: `กรมบัญชีกลาง ว809 · หน้า ${rate.page}${rate.condition ? ` · ${rate.condition}` : ""}`
                })
              }
              basket={basket}
            />
          ) : null}

          <div ref={controlsRef} className="gl-controls">
            <label className="gl-search">
              <span className="gl-sr">ค้นหา</span>
              <svg className="gl-search__icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(event) => { setQuery(event.target.value); setPage(0); }}
                placeholder={desk === "market" ? "ทรายหยาบ · ปูนซีเมนต์ · เหล็ก DB12 · รหัสสินค้า" : "งานฉาบปูน · เหล็กเส้น · รหัส A5006"}
              />
              {query ? (
                <button type="button" className="gl-search__clear" onClick={() => { setQuery(""); setPage(0); }} aria-label="ล้างคำค้น">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              ) : null}
            </label>

            {desk === "market" ? (
              <>
                <label className="gl-field">
                  <span>จังหวัด</span>
                  <select value={province} onChange={(event) => { setProvince(event.target.value); setPage(0); setFocusCode(null); }}>
                    {provinces.map((entry) => (
                      <option key={entry.code} value={entry.code}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="gl-field gl-field--narrow">
                  <span>ปี</span>
                  <select value={year} onChange={(event) => { setYear(Number(event.target.value)); setPage(0); }}>
                    {years.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="gl-field">
                  <span>เดือน</span>
                  <select value={month} onChange={(event) => { setMonth(Number(event.target.value)); setPage(0); }}>
                    {THAI_MONTHS.map((name, index) => (
                      <option key={name} value={index + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}

            <label className="gl-field">
              <span>เรียง</span>
              <select value={sort} onChange={(event) => { setSort(event.target.value as SortKey); setPage(0); }}>
                <option value="name">ตามชื่อ</option>
                <option value="price-desc">ราคามากไปน้อย</option>
                <option value="price-asc">ราคาน้อยไปมาก</option>
              </select>
            </label>

            <div className="gl-view" role="group" aria-label="รูปแบบรายการ">
              <button type="button" className={itemView === "card" ? "is-on" : undefined} onClick={() => setItemView("card")} aria-pressed={itemView === "card"}>
                การ์ด
              </button>
              <button type="button" className={itemView === "row" ? "is-on" : undefined} onClick={() => setItemView("row")} aria-pressed={itemView === "row"}>
                แถว
              </button>
            </div>
          </div>

          {atHome ? null : (
            <div className="gl-crumb">
              <button type="button" className="gl-back" onClick={goHome}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 11 12 4l8 7" />
                  <path d="M6 10v9h12v-9" />
                </svg>
                หน้าหลักของแอป
              </button>
              {desk === "market" && level === "items" ? (
                <button type="button" className="gl-back gl-back--quiet" onClick={backToCategories}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <line x1="20" y1="12" x2="5" y2="12" />
                    <polyline points="11 19 4 12 11 5" />
                  </svg>
                  ทุกหมวด
                </button>
              ) : null}
              <span className="gl-crumb__here">
                {query.trim()
                  ? `ค้นหา “${query.trim()}”`
                  : desk === "market"
                    ? currentCategory?.catName ?? "รายการที่เลือก"
                    : desk === "unit"
                      ? "ค่าวัสดุและค่าแรงต่อหน่วยงาน · สพฐ. 2569"
                      : "ค่าแรงสำหรับถอดแบบราคากลาง · ว809"}
              </span>
            </div>
          )}

          {desk === "market" && level === "cats" ? (
            <CategoryBoard
              facets={answer?.facets ?? []}
              artwork={artwork}
              onPick={(picked) => {
                setCat(picked);
                setPage(0);
              }}
            />
          ) : (
            <div className="gl-work">
              {/*
                ตู้หมวดยืนซ้ายแบบสารบัญ ไม่ใช่แถวชิปหลายชั้นเหนือผลลัพธ์
                จงใจฉีกจากคู่แข่งที่ใช้ชิปห้าแถวราวร้อยยี่สิบปุ่มกดก่อนถึงราคาแรก
                และตู้นี้อยู่กับที่ตอนเลื่อนรายการ ผู้ใช้จึงย้ายหมวดได้โดยไม่ต้องเลื่อนกลับขึ้นไป
              */}
              <aside className="gl-drawers" aria-label="หมวดของชุดข้อมูลนี้">
                <p className="gl-drawers__title">หมวด</p>
                <button type="button" className={cat === "all" ? "gl-drawer is-on" : "gl-drawer"} onClick={() => { setCat("all"); setPage(0); }} aria-pressed={cat === "all"}>
                  <span className="gl-drawer__name">ทุกหมวด</span>
                  <span className="gl-drawer__count">{drawerTotal.toLocaleString("th-TH")}</span>
                </button>
                {drawers.map((drawer) => (
                  <button
                    key={drawer.id}
                    type="button"
                    className={cat === drawer.id ? "gl-drawer is-on" : "gl-drawer"}
                    style={drawer.icon ? catStyle(drawer.icon) : undefined}
                    onClick={() => { setCat(drawer.id); setPage(0); }}
                    aria-pressed={cat === drawer.id}
                  >
                    {drawer.icon ? (
                      <span className="gl-drawer__icon" aria-hidden="true">
                        <MaterialCategoryIcon cat={drawer.icon} />
                      </span>
                    ) : null}
                    <span className="gl-drawer__name">{drawer.name}</span>
                    <span className="gl-drawer__count">{drawer.count.toLocaleString("th-TH")}</span>
                  </button>
                ))}
              </aside>

              <div className="gl-work__main">
                <label className="gl-drawer-select">
                  <span>หมวด</span>
                  <select value={cat} onChange={(event) => { setCat(event.target.value); setPage(0); }}>
                    <option value="all">ทุกหมวด ({drawerTotal.toLocaleString("th-TH")})</option>
                    {drawers.map((drawer) => (
                      <option key={drawer.id} value={drawer.id}>
                        {drawer.name} ({drawer.count.toLocaleString("th-TH")})
                      </option>
                    ))}
                  </select>
                </label>

                <p className="gl-count" aria-live="polite">
                  {loading && desk === "market" ? (
                    <span className="gl-count__loading">กำลังอ่านราคาจาก สนค.</span>
                  ) : (
                    <>
                      พบ <strong>{matched.toLocaleString("th-TH")}</strong> รายการ
                      {desk === "market" ? ` ใน ${provinceName} · ราคาก่อนภาษีมูลค่าเพิ่ม` : " · ค่าวัสดุและค่าแรงต่อหนึ่งหน่วยงาน"}
                    </>
                  )}
                </p>

                {desk === "market" ? (
                  <MarketBoard
                    answer={answer}
                    view={itemView}
                    loading={loading}
                    focusCode={focusCode}
                    onFocus={(code) => setFocusCode(focusCode === code ? null : code)}
                    onAdd={(row) =>
                      addToBasket({
                        key: `market:${row.code}`,
                        name: row.name,
                        unit: row.unit,
                        unitSatang: toSatang(row.price),
                        origin: `สนค. · ${provinceName} · ${formatMonthKeyLong(row.month)}`
                      })
                    }
                    basket={basket}
                  />
                ) : desk === "labour" ? (
                  <LabourBoard
                    rows={labourPage}
                    openCode={focusCode}
                    onToggle={(code) => setFocusCode(focusCode === code ? null : code)}
                  />
                ) : (
                  <UnitBoard
                    rows={unitPage}
                    view={itemView}
                    onAdd={(row) =>
                      addToBasket({
                        key: `unit:${row.code}`,
                        name: row.name,
                        unit: row.unit,
                        unitSatang: toSatang((row.materialBaht ?? 0) + (row.labourBaht ?? 0)),
                        origin: `สพฐ. 2569 · หน้า ${row.page}`
                      })
                    }
                    basket={basket}
                  />
                )}

                {pageCount > 1 ? (
                  <nav className="gl-pager" aria-label="หน้าของผลลัพธ์">
                    <button type="button" className="gl-chip" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0}>
                      ก่อนหน้า
                    </button>
                    <span>
                      หน้า {(page + 1).toLocaleString("th-TH")} จาก {pageCount.toLocaleString("th-TH")}
                    </span>
                    <button type="button" className="gl-chip" onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} disabled={page >= pageCount - 1}>
                      ถัดไป
                    </button>
                  </nav>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </section>

      {basket.length > 0 ? (
        <BasketBar
          basket={basket}
          total={basketTotal}
          open={basketOpen}
          onToggle={() => setBasketOpen((current) => !current)}
          onQuantity={(key, quantity) => setBasket((current) => current.map((line) => (line.key === key ? { ...line, quantity } : line)))}
          onRemove={(key) => setBasket((current) => current.filter((line) => line.key !== key))}
        />
      ) : null}
    </div>
  );
}

/**
 * ป้ายสถานะข้อมูล ย่อเหลือบรรทัดเดียว
 *
 * เจ้าของงานสั่งเมื่อ 2026-08-26 ว่าคำอธิบายยาวไม่ต้องยืนอยู่บนจอตลอดเวลา ให้โผล่ตอนชี้เท่านั้น
 * สิ่งที่ยังต้องเห็นตลอดคือสองอย่างที่ตัดสินใจด้วย คือราคานี้เป็นของเดือนไหน และเครื่องอ่านมากี่โมง
 * ส่วนที่เหลือ — ใครประกาศ ปรับปรุงวันไหน รอบตรวจถี่แค่ไหน — อยู่ในคำอธิบายที่ชี้แล้วเห็น
 *
 * ใช้ปุ่มจริง ไม่ใช่ div ที่ผูก onMouseOver เพราะบนมือถือไม่มีการชี้ และคนที่ใช้แป้นพิมพ์
 * ต้องแท็บมาถึงแล้วอ่านได้เหมือนกัน
 */
function LiveStamp({ answer, loading, failed, provinceName }: { answer: LedgerAnswer | null; loading: boolean; failed: string | null; provinceName: string }) {
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [storedAt, setStoredAt] = useState<string | null>(null);
  const [shown, setShown] = useState(false);

  /** เวลาแปลงฝั่งเบราว์เซอร์เท่านั้น เพราะเซิร์ฟเวอร์กับเครื่องผู้ใช้อยู่คนละเขตเวลาได้ */
  useEffect(() => {
    if (!answer) return;
    const timer = window.setTimeout(() => {
      setCheckedAt(new Date(answer.fetchedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }));
      setStoredAt(
        answer.storedAt
          ? new Date(answer.storedAt).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
          : null
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [answer]);

  /**
   * สถานะของแถบมาจากที่มาที่เซิร์ฟเวอร์ประกาศ ไม่ใช่จากการเดาของหน้าจอ (IP-162)
   *
   * ราคาที่เก็บไว้ไม่ใช่ความผิดปกติ จึงไม่ควรขึ้นสีเตือนเหมือนตอนต้นทางล่ม แต่ก็ไม่ใช่ของสด
   * จึงไม่ควรขึ้นสีเดียวกับของสดด้วย มันเป็นสถานะที่สามจริง ๆ ไม่ใช่สองสถานะเดิมที่ยืมกันใช้
   */
  const origin = answer?.origin;
  const state = failed || origin === "sample" ? "warn" : origin === "stored" ? "stored" : loading ? "busy" : "live";
  const word = origin === "stored" ? "ราคาที่เก็บไว้" : origin === "sample" ? "ราคาตัวอย่าง" : "Real-time price";

  return (
    <div className="gl-live">
      <button
        type="button"
        className={`gl-live__line gl-live__line--${state}`}
        aria-describedby="gl-live-detail"
        onMouseEnter={() => setShown(true)}
        onMouseLeave={() => setShown(false)}
        onFocus={() => setShown(true)}
        onBlur={() => setShown(false)}
        onClick={() => setShown((current) => !current)}
      >
        <span className="gl-live__word">{word}</span>
        {loading ? (
          <span className="gl-live__when">กำลังอ่านข้อมูล</span>
        ) : answer ? (
          <span className="gl-live__when">
            {THAI_MONTHS[answer.period.month - 1]} {answer.period.year} · ณ เวลา {checkedAt ?? "—"} น.
          </span>
        ) : (
          <span className="gl-live__when">ยังไม่มีข้อมูล</span>
        )}
      </button>
      <p id="gl-live-detail" className={shown ? "gl-live__detail is-shown" : "gl-live__detail"} role="tooltip">
        {failed
          ? failed
          : answer?.origin === "sample"
            ? `ใช้ชุดตัวอย่างในระบบ เพราะต้นทางไม่ตอบ (${answer.originNote ?? "ไม่ทราบสาเหตุ"})`
            : answer?.origin === "stored"
              ? `สำเนาที่ระบบเก็บไว้จากคำประกาศของ สนค. · ${provinceName} · ${answer.total.toLocaleString("th-TH")} รายการ · เก็บเมื่อ ${storedAt ?? "—"} · ${answer.originNote ?? "รุ่นตรงกับที่ต้นทางประกาศล่าสุด จึงไม่ต้องดึงซ้ำ"}`
              : answer
                ? `สนค. กระทรวงพาณิชย์ · ${provinceName} · ${answer.total.toLocaleString("th-TH")} รายการ · ผู้ประกาศปรับปรุง ${new Date(answer.lastUpdated).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })} · เครื่องตรวจของใหม่ทุก 1 ชั่วโมง ส่วนต้นทางประกาศเดือนละครั้ง`
                : "กำลังติดต่อ สนค."}
      </p>
    </div>
  );
}

/**
 * หน้าแรกของชุดข้อมูล — การ์ดหมวดวัสดุ
 *
 * ของคู่แข่งเปิดมาเจอการ์ดรายสินค้าเรียงกันเป็นพันใบ ซึ่งไม่มีใครไล่อ่าน หน้าแรกที่นี่จึงเป็นแผนที่
 * ยี่สิบเอ็ดหมวด แต่ละใบบอกจำนวนรายการ และบอกว่าเดือนนี้ในหมวดนั้นราคาขึ้นกี่รายการ ลงกี่รายการ
 * ซึ่งเป็นคำถามแรกของคนประมาณราคา ไม่ใช่ "หมวดนี้มีของกี่ชิ้น"
 */
/**
 * การ์ดรายการหนึ่งใบ
 *
 * โครงเดียวกับการ์ดหมวดทุกประการ คือกระจกใบเดียว มีสัญลักษณ์ประจำหมวดอยู่มุมบน สีของหมวดเป็นสันซ้าย
 * และตัวเลขเป็นพระเอก ต่างกันแค่ว่าใบนี้ตอบเรื่องราคาของรายการเดียว ส่วนใบหมวดตอบเรื่องภาพรวม
 * ความสูงเท่ากันทุกใบเพราะแถวภายในถูกล็อกไว้ ไม่ใช่เพราะบังคับความสูงรวม
 */
function ItemCard({
  row,
  index,
  open,
  picked,
  onFocus,
  onAdd
}: {
  row: LedgerRow;
  index: number;
  open: boolean;
  picked: boolean;
  onFocus: () => void;
  onAdd: () => void;
}) {
  const direction = directionOf(row);
  return (
    <article
      className={open ? "gl-item is-open" : "gl-item"}
      style={{ ...catStyle(row.cat), "--i": Math.min(index, 16) } as React.CSSProperties}
    >
      <header className="gl-item__head">
        <span className="gl-item__icon" aria-hidden="true">
          <MaterialCategoryIcon cat={row.cat} />
        </span>
        <span className="gl-item__cat">{row.catName}</span>
        <span className="gl-item__unit">ต่อ {row.unit}</span>
      </header>
      <h3 className="gl-item__name" title={row.name}>
        {row.name}
      </h3>
      <p className="gl-item__price">
        <strong>{formatPrice(toSatang(row.price))}</strong>
        <small>บาท</small>
      </p>
      <div className="gl-item__move">
        <MoveTag row={row} compact />
        <span className="gl-item__month">{formatMonthKey(row.month)}</span>
      </div>
      <Spark series={row.series} direction={direction} width={240} height={40} />
      <footer className="gl-item__actions">
        <button type="button" className="gl-chip" onClick={onFocus} aria-expanded={open}>
          {open ? "ปิดกราฟ" : "ที่มาและกราฟ"}
        </button>
        <button type="button" className="gl-chip gl-chip--primary" onClick={onAdd} disabled={picked}>
          {picked ? "อยู่ในรายการ" : "หยิบเข้ารายการ"}
        </button>
      </footer>
    </article>
  );
}

/**
 * หน้าแรกของชุดข้อมูล — การ์ดหมวดวัสดุ
 *
 * ของคู่แข่งเปิดมาเจอการ์ดรายสินค้าเรียงกันเป็นพันใบ ซึ่งไม่มีใครไล่อ่าน หน้าแรกที่นี่จึงเป็นแผนที่
 * ยี่สิบเอ็ดหมวด แต่ละใบบอกจำนวนรายการ และบอกว่าเดือนนี้ในหมวดนั้นราคาขึ้นกี่รายการ ลงกี่รายการ
 * ซึ่งเป็นคำถามแรกของคนประมาณราคา ไม่ใช่ "หมวดนี้มีของกี่ชิ้น"
 */
function CategoryBoard({
  facets,
  artwork,
  onPick
}: {
  facets: { cat: string; catName: string; count: number; rise: number; fall: number; flat: number }[];
  /** รหัสหมวดที่มีภาพประกอบจริงอยู่ใน public/brand/categories แล้ว หมวดที่ไม่มีใช้สัญลักษณ์เส้นแทน */
  artwork: string[];
  onPick: (cat: string) => void;
}) {
  if (facets.length === 0) return <p className="gl-empty">ยังไม่มีหมวดให้แสดง</p>;
  return (
    <div className="gl-cats">
      {facets.map((facet, index) => {
        const moved = facet.rise + facet.fall;
        const risePart = moved === 0 ? 0 : (facet.rise / facet.count) * 100;
        const fallPart = moved === 0 ? 0 : (facet.fall / facet.count) * 100;
        return (
          <button
            key={facet.cat}
            type="button"
            className="gl-cat"
            style={{ ...catStyle(facet.cat), "--i": Math.min(index, 20) } as React.CSSProperties}
            onClick={() => onPick(facet.cat)}
          >
            {/*
              แถบภาพประจำหมวด กินความกว้างเต็มใบ
              ตอนนี้วาดด้วยสัญลักษณ์เส้นขนาดใหญ่ ซึ่งเป็นของที่มีจริงแล้วและรับสีจากธีมได้
              เมื่อภาพประกอบชุด 512px จาก GPT มาถึง ให้วางไฟล์ที่ public/brand/categories/<รหัส>.png
              แล้วสลับมาใช้ <Image> ในกรอบเดียวกันนี้ โดยไม่ต้องแก้โครงการ์ด
            */}
            <span className="gl-cat__art" aria-hidden="true">
              {artwork.includes(facet.cat) ? (
                <Image src={`/brand/categories/${facet.cat}.webp`} alt="" width={420} height={300} sizes="(max-width: 620px) 100vw, 260px" />
              ) : (
                <MaterialCategoryIcon cat={facet.cat} />
              )}
            </span>
            <span className="gl-cat__body">
              <span className="gl-cat__name">{facet.catName}</span>
              <span className="gl-cat__count">
                <strong>{facet.count.toLocaleString("th-TH")}</strong> รายการ
              </span>
              <span
                className="gl-cat__bar"
                data-explain={`สัดส่วนของรายการในหมวดนี้ที่ราคาขยับ · เขียวคือขึ้น ${facet.rise.toLocaleString("th-TH")} รายการ · แดงคือลง ${facet.fall.toLocaleString("th-TH")} รายการ · ที่เหลือคือราคาเท่าเดิม เทียบกับเดือนก่อนหน้าที่มีข้อมูลของแต่ละรายการ`}
              >
                <span className="gl-cat__bar-rise" style={{ width: `${risePart}%` }} />
                <span className="gl-cat__bar-fall" style={{ width: `${fallPart}%` }} />
              </span>
              <span className="gl-cat__moves">
                {moved === 0 ? (
                  "เดือนนี้ยังไม่มีรายการไหนขยับ"
                ) : (
                  <>
                    <em className="is-rise">ขึ้น {facet.rise.toLocaleString("th-TH")}</em>
                    <em className="is-fall">ลง {facet.fall.toLocaleString("th-TH")}</em>
                    <em>เท่าเดิม {facet.flat.toLocaleString("th-TH")}</em>
                  </>
                )}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * รายการในหมวด แสดงได้สองแบบ
 *
 * ค่าตั้งต้นเป็นการ์ด เพราะเจ้าของงานดูของจริงแล้วเลือกแบบนั้น ส่วนแบบแถวยังอยู่เป็นตัวเลือก
 * สำหรับตอนที่ต้องไล่เทียบราคาหลายสิบรายการพร้อมกัน ซึ่งการ์ดทำให้ต้องเลื่อนมากกว่าสามเท่า
 */
function MarketBoard({
  answer,
  view,
  loading,
  focusCode,
  onFocus,
  onAdd,
  basket
}: {
  answer: LedgerAnswer | null;
  view: ItemView;
  loading: boolean;
  focusCode: string | null;
  onFocus: (code: string) => void;
  onAdd: (row: LedgerRow) => void;
  basket: BasketEntry[];
}) {
  if (!answer && loading) return <LedgerSkeleton />;
  if (!answer) return <p className="gl-empty">ยังไม่มีข้อมูลให้แสดง</p>;
  if (answer.rows.length === 0) return <p className="gl-empty">ไม่พบรายการที่ตรงกับคำค้นนี้ ลองพิมพ์สั้นลง หรือเปลี่ยนหมวด</p>;

  if (view === "card") {
    return (
      <div className={loading ? "gl-items is-loading" : "gl-items"}>
        {answer.rows.map((row, index) => (
          <ItemCard
            key={row.code}
            row={row}
            index={index}
            open={focusCode === row.code}
            picked={basket.some((line) => line.key === `market:${row.code}`)}
            onFocus={() => onFocus(row.code)}
            onAdd={() => onAdd(row)}
          />
        ))}
      </div>
    );
  }

  return (
    <ul className={loading ? "gl-list is-loading" : "gl-list"}>
      {answer.rows.map((row, index) => {
        const picked = basket.some((line) => line.key === `market:${row.code}`);
        const direction = directionOf(row);
        return (
          <li
            key={row.code}
            className={focusCode === row.code ? "gl-slab is-open" : "gl-slab"}
            style={{ ...catStyle(row.cat), "--i": Math.min(index, 18) } as React.CSSProperties}
          >
            <button type="button" className="gl-slab__main" onClick={() => onFocus(row.code)} aria-expanded={focusCode === row.code}>
              <span className="gl-slab__badge" aria-hidden="true">
                <MaterialCategoryIcon cat={row.cat} />
              </span>
              <span className="gl-slab__name">{row.name}</span>
              <span className="gl-slab__meta">
                <span className="gl-slab__cat">{row.catName}</span>
                <span className="gl-slab__dot" aria-hidden="true" />
                <span>ต่อ {row.unit}</span>
                <span className="gl-slab__dot" aria-hidden="true" />
                <span>{formatMonthKey(row.month)}</span>
              </span>
            </button>
            <span className="gl-slab__figures">
              <Spark series={row.series} direction={direction} width={92} height={30} />
              <MoveTag row={row} compact />
              <span className="gl-slab__price">
                {formatPrice(toSatang(row.price))}
                <small>บาท</small>
              </span>
              <button type="button" className="gl-slab__add" onClick={() => onAdd(row)} disabled={picked} aria-label={`หยิบ ${row.name} เข้ารายการ`}>
                {picked ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <polyline points="5 13 10 18 19 6" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                )}
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * ค่าวัสดุและค่าแรงต่อหน่วยงาน จากบัญชีราคาของ สพฐ.
 *
 * ใช้การ์ดชุดเดียวกับชุดราคาวัสดุทุกประการ ไม่ใช่คลาสของตัวเอง
 * รอบก่อนกระดานนี้ยังเรียกคลาสชุดเก่าที่ถูกลบไปพร้อมการรื้อหน้าตา ผลคือมันเรนเดอร์ออกมาโดยไม่มีสไตล์เลย
 * ตัวหนังสือทับกันมั่วทั้งกระดาน และไม่มี error ที่ไหนให้เห็น เพราะ CSS ที่หายไปไม่เคยส่งเสียง
 * บทเรียนคือกระดานทุกอันต้องใช้ชิ้นส่วนร่วมกัน ไม่ใช่ต่างคนต่างมีคลาสของตัวเอง
 */
/**
 * จัดกลุ่มรายการตามประเภทงาน โดยรักษาลำดับเดิม
 *
 * เจ้าของงานสั่งเมื่อ 2026-08-26 ว่าหน้าค่าแรงต้องเห็นเป็นกลุ่มประเภทงาน มีหัวกลุ่มคั่น
 * และช่องว่างระหว่างกลุ่มมากกว่าปกติราวหนึ่งบรรทัด ไม่ใช่การ์ดไหลติดกันเป็นพืดข้ามประเภท
 */
function groupBySection<T>(rows: T[], sectionOf: (row: T) => string): { section: string; rows: T[] }[] {
  const groups: { section: string; rows: T[] }[] = [];
  for (const row of rows) {
    const section = sectionOf(row);
    const last = groups[groups.length - 1];
    if (last && last.section === section) last.rows.push(row);
    else groups.push({ section, rows: [row] });
  }
  return groups;
}

function GroupHead({ section, count }: { section: string; count: number }) {
  return (
    <h4 className="gl-group">
      {section}
      <span className="gl-group__count">{count.toLocaleString("th-TH")} รายการ</span>
      <span className="gl-group__rule" aria-hidden="true" />
    </h4>
  );
}

function UnitBoard({ rows, view, onAdd, basket }: { rows: UnitPriceRow[]; view: ItemView; onAdd: (row: UnitPriceRow) => void; basket: BasketEntry[] }) {
  if (rows.length === 0) return <p className="gl-empty">ไม่พบรายการที่ตรงกับคำค้นนี้ในบัญชีราคา สพฐ.</p>;
  const total = (row: UnitPriceRow) => toSatang((row.materialBaht ?? 0) + (row.labourBaht ?? 0));

  if (view === "row") {
    return (
      <ul className="gl-list">
        {rows.map((row, index) => {
          const picked = basket.some((line) => line.key === `unit:${row.code}`);
          return (
            <li key={row.code} className="gl-slab gl-slab--unit" style={{ "--cat": "var(--teal)", "--cat-soft": "var(--teal-soft)", "--cat-wash": "var(--teal-wash)", "--i": Math.min(index, 18) } as React.CSSProperties}>
              <span className="gl-slab__main gl-slab__main--static">
                <span className="gl-slab__name">{row.name}</span>
                <span className="gl-slab__meta">
                  <span className="gl-slab__cat">{row.section}</span>
                  <span className="gl-slab__dot" aria-hidden="true" />
                  <span>ต่อ {row.unit}</span>
                  <span className="gl-slab__dot" aria-hidden="true" />
                  <span>ค่าวัสดุ {row.materialBaht === null ? "ไม่ระบุ" : formatPrice(toSatang(row.materialBaht))}</span>
                  <span className="gl-slab__dot" aria-hidden="true" />
                  <span>ค่าแรง {row.labourBaht === null ? "ไม่ระบุ" : formatPrice(toSatang(row.labourBaht))}</span>
                </span>
              </span>
              <span className="gl-slab__figures">
                <span className="gl-slab__price">
                  {formatPrice(total(row))}
                  <small>บาท</small>
                </span>
                <button type="button" className="gl-slab__add" onClick={() => onAdd(row)} disabled={picked} aria-label={`หยิบ ${row.name} เข้ารายการ`}>
                  {picked ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <polyline points="5 13 10 18 19 6" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  )}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  const groups = groupBySection(rows, (row) => row.section);
  const groupStart = groups.map((group, at) => groups.slice(0, at).reduce((sum, g) => sum + g.rows.length, 0));

  return (
    <div className="gl-items">
      {groups.map((group, groupAt) => (
        <Fragment key={group.section}>
          <GroupHead section={group.section} count={group.rows.length} />
          {group.rows.map((row, rowAt) => {
        const index = groupStart[groupAt] + rowAt;
        const picked = basket.some((line) => line.key === `unit:${row.code}`);
        return (
          <article
            key={row.code}
            className="gl-item gl-item--unit"
            style={{ "--cat": "var(--teal)", "--cat-soft": "var(--teal-soft)", "--cat-wash": "var(--teal-wash)", "--i": Math.min(index, 16) } as React.CSSProperties}
          >
            <header className="gl-item__head">
              <span className="gl-item__cat">{row.section}</span>
              <span className="gl-item__unit">ต่อ {row.unit}</span>
            </header>
            <h3 className="gl-item__name" title={row.name}>
              {row.name}
            </h3>
            <p className="gl-item__price">
              <strong>{formatPrice(total(row))}</strong>
              <small>บาท</small>
            </p>
            <p className="gl-item__split">
              <span>
                ค่าวัสดุ <strong>{row.materialBaht === null ? "ไม่ระบุ" : formatPrice(toSatang(row.materialBaht))}</strong>
              </span>
              <span className="gl-item__plus" aria-hidden="true" />
              <span>
                ค่าแรง <strong>{row.labourBaht === null ? "ไม่ระบุ" : formatPrice(toSatang(row.labourBaht))}</strong>
              </span>
            </p>
            <p className="gl-labour__summary">
              {row.allowancePercent !== null ? `เผื่อวัสดุ ${row.allowancePercent}% · ` : ""}
              บัญชีราคา สพฐ. 2569 หน้า {row.page}
            </p>
            <footer className="gl-item__actions gl-item__actions--single">
              <button type="button" className="gl-chip gl-chip--primary" onClick={() => onAdd(row)} disabled={picked}>
                {picked ? "อยู่ในรายการแล้ว" : "หยิบเข้ารายการ"}
              </button>
            </footer>
          </article>
        );
      })}
        </Fragment>
      ))}
    </div>
  );
}

function LabourFocus({
  row,
  onClose,
  onAdd,
  basket
}: {
  row: LabourRow;
  onClose: () => void;
  onAdd: (row: LabourRow, variant: LabourVariant, rate: LabourRate) => void;
  basket: BasketEntry[];
}) {
  return (
    <section className="gl-focus gl-labour__open" aria-label={`อัตราค่าแรงของ ${row.title}`}>
      <button type="button" className="gl-focus__close" onClick={onClose} aria-label="ปิดแผงอัตรา">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <p className="gl-labour__open-title">
        {row.title}
        <small>กรมบัญชีกลาง ว809 · {row.section} · ลำดับ {row.code}</small>
      </p>
      {row.variants.map((variant) => (
        <div key={variant.name || "หลัก"} className="gl-labour__variant">
          {variant.name ? <p className="gl-labour__variant-name">{variant.name}</p> : null}
          <ul className="gl-labour__rates">
            {variant.rates.map((rate) => {
              const key = `labour:${row.code}:${variant.name}:${rate.condition}:${rate.baht}`;
              const picked = basket.some((line) => line.key === key);
              return (
                <li key={key}>
                  <span className="gl-labour__rate">
                    {formatPrice(toSatang(rate.baht))}
                    <small>บาท/{rate.unit}</small>
                  </span>
                  <span className="gl-labour__cond">{rate.condition || "ทุกปริมาณงาน"}</span>
                  <button type="button" className="gl-slab__add" onClick={() => onAdd(row, variant, rate)} disabled={picked} aria-label={`หยิบอัตรา ${rate.baht} บาทต่อ${rate.unit} เข้ารายการ`}>
                    {picked ? (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <polyline points="5 13 10 18 19 6" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <p className="gl-labour__note">
        อัตราที่ถูกต้องขึ้นกับปริมาณงานจริงของโครงการ เลือกให้ตรงช่วงก่อนหยิบเข้ารายการ
        เพราะเงื่อนไขจะติดไปกับบรรทัดนั้นและตรวจย้อนได้ภายหลัง
      </p>
    </section>
  );
}

/**
 * ค่าแรงราชการ หนึ่งรายการมีได้หลายอัตรา
 *
 * อัตราผูกกับปริมาณงาน ตอกเสาเข็มร้อยต้นขึ้นไปกับยี่สิบห้าต้นคนละราคา การแสดงตัวเลขเดียว
 * แล้วซ่อนเงื่อนไขไว้คือการทำให้ผู้ใช้หยิบตัวเลขผิดไปขึ้นราคากลาง ทุกอัตราจึงต้องเข้าถึงได้
 *
 * **แต่ห้ามกางทุกอัตราบนการ์ด** รอบแรกทำแบบนั้น ผลคือการ์ดใบหนึ่งสูง 765px อีกใบสูง 320px
 * เพราะรายการหนึ่งมีเก้าอัตราส่วนอีกรายการมีอัตราเดียว กริดจึงกลายเป็นกำแพงหยักที่อ่านไม่ได้
 * การ์ดที่นี่จึงสรุปเป็นช่วงราคากับจำนวนอัตรา ทุกใบสูงเท่ากัน แล้วรายละเอียดไปอยู่ที่แผงเหนือกระดาน
 */
function LabourBoard({
  rows,
  openCode,
  onToggle
}: {
  rows: LabourRow[];
  openCode: string | null;
  onToggle: (code: string) => void;
}) {
  if (rows.length === 0) return <p className="gl-empty">ไม่พบงานที่ตรงกับคำค้นนี้ในบัญชีค่าแรง ว809</p>;

  const groups = groupBySection(rows, (row) => row.section);
  const groupStart = groups.map((group, at) => groups.slice(0, at).reduce((sum, g) => sum + g.rows.length, 0));

  return (
    <div className="gl-items">
      {groups.map((group, groupAt) => (
        <Fragment key={group.section}>
          <GroupHead section={group.section} count={group.rows.length} />
          {group.rows.map((row, rowAt) => {
        const index = groupStart[groupAt] + rowAt;
        const rates = row.variants.flatMap((variant) => variant.rates);
        const low = Math.min(...rates.map((rate) => rate.baht));
        const high = Math.max(...rates.map((rate) => rate.baht));
        const units = [...new Set(rates.map((rate) => rate.unit))];
        const open = openCode === row.code;

        return (
          <article key={row.code} className={open ? "gl-item gl-item--labour is-open" : "gl-item gl-item--labour"} style={{ "--i": Math.min(index, 16) } as React.CSSProperties}>
            <header className="gl-item__head">
              <span className="gl-item__cat">{row.section}</span>
              <span className="gl-item__unit">{row.code}</span>
            </header>
            <h3 className="gl-item__name" title={row.title}>
              {row.title}
            </h3>
            <p className="gl-item__price">
              <strong>{low === high ? formatPrice(toSatang(low)) : `${formatPrice(toSatang(low))}–${formatPrice(toSatang(high))}`}</strong>
              <small>บาท/{units.length === 1 ? units[0] : "หน่วย"}</small>
            </p>
            <p className="gl-labour__summary">
              {row.variants.length > 1 ? `${row.variants.length} แบบย่อย · ` : ""}
              {rates.length} อัตรา ตามปริมาณงาน
            </p>
            <footer className="gl-item__actions gl-item__actions--single">
              <button type="button" className={open ? "gl-chip gl-chip--primary" : "gl-chip"} onClick={() => onToggle(row.code)} aria-expanded={open}>
                {open ? "กำลังดูอัตราอยู่" : `ดูอัตราทั้งหมด (${rates.length})`}
              </button>
            </footer>
          </article>
        );
      })}
        </Fragment>
      ))}
    </div>
  );
}

function FocusPanel({
  row,
  provinceName,
  history,
  historyLoading,
  windowMonths,
  onClose,
  onAdd,
  inBasket
}: {
  row: LedgerRow;
  provinceName: string;
  history: { code: string; months: MonthKey[]; values: (number | null)[] } | null;
  historyLoading: boolean;
  windowMonths: MonthKey[];
  onClose: () => void;
  onAdd: () => void;
  inBasket: boolean;
}) {
  const months = history?.months ?? windowMonths;
  const values = history?.values ?? row.series;
  return (
    <section className="gl-focus" aria-label={`รายละเอียดของ ${row.name}`}>
      <button type="button" className="gl-focus__close" onClick={onClose} aria-label="ปิดแผงคำตอบ">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <div className="gl-focus__grid">
        <div className="gl-focus__answer">
          <p className="gl-focus__where">
            {row.catName} · {provinceName} · {formatMonthKeyLong(row.month)}
          </p>
          <h2>{row.name}</h2>
          <p className="gl-focus__price">
            <strong>{formatPrice(toSatang(row.price))}</strong>
            <span>บาท ต่อ {row.unit}</span>
          </p>
          <div className="gl-focus__row">
            <MoveTag row={row} />
            <span className="gl-tag gl-tag--quiet">รวมภาษีมูลค่าเพิ่ม {formatPrice(toSatang(row.priceVat))} บาท</span>
          </div>
          <dl className="gl-focus__facts">
            <div>
              <dt>รหัสสินค้าของผู้ประกาศ</dt>
              <dd>{row.code}</dd>
            </div>
            <div>
              <dt>แหล่งข้อมูล</dt>
              <dd>สำนักงานนโยบายและยุทธศาสตร์การค้า กระทรวงพาณิชย์</dd>
            </div>
          </dl>
          <p className="gl-focus__caveat">
            ราคานี้เป็นราคาสืบของจังหวัด ยังไม่รวมค่าขนส่งถึงหน่วยงานและยังไม่ผ่านการทบทวนของโครงการ
            จึงเป็นตัวตั้งต้นของค่าวัสดุ ไม่ใช่ค่าวัสดุที่พร้อมขึ้นแบบ ปร.4
          </p>
          <button type="button" className="gl-chip gl-chip--primary gl-focus__add" onClick={onAdd} disabled={inBasket}>
            {inBasket ? "อยู่ในรายการแล้ว" : "หยิบเข้ารายการ"}
          </button>
        </div>
        <div className="gl-focus__chart">
          {historyLoading ? <p className="gl-focus__loading">กำลังอ่านราคาย้อนหลัง 24 เดือน</p> : null}
          <TrendChart series={values} months={months} unit={row.unit} />
        </div>
      </div>
    </section>
  );
}

/**
 * โครงระหว่างรอราคาชุดแรก
 *
 * ใช้กริดและการ์ดชุดเดียวกับของจริง เพื่อให้พื้นที่ไม่กระโดดตอนของจริงมาถึง
 * รอบก่อนโครงนี้ยังเรียกคลาสชุดเก่าที่ถูกลบไปแล้ว มันจึงแสดงเป็นก้อนเปล่าที่ไม่มีรูปร่าง
 */
function LedgerSkeleton() {
  return (
    <div className="gl-items" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="gl-item gl-item--ghost" style={{ "--i": index } as React.CSSProperties}>
          <span className="gl-ghost gl-ghost--sm" />
          <span className="gl-ghost gl-ghost--lg" />
          <span className="gl-ghost gl-ghost--md" />
          <span className="gl-ghost gl-ghost--sm" />
        </div>
      ))}
    </div>
  );
}

function BasketBar({
  basket,
  total,
  open,
  onToggle,
  onQuantity,
  onRemove
}: {
  basket: BasketEntry[];
  total: bigint;
  open: boolean;
  onToggle: () => void;
  onQuantity: (key: string, quantity: number) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <div className={open ? "gl-basket is-open" : "gl-basket"}>
      <div className="container gl-basket__bar">
        <button type="button" className="gl-basket__toggle" onClick={onToggle} aria-expanded={open}>
          รายการที่หยิบไว้
          <span className="gl-chip__count">{basket.length}</span>
        </button>
        <p className="gl-basket__total">
          ค่างานต้นทุนรวม <strong>{formatPrice(total)}</strong> บาท
        </p>
      </div>
      {open ? (
        <div className="container gl-basket__panel">
          <table>
            <thead>
              <tr>
                <th scope="col">รายการ</th>
                <th scope="col">ราคาต่อหน่วย</th>
                <th scope="col">ปริมาณ</th>
                <th scope="col">เป็นเงิน</th>
                <th scope="col"><span className="gl-sr">เอาออก</span></th>
              </tr>
            </thead>
            <tbody>
              {basket.map((line) => (
                <tr key={line.key}>
                  <td>
                    <strong>{line.name}</strong>
                    <small>{line.origin}</small>
                  </td>
                  <td className="gl-num">
                    {formatPrice(line.unitSatang)}
                    <small> บาท/{line.unit}</small>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.quantity}
                      onChange={(event) => onQuantity(line.key, Number(event.target.value) || 0)}
                      aria-label={`ปริมาณของ ${line.name}`}
                    />
                  </td>
                  <td className="gl-num">{formatPrice(lineCost(line.unitSatang, line.quantity))}</td>
                  <td>
                    <button type="button" className="gl-basket__remove" onClick={() => onRemove(line.key)} aria-label={`เอา ${line.name} ออก`}>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="form-note">
            ทุกบรรทัดจำเดือนและแหล่งของราคาที่หยิบมา ตอนส่งต่อเข้างานประมาณราคาจึงตรวจย้อนได้ว่า
            ตัวเลขนี้มาจากประกาศฉบับไหน เดือนไหน
          </p>
        </div>
      ) : null}
    </div>
  );
}

export type { UnitPriceRow, LabourRow, LedgerAnswer, Province };
