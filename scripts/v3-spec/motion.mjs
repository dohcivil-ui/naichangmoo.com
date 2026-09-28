/**
 * ตรวจว่าสไลด์ของหน้าแรกหยุดหมุนถูกกรณี
 *
 * **สี่กรณี — เคยเหลือสองเมื่อ 2026-09-07 แล้วคืนกลับ 2026-09-09**
 *
 * สไลด์หยุดสามทาง คือเมื่อชี้เมาส์ เมื่อโฟกัสเข้าแบนเนอร์ และเมื่อผู้ใช้ตั้งเครื่องให้ลด
 * การเคลื่อนไหว · สองทางแรกเคยถูกถอนออกด้วยเหตุผล "ยึดผืน" และกรณีทดสอบของมัน
 * ถูกลบตามไปด้วย · **เจ้าของงานตัดสิน 2026-09-09 ว่าคำว่าเหมือนผืนใช้กับสิ่งที่ตาเห็น
 * ไม่ใช่กับพฤติกรรม** ผืนเป็นภาพนิ่ง มันไม่ได้วาดทั้งการหมุนเองและการหยุด การเก็บ
 * การหมุนไว้แล้วถอนการหยุดออก คือการใช้ตรรกะเดียวกันสองทางไม่เท่ากัน
 *
 * WCAG 2.2.2 บังคับว่าของที่ขยับเองนานเกินห้าวินาทีต้องหยุดได้ · การชี้เมาส์กับการโฟกัส
 * เป็นสองทางที่เกณฑ์นั้นรับ · **ทางที่สามคือ `prefers-reduced-motion` ซึ่งไม่ใช่ของที่
 * ผืนวาดและไม่ใช่พฤติกรรมที่เราเลือก** มันคือคำสั่งที่ผู้ใช้ตั้งไว้ที่เครื่องของเขาเอง ·
 * กฎ CSS ที่ท้าย `globals.css` สั่งได้แค่ animation ส่วนตัวหมุนเป็น JavaScript
 * ซึ่ง CSS แตะไม่ถึง และด่านในชุดเทสต์ก็จับไม่ได้เพราะไม่มีเบราว์เซอร์จริงให้เวลาเดิน
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
   * **ต้องพิสูจน์ว่าหน้าพร้อมรับการกดก่อน แล้วค่อยเริ่มจับเวลา**
   *
   * สไลด์ใบแรกถูกเขียนมาจากฝั่ง server จึงมองเห็นตั้งแต่ก่อน React จะผูกตัวรับเหตุการณ์
   * และตัวจับเวลาก็ยังไม่ได้ตั้งในช่วงนั้นเหมือนกัน · การจับเวลาก่อนหน้าจะพร้อมทำให้กรณี
   * "ปกติ ควรเลื่อน" ตกได้ทั้งที่โค้ดถูก · กดลูกศรหนึ่งครั้งแล้วดูว่าสไลด์เปลี่ยนจริง
   * เป็นการพิสูจน์ว่าหน้าพร้อมแล้ว ไม่ใช่การเดาด้วยการรอเป็นวินาที
   */
  const first = await titleOf(page);
  await page.locator(".v3-banner__nav--next .button").click();
  await page.waitForFunction(
    (was) => document.querySelector(".v3-banner__title span")?.textContent !== was,
    first,
    { timeout: 20000 }
  );

  /**
   * คืนหน้าสู่สภาพปกติก่อนเริ่มจับเวลา — **จำเป็น ไม่ใช่ของแถม**
   *
   * การกดลูกศรทำให้ปุ่มนั้นได้โฟกัส ซึ่งทำให้สไลด์หยุดหมุนตามที่ตั้งใจไว้ — และหยุดค้าง
   * ต่อไปตลอดการทดสอบ · ถ้าไม่ล้างโฟกัสก่อน กรณี "ปกติ ควรเลื่อน" จะตกทุกรอบ
   * ทั้งที่โค้ดถูก และคนอ่านผลจะไปไล่หาบั๊กที่ตัวหมุน ทั้งที่เหตุอยู่ที่ตัวทดสอบเอง
   */
  await page.evaluate(() => document.activeElement?.blur());
  await page.mouse.move(10, 10);

  if (hover) await page.locator(".v3-banner").hover();
  if (focus) await page.locator(".v3-banner__nav--next .button").focus();

  const before = await titleOf(page);
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
/* นับจาก `results` ไม่ใช่พิมพ์จำนวนไว้ตายตัว — บรรทัดนี้เคยค้างว่า "สองกรณี"
   อยู่หลังจากกรณีเหลือสองแล้วเพิ่มกลับเป็นสี่ ซึ่งเป็นคำโกหกที่ไม่มีด่านไหนจับได้ */
console.log(failed === 0 ? `\nครบทั้ง ${results.length} กรณี` : `\nตก ${failed} จาก ${results.length} กรณี`);
process.exitCode = failed === 0 ? 0 : 1;
