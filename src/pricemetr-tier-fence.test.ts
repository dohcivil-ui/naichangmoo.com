import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { FREE_HISTORY_MONTHS, FREE_LINE_LIMIT, allowanceOf } from "@/lib/pricemetr-tier";

/**
 * ด่านตรวจสิทธิ์ของ PRICEMETR (IP-164)
 *
 * เอกสาร `docs/requirements/pricemetr-membership.md` มีข้อห้ามสี่ข้อ ทุกข้อเขียนไว้ตั้งแต่
 * 2026-08-26 แล้วโค้ดไม่เคยบังคับสักข้อจนถึงวันนี้ ไฟล์นี้คือที่ที่ข้อห้ามพวกนั้นกัดได้จริง
 *
 * บทเรียนที่ทำให้ต้องมีไฟล์นี้ — เซสชัน 2026-08-29 เจอบั๊กตระกูล "ประกาศแล้วแต่เป็นหมัน"
 * สี่ตัวติดกัน ทั้งหมดอ่านโค้ดแล้วเหมือนสั่งครบแต่ผลจริงไม่เกิด เทสต์ที่อ่านแต่ตัวอักษร
 * ในไฟล์ก็เป็นหมันได้แบบเดียวกัน ข้อแรกของไฟล์นี้จึง **เรียก route จริง** ไม่ใช่ค้นคำ
 */

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

/**
 * อ่านเฉพาะโค้ด ตัดคอมเมนต์ทิ้ง
 *
 * กฎที่ห้ามเขียนโค้ดแบบหนึ่งไม่ควรยิงใส่คอมเมนต์ที่อธิบายว่าทำไมถึงห้าม — ด่าน `await import()`
 * ข้างล่างจับคอมเมนต์ของตัวเองได้ในรอบแรก ซึ่งทำให้คนถัดไปต้องลบคำอธิบายทิ้งเพื่อให้เทสต์เขียว
 */
const codeOf = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const PRICEMETR_SOURCES = [
  "src/lib/pricemetr-tier.ts",
  "src/server/pricemetr-access.ts",
  "src/server/price-basket.ts",
  "src/server/actions/price-basket.ts",
  "src/app/api/prototype/price-history/route.ts",
  "src/app/api/prototype/price-ledger/route.ts",
  "src/app/prototype/price-check/page.tsx",
  "src/components/prototype/price-workspace.tsx"
];

/* ------------------------------------------------------------------------------------------- */
/* หนึ่ง — ด่านจริงที่ยิงของจริง                                                                  */
/* ------------------------------------------------------------------------------------------- */

/** ของปลอมที่จำอาร์กิวเมนต์ไว้ให้ตรวจ — จำนวนเดือนที่วิ่งไปถึงต้นทางคือหลักฐานว่าด่านกัดจริง */
const readHistory = vi.fn(async (...args: unknown[]) => {
  void args;
  return [];
});
const readMaster = vi.fn(async () => ({ period: { end: { year: 2569, month: 7 } } }));
const getPricemetrAccess = vi.fn();

vi.mock("@/server/tpso-prices", () => ({
  readHistory: (...args: unknown[]) => readHistory(...args),
  readMaster: () => readMaster()
}));

vi.mock("@/server/pricemetr-access", () => ({
  getPricemetrAccess: () => getPricemetrAccess()
}));

const { POST } = await import("@/app/api/prototype/price-history/route");

const askFor = async (months: number, tier: "visitor" | "member_free" | "vip") => {
  readHistory.mockClear();
  getPricemetrAccess.mockResolvedValue({ signedIn: tier !== "visitor", ...allowanceOf(tier) });
  const response = await POST(
    new Request("http://localhost/api/prototype/price-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ province: "10", codes: ["1234567890123456"], months })
    })
  );
  const body = (await response.json()) as { monthsGranted: number; tier: string };
  // อาร์กิวเมนต์ที่สี่ของ readHistory คือจำนวนเดือนที่วิ่งไปถึง สนค. จริง
  const monthsSentUpstream = readHistory.mock.calls[0]?.[3] as number | undefined;
  return { body, monthsSentUpstream };
};

describe("ด่านสิทธิ์ของ price-history ต้องกัดจริง ไม่ใช่กัดบนกระดาษ", () => {
  it("สมาชิกฟรีขอ 24 เดือน ได้ 6 และคำขอที่วิ่งไปถึงต้นทางก็เป็น 6 ไม่ใช่ 24", async () => {
    const { body, monthsSentUpstream } = await askFor(24, "member_free");
    expect(body.monthsGranted).toBe(FREE_HISTORY_MONTHS);
    expect(monthsSentUpstream).toBe(FREE_HISTORY_MONTHS);
  });

  it("ผู้มาเยือนที่ยิงตรงด้วย curl ก็ถูกหนีบเหมือนกัน การกั้นไม่ได้อยู่ที่หน้าจอ", async () => {
    const { body, monthsSentUpstream } = await askFor(9999, "visitor");
    expect(body.monthsGranted).toBe(FREE_HISTORY_MONTHS);
    expect(monthsSentUpstream).toBe(FREE_HISTORY_MONTHS);
  });

  it("VIP ขอ 24 ได้ 24 — ด่านนี้ต้องไม่กั้นคนที่จ่ายแล้ว", async () => {
    const { body, monthsSentUpstream } = await askFor(24, "vip");
    expect(body.monthsGranted).toBe(24);
    expect(monthsSentUpstream).toBe(24);
  });

  it("คำตอบบอกระดับสิทธิ์กลับไปด้วย หน้าจอจะได้ไม่ต้องเดาว่ากราฟสั้นเพราะอะไร", async () => {
    const { body } = await askFor(24, "member_free");
    expect(body.tier).toBe("member_free");
  });
});

/* ------------------------------------------------------------------------------------------- */
/* สอง — ข้อห้ามสี่ข้อของเอกสารเส้นแบ่ง                                                            */
/* ------------------------------------------------------------------------------------------- */

describe("ข้อห้ามที่เอกสารเส้นแบ่งเขียนไว้", () => {
  it("ข้อ 1 ห้ามเบลอราคา — ไม่มีไฟล์ไหนของแอปนี้เรียก blur ใส่ตัวเลข", () => {
    const offenders = PRICEMETR_SOURCES.filter((rel) => /blur\s*\(|\bblurred\b|filter:\s*blur/i.test(read(rel)));
    // .gl-basket ใน globals.css ใช้ backdrop-filter blur กับพื้นหลังของแถบ ไม่ใช่กับราคา
    // จึงไม่อยู่ในบัญชีนี้ ส่วนไฟล์ของแอปห้ามมี blur ทุกรูปแบบ
    expect(offenders).toEqual([]);
  });

  it("ข้อ 2 ห้ามนับโควตาการค้นหา — price-ledger ไม่มีตัวนับและไม่มีเพดาน", () => {
    const ledger = read("src/app/api/prototype/price-ledger/route.ts");
    expect(ledger).not.toMatch(/quota|rateLimit|consumeRateLimit|searchCount|remainingSearches/i);
  });

  it("ข้อ 4 การกั้นตรวจที่เซิร์ฟเวอร์ — route ตัดสินจากสิทธิ์ ไม่ใช่จากค่าที่หน้าจอส่งมา", () => {
    const route = read("src/app/api/prototype/price-history/route.ts");
    // ต้องเป็น "เรียกใช้" ไม่ใช่ "import ไว้เฉย ๆ" — การถอดบรรทัดที่หนีบออกแล้วทิ้ง import ไว้
    // คือรูปแบบเดียวกับบั๊กตระกูลประกาศแล้วเป็นหมัน ที่อ่านโค้ดผ่านตาแล้วดูเหมือนยังกั้นอยู่
    expect(route).toMatch(/getPricemetrAccess\(/);
    expect(route).toMatch(/clampHistoryMonths\(/);
    // ค่าดิบจากหน้าจอต้องไม่เคยเดินทางไปถึง readHistory โดยตรง
    expect(route).not.toMatch(/readHistory\([^)]*body\.months/);
  });
});

/* ------------------------------------------------------------------------------------------- */
/* สาม — รูปร่างของโค้ดที่ทำให้ด่านนี้ยังตรวจสอบได้ในปีหน้า                                          */
/* ------------------------------------------------------------------------------------------- */

describe("รูปร่างของชั้นตัดสินสิทธิ์", () => {
  it("ชั้นตัดสินไม่รู้จักฐานข้อมูล จึงทดสอบครบทุกสถานะได้โดยไม่ต้องยก Postgres", () => {
    const tier = read("src/lib/pricemetr-tier.ts");
    expect(tier).not.toMatch(/from "@\/db"|from "@\/server\/|drizzle-orm|next\//);
  });

  it("ทางอ่านสิทธิ์ไม่เขียนอะไรลงฐานข้อมูล — สมาชิกฟรีไม่ใช่สภาพที่ต้องซ่อมด้วยการแอบเขียนแถว", () => {
    const access = read("src/server/pricemetr-access.ts");
    expect(access).not.toMatch(/\.insert\(|\.update\(|\.delete\(|transaction\(/);
  });

  it("ตัวเลข 50 กับ 6 มีบ้านหลังเดียว ไม่มีสำเนาที่สองให้ค้างเมื่อวันหนึ่งมันเปลี่ยน", () => {
    expect(FREE_LINE_LIMIT).toBe(50);
    expect(FREE_HISTORY_MONTHS).toBe(6);

    const copies = PRICEMETR_SOURCES.filter((rel) => rel !== "src/lib/pricemetr-tier.ts").filter((rel) =>
      /months:\s*(6|24)\b|lineLimit:\s*\d|limit\s*=\s*50\b/.test(read(rel))
    );
    expect(copies).toEqual([]);
  });
});

/* ------------------------------------------------------------------------------------------- */
/* สี่ — รายการที่หยิบไว้ (IP-163) คำวินิจฉัยที่ห้ามรื้อโดยไม่ถาม                                   */
/* ------------------------------------------------------------------------------------------- */

describe("รายการที่หยิบไว้", () => {
  const basket = read("src/server/price-basket.ts");

  it("นับบรรทัดในทรานแซกชันเดียวกับการเขียน ไม่ใช่ตรวจก่อนแล้วค่อยเขียน", () => {
    // สองแท็บที่กดพร้อมกันตอนอยู่ที่สี่สิบเก้าบรรทัดจะผ่านการตรวจทั้งคู่แล้วได้ห้าสิบเอ็ด
    // ถ้าการนับอยู่นอกทรานแซกชัน จึงตรวจว่าทั้งการนับและการกันอยู่ในบล็อกเดียวกัน
    const transaction = basket.slice(basket.indexOf("db.transaction("), basket.indexOf("return outcome.blocked"));
    expect(transaction).toMatch(/count\(\*\)/);
    expect(transaction).toMatch(/canPickAnotherLine\(/);
  });

  it("ส่งเข้าโครงการแล้วตะกร้าไม่ถูกล้าง — คัดลอก ไม่ใช่ย้าย", () => {
    const send = basket.slice(basket.indexOf("export async function sendBasketToProject"));
    expect(send).not.toMatch(/delete\(priceBasketLines\)|delete\(priceBaskets\)/);
  });

  it("ชั้น server action ไม่ตัดสินอะไรเอง ทุกด่านอยู่ชั้นล่าง", () => {
    const actions = read("src/server/actions/price-basket.ts");
    expect(actions).not.toMatch(/canPickAnotherLine|FREE_LINE_LIMIT|lineLimit|allowance\./);
  });

  it("ไฟล์ server action ห้ามใช้ await import() — คำขอจะค้างเงียบโดยไม่มี error ให้เห็น", () => {
    // เจ็บมาแล้ว 2026-08-29: listBasketTargetProjects เขียนด้วย await import() เพื่อให้ไฟล์บาง
    // ผลคือคำขอไม่ตอบและไม่โยน หน้าจอขึ้น "กำลังอ่านรายชื่อโครงการ" ค้างตลอดกาล
    // log ของเซิร์ฟเวอร์ไม่มีบรรทัดของ action นั้นเลย เพราะมันไม่เคยจบ
    // จับได้ตอนเปิดของจริงเท่านั้น เทสต์และ typecheck เขียวหมด
    const offenders = PRICEMETR_SOURCES.filter(
      (rel) => rel.includes("/actions/") && /await\s+import\(/.test(codeOf(rel))
    );
    expect(offenders).toEqual([]);
  });

  it("ที่มาของบรรทัดไม่ถูกเก็บเป็นข้อความ แต่สร้างจากหลักฐานทุกครั้ง", () => {
    // ข้อความแสดงผลที่แช่ไว้จะเน่าวันที่ถ้อยคำเปลี่ยน แล้วของเก่ากับของใหม่จะพูดคนละแบบ
    expect(basket).not.toMatch(/origin:\s*["'`]/);
    expect(read("src/db/schema.ts")).not.toMatch(/priceBasketLines[\s\S]{0,900}?origin:/);
  });

  it("บรรทัดเก็บหลักฐานครบทุกช่องที่ใบสรุปสัญญาไว้", () => {
    const schema = read("src/db/schema.ts");
    const table = schema.slice(schema.indexOf("priceBasketLines = pgTable"), schema.indexOf("priceSetLines = pgTable"));
    for (const column of ["source_key", "catalog_code", "province_code", "effective_month", "document_page", "rate_condition"]) {
      expect(table).toContain(column);
    }
  });
});

/* ------------------------------------------------------------------------------------------- */
/* ห้า — ตัวตรวจเองต้องยังกัด (IP-091)                                                            */
/* ------------------------------------------------------------------------------------------- */

describe("พิสูจน์ว่าตัวตรวจยังกัด", () => {
  it("กับดักที่วางไว้ต้องถูกจับได้ทุกอัน", () => {
    const blurTrap = ".gl-price { filter: blur(4px); }";
    expect(/blur\s*\(|\bblurred\b|filter:\s*blur/i.test(blurTrap)).toBe(true);

    const quotaTrap = "const remainingSearches = 10;";
    expect(/quota|rateLimit|consumeRateLimit|searchCount|remainingSearches/i.test(quotaTrap)).toBe(true);

    const passthroughTrap = "const series = await readHistory(province, codes, end, body.months ?? 24);";
    expect(/readHistory\([^)]*body\.months/.test(passthroughTrap)).toBe(true);

    const dbTrap = 'import { getDb } from "@/db";';
    expect(/from "@\/db"|from "@\/server\/|drizzle-orm|next\//.test(dbTrap)).toBe(true);

    const writeTrap = "await db.insert(appEntitlements).values({});";
    expect(/\.insert\(|\.update\(|\.delete\(|transaction\(/.test(writeTrap)).toBe(true);

    const copyTrap = "body: JSON.stringify({ months: 24 })";
    expect(/months:\s*(6|24)\b|lineLimit:\s*\d|limit\s*=\s*50\b/.test(copyTrap)).toBe(true);

    const dynamicImportTrap = 'const { listProjects } = await import("@/server/estimeter/project-repository");';
    expect(/await\s+import\(/.test(dynamicImportTrap)).toBe(true);
  });
});
