/**
 * ทับภาพผืนออกแบบกับหน้าจริง แล้วซ้อนแบบ difference
 *
 * ตัวเลขจับความต่างของกล่องได้ แต่จับลำดับของ จังหวะช่องไฟ และน้ำหนักตัวอักษรไม่ได้
 * ภาพซ้อนจับสิ่งนั้น — ที่ไหนดำสนิทคือตรงกัน ที่ไหนสว่างคือต่าง
 *
 * ถ่ายเฉพาะช่วงบนของหน้าโดยตั้งใจ ตอนนี้หน้าแรกลงไปแล้วสี่บล็อกจากเก้า ที่เหลือยังเป็นของเดิม
 * การซ้อนทั้งหน้าจะสว่างทั้งผืนโดยไม่บอกอะไร · ขยับความสูงตอนบล็อกถัดไปลง
 *
 * **ทำทั้งสองความกว้าง** ผืนวาดไว้สองใบ 1280 กับ 390 · ภาพซ้อนที่ทำแต่ใบกว้างบอกได้แค่
 * ครึ่งเดียวของเรื่อง และเป็นครึ่งที่คนดูอยู่แล้ว · ไฟล์ออกแยกตามความกว้าง จึงเทียบรอบต่อรอบ
 * ได้ทีละใบโดยไม่ทับกัน
 *
 * ต้องมี `serve-canvas.mjs` ที่ :4173 และ dev server ที่ :3000
 * รัน: node scripts/v3-spec/overlay.mjs [ความสูง]
 */
import { loadPlaywright } from "./playwright.mjs";
import { readFile } from "node:fs/promises";

const { chromium } = await loadPlaywright();

const HEIGHT = Number(process.argv[2] ?? 780);
const OUT = "scripts/v3-spec/out";
/** อาร์ตบอร์ดที่ผืนวาดไว้ · ชื่อไฟล์ต่อท้ายด้วยความกว้าง จึงไม่ทับกัน */
const WIDTHS = [1280, 390];

const browser = await chromium.launch({ channel: "msedge" });

const canvasPage = await browser.newPage({ viewport: { width: 1900, height: 1400 } });
await canvasPage.goto("http://localhost:4173/", { waitUntil: "networkidle" });
await canvasPage.waitForTimeout(1200);

const livePage = await browser.newPage({ viewport: { width: 1280, height: HEIGHT } });
/* dev server เปิด websocket ของ HMR ค้างไว้ เครือข่ายจึงไม่มีวันเงียบ รอภาพแทน */
await livePage.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await livePage.locator(".v3-hcard__poster").waitFor({ state: "visible" });

/* ฝังภาพเป็น data URI แทนการเสิร์ฟไฟล์ เพราะการดักเส้นทางหลังตั้งเนื้อหาหน้าแล้วไม่ทัน */
const asData = async (file) => `data:image/png;base64,${(await readFile(file)).toString("base64")}`;

for (const width of WIDTHS) {
  /* ผืน — ตัดเฉพาะกรอบอาร์ตบอร์ดใบนี้ ไม่เอาพื้นเทาของผืนกับป้ายชื่ออาร์ตบอร์ด */
  const clip = await canvasPage.evaluate(
    ({ height, want }) => {
      const board = [...document.querySelectorAll("div")].find((el) => {
        const box = el.getBoundingClientRect();
        return Math.round(box.width) === want && box.height > 500;
      });
      const body = board.querySelector(":scope > div:nth-child(2)");
      return { x: board.getBoundingClientRect().x, y: body.getBoundingClientRect().y, width: want, height };
    },
    { height: HEIGHT, want: width }
  );
  await canvasPage.screenshot({ path: `${OUT}/canvas-${width}.png`, clip });

  /* หน้าจริง — ความกว้างเดียวกัน จากบนสุดของหน้า */
  await livePage.setViewportSize({ width, height: HEIGHT });
  await livePage.waitForTimeout(600);
  await livePage.screenshot({ path: `${OUT}/live-${width}.png`, clip: { x: 0, y: 0, width, height: HEIGHT } });

  const [canvasData, liveData] = await Promise.all([
    asData(`${OUT}/canvas-${width}.png`),
    asData(`${OUT}/live-${width}.png`)
  ]);

  const diffPage = await browser.newPage({ viewport: { width, height: HEIGHT } });
  await diffPage.setContent(`<style>
    html, body { margin: 0; background: #000 }
    .stack { position: relative; width: ${width}px; height: ${HEIGHT}px; isolation: isolate }
    .stack img { position: absolute; inset: 0; width: ${width}px; display: block }
    .stack img.over { mix-blend-mode: difference }
  </style><div class="stack"><img src="${canvasData}"><img class="over" src="${liveData}"></div>`);
  await diffPage.waitForTimeout(700);
  await diffPage.screenshot({ path: `${OUT}/diff-${width}.png` });

  /* วัดเป็นตัวเลขคู่กับภาพ เพื่อให้เทียบรอบต่อรอบได้ ไม่ใช่ดูด้วยตาอย่างเดียว */
  const stat = await diffPage.evaluate((boardWidth) => {
    const [base, over] = [...document.images];
    const pixels = (img) => {
      const canvas = document.createElement("canvas");
      canvas.width = boardWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, boardWidth, img.naturalHeight).data;
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
  }, width);
  await diffPage.close();

  console.log(`\nความกว้าง ${width}`);
  console.log(`  ภาพผืน   ${OUT}/canvas-${width}.png`);
  console.log(`  ภาพจริง  ${OUT}/live-${width}.png`);
  console.log(`  ภาพซ้อน  ${OUT}/diff-${width}.png — ดำคือตรงกัน สว่างคือต่าง`);
  console.log(`  ต่างเกินเกณฑ์ ${stat.differing.toLocaleString()} จาก ${stat.total.toLocaleString()} พิกเซล = ${stat.percent}%`);
}

await browser.close();
