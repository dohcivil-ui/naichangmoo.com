import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";

/**
 * Read an official circular that is not in the repository.
 *
 * The circulars under km/ come in two shapes and both have to be readable, because everything the
 * pricing layer will use is printed in one of them:
 *
 *   text   the tables, which carry a text layer and can be read as rows
 *   image  the covering letter and the announcement, which are scans and hold the document number,
 *          the date, the issuing department and the basis for the rate
 *
 * Usage:
 *   node scripts/read-circular.mjs text  <file.pdf> [fromPage] [toPage]
 *   node scripts/read-circular.mjs image <file.pdf> <page> <out.png> [divisor]
 *   node scripts/read-circular.mjs hash  <file.pdf>
 *
 * The image mode pulls the scanned bitmap straight out of the page and writes the PNG by hand.
 * Rendering the page properly would need a canvas backend, and the one available here segfaults.
 */

const [mode, file, ...rest] = process.argv.slice(2);

if (!mode || !file) {
  console.error("usage: node scripts/read-circular.mjs <text|image|hash> <file.pdf> [...]");
  process.exit(1);
}

const bytes = readFileSync(file);

if (mode === "hash") {
  console.log(createHash("sha256").update(bytes).digest("hex"));
  process.exit(0);
}

const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;

if (mode === "text") {
  const from = Number(rest[0] ?? 1);
  const to = rest[1] ? Math.min(Number(rest[1]), doc.numPages) : doc.numPages;
  console.log(`PAGES=${doc.numPages}`);
  for (let n = from; n <= to; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    // Group items into visual rows so a table reads as rows rather than a stream of cells.
    const rows = new Map();
    for (const item of content.items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 3) ?? y;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push({ x: item.transform[4], s: item.str.trim() });
    }
    console.log(`\n===== PAGE ${n} (${content.items.length} items) =====`);
    for (const [, cells] of [...rows.entries()].sort((a, b) => b[0] - a[0])) {
      const line = cells.sort((a, b) => a.x - b.x).map((c) => c.s).join(" | ");
      if (line.trim()) console.log(line);
    }
  }
  process.exit(0);
}

if (mode === "image") {
  const pageNo = Number(rest[0]);
  const out = rest[1];
  const divisor = Number(rest[2] ?? 1);
  if (!pageNo || !out) {
    console.error("usage: node scripts/read-circular.mjs image <file.pdf> <page> <out.png> [divisor]");
    process.exit(1);
  }
  const page = await doc.getPage(pageNo);
  const ops = await page.getOperatorList();
  const index = ops.fnArray.findIndex(
    (fn) => fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject
  );
  if (index < 0) {
    console.error(`page ${pageNo} carries no image; it is probably a text page — use text mode`);
    process.exit(1);
  }
  const img = await new Promise((resolve) => page.objs.get(ops.argsArray[index][0], resolve));
  const { width: W, height: H, data, kind } = img;
  const bpp = kind === 3 ? 4 : 3;
  const w = Math.floor(W / divisor);
  const h = Math.floor(H / divisor);

  const raw = Buffer.alloc((w * 3 + 1) * h);
  let p = 0;
  for (let y = 0; y < h; y++) {
    raw[p++] = 0;
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < divisor; dy++) {
        for (let dx = 0; dx < divisor; dx++) {
          const i = ((y * divisor + dy) * W + (x * divisor + dx)) * bpp;
          r += data[i]; g += data[i + 1]; b += data[i + 2];
        }
      }
      const n = divisor * divisor;
      raw[p++] = (r / n) | 0; raw[p++] = (g / n) | 0; raw[p++] = (b / n) | 0;
    }
  }
  writeFileSync(out, png(w, h, raw));
  console.log(`wrote ${out} (${w}x${h}, source ${W}x${H})`);
  process.exit(0);
}

console.error(`unknown mode: ${mode}`);
process.exit(1);

/** Minimal 8-bit RGB PNG encoder, so no image library is needed for a one-off read. */
function png(width, height, raw) {
  let table = null;
  const crc = (buf) => {
    if (!table) {
      table = new Int32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c;
      }
    }
    let c = -1;
    for (const byte of buf) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const chunk = (type, body) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const head = Buffer.concat([Buffer.from(type, "ascii"), body]);
    const check = Buffer.alloc(4);
    check.writeUInt32BE(crc(head));
    return Buffer.concat([len, head, check]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
