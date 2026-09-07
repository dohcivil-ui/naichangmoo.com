/**
 * เทียบผืนออกแบบรุ่นสามกับหน้าจริง แล้วแยกผลเป็นสามกอง
 *
 *   ตรง                  ต่างไม่เกินเกณฑ์ ไม่ต้องทำอะไร
 *   ต่างแต่มีเหตุผล        อยู่ในสมุดข้อยกเว้น พร้อมเหตุผลและวันที่ตัดสิน
 *   ต่างโดยไม่มีใครรู้      กองนี้คือบั๊ก **ต้องว่างก่อนบอกว่าบล็อกไหนเสร็จ**
 *
 * แผนที่จับคู่จำเป็นเพราะผืนกับโค้ดตั้งชื่อคนละแบบ — ผืนใช้ `.nl` เราใช้ `.v3-nl`
 * และของหลายชิ้นในผืนไม่มีคลาสเลยเพราะเป็น inline style ล้วน
 *
 * **สมุดข้อยกเว้นเน่าไม่ได้** ตัวเทียบจึงตรวจด้วยว่าทุกข้อในสมุดยังชี้ความต่างที่มีอยู่จริง
 * วันที่ทะเบียนช่องทางถูกกรอก ข้อ "วงไอคอนช่องทาง ไม่มีสักวง" จะกลายเป็นเท็จทันที
 * ข้อยกเว้นที่หมดอายุคือรูของรั้ว ไม่ใช่บรรทัดที่ไม่มีพิษภัย · กฎเดียวกับที่
 * `palette-fence.test.ts` ใช้กับบัญชียกเว้นของมันเอง
 *
 * ต้องมี `serve-canvas.mjs` ที่ :4173 และ dev server ที่ :3000
 * รัน: node scripts/v3-spec/compare.mjs
 */
import { loadPlaywright } from "./playwright.mjs";
import { readFile } from "node:fs/promises";

const { chromium } = await loadPlaywright();

const CANVAS = "http://localhost:4173/";
const LIVE = "http://localhost:3000/";
const LEDGER = "docs/design/v3-deliberate-differences.json";
/** เกินเท่านี้ถือว่าต่าง — หนึ่งพิกเซลเป็นเรื่องของการปัดเศษ ไม่ใช่ความต่างของการออกแบบ */
const TOLERANCE = 1;

/**
 * แผนที่จับคู่ · `canvas` คือ selector ในผืน `live` คือ selector ในหน้าจริง
 * `keys` คือสิ่งที่ต้องเท่ากัน ไม่ใส่ = เทียบทั้งกว้างและสูง
 *
 * เพิ่มบรรทัดตอนบล็อกใหม่ลง · เปิด `out/canvas-1280.json` ที่ `extract-canvas.mjs`
 * เขียนไว้ ดูว่ามีอะไรอยู่ตรงไหนก่อนเขียน selector ของฝั่งผืน
 */
const MAP = [
  { name: "แถบบน", canvas: ":scope > div:nth-child(2) > div:nth-child(1)", live: ".v3-header", keys: ["h"] },
  { name: "แถบหมวด", canvas: ":scope > div:nth-child(2) > div:nth-child(2)", live: ".v3-catbar", keys: ["h"] },
  { name: "ตราคำ", canvas: ".nl img", live: ".v3-header__brand img" },
  { name: "ช่องสองบรรทัดในแถบบน", canvas: ".nl-item", live: ".v3-hslot", keys: ["h"] },
  { name: "ไอคอนของช่อง", canvas: ".nl-item svg", live: ".v3-hslot__icon svg" },
  { name: "วงไอคอนช่องทาง", canvas: ".nl-icon", live: ".v3-header__channel" },
  { name: "ปุ่มขอใบเสนอราคา", canvas: ".btn-primary", live: ".v3-header__right .button", keys: ["h"] },
  { name: "แท็บแอปทั้งหมด", canvas: ".scp0", live: ".v3-catbar__all", keys: ["h"] },
  { name: "แท็บในแถบหมวด", canvas: ".nl-tab", live: ".v3-catbar__tab", keys: ["h"] },
  { name: "แบนเนอร์", canvas: ".card-hi", live: ".v3-banner" },
  { name: "กล่องข้อความบนแบนเนอร์", canvas: ".card-hi > div:has(h1)", live: ".v3-banner__text", keys: ["w"] },
  { name: "ป้ายสิทธิ์บนแบนเนอร์", canvas: ".tag", live: ".v3-banner .v3-tag", keys: ["h"] },
  { name: "หัวเรื่องสไลด์", canvas: ".card-hi h1", live: ".v3-banner__title", keys: ["w"] },
  { name: "ปุ่มหลักบนแบนเนอร์", canvas: ".btn-shop", live: ".v3-banner__actions .button", keys: ["h"] },
  { name: "การ์ด Hermes", canvas: ".hcard", live: ".v3-hcard" },
  { name: "โปสเตอร์", canvas: ".hcard img", live: ".v3-hcard__poster" },
  { name: "ขีดแดงในการ์ด", canvas: ".hline", live: ".v3-hline" },
  { name: "หัวเรื่องการ์ด", canvas: ".hcard h3", live: ".v3-hcard__title", keys: ["h"] },
  { name: "หัวบล็อกโปรโมชั่น", canvas: "#promo > div:first-child", live: ".v3-promo__head", keys: ["h"] },
  { name: "ช่องนาฬิกา", canvas: "#promo .hd", live: ".v3-promo__clock-cell", keys: ["h"] },
  { name: "การ์ดโปรโมชั่น", canvas: "#promo .card", live: ".v3-promo__card" },
  { name: "ภาพบนการ์ดโปรโมชั่น", canvas: "#promo .card img", live: ".v3-promo__image" },
  { name: "ป้ายสิทธิ์บนการ์ดโปรโมชั่น", canvas: "#promo .card span", live: ".v3-promo__badge", keys: ["h"] },
  { name: "ปุ่มบนการ์ดโปรโมชั่น", canvas: "#promo .btn-shop", live: ".v3-promo__action .button", keys: ["h"] }
];

async function boxes(page, selectors, boardWidth) {
  return page.evaluate(
    ({ selectors, boardWidth }) => {
      /* ในผืนต้องหาอาร์ตบอร์ดก่อนแล้วค้นเฉพาะข้างใน เพราะผืนมีสองอาร์ตบอร์ดวางเรียงกัน
         และคลาสเดียวกันมีอยู่ในทั้งสองใบ */
      let root = document;
      if (boardWidth) {
        const board = [...document.querySelectorAll("div")].find((el) => {
          const box = el.getBoundingClientRect();
          return Math.round(box.width) === boardWidth && box.height > 500;
        });
        if (!board) return {};
        root = board;
      }
      const out = {};
      for (const selector of selectors) {
        const el = root.querySelector(selector);
        if (!el) {
          out[selector] = null;
          continue;
        }
        const box = el.getBoundingClientRect();
        out[selector] = { w: Number(box.width.toFixed(2)), h: Number(box.height.toFixed(2)) };
      }
      return out;
    },
    { selectors, boardWidth }
  );
}

const ledger = JSON.parse(await readFile(LEDGER, "utf8"));
const excused = new Map(ledger.map((entry) => [entry.name, entry]));

const browser = await chromium.launch({ channel: "msedge" });
const canvasPage = await browser.newPage({ viewport: { width: 1900, height: 1400 } });
await canvasPage.goto(CANVAS, { waitUntil: "networkidle" });
await canvasPage.waitForTimeout(1200);
const livePage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
/* `networkidle` ใช้กับ dev server ไม่ได้ มันเปิด websocket ของ HMR ค้างไว้ตลอด
   เครือข่ายจึงไม่มีวันเงียบ · รอสิ่งที่จะวัดจริงแทน ซึ่งตรงกับที่ต้องการมากกว่าอยู่แล้ว */
await livePage.goto(LIVE, { waitUntil: "domcontentloaded" });
await livePage.locator(".v3-hcard__poster").waitFor({ state: "visible" });
/* นาฬิกาโผล่หลัง hydrate เท่านั้น การรอมันจึงพิสูจน์ว่าหน้าพร้อมวัดครบทุกส่วน
   ไม่ใช่แค่ส่วนที่ server เขียนมา · ถ้าบล็อกโปรโมชั่นหมดอายุแล้วจะไม่มีนาฬิกา จึงไม่รอค้าง */
await livePage.locator(".v3-promo__clock-cell").first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});

const canvas = await boxes(canvasPage, MAP.map((row) => row.canvas), 1280);
const live = await boxes(livePage, MAP.map((row) => row.live), null);

/**
 * ตัวตรวจในตัวสำหรับข้อที่วัดด้วยกล่องไม่ได้ แต่วัดด้วยวิธีอื่นได้
 *
 * `hitTarget` วัดเขตกดจริงของขีดบอกสไลด์ · กล่องของปุ่มคือ 22x3 ตามผืน ส่วนเขตกด
 * เป็น `::after` ที่ไม่กินพื้นที่ layout จึงไม่โผล่ใน `getBoundingClientRect` ของตัวปุ่ม
 * **แต่วัดได้** ด้วยการยิงจุดที่มุมของกล่องขนาดเกณฑ์ แล้วดูว่าโดนปุ่มตัวเดิมไหม
 * ซึ่งตรงกับความหมายของเกณฑ์มากกว่าการอ่านตัวเลข inset — เป้ากดคือที่ที่กดแล้วโดน
 *
 * เลขนี้เคยพลาดมาแล้วหนึ่งพิกเซล และถอยลงเงียบ ๆ ได้ทุกครั้งที่มีคนแตะขอบปุ่มหรือ inset
 */
const builtIn = {
  async hitTarget(entry) {
    const size = entry.minHitTarget ?? 24;
    const result = await livePage.evaluate((want) => {
      const dot = document.querySelector(".button--slide-dot");
      if (!dot) return { ok: false, detail: "หาขีดบอกสไลด์ในหน้าไม่เจอ" };
      const box = dot.getBoundingClientRect();
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const half = want / 2;
      /* ยิงสี่มุมของกล่องขนาดเกณฑ์ ถ้ามุมไหนไม่โดนปุ่มตัวเดิม แปลว่าเป้ากดเล็กกว่าเกณฑ์ */
      const corners = [
        [cx - half + 0.5, cy - half + 0.5],
        [cx + half - 0.5, cy - half + 0.5],
        [cx - half + 0.5, cy + half - 0.5],
        [cx + half - 0.5, cy + half - 0.5]
      ];
      const missed = corners.filter(([x, y]) => {
        const hit = document.elementFromPoint(x, y);
        return hit !== dot && !dot.contains(hit);
      });
      return {
        ok: missed.length === 0,
        detail: missed.length === 0
          ? `กดโดนครบทั้งสี่มุมของกล่อง ${want}x${want}`
          : `กดไม่โดน ${missed.length} มุมจากสี่ ของกล่อง ${want}x${want} — เป้ากดเล็กกว่าเกณฑ์`
      };
    }, size);
    return result;
  }
};

/**
 * ตรวจว่าสัญญาในสมุดยังครบกำหนดไหม
 *
 * ข้อที่เขียนว่า "ยังไม่มีตัวตรวจเพราะบล็อกนั้นยังไม่ลง" เป็นสัญญา ไม่ใช่ข้อยกเว้น
 * วันที่บล็อกลงหน้าจริง สัญญานั้นครบกำหนด · ถ้าไม่มีอะไรเตือน คำว่า "ตอนขั้นที่ 3"
 * จะกลายเป็น "ไม่เคย" อย่างเงียบ ๆ ซึ่งเป็นวิธีตายมาตรฐานของหนี้ทุกก้อน
 */
const blockLanded = {};
for (const entry of ledger.filter((row) => row.dueWhen)) {
  blockLanded[entry.name] = await livePage.evaluate(
    (selector) => document.querySelector(selector) !== null,
    entry.dueWhen
  );
}

const hitChecks = {};
for (const entry of ledger.filter((row) => row.checkedBy?.startsWith("compare.mjs:"))) {
  const fn = builtIn[entry.checkedBy.split(":")[1]];
  hitChecks[entry.name] = fn ? await fn(entry) : { ok: false, detail: `ไม่มีตัวตรวจในตัวชื่อ ${entry.checkedBy}` };
}

await browser.close();

const same = [];
const excusedRows = [];
const unknown = [];
/** ชื่อข้อยกเว้นที่ตัวเทียบยืนยันได้ว่ายังชี้ความต่างจริง */
const stillTrue = new Set();

for (const row of MAP) {
  const fromCanvas = canvas[row.canvas];
  const fromLive = live[row.live];
  const entry = excused.get(row.name);

  if (!fromCanvas || !fromLive) {
    const detail = !fromCanvas ? "หาในผืนไม่เจอ" : "หาในหน้าจริงไม่เจอ";
    if (entry) {
      stillTrue.add(row.name);
      excusedRows.push({ name: row.name, detail, why: entry.why });
    } else {
      unknown.push({ name: row.name, detail });
    }
    continue;
  }

  const keys = row.keys ?? ["w", "h"];
  const diffs = keys
    .map((key) => ({ key, canvas: fromCanvas[key], live: fromLive[key], gap: Number((fromLive[key] - fromCanvas[key]).toFixed(2)) }))
    .filter((diff) => Math.abs(diff.gap) > TOLERANCE);

  if (diffs.length === 0) {
    same.push(row.name);
    continue;
  }

  const detail = diffs
    .map((diff) => `${diff.key}: ผืน ${diff.canvas} → จริง ${diff.live} (${diff.gap > 0 ? "+" : ""}${diff.gap})`)
    .join(" · ");

  if (entry) {
    stillTrue.add(row.name);
    excusedRows.push({ name: row.name, detail, why: entry.why });
  } else {
    unknown.push({ name: row.name, detail });
  }
}

/**
 * ทุกข้อในสมุดต้องพิสูจน์ตัวเองได้ด้วยทางใดทางหนึ่ง ห้ามยืนยันด้วยประโยคเฉย ๆ
 *
 *   อยู่ในแผนที่          วัดเป็นกล่องได้ ต้องยังต่างจริง ไม่งั้นหมดอายุ
 *   `checkedBy`         มีตัวตรวจอยู่ที่อื่น ไฟล์นั้นต้องมีจริง หรือตัวตรวจในตัวต้องผ่าน
 *   `effectOf`          เป็นผลของข้ออื่น ชื่อที่อ้างต้องมีในสมุดและต้องยังต่างจริง
 *   `dueWith`           สัญญาว่าจะมีตัวตรวจตอนบล็อกนั้นลง ครบกำหนดแล้วต้องทวง
 *   `unmeasured`        วัดไม่ได้จริง ๆ ต้องมีเหตุผลกำกับ
 */
const mapped = new Set(MAP.map((row) => row.name));
const named = new Set(ledger.map((entry) => entry.name));
const problems = [];

for (const entry of ledger) {
  if (mapped.has(entry.name)) {
    if (!stillTrue.has(entry.name)) problems.push(`${entry.name} — อยู่ในแผนที่แต่วัดแล้วไม่ต่างอีกแล้ว หมดอายุ เอาออกจากสมุดได้`);
    continue;
  }
  if (entry.checkedBy) {
    if (entry.checkedBy.startsWith("compare.mjs:")) {
      const result = hitChecks[entry.name];
      if (!result?.ok) problems.push(`${entry.name} — ตัวตรวจในตัวไม่ผ่าน: ${result?.detail}`);
    } else {
      const path = new URL(entry.checkedBy, import.meta.url);
      const exists = await readFile(path, "utf8").then(() => true).catch(() => false);
      if (!exists) problems.push(`${entry.name} — อ้างว่าตรวจด้วย ${entry.checkedBy} แต่ไฟล์นั้นไม่มีแล้ว`);
    }
    continue;
  }
  if (entry.effectOf) {
    const missing = entry.effectOf.filter((name) => !named.has(name));
    if (missing.length > 0) problems.push(`${entry.name} — อ้างว่าเป็นผลของ ${missing.join(" กับ ")} ซึ่งไม่มีในสมุดแล้ว`);
    const dead = entry.effectOf.filter((name) => named.has(name) && mapped.has(name) && !stillTrue.has(name));
    if (dead.length > 0) problems.push(`${entry.name} — อ้างว่าเป็นผลของ ${dead.join(" กับ ")} ซึ่งวัดแล้วไม่ต่างอีกแล้ว`);
    continue;
  }
  if (entry.dueWith) {
    if (blockLanded[entry.name]) problems.push(`${entry.name} — บล็อก ${entry.dueWith} ลงหน้าแล้ว ครบกำหนดต้องมีตัวตรวจ ไม่ใช่ค้างเป็นหนี้ต่อ`);
    continue;
  }
  if (entry.unmeasured !== true) problems.push(`${entry.name} — ไม่มีทางพิสูจน์ตัวเองสักทาง เพิ่มลงแผนที่ หรือใส่ checkedBy effectOf dueWith หรือ unmeasured`);
}

const heading = (text) => console.log(`\n${text}\n${"-".repeat(text.length)}`);

heading(`ตรง — ${same.length} จุด`);
for (const name of same) console.log(` ${name}`);

heading(`ต่างแต่มีเหตุผล — ${excusedRows.length} จุด`);
for (const row of excusedRows) console.log(` ${row.name}\n   ${row.detail}\n   เหตุผล: ${row.why}`);

heading(`ต่างโดยไม่มีใครรู้ — ${unknown.length} จุด`);
for (const row of unknown) console.log(` ${row.name}\n   ${row.detail}`);

heading(`ตัวตรวจในตัว — ${Object.keys(hitChecks).length} ข้อ`);
for (const [name, result] of Object.entries(hitChecks)) console.log(` ${result.ok ? "ผ่าน" : "ตก  "} ${name} — ${result.detail}`);

heading(`สัญญาที่ยังไม่ครบกำหนด — ${Object.keys(blockLanded).length} ข้อ`);
for (const [name, landed] of Object.entries(blockLanded)) {
  const entry = excused.get(name);
  console.log(` ${landed ? "ครบกำหนดแล้ว" : "ยังไม่ถึง   "} ${name} — รอบล็อก ${entry.dueWith}`);
}

heading(`สมุดที่พิสูจน์ตัวเองไม่ได้ — ${problems.length} ข้อ`);
for (const problem of problems) console.log(` ${problem}`);

console.log("");
process.exitCode = unknown.length + problems.length === 0 ? 0 : 1;
