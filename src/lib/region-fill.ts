/**
 * เลือกพื้นที่ห้องด้วยการคลิกครั้งเดียว (IP-227)
 *
 * **ไม่ใช่งานของแบบจำลองภาษา และไม่มี prompt** เป็นอัลกอริทึมภาพแบบดั้งเดิม
 * ไล่จากพิกเซลที่ผู้ใช้คลิกออกไปทุกทิศจนกว่าจะชนเส้นที่เขียนไว้ในแบบ แล้วไล่ขอบของบริเวณ
 * ที่ได้ออกมาเป็นรูปหลายเหลี่ยม
 *
 * **เหตุผลที่ต้องไม่ใช่แบบจำลอง** ห้องเดียวกันต้องได้พื้นที่เท่ากันทุกครั้งที่คลิก
 * ซึ่งเป็นสิ่งที่แบบจำลองรับประกันให้ไม่ได้ และตรงกับหลักการข้อ 1 ที่แพลตฟอร์มประกาศไว้ว่า
 * ถามซ้ำกี่ครั้งก็ได้คำตอบเดิม · ผลพลอยได้คือไม่มีค่าใช้จ่ายต่อครั้งและทำงานได้แม้ไม่มีเน็ต
 *
 * ไฟล์นี้เป็นฟังก์ชันบริสุทธิ์ รับภาพเป็นตัวเลขล้วน ไม่แตะ DOM ไม่แตะ canvas
 * เพื่อให้เทสต์สร้างภาพจำลองขึ้นมาตรวจได้โดยไม่ต้องเปิดเบราว์เซอร์
 */

export type GreyImage = {
  /** ค่าความสว่าง 0 ถึง 255 เรียงทีละแถว ยาวเท่ากับ width คูณ height */
  data: Uint8ClampedArray | number[];
  width: number;
  height: number;
};

export type Pixel = { x: number; y: number };

export type RegionOptions = {
  /** พิกเซลที่มืดกว่าค่านี้ถือว่าเป็นเส้นในแบบ ปรับได้เพราะแบบสแกนกับแบบจาก CAD เข้มไม่เท่ากัน */
  lineThreshold?: number;
  /** สัดส่วนของทั้งหน้าที่ถ้าเกินแล้วถือว่าสีทะลุออกนอกห้อง */
  maxAreaFraction?: number;
};

export type RegionRejection = "seed_outside" | "seed_on_line" | "leaked" | "too_small";

export type RegionResult =
  | { ok: true; polygon: Pixel[]; areaPixels: number }
  | { ok: false; reason: RegionRejection; areaPixels: number };

export const DEFAULT_LINE_THRESHOLD = 140;
/**
 * เกินสัดส่วนนี้ของหน้าถือว่าสีทะลุออกนอกห้อง
 *
 * ค่านี้เคยเป็น 0.6 ซึ่งวัดกับแบบจริงเมื่อ 2026-09-01 แล้วพบว่าหลวมเกินไป
 * คลิกในห้องที่มีช่องประตู สีไหลออกไปทั้งชั้นแล้วได้ 266 ตร.ม. จากห้องที่จริง ๆ ราว 20 ตร.ม.
 * โดยระบบไม่เตือนสักคำ เพราะบริเวณที่ไหลออกไปกินเนื้อที่เพียง 14% ของหน้า
 * เจ้าของงานเคาะเมื่อ 2026-09-01 ให้ลดเพดานลงเหลือหนึ่งในสี่ของหน้า
 * และให้คนกดยืนยันรูปที่ได้ทุกครั้งก่อนเข้ารายการวัด เพดานนี้จึงเป็นตาข่ายชั้นล่าง ไม่ใช่ด่านเดียว
 */
const DEFAULT_MAX_AREA_FRACTION = 0.25;
const MIN_AREA_PIXELS = 40;

export const regionRejectionMessage: Record<RegionRejection, string> = {
  seed_outside: "คลิกนอกขอบหน้าแบบ",
  seed_on_line: "คลิกโดนเส้นในแบบพอดี ลองคลิกกลางห้องที่ว่าง",
  leaked:
    "เส้นรอบห้องในแบบไม่ปิดสนิท สีจึงทะลุออกนอกห้อง ให้วัดพื้นที่ด้วยการคลิกไล่มุมแทน",
  too_small: "บริเวณที่ได้เล็กเกินกว่าจะเป็นห้อง ลองคลิกใหม่กลางพื้นที่ว่าง"
};

/**
 * ไล่บริเวณที่ปิดล้อมรอบจุดที่คลิก แล้วคืนรูปหลายเหลี่ยมของขอบ
 *
 * **ตรวจการรั่วเสมอ** ผู้พัฒนาเครื่องมือที่เจ้าของงานให้ดูเตือนเองว่าวิธีนี้ไม่แม่นทุกครั้ง
 * ถ้าเส้นในแบบไม่ปิดสนิท สีจะทะลุออกไปทั้งหน้า เราจึงต้องจับให้ได้แล้วบอกตรง ๆ
 * ไม่ใช่คืนพื้นที่มั่ว ๆ ให้ไหลเข้าใบราคา
 */
export function traceRegion(image: GreyImage, seed: Pixel, options: RegionOptions = {}): RegionResult {
  const threshold = options.lineThreshold ?? DEFAULT_LINE_THRESHOLD;
  const maxArea = (options.maxAreaFraction ?? DEFAULT_MAX_AREA_FRACTION) * image.width * image.height;

  const sx = Math.round(seed.x);
  const sy = Math.round(seed.y);
  if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) {
    return { ok: false, reason: "seed_outside", areaPixels: 0 };
  }
  const at = (x: number, y: number) => image.data[y * image.width + x];
  if (at(sx, sy) <= threshold) {
    return { ok: false, reason: "seed_on_line", areaPixels: 0 };
  }

  const filled = new Uint8Array(image.width * image.height);
  const stack: number[] = [sy * image.width + sx];
  filled[stack[0]] = 1;
  let areaPixels = 0;
  let touchedBorder = false;

  while (stack.length > 0) {
    const index = stack.pop() as number;
    const x = index % image.width;
    const y = (index - x) / image.width;
    areaPixels += 1;

    if (x === 0 || y === 0 || x === image.width - 1 || y === image.height - 1) touchedBorder = true;
    if (areaPixels > maxArea) return { ok: false, reason: "leaked", areaPixels };

    const neighbours = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1]
    ];
    for (const [nx, ny] of neighbours) {
      if (nx < 0 || ny < 0 || nx >= image.width || ny >= image.height) continue;
      const nextIndex = ny * image.width + nx;
      if (filled[nextIndex]) continue;
      if (at(nx, ny) <= threshold) continue;
      filled[nextIndex] = 1;
      stack.push(nextIndex);
    }
  }

  if (touchedBorder) return { ok: false, reason: "leaked", areaPixels };
  if (areaPixels < MIN_AREA_PIXELS) return { ok: false, reason: "too_small", areaPixels };

  const outline = traceOutline(filled, image.width, image.height);
  return { ok: true, polygon: simplify(outline, 1.5), areaPixels };
}

/**
 * ไล่ขอบนอกของบริเวณที่ถูกเติม โดยเดินตามขอบทีละพิกเซล
 *
 * เดินตามเข็มนาฬิกาจากพิกเซลบนสุดซ้ายสุด แล้ววนจนกลับมาจุดเริ่ม
 */
function traceOutline(filled: Uint8Array, width: number, height: number): Pixel[] {
  let start = -1;
  for (let index = 0; index < filled.length; index += 1) {
    if (filled[index]) {
      start = index;
      break;
    }
  }
  if (start < 0) return [];

  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && filled[y * width + x] === 1;

  // แปดทิศรอบพิกเซล เรียงตามเข็มนาฬิกาเริ่มจากทิศตะวันตก
  const directions = [
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1]
  ];

  const startX = start % width;
  const startY = (start - startX) / width;
  const outline: Pixel[] = [{ x: startX, y: startY }];

  let current = { x: startX, y: startY };
  let entry = 0;
  const limit = width * height * 4;

  for (let step = 0; step < limit; step += 1) {
    let moved = false;
    for (let turn = 0; turn < directions.length; turn += 1) {
      const dirIndex = (entry + turn) % directions.length;
      const [dx, dy] = directions[dirIndex];
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (!inside(nx, ny)) continue;
      current = { x: nx, y: ny };
      // เข้ามาจากทิศตรงข้าม แล้วถอยหนึ่งช่องเพื่อไม่ให้ข้ามขอบที่บาง
      entry = (dirIndex + 5) % directions.length;
      outline.push(current);
      moved = true;
      break;
    }
    if (!moved) break;
    if (current.x === startX && current.y === startY && outline.length > 2) break;
  }

  return outline;
}

/**
 * ลดจำนวนจุดของเส้นขอบให้เหลือเท่าที่จำเป็น
 *
 * ขอบที่ไล่มาทีละพิกเซลมีจุดเป็นพันจุด ซึ่งลากแก้ด้วยมือไม่ได้และวาดช้า
 * วิธีนี้ตัดจุดที่อยู่บนเส้นตรงเดิมออก โดยคงรูปร่างไว้ในระยะที่กำหนด
 */
export function simplify(points: readonly Pixel[], tolerance: number): Pixel[] {
  if (points.length <= 2) return [...points];

  let maxDistance = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(points[i], first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }

  if (maxDistance <= tolerance) return [first, last];

  const left = simplify(points.slice(0, index + 1), tolerance);
  const right = simplify(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

function perpendicularDistance(point: Pixel, from: Pixel, to: Pixel): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - from.x, point.y - from.y);
  const area = Math.abs(dy * point.x - dx * point.y + to.x * from.y - to.y * from.x);
  return area / Math.hypot(dx, dy);
}

/** ดึงค่าความสว่างออกจากข้อมูลภาพสี่ช่องของ canvas ให้เป็นภาพขาวดำที่ฟังก์ชันข้างบนใช้ได้ */
export function toGreyImage(rgba: Uint8ClampedArray, width: number, height: number): GreyImage {
  const data = new Uint8ClampedArray(width * height);
  for (let index = 0; index < data.length; index += 1) {
    const offset = index * 4;
    data[index] = (rgba[offset] + rgba[offset + 1] + rgba[offset + 2]) / 3;
  }
  return { data, width, height };
}
