/**
 * อ่านสิ่งที่อัลกอริทึมเห็น ไม่ใช่สิ่งที่ต้นฉบับเขียน
 *
 * ภาพต้นทางคือ **ผืนที่แอปเรนเดอร์เอง** ดึงออกมาจากเบราว์เซอร์ด้วย `canvas.toDataURL`
 * ขนาด 2382×1684 ซึ่งเป็นแผนเดียวกับชั้นวิเคราะห์ (`fullPageScaleFor` = 2 จุดต่อพิกเซล)
 * และพื้นถูกถมด้วย `--paper` เหมือนกันทั้งสองผืน · ที่ต้องทำแบบนี้เพราะ pdfjs เรนเดอร์
 * ลงผืนของ node แล้ว segfault ตอนวาดตัวอักษร
 *
 * ใช้: npx tsx scripts/probe-region-fill.mts <png> "<x,y;x,y>" [ratio] [outPng]
 * · ตั้ง CROP="x0,y0,x1,y1" เพื่อเลือกกรอบของภาพผลลัพธ์เอง
 */
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
import {
  COLUMN_MAX_METRES,
  COLUMN_MIN_METRES,
  COLUMN_TOUCH_METRES,
  DOOR_BRIDGE_METRES,
  LINE_MAX_THICKNESS_POINTS,
  MIN_STRUCTURE_METRES,
  MIN_WALL_RUN_METRES,
  OUTLINE_MIN_STEP_METRES,
  WALL_SNAP_METRES,
  WALL_THICKNESS_METRES,
  structuralBarrier,
  toGreyImage,
  traceRegion,
  type Pixel
} from "../src/lib/region-fill.ts";

const [pngPath, seedArg, ratioArg, outPng] = process.argv.slice(2);
const ratio = Number(ratioArg ?? 125.29);
const metresPerPoint = (ratio * 25.4) / 1000 / 72;
const analysisScale = 2;
const metresPerPixel = metresPerPoint / analysisScale;
const pixelsPerMetre = analysisScale / metresPerPoint;

const image = await loadImage(pngPath);
const canvas = createCanvas(image.width, image.height);
const context = canvas.getContext("2d");
context.drawImage(image, 0, 0);
const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
const grey = toGreyImage(rgba as unknown as Uint8ClampedArray, canvas.width, canvas.height);

const options = {
  minRunPixels: MIN_WALL_RUN_METRES * pixelsPerMetre,
  minStructurePixels: MIN_STRUCTURE_METRES * pixelsPerMetre,
  column: {
    min: Math.round(COLUMN_MIN_METRES * pixelsPerMetre),
    max: Math.round(COLUMN_MAX_METRES * pixelsPerMetre),
    touch: Math.round(COLUMN_TOUCH_METRES * pixelsPerMetre)
  },
  bridgeGapPixels: (DOOR_BRIDGE_METRES / 2) * pixelsPerMetre,
  minStepPixels: OUTLINE_MIN_STEP_METRES * pixelsPerMetre,
  snapToLinePixels: WALL_SNAP_METRES * pixelsPerMetre,
  lineMaxThicknessPixels: LINE_MAX_THICKNESS_POINTS * analysisScale,
  wallThicknessPixels: WALL_THICKNESS_METRES * pixelsPerMetre
};

console.log(`ผืน ${canvas.width}×${canvas.height} · 1:${ratio} · ${pixelsPerMetre.toFixed(2)} พิกเซลต่อเมตร · ${(metresPerPixel * 100).toFixed(2)} ซม.ต่อพิกเซล`);
console.log(`เอื้อม ${Math.round(options.snapToLinePixels)} พิกเซล · เพดานความหนาเส้น ${options.lineMaxThicknessPixels} · เสา ${options.column.min}-${options.column.max}`);

function shoelace(points: readonly Pixel[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

const seeds = (seedArg ?? "").split(";").filter(Boolean).map((pair) => {
  const [x, y] = pair.split(",").map(Number);
  return { x, y };
});

const traced: Pixel[][] = [];
for (const seed of seeds) {
  const result = traceRegion(grey, seed, options);
  if (!result.ok) {
    console.log(`\nจุด (${seed.x},${seed.y}) → ปฏิเสธ: ${result.reason} (${result.areaPixels} พิกเซล)`);
    continue;
  }
  traced.push(result.polygon as Pixel[]);
  const area = shoelace(result.polygon) * metresPerPixel * metresPerPixel;
  const xs = result.polygon.map((p) => p.x);
  const ys = result.polygon.map((p) => p.y);
  const w = (Math.max(...xs) - Math.min(...xs)) * metresPerPixel;
  const h = (Math.max(...ys) - Math.min(...ys)) * metresPerPixel;
  console.log(`\nจุด (${seed.x},${seed.y}) → ${result.polygon.length} มุม`);
  console.log(`  กรอบพิกเซล x ${Math.min(...xs)}..${Math.max(...xs)} · y ${Math.min(...ys)}..${Math.max(...ys)}`);
  console.log(`  กว้าง ${w.toFixed(3)} × ยาว ${h.toFixed(3)} · พื้นที่ ${area.toFixed(3)} ตร.ม.`);
  if (result.polygon.length <= 80) console.log(`  มุม ${result.polygon.map((p) => `${p.x},${p.y}`).join(" ")}`);
}

/** ภาพขยายพร้อมรูปที่ไล่ได้ทาบบนแบบ · ตัวเลขถูกไม่ได้แปลว่ารูปถูก ต้องเปิดดูทุกครั้ง */
if (outPng && traced.length > 0) {
  const all = traced.flat();
  const pad = 30;
  const window = (process.env.CROP ?? "").split(",").map(Number);
  const [x0, y0, x1, y1] = window.length === 4
    ? window
    : [
        Math.max(0, Math.floor(Math.min(...all.map((p) => p.x)) - pad)),
        Math.max(0, Math.floor(Math.min(...all.map((p) => p.y)) - pad)),
        Math.min(canvas.width, Math.ceil(Math.max(...all.map((p) => p.x)) + pad)),
        Math.min(canvas.height, Math.ceil(Math.max(...all.map((p) => p.y)) + pad))
      ];
  const zoom = Math.max(1, Math.min(12, Math.floor(1400 / (x1 - x0))));
  const out = createCanvas((x1 - x0) * zoom, (y1 - y0) * zoom);
  const octx = out.getContext("2d");
  octx.imageSmoothingEnabled = false;
  octx.drawImage(image, x0, y0, x1 - x0, y1 - y0, 0, 0, out.width, out.height);
  octx.lineWidth = 2;
  octx.strokeStyle = "#f47721";
  for (const polygon of traced) {
    octx.beginPath();
    polygon.forEach((p, i) => {
      const sx = (p.x - x0) * zoom;
      const sy = (p.y - y0) * zoom;
      if (i === 0) octx.moveTo(sx, sy); else octx.lineTo(sx, sy);
    });
    octx.closePath();
    octx.stroke();
  }
  writeFileSync(outPng, out.toBuffer("image/png"));
  console.log(`\nภาพ ${outPng} · ครอบ x ${x0}..${x1} y ${y0}..${y1} · ขยาย ${zoom} เท่า`);
}

if (process.env.DUMP_BARRIER) {
  const { drawn, barrier } = structuralBarrier(grey, options);
  writeFileSync("tmp/drawn.bin", Buffer.from(drawn));
  writeFileSync("tmp/barrier.bin", Buffer.from(barrier));
  console.log("เขียน tmp/drawn.bin กับ tmp/barrier.bin แล้ว");
}
