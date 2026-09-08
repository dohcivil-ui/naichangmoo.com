/**
 * เสิร์ฟโฟลเดอร์ผืนออกแบบผ่าน http เพื่อให้ภาพและ fetch ของ prototype ทำงาน
 *
 * **หน้านี้ไม่ใช่เว็บ มันคือแบบ** เว็บจริงอยู่ที่ `:3000` ซึ่งเป็น Next.js dev server ·
 * ที่นี่เสิร์ฟไฟล์เดียวคือผืนที่ Claude Design ส่งออกมา มีไว้ให้ `compare.mjs` เปิด
 * สองหน้าพร้อมกันแล้ววัดทีละชิ้นว่าของจริงตรงผืนไหม · ปิดตัวนี้ทิ้งเว็บไม่กระทบเลย
 * แต่ตัวเทียบจะรันไม่ได้
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
const ROOT = "D:/AIProject/naichangmoo/redesign/V3";
const INDEX = "Home Redesign v3.dc.html";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json",
  ".webp": "image/webp", ".png": "image/png", ".css": "text/css" };

/**
 * ชื่อแท็บ — เติมตอนเสิร์ฟ **ห้ามเติมลงไฟล์ผืน**
 *
 * ไฟล์ผืนไม่มี `<title>` เลยสักแท็ก เพราะ Claude Design ส่งออกมาเป็นภาพแบบ ไม่ได้ตั้งใจ
 * ให้เปิดเป็นหน้าเว็บ · เบราว์เซอร์จึงโชว์ `localhost:4173` เปล่า ๆ ซึ่งแยกจากแท็บของ
 * เว็บจริงไม่ออกเมื่อเปิดคู่กัน
 *
 * **ไฟล์ผืนเป็นสำเนาที่ต้องตรงกับต้นทางทุกตัวอักษร** `canvas-provenance.mjs` เทียบมัน
 * กับผืนฉบับที่เผยแพร่ · เติมอะไรลงไฟล์เมื่อไร ตัวตรวจจะรายงานว่าสำเนาไม่ตรงทันที
 * ซึ่งถูกต้องแล้วที่มันจะรายงาน · การเติมตอนเสิร์ฟจึงเป็นทางเดียวที่ไม่โกหกตัวตรวจ
 *
 * **ไม่กระทบการวัด** `<title>` ไม่ถูกวาดบนหน้า `extract-canvas.mjs` วัดจากกล่องที่วาดจริง
 * ด้วย `getBoundingClientRect` จึงไม่เห็นแท็กนี้เลย
 */
const TAB_TITLE = "ผืนออกแบบ v3 — ไม่ใช่เว็บจริง";

function withTitle(html) {
  if (html.includes("<title")) return html;
  const at = html.indexOf("<head>");
  if (at < 0) return html;
  return `${html.slice(0, at + 6)}<title>${TAB_TITLE}</title>${html.slice(at + 6)}`;
}

createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const rel = url === "/" ? INDEX : url;
  try {
    const buf = await readFile(join(ROOT, rel));
    const type = TYPES[extname(rel).toLowerCase()] ?? "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    res.end(type.startsWith("text/html") ? withTitle(buf.toString("utf8")) : buf);
  } catch { res.writeHead(404).end("not found"); }
}).listen(4173, () => console.log("canvas server :4173"));
