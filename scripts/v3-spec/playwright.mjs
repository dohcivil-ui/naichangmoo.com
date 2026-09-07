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
