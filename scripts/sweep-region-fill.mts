/**
 * กวาดทั้งหน้าแบบด้วยจุดตั้งต้นเป็นตาราง แล้วเทียบพื้นที่ห้องของโค้ดเดิมกับโค้ดใหม่ทีละห้อง
 *
 * **ทำไมต้องมี** เทสต์สังเคราะห์จับความผิดของกติกาเสาไม่ได้ เพราะภาพจำลองเป็นระเบียบ
 * เกินกว่าแบบจริง · 2026-09-05 การแก้กติกาการรวมก้อนเสาทำให้ห้องน้ำผู้ป่วยชายหน้า 7
 * เหลือ 2.77 จาก 4.20 โดยที่เทสต์ 1,204 ข้อยังเขียวหมด · เครื่องมือนี้จับได้ในรอบเดียว
 *
 * **วิธีใช้**
 * 1. เปิดแบบในแอปที่หน้าที่จะตรวจ แล้วดึงผืนวิเคราะห์ออกมาเป็น PNG ด้วย devtools
 *    `document.querySelector("canvas").toDataURL("image/png")` แล้วเซฟเป็น `tmp/page7.png`
 *    · ต้องใช้ผืนที่แอปเรนเดอร์เอง เพราะ pdfjs เรนเดอร์ลงผืนของ node แล้ว segfault
 * 2. `git show HEAD:src/lib/region-fill.ts > tmp/region-fill.head.ts` เพื่อเก็บโค้ดก่อนแก้
 * 3. `npx tsx scripts/sweep-region-fill.mts`
 *
 * ห้องที่พื้นที่เปลี่ยนเกิน 3% จะถูกทำเครื่องหมายไว้ · การแก้ที่ตั้งใจก็ติดเครื่องหมายได้
 * ให้ดูว่าทิศทางกับขนาดของการเปลี่ยนสมเหตุสมผลไหม ไม่ใช่ดูแค่ว่ามีเครื่องหมายหรือไม่มี
 */
import { createCanvas, loadImage } from "@napi-rs/canvas";
import * as now from "../src/lib/region-fill.ts";
import * as head from "../tmp/region-fill.head.ts";

const ratio = 125.29;
const analysisScale = 2;
const metresPerPoint = (ratio * 25.4) / 1000 / 72;
const metresPerPixel = metresPerPoint / analysisScale;
const pixelsPerMetre = analysisScale / metresPerPoint;

const image = await loadImage(process.argv[2] ?? "tmp/page7-analysis.png");
const canvas = createCanvas(image.width, image.height);
const context = canvas.getContext("2d");
context.drawImage(image, 0, 0);
const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;

const base = {
  minRunPixels: now.MIN_WALL_RUN_METRES * pixelsPerMetre,
  minStructurePixels: now.MIN_STRUCTURE_METRES * pixelsPerMetre,
  column: {
    min: Math.round(now.COLUMN_MIN_METRES * pixelsPerMetre),
    max: Math.round(now.COLUMN_MAX_METRES * pixelsPerMetre),
    touch: Math.round(now.COLUMN_TOUCH_METRES * pixelsPerMetre)
  },
  bridgeGapPixels: (now.DOOR_BRIDGE_METRES / 2) * pixelsPerMetre,
  minStepPixels: now.OUTLINE_MIN_STEP_METRES * pixelsPerMetre,
  snapToLinePixels: now.WALL_SNAP_METRES * pixelsPerMetre,
  wallThicknessPixels: now.WALL_THICKNESS_METRES * pixelsPerMetre
};
const greyNow = now.toGreyImage(rgba as unknown as Uint8ClampedArray, canvas.width, canvas.height);

/**
 * นับพิกเซลของสิ่งกั้นที่รูปห้องกินทับ — คือ "สีล้นในเสา" ที่เจ้าของงานเห็นบนจอ
 *
 * ตัวเลขพื้นที่บอกไม่ได้ว่ารูปถูกหรือผิด เพราะส่วนที่ขาดกับส่วนที่เกินหักกลบกันได้
 * ตัวนี้บอกตรง ๆ ว่ารูปที่ได้ทับเนื้อของผนังกับเสาไปกี่พิกเซล ยิ่งน้อยยิ่งดี
 */
function barrierInside(polygon: readonly { x: number; y: number }[], barrier: Uint8Array, width: number): number {
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  const x0 = Math.floor(Math.min(...xs));
  const x1 = Math.ceil(Math.max(...xs));
  const y0 = Math.floor(Math.min(...ys));
  const y1 = Math.ceil(Math.max(...ys));
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const inside = new Uint8Array(w * h);
  for (let y = y0; y <= y1; y += 1) {
    const cy = y + 0.5;
    const crossings: number[] = [];
    for (let i = 0; i < polygon.length; i += 1) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      if (a.y === b.y) continue;
      if (cy < Math.min(a.y, b.y) || cy >= Math.max(a.y, b.y)) continue;
      crossings.push(a.x + ((cy - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
    crossings.sort((p, q) => p - q);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const from = Math.max(x0, Math.ceil(crossings[i] - 0.5));
      const to = Math.min(x1, Math.floor(crossings[i + 1] - 0.5));
      for (let x = from; x <= to; x += 1) inside[(y - y0) * w + (x - x0)] = 1;
    }
  }
  /**
   * หดเข้ามาสองพิกเซลก่อนนับ · ขอบห้องนั่งบนกึ่งกลางเส้นผิวผนังโดยตั้งใจ หมึกของเส้นนั้น
   * จึงอยู่ในรูปเสมอตลอดเส้นรอบรูป ซึ่งไม่ใช่ความผิด · ที่ต้องจับคือหมึกที่อยู่**ลึกเข้ามา**
   * ในห้อง ซึ่งแปลว่ารูปกลืนเสาหรือกลืนผนังไปทั้งชิ้น
   */
  const margin = 2;
  let count = 0;
  for (let y = margin; y < h - margin; y += 1) {
    for (let x = margin; x < w - margin; x += 1) {
      if (!inside[y * w + x]) continue;
      let solid = true;
      for (let dy = -margin; dy <= margin && solid; dy += 1) {
        for (let dx = -margin; dx <= margin; dx += 1) {
          if (!inside[(y + dy) * w + (x + dx)]) { solid = false; break; }
        }
      }
      if (solid && barrier[(y + y0) * width + (x + x0)]) count += 1;
    }
  }
  return count;
}
const barrierNow = now.structuralBarrier(greyNow, { ...base, lineMaxThicknessPixels: now.LINE_MAX_THICKNESS_POINTS * analysisScale }).drawn;
const greyHead = head.toGreyImage(rgba as unknown as Uint8ClampedArray, canvas.width, canvas.height);

function shoelace(points: readonly { x: number; y: number }[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return (Math.abs(sum) / 2) * metresPerPixel * metresPerPixel;
}
const key = (points: readonly { x: number; y: number }[]) => {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return `${Math.round(Math.min(...xs))},${Math.round(Math.min(...ys))},${Math.round(Math.max(...xs))},${Math.round(Math.max(...ys))}`;
};

const seen = new Map<string, { head: number; now: number; seed: string; overlap: number }>();
for (let y = 300; y < 1450; y += 80) {
  for (let x = 300; x < 2150; x += 80) {
    const a = head.traceRegion(greyHead, { x, y }, base);
    const b = now.traceRegion(greyNow, { x, y }, { ...base, lineMaxThicknessPixels: now.LINE_MAX_THICKNESS_POINTS * analysisScale });
    if (!a.ok || !b.ok) continue;
    const id = key(a.polygon);
    if (seen.has(id)) continue;
    seen.set(id, {
      head: shoelace(a.polygon),
      now: shoelace(b.polygon),
      seed: `${x},${y}`,
      overlap: barrierInside(b.polygon, barrierNow, canvas.width)
    });
  }
}
const rows = [...seen.values()].sort((p, q) => q.head - p.head);
console.log("จุดตั้งต้น".padEnd(12), "เดิม".padStart(9), "ใหม่".padStart(9), "ต่าง".padStart(9), "  %".padEnd(10), "ทับสิ่งกั้น");
for (const row of rows) {
  const delta = row.now - row.head;
  const pct = (delta / row.head) * 100;
  const flag = Math.abs(pct) > 3 ? "  <<< ผิดปกติ" : "";
  console.log(
    row.seed.padEnd(12),
    row.head.toFixed(2).padStart(9),
    row.now.toFixed(2).padStart(9),
    delta.toFixed(2).padStart(9),
    `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`.padEnd(10),
    String(row.overlap).padStart(7) + flag
  );
}
console.log(`\nห้องที่ไล่ได้ ${rows.length} ห้อง`);
