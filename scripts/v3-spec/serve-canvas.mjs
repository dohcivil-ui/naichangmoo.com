/** เสิร์ฟโฟลเดอร์ผืนออกแบบผ่าน http เพื่อให้ภาพและ fetch ของ prototype ทำงาน */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
const ROOT = "D:/AIProject/naichangmoo/redesign/V3";
const INDEX = "Home Redesign v3.dc.html";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json",
  ".webp": "image/webp", ".png": "image/png", ".css": "text/css" };
createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const rel = url === "/" ? INDEX : url;
  try {
    const buf = await readFile(join(ROOT, rel));
    res.writeHead(200, { "content-type": TYPES[extname(rel).toLowerCase()] ?? "application/octet-stream" });
    res.end(buf);
  } catch { res.writeHead(404).end("not found"); }
}).listen(4173, () => console.log("canvas server :4173"));
