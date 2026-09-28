/**
 * หา playwright ให้เครื่องมือวัด โดยไม่ต้องให้มันเข้า `devDependencies` ของโปรเจกต์
 *
 * **ทำไมไม่ติดตั้งเข้าโปรเจกต์ไปเลย** เครื่องมือวัดไม่ใช่ส่วนหนึ่งของสิ่งที่ deploy
 * การใส่เบราว์เซอร์ทั้งตัวลงในต้นไม้ dependency ของเว็บ ทำให้ทุกคนที่ `pnpm install`
 * ต้องโหลดของที่ใช้เฉพาะตอนตรวจงานหน้าแรก และทำให้ด่านที่นับ dependency อ่านผิดไปด้วย
 *
 * **ทำไมต้องมีไฟล์นี้แทนที่จะ `import "playwright"` ตรง ๆ** เพราะเมื่อไม่ได้ติดตั้งเข้าโปรเจกต์
 * `npx --package playwright -c "node ..."` ให้แค่ `PATH` ไปที่ `.bin` ไม่ได้ตั้ง `NODE_PATH`
 * การ import ตรง ๆ จึงหาไม่เจอ · ตัวนี้เดินจาก `PATH` ที่ npx ให้มา ย้อนขึ้นไปหา `node_modules`
 * แล้ว import จากที่นั่น
 *
 * ใช้: `const { chromium } = await loadPlaywright();`
 */
import { existsSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

/** ที่ทางที่เป็นไปได้ของ playwright เรียงจากที่ควรใช้ก่อน */
function candidates() {
  const found = [];
  for (const entry of (process.env.PATH ?? "").split(delimiter)) {
    /* npx วาง `.bin` ไว้ใน PATH — ตัว `node_modules` อยู่ถัดขึ้นไปหนึ่งชั้น */
    if (!entry.endsWith(join("node_modules", ".bin"))) continue;
    found.push(join(dirname(entry), "playwright", "index.mjs"));
  }
  return found;
}

export async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    /* ไม่ได้ติดตั้งเข้าโปรเจกต์ ซึ่งเป็นเรื่องปกติของเครื่องมือชุดนี้ — ไปหาที่ npx เตรียมไว้ */
  }

  for (const path of candidates()) {
    if (existsSync(path)) return import(pathToFileURL(path).href);
  }

  throw new Error(
    [
      "หา playwright ไม่เจอ",
      "",
      "เครื่องมือชุดนี้ไม่ได้ติดตั้ง playwright เข้าโปรเจกต์โดยตั้งใจ ให้รันผ่าน npx แทน",
      '  npx --yes --package playwright@1.63.0 -c "node scripts/v3-spec/compare.mjs"',
      "",
      "ครั้งแรกจะโหลดสักครู่ ครั้งถัดไปใช้ของที่ npx เก็บไว้แล้ว",
      "ใช้ Edge ที่ติดตั้งในเครื่อง ไม่ต้องรัน playwright install"
    ].join("\n")
  );
}

/**
 * หยุดอนิเมชันทั้งหน้าก่อนวัด — **จำเป็น ไม่ใช่ของแถม**
 *
 * บั๊กที่ฟังก์ชันนี้เกิดมาเพื่อกัน: `getBoundingClientRect` คืนกล่องของ **เฟรมที่กำลังฉาย
 * ณ วินาทีนั้น** ไม่ใช่ขนาดที่ออกแบบไว้ · ของที่ขยับขนาดด้วย keyframe จึงวัดได้ไม่เท่ากัน
 * ทุกรอบ · รัน `extract-canvas.mjs` สองรอบติดกันบนผืนที่ไม่ได้แก้อะไรเลย
 * **ได้ค่าต่างกัน 22 จาก 353 อิลิเมนต์**
 *
 * ความเสียหายจริงที่เกิดแล้ว: ป้ายสิทธิ์บนการ์ดโปรโมชั่นหมุนด้วย `badgePop`
 * ซึ่งย่อขยาย 1 ถึง 1.08 พร้อมเอียง −2 ถึง +2 องศา · กล่องที่ `getBoundingClientRect`
 * คืนมาเป็นกรอบสี่เหลี่ยมที่ครอบของที่เอียงอยู่ จึงกว้างและสูงตามมุมเอียงด้วย
 * ช่วงแกว่งกว้างประมาณหกพิกเซล ซึ่งกว้างกว่าเกณฑ์หนึ่งพิกเซลของตัวเทียบหลายเท่า ·
 * ผลคือ **แถวเดียวกันเข้ากอง "ตรง" รอบหนึ่ง แล้วเข้ากอง "ต่างแต่มีเหตุผล" อีกรอบหนึ่ง**
 * โดยไม่มีใครแตะโค้ด และการตรวจว่าสมุดเน่าหรือยังก็พลิกตาม
 *
 * ปิดทั้งสองฝั่งเสมอ ผืนกับหน้าจริงมี keyframe ชุดเดียวกัน การปิดข้างเดียวจะกลายเป็น
 * การเทียบขนาดที่ออกแบบไว้กับเฟรมสุ่ม ซึ่งแย่กว่าเดิม
 *
 * `animation: none` ไม่ใช่ `animation-play-state: paused` — การหยุดค้างเก็บ transform
 * ของเฟรมนั้นไว้ ส่วนการยกเลิกทำให้อิลิเมนต์กลับไปใช้สไตล์ของตัวเอง ซึ่งคือขนาดที่ออกแบบไว้
 */
export async function freezeAnimations(page) {
  await page.addStyleTag({
    content: "*, *::before, *::after { animation: none !important; transition: none !important; }"
  });
}
