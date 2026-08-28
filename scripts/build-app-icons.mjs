import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

/**
 * สร้างชุดไอคอนของแอปจากตรา NM (IP-196) — รันซ้ำได้ทุกครั้งที่ตราเปลี่ยน:
 *
 *   node scripts/build-app-icons.mjs
 *
 * ต้นทาง: public/brand/naichangmoo-nm-mark.png (พื้นขาว) → crop กรอบเนื้อตราจากภาพจริง
 * (เนื้อตราชิดขอบขวาเกือบพอดี ถ้า pad จากภาพเต็มตราจะเบี้ยว) แล้ววางกึ่งกลางจัตุรัสพื้นขาว
 * ย่อแบบหารครึ่งเป็นขั้น ๆ ให้ขนาดเล็กยังคม แล้วเขียนออก:
 *
 *   src/app/favicon.ico                        ICO ฝัง PNG 16+32+48 — Next เสิร์ฟที่ /favicon.ico
 *   src/app/icon.png                           192 — Next ใส่ <link rel="icon"> ให้เอง
 *   src/app/apple-icon.png                     180 — iOS ตัดมุมโค้ง จึงเว้นขอบมากกว่า
 *   public/brand/naichangmoo-app-icon-192.png  ให้ manifest ชี้
 *   public/brand/naichangmoo-app-icon-512.png  ให้ manifest ชี้
 *
 * ไฟล์ผลลัพธ์ถูกด่านตรวจ src/icon-fence.test.ts เฝ้า magic bytes กับขนาดจริงอยู่
 * สคริปต์นี้อยู่นอก src จึงประกาศ #ffffff ได้โดยไม่ผิดด่านตรวจสี (ADR 0021)
 */

const ROOT = join(import.meta.dirname, "..");
const SOURCE = join(ROOT, "public/brand/naichangmoo-nm-mark.png");

/** สัดส่วนที่ด้านยาวสุดของตรากินพื้นที่จัตุรัส */
const FILL_TAB = 0.86;
const FILL_APPLE = 0.74;

const img = await loadImage(SOURCE);

/** หากรอบเนื้อตราจากภาพจริง: ช่องสีใดต่ำกว่า 240 ถือเป็นเนื้อตรา ไม่ใช่พื้นขาว */
function measureContentBox(image) {
  const probe = createCanvas(image.width, image.height);
  const ctx = probe.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, image.width, image.height);
  let minX = image.width, minY = image.height, maxX = -1, maxY = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      if (data[i] < 240 || data[i + 1] < 240 || data[i + 2] < 240) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error("ไม่พบเนื้อตราในภาพต้นทาง — ภาพขาวล้วน?");
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

const box = measureContentBox(img);

function renderMaster(size, fill) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  const scale = (size * fill) / Math.max(box.w, box.h);
  const w = box.w * scale, h = box.h * scale;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, box.x, box.y, box.w, box.h, (size - w) / 2, (size - h) / 2, w, h);
  return canvas;
}

/** ย่อแบบหารครึ่งเป็นขั้น ๆ จนใกล้เป้า แล้วค่อยลงขั้นสุดท้าย — ภาพ 16/32px ยังอ่านออก */
function downscale(master, target) {
  let current = master;
  while (current.width / 2 >= target * 2) {
    const half = createCanvas(current.width / 2, current.height / 2);
    const ctx = half.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(current, 0, 0, half.width, half.height);
    current = half;
  }
  const out = createCanvas(target, target);
  const ctx = out.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(current, 0, 0, target, target);
  return out;
}

/**
 * ICO ฝัง PNG — ICONDIR 6 bytes (u16 reserved=0, u16 type=1, u16 count, LE ทั้งหมด)
 * ตามด้วย ICONDIRENTRY 16 bytes ต่อภาพ แล้วต่อท้ายด้วย PNG ทั้งก้อนตามลำดับ
 */
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, buf } of pngs) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += buf.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.buf)]);
}

const masterTab = renderMaster(1024, FILL_TAB);
const masterApple = renderMaster(1024, FILL_APPLE);
const png = (canvas) => canvas.encode("png");

const out192 = await png(downscale(masterTab, 192));
const out512 = await png(downscale(masterTab, 512));
const outApple = await png(downscale(masterApple, 180));
const out48 = await png(downscale(masterTab, 48));
const out32 = await png(downscale(masterTab, 32));
const out16 = await png(downscale(masterTab, 16));

writeFileSync(join(ROOT, "src/app/favicon.ico"), buildIco([
  { size: 16, buf: out16 },
  { size: 32, buf: out32 },
  { size: 48, buf: out48 }
]));
writeFileSync(join(ROOT, "src/app/icon.png"), out192);
writeFileSync(join(ROOT, "src/app/apple-icon.png"), outApple);
writeFileSync(join(ROOT, "public/brand/naichangmoo-app-icon-192.png"), out192);
writeFileSync(join(ROOT, "public/brand/naichangmoo-app-icon-512.png"), out512);

console.log(`สร้างไอคอนครบจากกรอบเนื้อตรา ${box.w}x${box.h} ที่ (${box.x},${box.y})`);
console.log("→ src/app/favicon.ico (16+32+48) · icon.png 192 · apple-icon.png 180 · public/brand 192/512");
