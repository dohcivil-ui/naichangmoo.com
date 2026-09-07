/**
 * ตรวจว่าสไลด์ของหน้าแรกหยุดหมุนถูกกรณี
 *
 * WCAG 2.2.2 บังคับว่าของที่ขยับเองนานเกินห้าวินาทีต้องหยุดได้ · กฎ CSS ที่ท้าย
 * `globals.css` สั่งได้แค่ animation ส่วนตัวหมุนเป็น JavaScript ซึ่ง CSS แตะไม่ถึง
 * ด่านในชุดเทสต์ก็จับไม่ได้ เพราะไม่มีเบราว์เซอร์จริงให้เวลาเดิน
 *
 * ต้องมี dev server ที่ :3000
 * รัน: node scripts/v3-spec/motion.mjs
 */
import { loadPlaywright } from "./playwright.mjs";

const { chromium } = await loadPlaywright();

const LIVE = "http://localhost:3000/";
/** รอเกินรอบสไลด์หนึ่งรอบ (5000ms) พอให้เห็นว่ามันเปลี่ยนจริงหรือนิ่งจริง */
const WAIT = 6500;

const browser = await chromium.launch({ channel: "msedge" });
const titleOf = (page) => page.locator(".v3-banner__title span").first().innerText();

async function check(label, expectMove, { reduced = false, hover = false, focus = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: reduced ? "reduce" : "no-preference"
  });
  const page = await context.newPage();
  await page.goto(LIVE, { waitUntil: "domcontentloaded" });
  await page.locator(".v3-banner__title").waitFor({ state: "visible" });
  await page.waitForLoadState("load");

  /**
   * **ต้องพิสูจน์ว่าหน้าพร้อมรับเมาส์ก่อน แล้วค่อยเริ่มจับเวลา**
   *
   * สไลด์ใบแรกถูกเขียนมาจากฝั่ง server จึงมองเห็นตั้งแต่ก่อน React จะผูกตัวรับเหตุการณ์
   * ถ้าเอาเมาส์ไปชี้ในช่วงนั้น `onMouseEnter` ไม่ยิง แล้วสไลด์จะหมุนต่อทั้งที่เมาส์ค้างอยู่
   * ตัวตรวจจะรายงานว่าตกทั้งที่โค้ดถูก · กดลูกศรหนึ่งครั้งแล้วดูว่าสไลด์เปลี่ยนจริง
   * เป็นการพิสูจน์ว่าตัวรับเหตุการณ์ผูกแล้ว ไม่ใช่การเดาด้วยการรอเป็นวินาที
   */
  const first = await titleOf(page);
  await page.locator(".v3-banner__nav--next .button").click();
  await page.waitForFunction(
    (was) => document.querySelector(".v3-banner__title span")?.textContent !== was,
    first,
    { timeout: 20000 }
  );

  /**
   * คืนหน้าสู่สภาพปกติก่อนเริ่มจับเวลา
   *
   * การกดลูกศรทำให้ปุ่มนั้นได้โฟกัส ซึ่งทำให้สไลด์หยุดหมุนตามที่ตั้งใจไว้ — **และหยุดค้าง
   * จนกว่าโฟกัสจะย้ายออก** ซึ่งเป็นพฤติกรรมที่ถูก คนที่กำลังเลือกดูเองไม่ควรถูกแย่งไป
   * แต่ถ้าไม่ล้างโฟกัสตรงนี้ กรณี "ปกติ ควรเลื่อน" จะวัดสภาพที่ไม่ใช่สภาพปกติ
   */
  await page.evaluate(() => document.activeElement?.blur());
  await page.mouse.move(10, 10);

  const before = await titleOf(page);
  if (hover) await page.locator(".v3-banner").hover();
  if (focus) await page.locator(".v3-banner__nav--next .button").focus();
  await page.waitForTimeout(WAIT);
  const after = await titleOf(page);
  const moved = before !== after;
  const ok = moved === expectMove;
  console.log(`${ok ? "ผ่าน" : "ตก "}  ${label.padEnd(34)} ${before} -> ${after}  (${moved ? "เลื่อน" : "หยุด"})`);
  await context.close();
  return ok;
}

const results = [
  await check("ปกติ ควรเลื่อน", true),
  await check("ตั้งเครื่องลดการเคลื่อนไหว ควรหยุด", false, { reduced: true }),
  await check("เมาส์ชี้ค้างไว้ ควรหยุด", false, { hover: true }),
  await check("โฟกัสปุ่มด้วยคีย์บอร์ด ควรหยุด", false, { focus: true })
];

await browser.close();

const failed = results.filter((ok) => !ok).length;
console.log(failed === 0 ? "\nครบทั้งสี่กรณี" : `\nตก ${failed} กรณี`);
process.exitCode = failed === 0 ? 0 : 1;
