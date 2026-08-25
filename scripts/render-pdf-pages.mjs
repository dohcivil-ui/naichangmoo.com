import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas, ImageData } from "@napi-rs/canvas";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

/**
 * Pull the scanned page images out of a PDF so they can be read as pictures.
 *
 * Most of km/ is scanned paper. The Factor F circular carried a text layer, but the S-Curve
 * textbook and every งวดงาน sheet do not — pdfjs returns empty strings for those, so the only
 * way to read them is to look at them.
 *
 * This extracts the embedded image rather than re-rendering the page. Rendering through
 * pdfjs into a node canvas segfaults on these files, and extraction is the better answer
 * anyway: a scanned page *is* one image, so lifting it out keeps the original scan untouched
 * instead of resampling it through a rasteriser.
 *
 * It prints the source sha256 on every run, because a rule copied out of a scan has to name
 * the exact file it came from — the discipline scripts/extract-factor-f.mjs already follows.
 *
 * Usage: node scripts/render-pdf-pages.mjs <pdf> <outDir> [firstPage] [lastPage]
 */

const [file, outDir, first = "1", last = "0"] = process.argv.slice(2);

if (!file || !outDir) {
  console.error("usage: node scripts/render-pdf-pages.mjs <pdf> <outDir> [first] [last]");
  process.exit(1);
}

const bytes = readFileSync(file);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const doc = await getDocument({ data: new Uint8Array(bytes) }).promise;

const from = Math.max(1, Number(first));
const to = Number(last) > 0 ? Math.min(doc.numPages, Number(last)) : doc.numPages;

mkdirSync(outDir, { recursive: true });

console.log(`source : ${file}`);
console.log(`sha256 : ${sha256}`);
console.log(`pages  : ${doc.numPages} total, extracting ${from}-${to}`);

/**
 * pdfjs hands back pixels in one of three shapes. Only RGBA can go straight into an ImageData,
 * so the other two are widened here rather than at the call site.
 */
const toRgba = (image) => {
  const { width, height, kind, data } = image;
  const out = new Uint8ClampedArray(width * height * 4);

  if (kind === 3) {
    out.set(data.subarray(0, out.length));
    return out;
  }

  if (kind === 2) {
    for (let i = 0, o = 0; o < out.length; i += 3, o += 4) {
      out[o] = data[i];
      out[o + 1] = data[i + 1];
      out[o + 2] = data[i + 2];
      out[o + 3] = 255;
    }
    return out;
  }

  // GRAYSCALE_1BPP: one bit per pixel, rows padded to whole bytes.
  const rowBytes = (width + 7) >> 3;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const bit = (data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
      const shade = bit ? 0 : 255;
      const o = (y * width + x) * 4;
      out[o] = shade;
      out[o + 1] = shade;
      out[o + 2] = shade;
      out[o + 3] = 255;
    }
  }
  return out;
};

const pageImage = async (page) => {
  const ops = await page.getOperatorList();
  for (let i = 0; i < ops.fnArray.length; i += 1) {
    const fn = ops.fnArray[i];
    if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject) {
      const name = ops.argsArray[i][0];
      return await new Promise((resolve) => page.objs.get(name, resolve));
    }
  }
  return null;
};

let written = 0;
let skipped = 0;

for (let n = from; n <= to; n += 1) {
  const page = await doc.getPage(n);
  const image = await pageImage(page);

  if (!image?.data) {
    // A page with no image and no text layer is a page nothing can read. Say so rather than
    // leaving a gap in the numbering that looks like a rendering failure later.
    console.log(`  p${String(n).padStart(3, "0")}  no image on this page`);
    skipped += 1;
    continue;
  }

  const canvas = createCanvas(image.width, image.height);
  canvas.getContext("2d").putImageData(new ImageData(toRgba(image), image.width, image.height), 0, 0);

  const name = `p${String(n).padStart(3, "0")}.png`;
  writeFileSync(join(outDir, name), canvas.toBuffer("image/png"));
  console.log(`  ${name}  ${image.width}x${image.height}`);
  written += 1;
}

console.log(`done: ${written} written, ${skipped} skipped`);
