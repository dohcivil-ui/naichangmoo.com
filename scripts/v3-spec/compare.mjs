/**
 * เทียบผืนออกแบบรุ่นสามกับหน้าจริง แล้วแยกผลเป็นสามกอง — **ทั้งเดสก์ท็อปและมือถือ**
 *
 *   ตรง                  ต่างไม่เกินเกณฑ์ ไม่ต้องทำอะไร
 *   ต่างแต่มีเหตุผล        อยู่ในสมุดข้อยกเว้น พร้อมเหตุผลและวันที่ตัดสิน
 *   ต่างโดยไม่มีใครรู้      กองนี้คือบั๊ก **ต้องว่างทั้งสองความกว้างก่อนบอกว่าบล็อกไหนเสร็จ**
 *
 * **ทำไมต้องสองความกว้าง** `extract-canvas.mjs` ถอดผืนไว้ทั้ง 1280 และ 390 ตั้งแต่วันแรก
 * แต่ตัวเทียบตรึงไว้ที่ 1280 อย่างเดียว `canvas-390.json` จึงถูกถอดทิ้งไว้โดยไม่มีใครเปิดอ่าน
 * สักครั้ง · ผลคือเลข "ตรง 25 จุด กองที่สามว่าง" ที่รายงานกันมาตลอด เป็นเลขของเดสก์ท็อปล้วน
 * และไม่มีใครรู้เลยว่ามือถือตรงผืนไหม เจ้าของงานสั่ง 2026-09-07 ให้มือถือเข้าขอบเขต
 * เครื่องมือจึงต้องมองเห็นมันก่อน — **ทำมือถือโดยไม่มีตัววัด คือทำแล้วไม่มีใครรู้ว่าตรงไหม**
 *
 * **ผืนมือถือไม่ใช่ผืนเดสก์ท็อปที่ถูกบีบให้แคบ มันเป็นคนละโครง** นับคลาสในอาร์ตบอร์ด 390
 * แล้วไม่มี `.nl` `.nl-item` `.nl-icon` `.nl-tab` `.scp0` `.hcard` `.hline` เลยสักตัว ·
 * แบนเนอร์มือถือเป็น `.card` ไม่ใช่ `.card-hi` และไม่มีสไลด์ · นาฬิกาเป็นข้อความเดียว
 * ไม่ใช่สี่ช่อง · แผนที่จับคู่จึงต้องบอกเป็นรายแถวว่าแถวนี้วัดที่ใบไหน ด้วย selector ของใบนั้น
 *
 * **สมุดข้อยกเว้นเน่าไม่ได้** ตัวเทียบจึงตรวจด้วยว่าทุกข้อในสมุดยังชี้ความต่างที่มีอยู่จริง
 * วันที่ทะเบียนช่องทางถูกกรอก ข้อ "วงไอคอนช่องทาง ไม่มีสักวง" จะกลายเป็นเท็จทันที
 * ข้อยกเว้นที่หมดอายุคือรูของรั้ว ไม่ใช่บรรทัดที่ไม่มีพิษภัย · กฎเดียวกับที่
 * `palette-fence.test.ts` ใช้กับบัญชียกเว้นของมันเอง
 *
 * ต้องมี `serve-canvas.mjs` ที่ :4173 และ dev server ที่ :3000
 * รัน: node scripts/v3-spec/compare.mjs
 */
import { freezeAnimations, loadPlaywright } from "./playwright.mjs";
import { readFile } from "node:fs/promises";

const { chromium } = await loadPlaywright();

const CANVAS = "http://localhost:4173/";
const LIVE = "http://localhost:3000/";
const LEDGER = "docs/design/v3-deliberate-differences.json";
/** เกินเท่านี้ถือว่าต่าง — หนึ่งพิกเซลเป็นเรื่องของการปัดเศษ ไม่ใช่ความต่างของการออกแบบ */
const TOLERANCE = 1;

/** อาร์ตบอร์ดที่ผืนวาดไว้ · เรียงจากกว้างไปแคบ เพราะรายงานอ่านจากบนลงล่าง */
const WIDTHS = [1280, 390];

/**
 * ทางลัดไปยังบล็อกลำดับที่ n ของอาร์ตบอร์ด
 *
 * ผืนแทบไม่ใช้คลาสเลย เกือบทุกชิ้นเป็น inline style ล้วน การอ้างตำแหน่งจึงเป็นทางเดียว
 * ที่มีสำหรับบล็อกระดับบน · **ลำดับบล็อกของสองใบไม่ตรงกัน** ใบมือถือมีแถบประกาศบาง ๆ
 * เป็นบล็อกแรก ทุกอย่างจึงเลื่อนลงหนึ่ง — นี่คือเหตุผลที่แต่ละแถวต้องเขียน selector แยกต่อใบ
 * ไม่ใช่ใช้ตัวเดียวกันแล้วหวังว่าจะตรง
 */
const section = (n) => `:scope > div:nth-child(2) > div:nth-child(${n})`;

/** `live` เขียนเป็นสตริงเดียวหรือแยกรายความกว้างก็ได้ — ตัวนี้คลี่ให้เป็นค่าเดียว */
const liveSelector = (row, width) => (typeof row.live === "string" ? row.live : row.live[width]);

/**
 * `keys` เขียนเป็นรายการเดียวหรือแยกรายความกว้างก็ได้ — ตัวนี้คลี่ให้เป็นรายการเดียว
 *
 * แยกรายความกว้างจำเป็นเมื่อของชิ้นเดียวกันในสองใบมีของให้เทียบไม่เท่ากัน เช่นแถบนาฬิกา
 * ที่ใบเดสก์ท็อปมีทั้งคำนำหน้าและระยะระหว่างชิ้น ส่วนใบมือถือเป็นสายตัวเลขเปล่า ๆ
 * ที่ไม่มีทั้งสองอย่าง · เขียนคีย์ชุดเดียวจะบังคับให้ใบมือถือถูกเทียบกับของที่มันไม่มี
 */
const rowKeys = (row, width) => {
  const keys = row.keys ?? ["w", "h"];
  return Array.isArray(keys) ? keys : keys[width] ?? ["w", "h"];
};

/**
 * แผนที่จับคู่ · `canvas` บอกว่าแต่ละความกว้างใช้ selector ไหนในผืน
 * `live` คือ selector ในหน้าจริง เขียนเป็นสตริงเดียวได้เมื่อใช้ตัวเดียวกันทั้งสองความกว้าง
 * หรือเขียนแยกรายความกว้างแบบเดียวกับ `canvas` เมื่อไม่ใช่
 * `keys` คือสิ่งที่ต้องเท่ากัน ไม่ใส่ = เทียบทั้งกว้างและสูง
 *
 * **ทำไม `live` ต้องแยกรายความกว้างได้ด้วย** ปกติหน้าจริงเป็น DOM เดียวที่เปลี่ยนหน้าตา
 * ด้วย CSS จึงใช้ selector ตัวเดียวได้ · แต่ selector ของ**ผืน**ตัวเดียวกันอาจชี้ของคนละชิ้น
 * ในสองใบ เช่น `#promo .hd` ที่ใบเดสก์ท็อปคือช่องนาฬิกาช่องแรก ส่วนใบมือถือคือนาฬิกาทั้งสาย
 * เพราะผืนมือถือไม่ได้แยกเป็นช่อง · ถ้าฝั่งจริงยังใช้ selector เดิม จะกลายเป็นการเทียบ
 * ช่องเดียวกับทั้งสาย ซึ่งได้ตัวเลขออกมาแต่ไม่ได้แปลว่าอะไรเลย
 *
 * **ไม่มีคีย์ของความกว้างไหน = ผืนใบนั้นไม่มีของชิ้นนี้** ซึ่งเป็นคำตอบที่ถูก ไม่ใช่ช่องที่ลืมกรอก
 * รายงานจะบอกว่าแถวนั้นไม่ได้วัดที่ใบนั้น เพื่อไม่ให้เงียบหายไปเฉย ๆ
 *
 * เพิ่มบรรทัดตอนบล็อกใหม่ลง · เปิด `out/canvas-1280.json` กับ `out/canvas-390.json`
 * ที่ `extract-canvas.mjs` เขียนไว้ ดูว่ามีอะไรอยู่ตรงไหนก่อนเขียน selector ของฝั่งผืน
 */
const MAP = [
  { name: "แถบบน", live: ".v3-header", keys: ["h"], canvas: { 1280: section(1), 390: section(2) } },
  { name: "แถบหมวด", live: ".v3-catbar", keys: ["h"], canvas: { 1280: section(2), 390: section(3) } },
  { name: "ตราคำ", live: ".v3-header__brand img", canvas: { 1280: ".nl img", 390: `${section(2)} img` } },
  { name: "ช่องสองบรรทัดในแถบบน", live: ".v3-hslot", keys: ["h"], canvas: { 1280: ".nl-item" } },
  { name: "ไอคอนของช่อง", live: ".v3-hslot__icon svg", canvas: { 1280: ".nl-item svg" } },
  { name: "วงไอคอนช่องทาง", live: ".v3-header__channel", canvas: { 1280: ".nl-icon" } },
  { name: "ปุ่มขอใบเสนอราคา", live: ".v3-header__right .button", keys: ["h"], canvas: { 1280: ".btn-primary" } },
  { name: "แท็บแอปทั้งหมด", live: ".v3-catbar__all", keys: ["h"], canvas: { 1280: ".scp0" } },
  { name: "แท็บในแถบหมวด", live: ".v3-catbar__tab", keys: ["h"], canvas: { 1280: ".nl-tab", 390: `${section(3)} span` } },
  { name: "แบนเนอร์", live: ".v3-banner", canvas: { 1280: ".card-hi", 390: `${section(4)} .card` } },
  { name: "กล่องข้อความบนแบนเนอร์", live: ".v3-banner__text", keys: ["w"], canvas: { 1280: ".card-hi > div:has(h1)" } },
  { name: "ป้ายสิทธิ์บนแบนเนอร์", live: ".v3-banner .v3-tag", keys: ["h"], canvas: { 1280: ".tag", 390: ".tag" } },
  { name: "หัวเรื่องสไลด์", live: ".v3-banner__title", keys: ["w"], canvas: { 1280: ".card-hi h1", 390: `${section(4)} .card h1` } },
  { name: "ปุ่มหลักบนแบนเนอร์", live: ".v3-banner__actions .button", keys: ["h"], canvas: { 1280: ".btn-shop", 390: ".btn-block" } },
  { name: "การ์ด Hermes", live: ".v3-hcard", canvas: { 1280: ".hcard" } },
  { name: "โปสเตอร์", live: ".v3-hcard__poster", canvas: { 1280: ".hcard img" } },
  { name: "ขีดแดงในการ์ด", live: ".v3-hline", canvas: { 1280: ".hline" } },
  { name: "หัวเรื่องการ์ด", live: ".v3-hcard__title", keys: ["h"], canvas: { 1280: ".hcard h3" } },
  { name: "หัวบล็อกโปรโมชั่น", live: ".v3-promo__head", keys: ["h"], canvas: { 1280: "#promo > div:first-child", 390: `${section(5)} > div:nth-child(1)` } },
  /* `#promo .hd` ที่ใบเดสก์ท็อปคือ**กลุ่มทั้งกลุ่ม** ไม่ใช่ช่องแรก · ช่องแรกต้องเขียนเป็น
     `#promo .hd > span:first-child` · ส่วนใบมือถือ `.hd` ตัวเดียวกันคือสายตัวเลขทั้งสาย
     เพราะผืนมือถือไม่ได้แยกช่อง · **เคยจับคู่กลุ่มกับช่องมาแล้วและมันขึ้นว่าตรง**
     เพราะทั้งคู่สูง 50 เท่ากันพอดี ซึ่งเป็นความบังเอิญ ไม่ใช่ความถูกต้อง

     **นาฬิกาแตกเป็นห้าแถว ไม่ใช่แถวเดียว** เดิมมีแถวเดียวที่เทียบแค่ความสูงของกล่องเลข
     แล้วขึ้นว่า "ตรง" มาตลอด ทั้งที่ของจริงต่างจากผืนแปดอย่าง — น้ำหนักฟอนต์ ช่องไฟ
     ขนาดกับสีของตัวคั่น สีของคำนำหน้า และระยะสองจุด · ทั้งแปดเป็นสีกับตัวอักษร
     ซึ่งตัวเทียบมองไม่เห็นเลยจนถึง 2026-09-08 · **ของที่ไม่ถูกเทียบ ไม่มีอะไรเตือนตลอดกาล** */
  { name: "แถบนาฬิกา", live: ".v3-promo__clock", keys: { 1280: ["w", "h", "color", "gap"], 390: ["w", "h"] }, canvas: { 1280: "#promo > div:first-child > div:last-child", 390: `${section(5)} .hd` } },
  { name: "ช่องนาฬิกา", live: { 1280: ".v3-promo__clock-slot" }, keys: ["w", "h", "gap"], canvas: { 1280: "#promo .hd > span:first-child" } },
  { name: "กล่องเลขนาฬิกา", live: { 1280: ".v3-promo__clock-cell" }, keys: ["w", "h", "color", "bg", "fontWeight", "ls", "radius"], canvas: { 1280: "#promo .hd > span:first-child > span:first-child" } },
  { name: "ตัวคั่นนาฬิกา", live: { 1280: ".v3-promo__tick" }, keys: ["color", "fontSize", "fontWeight"], canvas: { 1280: "#promo .hd > span:nth-child(2)" } },
  { name: "ป้ายกำกับใต้ช่องนาฬิกา", live: { 1280: ".v3-promo__clock-unit" }, keys: ["w", "h", "color", "fontWeight", "ls", "lh"], canvas: { 1280: "#promo .hd > span > span:last-child" } },
  { name: "การ์ดโปรโมชั่น", live: ".v3-promo__card", canvas: { 1280: "#promo .card", 390: `${section(5)} .card` } },
  { name: "ภาพบนการ์ดโปรโมชั่น", live: ".v3-promo__image", canvas: { 1280: "#promo .card img", 390: `${section(5)} .card img` } },
  { name: "ป้ายสิทธิ์บนการ์ดโปรโมชั่น", live: ".v3-promo__badge", keys: ["h"], canvas: { 1280: "#promo .card span", 390: `${section(5)} .card span` } },
  { name: "ปุ่มบนการ์ดโปรโมชั่น", live: ".v3-promo__action .button", keys: ["h"], canvas: { 1280: "#promo .btn-shop", 390: `${section(5)} .btn-shop` } }
];

/**
 * ระยะห่างของค่าหนึ่งช่อง — **ไม่ใช่ทุกช่องเป็นตัวเลข**
 *
 * `w` `h` `lh` เป็นตัวเลข ลบกันได้ · ส่วน `color` `fontWeight` `ls` `gap` เป็นข้อความ
 * ซึ่งลบกันได้ `NaN` แล้ว `Math.abs(NaN) > TOLERANCE` เป็นเท็จเสมอ · **ถ้าปล่อยไว้
 * แถวที่เฝ้าสีจะรายงานว่าตรงกันทุกครั้ง ไม่ว่าสีจะต่างแค่ไหน** ซึ่งแย่กว่าไม่เฝ้าเลย
 * เพราะมันขึ้นในรายงานว่าถูกเฝ้าอยู่ · ข้อความจึงเทียบเท่ากับไม่เท่า และตอบเป็น
 * `Infinity` เมื่อต่าง เพื่อให้ผ่านเกณฑ์หนึ่งพิกเซลไปเป็นความต่างจริงเสมอ
 */
function keyGap(live, canvas) {
  if (typeof live === "number" && typeof canvas === "number") return Math.abs(live - canvas);
  return live === canvas ? 0 : Infinity;
}

/**
 * วัดกล่องและสไตล์ของ selector ที่ให้มา
 *
 * `boardWidth` มีเฉพาะฝั่งผืน เพราะผืนวางอาร์ตบอร์ดสองใบเรียงกันในหน้าเดียว และคลาสเดียวกัน
 * มีอยู่ในทั้งสองใบ · ฝั่งหน้าจริงไม่ต้องหา ทั้งหน้าคือของที่วัด
 *
 * **ของที่หาเจอแต่กล่องเป็นศูนย์ ไม่เหมือนของที่หาไม่เจอ** อย่างแรกคือของที่มีในหน้าแต่ถูก
 * ซ่อนที่ความกว้างนี้ ซึ่งเป็นคำตอบคนละอย่างกับ "ไม่มีของชิ้นนี้เลย" · แยกไว้ตั้งแต่ตอนวัด
 * ไม่งั้นของที่ถูกซ่อนจะรายงานว่าต่างจากผืนเท่ากับความสูงเต็มของมัน ซึ่งอ่านแล้วไขว้เขว
 *
 * **เดิมคืนแค่กว้าง สูง และซ่อนอยู่ไหม** สี น้ำหนักฟอนต์ ช่องไฟ และระยะจึงไม่เคยถูกเทียบเลย
 * สักรอบ ทั้งที่ฝั่งผืนเก็บมาตั้งแต่วันแรก · เดสก์ท็อปเคยขึ้นว่า "ตรง" ทั้งที่นาฬิกาต่างจากผืน
 * แปดอย่าง เพราะทั้งแปดเป็นสีกับตัวอักษร ไม่ใช่ขนาดกล่อง — 2026-09-08
 */
async function boxes(page, selectors, boardWidth) {
  return page.evaluate(
    ({ selectors, boardWidth }) => {
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
        const s = getComputedStyle(el);
        const px = (v) => (v && v.endsWith("px") ? +parseFloat(v).toFixed(2) : v);
        out[selector] = {
          w: Number(box.width.toFixed(2)),
          h: Number(box.height.toFixed(2)),
          hidden: box.width === 0 && box.height === 0,
          /* **ชื่อช่องกับรูปแบบต้องตรงกับ `extract-canvas.mjs` ทุกตัวอักษร** ไม่งั้นแถวที่
             เขียน `keys: ["color"]` จะเทียบของที่คนละหน่วยแล้วแดงตลอดกาลโดยไม่มีบั๊กจริง */
          color: s.color,
          bg: s.backgroundColor,
          font: `${px(s.fontSize)}/${s.fontWeight}`,
          fontSize: px(s.fontSize),
          fontWeight: s.fontWeight,
          lh: px(s.lineHeight),
          ls: s.letterSpacing,
          radius: s.borderRadius,
          pad: s.padding,
          gap: s.gap === "normal" ? null : s.gap,
          display: s.display
        };
      }
      return out;
    },
    { selectors, boardWidth }
  );
}

const ledger = JSON.parse(await readFile(LEDGER, "utf8"));
const excused = new Map(ledger.map((entry) => [entry.name, entry]));

/**
 * ข้อยกเว้นหนึ่งข้อยกเว้นให้ที่ความกว้างไหนบ้าง
 *
 * **ไม่เขียน `widths` ไว้ = ยกเว้นเฉพาะ 1280** เพราะทุกข้อที่อยู่ในสมุดวันนี้เขียนขึ้นจาก
 * การวัดเดสก์ท็อปล้วน ตอนที่ตัวเทียบยังมองไม่เห็น 390 เลย · เหตุผลของมันจึงพูดแทนมือถือไม่ได้
 *
 * รอบแรกที่ตัวเทียบเห็นสองความกว้าง มันยกเว้นข้ามใบให้ทันทีสามข้อ แล้วรายงานว่า
 * แบนเนอร์มือถือที่กว้างผิดไป 166 พิกเซล เป็น "ต่างแต่มีเหตุผล" โดยอ้างเหตุผลเรื่อง
 * `align-items: stretch` ของเดสก์ท็อป ซึ่งไม่ได้อธิบายอะไรเลยที่ความกว้างนั้น ·
 * **ข้อยกเว้นที่ยกเว้นให้เรื่องที่มันไม่ได้พูดถึง อันตรายกว่าไม่มีข้อยกเว้น** เพราะมันกลบ
 * บั๊กจริงด้วยประโยคที่อ่านแล้วน่าเชื่อ · ความต่างที่ตั้งใจของมือถือต้องเขียนของมันเอง
 */
const coversWidth = (entry, width) => (entry.widths ?? [1280]).includes(width);

const browser = await chromium.launch({ channel: "msedge" });
const canvasPage = await browser.newPage({ viewport: { width: 1900, height: 1400 } });
await canvasPage.goto(CANVAS, { waitUntil: "networkidle" });
await canvasPage.waitForTimeout(1200);
await freezeAnimations(canvasPage);

const livePage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
/* `networkidle` ใช้กับ dev server ไม่ได้ มันเปิด websocket ของ HMR ค้างไว้ตลอด
   เครือข่ายจึงไม่มีวันเงียบ · รอสิ่งที่จะวัดจริงแทน ซึ่งตรงกับที่ต้องการมากกว่าอยู่แล้ว */
await livePage.goto(LIVE, { waitUntil: "domcontentloaded" });
await livePage.locator(".v3-hcard__poster").waitFor({ state: "visible" });
/* นาฬิกาโผล่หลัง hydrate เท่านั้น การรอมันจึงพิสูจน์ว่าหน้าพร้อมวัดครบทุกส่วน
   ไม่ใช่แค่ส่วนที่ server เขียนมา · ถ้าบล็อกโปรโมชั่นหมดอายุแล้วจะไม่มีนาฬิกา จึงไม่รอค้าง */
await livePage.locator(".v3-promo__clock-cell").first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
/* หยุดอนิเมชันทั้งสองฝั่งก่อนวัด ปิดข้างเดียวจะกลายเป็นการเทียบขนาดที่ออกแบบไว้กับเฟรมสุ่ม */
await freezeAnimations(livePage);

/** ผลของทุกความกว้าง เก็บไว้ก่อนเพราะการตรวจสมุดต้องดูภาพรวมทุกใบพร้อมกัน */
const perWidth = [];
/** ชื่อข้อยกเว้นที่ตัวเทียบยืนยันได้ว่ายังชี้ความต่างจริง — ต่างที่ใบใดใบหนึ่งก็ถือว่ายังจริง */
const stillTrue = new Set();

for (const width of WIDTHS) {
  const rows = MAP.filter((row) => row.canvas[width] && liveSelector(row, width));
  const skipped = MAP.filter((row) => !(row.canvas[width] && liveSelector(row, width))).map((row) => row.name);

  await livePage.setViewportSize({ width, height: 900 });
  /* ให้ CSS ตอบสนองความกว้างใหม่และให้ภาพที่ปรับขนาดเข้าที่ก่อนวัด */
  await livePage.waitForTimeout(500);

  const canvas = await boxes(canvasPage, rows.map((row) => row.canvas[width]), width);
  const live = await boxes(livePage, rows.map((row) => liveSelector(row, width)), null);

  const same = [];
  const excusedRows = [];
  const unknown = [];

  for (const row of rows) {
    const fromCanvas = canvas[row.canvas[width]];
    const fromLive = live[liveSelector(row, width)];
    const named = excused.get(row.name);
    const entry = named && coversWidth(named, width) ? named : null;

    let detail = null;
    if (!fromCanvas) detail = "หาในผืนไม่เจอ";
    else if (!fromLive) detail = "หาในหน้าจริงไม่เจอ";
    else if (fromLive.hidden && !fromCanvas.hidden) detail = "ผืนมีของชิ้นนี้ แต่หน้าจริงซ่อนไว้ที่ความกว้างนี้";
    else if (fromCanvas.hidden && !fromLive.hidden) detail = "ผืนซ่อนของชิ้นนี้ แต่หน้าจริงแสดงอยู่";

    if (!detail) {
      const keys = rowKeys(row, width);
      const diffs = keys
        .map((key) => ({ key, canvas: fromCanvas[key], live: fromLive[key], gap: keyGap(fromLive[key], fromCanvas[key]) }))
        .filter((diff) => diff.gap > TOLERANCE);

      if (diffs.length === 0) {
        same.push(row.name);
        continue;
      }
      detail = diffs
        .map((diff) =>
          Number.isFinite(diff.gap) && typeof diff.live === "number"
            ? `${diff.key}: ผืน ${diff.canvas} → จริง ${diff.live} (${diff.live - diff.canvas > 0 ? "+" : ""}${Number((diff.live - diff.canvas).toFixed(2))})`
            : `${diff.key}: ผืน ${diff.canvas} → จริง ${diff.live}`
        )
        .join(" · ");
    }

    if (entry) {
      stillTrue.add(row.name);
      excusedRows.push({ name: row.name, detail, why: entry.why });
    } else {
      unknown.push({ name: row.name, detail });
    }
  }

  /* เก็บกล่องที่วัดได้ไว้ให้ตัวตรวจเหตุผลเอาไปเทียบซ้ำหลังแทรกแซง */
  const measured = new Map(rows.map((row) => [row.name, { canvas: canvas[row.canvas[width]], live: live[liveSelector(row, width)], keys: rowKeys(row, width) }]));
  perWidth.push({ width, same, excusedRows, unknown, skipped, measured });
}

/**
 * **ตรวจว่าเหตุผลในสมุดพิสูจน์ตัวเองได้ ไม่ใช่แค่ฟังดูน่าเชื่อ**
 *
 * สมุดเน่าได้สองทาง ทางแรกคือข้อที่เลิกต่างแล้ว ซึ่งตัวเทียบจับได้อยู่แล้ว · **ทางที่สอง
 * คือข้อที่ยังต่างจริงแต่เหตุผลผิด** ซึ่งจับไม่ได้เลย และอันตรายกว่า เพราะข้อที่เหตุผลผิด
 * จะพาคนไปแก้ผิดที่ · เกิดขึ้นจริงแล้วเมื่อ 2026-09-07 สองข้อเขียนว่าต่างเพราะฟอนต์
 * พอเปลี่ยนฟอนต์ให้ตรงผืนแล้วยังต่างเท่าเดิม เหตุจริงคือความสูงบรรทัด
 *
 * วิธีพิสูจน์คือ **การทดลองแทรกแซง** ข้อไหนอ้างว่าต่างเพราะอะไร ต้องบอกมาว่าเปลี่ยน
 * สิ่งนั้นบนหน้าจริงอย่างไร แล้วช่องว่างต้องเปลี่ยนตาม · ถ้าเปลี่ยนแล้วช่องว่างเท่าเดิม
 * แปลว่าสิ่งที่มันชี้ไม่ใช่เหตุ ไม่ว่าประโยคจะเขียนไว้ดีแค่ไหน
 *
 * เขียนในสมุดเป็น `provedBy` — `selector` คือของที่จะแทรกแซง `declare` คือกฎ CSS
 * ที่จะยัดใส่ให้เหมือนผืน และ `expect` คือสิ่งที่ต้องเกิด
 *
 *   "ปิดช่องว่าง"   แทรกแซงแล้วต้องเหลือต่างไม่เกินเกณฑ์ — เหตุนั้นอธิบายได้ทั้งหมด
 *   "ช่องว่างขยับ"  แทรกแซงแล้วช่องว่างต้องเปลี่ยน — เหตุนั้นมีส่วนจริง แต่ไม่ใช่ทั้งหมด
 *
 * **ตัวตรวจนี้ไม่บังคับทุกข้อ** ข้อที่ไม่มี `provedBy` ยังผ่านได้ด้วยทางเดิมห้าทาง
 * เพราะบางข้อไม่ได้อ้างเหตุที่แทรกแซงได้ เช่นทะเบียนที่ยังว่าง · แต่ข้อไหนที่เขียน
 * `provedBy` ไว้แล้วสอบตก คือข้อที่พูดผิด และต้องแดง
 */
const causeChecks = [];
for (const entry of ledger.filter((row) => row.provedBy)) {
  for (const result of perWidth) {
    if (!coversWidth(entry, result.width)) continue;
    const before = result.measured.get(entry.name);
    if (!before?.canvas || !before?.live) continue;

    await livePage.setViewportSize({ width: result.width, height: 900 });
    await livePage.waitForTimeout(300);
    /* เขียนกฎเดียวหรือหลายกฎก็ได้ — บางข้อมีเหตุที่แผ่ไปหลายชิ้นในกล่องเดียว
       และบางทีสองชิ้นนั้นต่างจากผืนคนละทิศ ซึ่งกฎเดียวทับให้ตรงพร้อมกันไม่ได้ */
    const rules = entry.provedBy.rules ?? [{ selector: entry.provedBy.selector, declare: entry.provedBy.declare }];
    const handle = await livePage.addStyleTag({
      content: rules.map((rule) => `${rule.selector} { ${rule.declare} !important; }`).join("\n")
    });
    await livePage.waitForTimeout(200);

    const row = MAP.find((item) => item.name === entry.name);
    const after = (await boxes(livePage, [liveSelector(row, result.width)], null))[liveSelector(row, result.width)];
    await handle.evaluate((node) => node.remove());

    /* ใช้ `keyGap` ตัวเดียวกับตอนจัดกอง ไม่งั้นแถวที่เฝ้าสีจะได้ `NaN`
       แล้วการทดลองแทรกแซงจะตัดสินจากค่าที่ไม่มีความหมาย */
    const gap = (live) => Math.max(...before.keys.map((key) => keyGap(live[key], before.canvas[key])));
    const was = Number(gap(before.live).toFixed(2));
    const now = after ? Number(gap(after).toFixed(2)) : null;

    const ok = now === null
      ? false
      : entry.provedBy.expect === "ปิดช่องว่าง"
        ? now <= TOLERANCE
        : Math.abs(now - was) > 0.01;

    causeChecks.push({
      name: entry.name,
      width: result.width,
      ok,
      detail: now === null
        ? "แทรกแซงแล้ววัดไม่ได้ หาอิลิเมนต์ไม่เจอ"
        : `แทรกแซง ${rules.map((rule) => rule.declare).join(" กับ ")} · ช่องว่าง ${was} -> ${now} (ต้อง${entry.provedBy.expect})`
    });
  }
}

/* ตัวตรวจในตัวและการทวงสัญญาเป็นเรื่องของโครงสร้างหน้า ไม่ใช่ของความกว้าง
   จึงตรวจครั้งเดียวที่ 1280 · ตั้งความกว้างกลับก่อน เพราะรอบสุดท้ายทิ้งไว้ที่ 390 */
await livePage.setViewportSize({ width: 1280, height: 900 });
await livePage.waitForTimeout(500);

/**
 * ตัวตรวจในตัวสำหรับข้อที่วัดด้วยกล่องไม่ได้ แต่วัดด้วยวิธีอื่นได้
 *
 * `hitTarget` วัดเขตกดจริง **ไม่ใช่อ่านตัวเลข `inset`** เพราะเขตกดที่แผ่ด้วย `::after`
 * ไม่โผล่ใน `getBoundingClientRect` ของปุ่มเลย · มันยิงสี่มุมของกล่องขนาดเกณฑ์ด้วย
 * `elementFromPoint` แล้วดูว่าโดนปุ่มตัวเดิมไหม ซึ่งตรงกับความหมายของเกณฑ์มากกว่า —
 * **เป้ากดคือที่ที่กดแล้วโดน**
 *
 * **มันพิสูจน์ตัวเองแล้วว่าจับได้จริง** จับได้ทันทีตอนถอย `inset` กลับไปค่าที่เคยพลาด ·
 * เคยถูกลบเมื่อ 2026-09-07 ตอนที่เกณฑ์ถูกถอน แล้วคืนกลับ 2026-09-09 พร้อมเกณฑ์
 */
const builtIn = {
  async hitTarget(entry) {
    const size = entry.minHitTarget ?? 24;
    return livePage.evaluate((want) => {
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

/**
 * ทุกข้อในสมุดต้องพิสูจน์ตัวเองได้ด้วยทางใดทางหนึ่ง ห้ามยืนยันด้วยประโยคเฉย ๆ
 *
 *   อยู่ในแผนที่          วัดเป็นกล่องได้ ต้องยังต่างจริงที่ความกว้างใดความกว้างหนึ่ง
 *   `checkedBy`         มีตัวตรวจอยู่ที่อื่น ไฟล์นั้นต้องมีจริง หรือตัวตรวจในตัวต้องผ่าน
 *   `effectOf`          เป็นผลของข้ออื่น ชื่อที่อ้างต้องมีในสมุดและต้องยังต่างจริง
 *   `dueWith`           สัญญาว่าจะมีตัวตรวจตอนบล็อกนั้นลง ครบกำหนดแล้วต้องทวง
 *   `unmeasured`        วัดไม่ได้จริง ๆ ต้องมีเหตุผลกำกับ
 *
 * **นับเฉพาะความกว้างที่ข้อนั้นบอกว่าตัวเองยกเว้นให้** ตามที่ `coversWidth` อธิบายไว้ ·
 * ข้อที่ยกเว้นให้แค่ 1280 แล้วที่ 1280 วัดได้ว่าไม่ต่างแล้ว ถือว่าหมดอายุ แม้ที่ 390 จะยังต่างอยู่
 * เพราะความต่างที่ 390 ไม่ใช่สิ่งที่ข้อนั้นพูดถึง
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
    /* **ผิดชนิดต้องกลายเป็นรายงาน ไม่ใช่กลายเป็นการล้ม** เขียน `effectOf` เป็นสตริงเดี่ยว
       แล้ว `.filter` จะโยน TypeError ทั้งตัวเทียบ · วันที่มันโยนคือวันที่แถวนั้นถูกถอด
       ออกจากแผนที่หรือถูกเปลี่ยนชื่อ ซึ่งเป็นวันที่มีคนกำลังรื้ออะไรอยู่พอดี
       คือวันที่ต้องการเครื่องมือมากที่สุด · เกิดขึ้นจริงแล้วครั้งหนึ่ง 2026-09-08 */
    if (!Array.isArray(entry.effectOf)) {
      problems.push(`${entry.name} — ช่อง effectOf ต้องเป็นรายการของชื่อ ไม่ใช่ชื่อเดี่ยว`);
      continue;
    }
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
  if (entry.unmeasured !== true) {
    problems.push(`${entry.name} — ไม่มีทางพิสูจน์ตัวเองสักทาง เพิ่มลงแผนที่ หรือใส่ checkedBy effectOf dueWith หรือ unmeasured`);
    continue;
  }
  /* **`unmeasured` เป็นทางเดียวในห้าทางที่ไม่มีอะไรมาพิสูจน์แทนได้** อีกสี่ทางมีของจริง
     ค้ำอยู่ คือกล่องที่วัดได้ ไฟล์ที่ต้องมีอยู่ ชื่อที่ต้องอยู่ในสมุด หรือ selector ที่ต้อง
     ยังไม่โผล่ · ส่วนทางนี้แปลว่า "เชื่อผมเถอะว่าวัดไม่ได้" ซึ่งถ้าไม่บังคับให้เขียนเหตุผล
     มันจะกลายเป็นประตูหลังที่ข้อไหนก็เดินผ่านได้โดยไม่ต้องพิสูจน์อะไรเลย

     กติกาข้อนี้เขียนไว้สองที่มาตั้งแต่ต้น คือตารางข้างบนกับ `README.md` แต่ไม่มีโค้ด
     บังคับสักบรรทัด · **เขียนไว้สองที่ บังคับศูนย์ที่** และข้อแรกที่ใช้ประตูนี้จริงคือ
     `เพดานความกว้างของหน้า` ซึ่งเป็นข้อที่กำลังถูกตรวจสอบพอดี · เติมด่านเมื่อ 2026-09-09 */
  const why = typeof entry.unmeasuredWhy === "string" ? entry.unmeasuredWhy.trim() : "";
  if (why === "") problems.push(`${entry.name} — เขียน unmeasured ไว้แต่ไม่มี unmeasuredWhy กำกับ ข้อที่บอกว่าวัดไม่ได้ต้องบอกด้วยว่าทำไม`);
}

const heading = (text) => console.log(`\n${text}\n${"-".repeat(text.length)}`);
const banner = (text) => console.log(`\n${"=".repeat(text.length)}\n${text}\n${"=".repeat(text.length)}`);

let unknownTotal = 0;

for (const result of perWidth) {
  banner(`ความกว้าง ${result.width}`);

  heading(`ตรง — ${result.same.length} จุด`);
  for (const name of result.same) console.log(` ${name}`);

  heading(`ต่างแต่มีเหตุผล — ${result.excusedRows.length} จุด`);
  for (const row of result.excusedRows) console.log(` ${row.name}\n   ${row.detail}\n   เหตุผล: ${row.why}`);

  heading(`ต่างโดยไม่มีใครรู้ — ${result.unknown.length} จุด`);
  for (const row of result.unknown) console.log(` ${row.name}\n   ${row.detail}`);

  heading(`ผืนใบนี้ไม่มีของชิ้นนี้ — ${result.skipped.length} จุด`);
  for (const name of result.skipped) console.log(` ${name}`);

  unknownTotal += result.unknown.length;
}

banner("ทั้งสองความกว้าง");

heading(`ตัวตรวจในตัว — ${Object.keys(hitChecks).length} ข้อ`);
for (const [name, result] of Object.entries(hitChecks)) console.log(` ${result.ok ? "ผ่าน" : "ตก  "} ${name} — ${result.detail}`);

heading(`สัญญาที่ยังไม่ครบกำหนด — ${Object.keys(blockLanded).length} ข้อ`);
for (const [name, landed] of Object.entries(blockLanded)) {
  const entry = excused.get(name);
  console.log(` ${landed ? "ครบกำหนดแล้ว" : "ยังไม่ถึง   "} ${name} — รอบล็อก ${entry.dueWith}`);
}

heading(`เหตุผลในสมุดพิสูจน์ตัวเองได้ไหม — ${causeChecks.length} ข้อ`);
for (const check of causeChecks) console.log(` ${check.ok ? "ผ่าน" : "ตก  "} ${check.name} ที่ ${check.width} — ${check.detail}`);

heading(`สมุดที่พิสูจน์ตัวเองไม่ได้ — ${problems.length} ข้อ`);
for (const problem of problems) console.log(` ${problem}`);

console.log("");
process.exitCode = unknownTotal + problems.length + causeChecks.filter((check) => !check.ok).length === 0 ? 0 : 1;
