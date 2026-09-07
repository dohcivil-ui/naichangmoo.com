/**
 * ทับภาพผืนออกแบบกับหน้าจริง แล้วซ้อนแบบ difference
 *
 * ตัวเลขจับความต่างของกล่องได้ แต่จับลำดับของ จังหวะช่องไฟ และน้ำหนักตัวอักษรไม่ได้
 * ภาพซ้อนจับสิ่งนั้น — ที่ไหนดำสนิทคือตรงกัน ที่ไหนสว่างคือต่าง
 *
 * ถ่ายเฉพาะช่วงบนของหน้าโดยตั้งใจ ตอนนี้หน้าแรกลงไปแล้วสามบล็อกจากเก้า ที่เหลือยังเป็นของเดิม
 * การซ้อนทั้งหน้าจะสว่างทั้งผืนโดยไม่บอกอะไร · ขยับความสูงตอนบล็อกถัดไปลง
 *
 * ต้องมี `serve-canvas.mjs` ที่ :4173 และ dev server ที่ :3000
 * รัน: node scripts/v3-spec/overlay.mjs [ความสูง]
 */
import { loadPlaywright } from "./playwright.mjs";
import { readFile } from "node:fs/promises";

const { chromium } = await loadPlaywright();

const HEIGHT = Number(process.argv[2] ?? 780);
const OUT = "scripts/v3-spec/out";

const browser = await chromium.launch({ channel: "msedge" });

/* ผืน — ตัดเฉพาะกรอบอาร์ตบอร์ด 1280 ไม่เอาพื้นเทาของผืนกับป้ายชื่ออาร์ตบอร์ด */
const canvasPage = await browser.newPage({ viewport: { width: 1900, height: 1400 } });
await canvasPage.goto("http://localhost:4173/", { waitUntil: "networkidle" });
await canvasPage.waitForTimeout(1200);
const clip = await canvasPage.evaluate((height) => {
  const board = [...document.querySelectorAll("div")].find((el) => {
    const box = el.getBoundingClientRect();
    return Math.round(box.width) === 1280 && box.height > 500;
  });
  const header = board.querySelector(":scope > div:nth-child(2)");
  return { x: board.getBoundingClientRect().x, y: header.getBoundingClientRect().y, width: 1280, height };
}, HEIGHT);
await canvasPage.screenshot({ path: `${OUT}/canvas.png`, clip });

/* หน้าจริง — ความกว้างเดียวกัน จากบนสุดของหน้า */
const livePage = await browser.newPage({ viewport: { width: 1280, height: HEIGHT } });
/* dev server เปิด websocket ของ HMR ค้างไว้ เครือข่ายจึงไม่มีวันเงียบ รอภาพแทน */
await livePage.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await livePage.locator(".v3-hcard__poster").waitFor({ state: "visible" });
await livePage.waitForTimeout(600);
await livePage.screenshot({ path: `${OUT}/live.png`, clip: { x: 0, y: 0, width: 1280, height: HEIGHT } });

/* ฝังภาพเป็น data URI แทนการเสิร์ฟไฟล์ เพราะการดักเส้นทางหลังตั้งเนื้อหาหน้าแล้วไม่ทัน */
const asData = async (file) => `data:image/png;base64,${(await readFile(file)).toString("base64")}`;
const [canvasData, liveData] = await Promise.all([asData(`${OUT}/canvas.png`), asData(`${OUT}/live.png`)]);

const diffPage = await browser.newPage({ viewport: { width: 1280, height: HEIGHT } });
await diffPage.setContent(`<style>
  html, body { margin: 0; background: #000 }
  .stack { position: relative; width: 1280px; height: ${HEIGHT}px; isolation: isolate }
  .stack img { position: absolute; inset: 0; width: 1280px; display: block }
  .stack img.over { mix-blend-mode: difference }
</style><div class="stack"><img src="${canvasData}"><img class="over" src="${liveData}"></div>`);
await diffPage.waitForTimeout(700);
await diffPage.screenshot({ path: `${OUT}/diff.png` });

/* วัดเป็นตัวเลขคู่กับภาพ เพื่อให้เทียบรอบต่อรอบได้ ไม่ใช่ดูด้วยตาอย่างเดียว */
const stat = await diffPage.evaluate(() => {
  const [base, over] = [...document.images];
  const pixels = (img) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, 1280, img.naturalHeight).data;
  };
  const a = pixels(base);
  const b = pixels(over);
  let differing = 0;
  let total = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 4) {
    total += 1;
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 90) differing += 1;
  }
  return { differing, total, percent: Number(((differing / total) * 100).toFixed(2)) };
});

console.log(`ภาพผืน   ${OUT}/canvas.png`);
console.log(`ภาพจริง  ${OUT}/live.png`);
console.log(`ภาพซ้อน  ${OUT}/diff.png — ดำคือตรงกัน สว่างคือต่าง`);
console.log(`ต่างเกินเกณฑ์ ${stat.differing.toLocaleString()} จาก ${stat.total.toLocaleString()} พิกเซล = ${stat.percent}%`);

await browser.close();
