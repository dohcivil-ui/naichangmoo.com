import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * ดึงราคาของจังหวัดที่ระบุแล้วเก็บลงคลังไว้ล่วงหน้า (IP-162)
 *
 * มีไว้เพราะคลังจะมีของก็ต่อเมื่อมีคนเปิดหน้านั้นมาก่อนแล้วเท่านั้น จังหวัดที่ยังไม่มีใครเปิดเลย
 * ผู้ใช้คนแรกก็ยังต้องรอต้นทางอยู่ดี สคริปต์นี้ให้เจ้าของงานอุ่นจังหวัดที่รู้ว่าจะมีคนใช้ไว้ก่อนได้
 *
 * **รันด้วยมือเท่านั้น ไม่มีงานตามเวลาในรุ่นนี้** เพราะการอุ่นครบเจ็ดสิบเจ็ดจังหวัดคือราวสามล้านแถว
 * ซึ่งเป็นการตัดสินใจคนละใบกับการทำให้ราคาอยู่รอดการรีสตาร์ต
 *
 * ใช้:
 *   npx tsx scripts/warm-price-archive.ts 10 50 90
 *
 * ไม่ใส่รหัสจังหวัด = อุ่นเฉพาะส่วนกลาง (10) ซึ่งเป็นค่าตั้งต้นของหน้า
 */

function loadLocalEnv() {
  const file = path.join(process.cwd(), ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (process.env[key] !== undefined) continue;
    process.env[key] = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
  }
}

loadLocalEnv();

if (!process.env.DATABASE_URL) {
  console.error("ไม่มี DATABASE_URL — สคริปต์นี้ต้องเขียนลงฐานข้อมูล จึงไปต่อไม่ได้");
  process.exit(1);
}

const provinces = process.argv.slice(2).filter(Boolean);
const targets = provinces.length > 0 ? provinces : ["10"];

const { readSnapshot } = await import("../src/server/tpso-prices.js");
const { storeLedger } = await import("../src/server/price-archive.js");

for (const province of targets) {
  const started = Date.now();
  try {
    const snapshot = await readSnapshot(province);
    await storeLedger({
      province,
      period: snapshot.period,
      months: snapshot.months,
      version: snapshot.version,
      payloadHash: snapshot.payloadHash,
      rows: snapshot.rows
    });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`จังหวัด ${province} · ${snapshot.rows.length.toLocaleString("th-TH")} รายการ · เดือน ${snapshot.period.year}-${snapshot.period.month} · ${seconds} วินาที`);
  } catch (error) {
    console.error(`จังหวัด ${province} ไม่สำเร็จ:`, error instanceof Error ? error.message : error);
  }
}

process.exit(0);
