/**
 * ก้อนที่ 1 — ถอดผืนออกแบบเป็นตาราง
 *
 * ผืน `.dc.html` เป็น HTML จริงที่เบราว์เซอร์ render ได้ ไม่ใช่ภาพ · แปลว่ามันวัดได้
 * ด้วยเครื่องมือเดียวกับที่วัดหน้าจริง และเลิกอ่านผืนด้วยตาแล้วพิมพ์ตามได้ทั้งหมด
 *
 * ผลลัพธ์คือ JSON หนึ่งไฟล์ต่อหนึ่งอาร์ตบอร์ด เก็บทุกอิลิเมนต์ที่มีชื่อคลาส
 * พร้อมกล่อง สี ระยะใน มุม น้ำหนักฟอนต์ และช่องไฟ · พิกัดเทียบกับมุมซ้ายบนของอาร์ตบอร์ด
 * ไม่ใช่ของ viewport เพราะอาร์ตบอร์ดสองใบวางเรียงกันอยู่ในผืนเดียว
 *
 * รัน: node scripts/v3-spec/extract-canvas.mjs   (ต้องมี serve-canvas.mjs ที่ :4173)
 */
import { freezeAnimations, loadPlaywright } from "./playwright.mjs";
import { writeFile } from "node:fs/promises";

const { chromium } = await loadPlaywright();

const CANVAS = "http://localhost:4173/";
/** ความกว้างของอาร์ตบอร์ดที่ต้องการถอด — ผืนวาดไว้สองใบ เดสก์ท็อปกับมือถือ */
const BOARDS = [1280, 390];

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1900, height: 1400 } });
await page.goto(CANVAS, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
/* ต้องหยุดอนิเมชันก่อนวัด ไม่งั้นของที่ขยับขนาดจะถอดได้ไม่เท่ากันทุกรอบ — เหตุผลเต็มอยู่ที่ตัวฟังก์ชัน */
await freezeAnimations(page);

for (const boardWidth of BOARDS) {
  const rows = await page.evaluate((want) => {
    /* อาร์ตบอร์ดคือกล่องที่กว้างเท่าที่ขอพอดี และเป็นตัวนอกสุดที่กว้างเท่านั้น */
    const board = [...document.querySelectorAll("div")].find((el) => {
      const r = el.getBoundingClientRect();
      return Math.round(r.width) === want && r.height > 500;
    });
    if (!board) return null;
    const origin = board.getBoundingClientRect();

    const px = (v) => (v && v.endsWith("px") ? +parseFloat(v).toFixed(2) : v);
    const out = [];
    /* เก็บทุกอิลิเมนต์ที่วัดได้ ไม่ใช่แค่ที่มีคลาส — ผืนใช้ inline style เป็นหลัก
       ของหลายชิ้นจึงไม่มีคลาสเลย แต่ยังเป็นของที่ต้องเทียบ */
    for (const el of board.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const s = getComputedStyle(el);
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || "").toString().trim() || null,
        text: (el.textContent || "").trim().slice(0, 40) || null,
        x: +(r.x - origin.x).toFixed(2),
        y: +(r.y - origin.y).toFixed(2),
        w: +r.width.toFixed(2),
        h: +r.height.toFixed(2),
        color: s.color,
        bg: s.backgroundColor,
        font: `${px(s.fontSize)}/${s.fontWeight}`,
        /* `font` อ่านง่ายตอนเปิดไฟล์ดูด้วยตา แต่เทียบทีละอย่างไม่ได้ · สองช่องนี้จึงมีไว้
           ให้แถวใน `MAP` เขียน `keys: ["fontWeight"]` ได้ตรง ๆ โดยไม่ต้องแกะสตริง */
        fontSize: px(s.fontSize),
        fontWeight: s.fontWeight,
        lh: px(s.lineHeight),
        ls: s.letterSpacing,
        radius: s.borderRadius,
        pad: s.padding,
        gap: s.gap === "normal" ? null : s.gap,
        display: s.display
      });
    }
    return { boardWidth: want, boardHeight: +origin.height.toFixed(2), count: out.length, elements: out };
  }, boardWidth);

  if (!rows) {
    console.log(`อาร์ตบอร์ด ${boardWidth} — หาไม่เจอในผืน`);
    continue;
  }
  const file = `scripts/v3-spec/out/canvas-${boardWidth}.json`;
  await writeFile(file, JSON.stringify(rows, null, 1), "utf8");
  console.log(`อาร์ตบอร์ด ${boardWidth} สูง ${rows.boardHeight} — ถอดได้ ${rows.count} อิลิเมนต์ -> ${file}`);
}

await browser.close();
