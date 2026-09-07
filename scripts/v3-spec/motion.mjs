/**
 * ตรวจว่าสไลด์ของหน้าแรกหยุดหมุนถูกกรณี
 *
 * **เหลือสองกรณี ไม่ใช่สี่ — เจ้าของงานเคาะ 2026-09-07 ให้ยึดผืน**
 *
 * เดิมสไลด์หยุดสามทาง คือเมื่อชี้เมาส์ เมื่อโฟกัสเข้าแบนเนอร์ และเมื่อผู้ใช้ตั้งเครื่องให้ลด
 * การเคลื่อนไหว · สองทางแรกถูกถอนออกตามคำสั่งยึดผืน ซึ่งวาดสไลด์ที่หมุนตลอด ·
 * กรณีทดสอบของสองทางนั้นจึงถูกลบไปด้วย **ไม่ใช่เพราะมันสอบตก แต่เพราะสิ่งที่มันเฝ้า
 * ไม่มีอยู่แล้ว** ตัวตรวจที่ไม่มีเกณฑ์คือโค้ดตาย กฎเดียวกับที่ใช้กับ `hitTarget`
 *
 * **ทางที่เหลือคือ `prefers-reduced-motion` และมันไม่ใช่ของที่ผืนวาด** มันคือคำสั่งที่
 * ผู้ใช้ตั้งไว้ที่เครื่องของเขาเอง ผืนจึงพูดแทนไม่ได้ · กฎ CSS ที่ท้าย `globals.css`
 * สั่งได้แค่ animation ส่วนตัวหมุนเป็น JavaScript ซึ่ง CSS แตะไม่ถึง และด่านในชุดเทสต์
 * ก็จับไม่ได้เพราะไม่มีเบราว์เซอร์จริงให้เวลาเดิน · ตัวตรวจนี้จึงยังต้องมี
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

async function check(label, expectMove, { reduced = false } = {}) {
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
   * คืนหน้าสู่สภาพปกติก่อนเริ่มจับเวลา
   *
   * **โฟกัสกับเมาส์ไม่หยุดสไลด์อีกแล้ว** การล้างจึงไม่จำเป็นต่อผลอีกต่อไป แต่ยังทำอยู่
   * เพราะมันทำให้ตัวตรวจวัดสภาพเดียวกันทุกรอบ ไม่ใช่สภาพที่ค้างมาจากการกดลูกศรเมื่อครู่
   */
  await page.evaluate(() => document.activeElement?.blur());
  await page.mouse.move(10, 10);

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
  await check("ตั้งเครื่องลดการเคลื่อนไหว ควรหยุด", false, { reduced: true })
];

await browser.close();

const failed = results.filter((ok) => !ok).length;
console.log(failed === 0 ? "\nครบทั้งสองกรณี" : `\nตก ${failed} กรณี`);
process.exitCode = failed === 0 ? 0 : 1;
