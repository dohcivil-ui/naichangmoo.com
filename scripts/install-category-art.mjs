import { createCanvas, loadImage } from "@napi-rs/canvas";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

/**
 * รับภาพประกอบหมวดวัสดุจากที่ไหนก็ได้เข้ามาไว้ในที่ที่แอปอ่าน
 *
 * ภาพที่ได้จาก Midjourney มักออกมาเป็นไฟล์ชื่อยาวและกว้างเป็นพันพิกเซล ส่วนการ์ดในแอปกว้าง 219px
 * ถ้าเอาไฟล์ดิบเข้ารีโปตรง ๆ ทั้งยี่สิบเอ็ดใบจะหนักหลายสิบเมกะไบต์เพื่อแสดงผลที่ขนาดหนึ่งในห้า
 * สคริปต์นี้ย่อให้เหลือ 800x640 ครอบแบบ cover แล้วตั้งชื่อเป็นรหัสหมวดให้เรียบร้อย
 *
 * ใช้:
 *   node scripts/install-category-art.mjs <โฟลเดอร์ต้นทาง>
 *
 * ไฟล์ต้นทางต้องขึ้นต้นด้วยรหัสหมวดสองหลัก เช่น 01.png, 16-aggregate.png, 05 pipe.jpg
 * ไฟล์ที่ไม่ขึ้นต้นด้วยรหัสจะถูกข้ามและรายงานออกมา ไม่ใช่เดาให้
 */

const source = resolve(process.argv[2] ?? ".");
const target = resolve("public/brand/categories");
const WIDTH = 800;
const HEIGHT = 640;

const CATEGORY_NAMES = {
  "01": "วัสดุเทหล่อกับที่",
  "02": "วัสดุก่อ",
  "03": "ชิ้นส่วนโครงสร้างสำเร็จรูป",
  "04": "วัสดุชิ้นส่วนหน้าตัดรูปต่างๆ",
  "05": "วัสดุท่อ",
  "06": "วัสดุลวดตาข่าย มุ้งลวด ลวดหนาม",
  "07": "วัสดุฉนวน",
  "08": "วัสดุแผ่นซ้อนทับ",
  "09": "วัสดุแผ่นแข็ง",
  "10": "วัสดุตกแต่งผิว",
  "11": "วัสดุไม้",
  "12": "วัสดุฉาบผิว",
  "13": "วัสดุขัดผิว",
  "14": "วัสดุชิ้นส่วนสำเร็จรูป",
  "15": "วัสดุผลิตภัณฑ์",
  "16": "วัสดุผสมคอนกรีต",
  "17": "วัสดุถม/รองพื้น",
  "18": "วัสดุและอุปกรณ์งานประปา",
  "19": "วัสดุและอุปกรณ์งานสุขาภิบาล",
  "20": "วัสดุและอุปกรณ์งานไฟฟ้า",
  "21": "เครื่องสุขภัณฑ์"
};

mkdirSync(target, { recursive: true });

const files = readdirSync(source).filter((file) => /\.(png|jpg|jpeg|webp)$/i.test(file));
const skipped = [];
let written = 0;

for (const file of files) {
  const code = basename(file, extname(file)).match(/^(\d{2})/)?.[1];
  if (!code || !CATEGORY_NAMES[code]) {
    skipped.push(file);
    continue;
  }

  const image = await loadImage(join(source, file));
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  // ครอบแบบ cover ให้เต็มกรอบโดยไม่ยืดภาพ ส่วนที่เกินถูกตัดทิ้งเท่ากันทั้งสองข้าง
  const scale = Math.max(WIDTH / image.width, HEIGHT / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.drawImage(image, (WIDTH - drawWidth) / 2, (HEIGHT - drawHeight) / 2, drawWidth, drawHeight);

  /**
   * บันทึกเป็น WebP คุณภาพ 82 ไม่ใช่ PNG
   *
   * ภาพถ่ายจาก Midjourney ที่ 1200x960 หนักใบละราว 1.3 MB ครบยี่สิบเอ็ดใบคือ 27 MB
   * ย่อเป็น PNG 800x640 ยังเหลือ 13 MB เพราะ PNG ไม่บีบภาพถ่าย ส่วน WebP เหลือหลักร้อยกิโลไบต์
   * ต่อทั้งชุด ซึ่งเป็นเพดานที่ docs/design-system/icon-prompts.md กำหนดไว้
   */
  const out = join(target, `${code}.webp`);
  writeFileSync(out, canvas.toBuffer("image/webp", 82));
  written += 1;
  console.log(`${code} ${CATEGORY_NAMES[code]}  <-  ${file}  (${image.width}x${image.height} -> ${WIDTH}x${HEIGHT})`);
}

console.log(`\nเข้ารีโปแล้ว ${written} ใบ จากทั้งหมด ${Object.keys(CATEGORY_NAMES).length} หมวด`);

const missing = Object.keys(CATEGORY_NAMES).filter((code) => !readdirSync(target).includes(`${code}.webp`));
if (missing.length) console.log(`ยังขาด: ${missing.join(", ")}`);
if (skipped.length) console.log(`ข้ามเพราะชื่อไฟล์ไม่ขึ้นต้นด้วยรหัสหมวด: ${skipped.join(", ")}`);
