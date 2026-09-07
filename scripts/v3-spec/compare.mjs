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
  { name: "หัวเรื่องการ์ด", canvas: ".hcard h3", live: ".v3-hcard__title", keys: ["h"] }
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

const canvas = await boxes(canvasPage, MAP.map((row) => row.canvas), 1280);
const live = await boxes(livePage, MAP.map((row) => row.live), null);
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
 * ข้อในสมุดที่ตัวเทียบยืนยันไม่ได้ แบ่งเป็นสองชนิด
 *
 * ชนิดแรกคือข้อที่มีชื่อตรงกับแผนที่ แต่รอบนี้วัดแล้วไม่ต่าง — **หมดอายุแล้ว** ต้องเอาออก
 * ชนิดที่สองคือข้อที่ไม่มีชื่อในแผนที่เลย เช่นเรื่องฟอนต์ทั้งหน้าหรือถ้อยคำ ซึ่งวัดเป็นกล่องไม่ได้
 * ข้อพวกนั้นต้องมี `"unmeasured": true` กำกับไว้ในสมุด เพื่อบอกว่าจงใจไม่มีตัวตรวจ
 */
const mapped = new Set(MAP.map((row) => row.name));
const expired = ledger.filter((entry) => mapped.has(entry.name) && !stillTrue.has(entry.name));
const unmeasured = ledger.filter((entry) => !mapped.has(entry.name));
const undeclared = unmeasured.filter((entry) => entry.unmeasured !== true);

const heading = (text) => console.log(`\n${text}\n${"-".repeat(text.length)}`);

heading(`ตรง — ${same.length} จุด`);
for (const name of same) console.log(` ${name}`);

heading(`ต่างแต่มีเหตุผล — ${excusedRows.length} จุด`);
for (const row of excusedRows) console.log(` ${row.name}\n   ${row.detail}\n   เหตุผล: ${row.why}`);

heading(`ต่างโดยไม่มีใครรู้ — ${unknown.length} จุด`);
for (const row of unknown) console.log(` ${row.name}\n   ${row.detail}`);

heading(`ข้อยกเว้นที่หมดอายุ — ${expired.length} ข้อ`);
for (const entry of expired) console.log(` ${entry.name} — วัดแล้วไม่ต่างอีกแล้ว เอาออกจากสมุดได้`);

if (undeclared.length > 0) {
  heading(`ข้อยกเว้นที่ไม่มีตัวตรวจและไม่ได้กำกับไว้ — ${undeclared.length} ข้อ`);
  for (const entry of undeclared) console.log(` ${entry.name} — เพิ่มชื่อลงแผนที่ หรือใส่ "unmeasured": true พร้อมเหตุผล`);
}

console.log("");
const broken = unknown.length + expired.length + undeclared.length;
process.exitCode = broken === 0 ? 0 : 1;
