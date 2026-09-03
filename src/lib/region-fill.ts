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
  /**
   * รัศมีของการกลบรอยเว้าและรูที่สัญลักษณ์ในแบบทิ้งไว้ หน่วยเป็นพิกเซลของภาพวิเคราะห์
   *
   * **ทำไมต้องมี** การไล่สีหยุดที่ทุกเส้นที่เขียนในแบบ ซึ่งรวมสิ่งที่ไม่ใช่ผนังด้วย คือ
   * สัญลักษณ์สามเหลี่ยมบอกระดับ ตัวอักษรชื่อห้อง ป้ายชนิดพื้นและฝ้า เส้นบอกระยะ สัญลักษณ์
   * ประตูหน้าต่าง เมื่อของพวกนี้อยู่ชิดผนัง สีลอดเข้าไประหว่างมันกับผนังไม่ได้ ขอบที่ไล่ได้
   * จึงเว้าเข้ามาเป็นรอยหยัก และพื้นที่ที่ได้ขาดไปจากของจริง เจ้าของงานทักเรื่องนี้เมื่อ
   * 2026-09-04 ว่า "ยังเว้นช่องสัญลักษณ์ สามเหลี่ยมอยู่เลย มันต้องไฮไลท์เต็ม"
   *
   * ศูนย์แปลว่าไม่กลบ ซึ่งเป็นค่าตั้งต้นเพื่อให้ฟังก์ชันนี้ยังเป็นการไล่ขอบล้วนเมื่อไม่สั่ง
   * ผู้เรียกเป็นคนคำนวณค่านี้จากสเกลของหน้า เพราะไฟล์นี้ไม่รู้จักเมตร รู้จักแต่พิกเซล
   */
  closeRadiusPixels?: number;
  /**
   * รัศมีของการเชื่อมช่องเปิดบนเส้นในแบบ ก่อนเริ่มไล่สี หน่วยเป็นพิกเซลของภาพวิเคราะห์
   *
   * **ทำไมต้องมี** ผังพื้นเขียนช่องประตูเป็นช่องว่างบนเส้นผนัง ไม่มีเส้นปิดพาด สีจึงลอด
   * ออกไปทั้งชั้นแล้วได้พื้นที่ที่ไม่มีความหมาย เจ้าของงานทักเมื่อ 2026-09-04 ว่า
   * "ห้องที่ไม่มีเส้นกั้นตรงประตูคลิ้กเลือกแล้วไม่เป็นเหมือนภาพตัวอย่าง" · ช่องที่แคบกว่า
   * สองเท่าของรัศมีจะถูกเชื่อมเป็นเส้นตรงพาดที่ผิวผนังพอดี ซึ่งตรงกับที่คนประมาณราคา
   * ลากเองด้วยมือ ส่วนช่องที่กว้างกว่านั้นไม่ถูกเชื่อม เพราะมันคือทางเชื่อมห้องจริง
   *
   * **นี่คือข้อเสนอ ไม่ใช่คำตัดสิน** ตามที่เจ้าของงานเคาะไว้ว่าระบบเสนอเส้นปิด คนกดรับ
   * ด่านจริงยังเป็นคนที่ดูรูปบนแบบก่อนกดยืนยัน การเชื่อมนี้แค่ทำให้สิ่งที่เขาต้องดูมีอยู่จริง
   * แทนที่จะเป็นสีที่ไหลไปทั้งชั้นซึ่งดูแล้วก็ทำอะไรต่อไม่ได้
   */
  bridgeGapPixels?: number;
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

/**
 * ขนาดของสิ่งที่ถือว่าเป็นสัญลักษณ์ ไม่ใช่ผนัง วัดเป็นเมตรบนอาคารจริง
 *
 * ผู้เรียกแปลงค่านี้เป็นพิกเซลของภาพวิเคราะห์แล้วส่งเข้า `closeRadiusPixels` — อยู่ที่นี่
 * เพราะมันเป็นค่าปรับจูนของอัลกอริทึมนี้ ไม่ใช่ของหน้าจอ แต่ตัวฟังก์ชันรู้จักแต่พิกเซล
 *
 * **ที่มาของ 0.40** สัญลักษณ์บอกระดับบนแบบ A3 มาตราส่วน 1:125 สูงราวหกมิลลิเมตรบนกระดาษ
 * ซึ่งเท่ากับ 0.75 เมตรบนอาคารจริง รัศมีนี้กลบรอยเว้าที่กว้างไม่เกินสองเท่าคือ 0.80 เมตร
 * จึงครอบสัญลักษณ์พวกนั้นได้พอดี
 *
 * **สิ่งที่แลกไป** เสาหรือแป้นที่ยื่นเข้ามาในห้องแคบกว่า 0.80 เมตรจะถูกกลบทับไปด้วย
 * ซึ่งรับได้เพราะวิธีประมาณราคาที่เจ้าของงานใช้จริงคือวัดกึ่งกลางเสาถึงกึ่งกลางเสา
 * ซึ่งนับเสาเข้าไปในพื้นที่อยู่แล้ว การกลบนี้จึงเดินไปทางเดียวกับวิธีที่เขาใช้ ไม่ใช่สวนทาง
 */
export const SYMBOL_CLOSE_METRES = 0.4;

/**
 * ช่องเปิดที่แคบกว่าค่านี้ถือว่าเป็นประตู ไม่ใช่ทางเชื่อมห้อง วัดเป็นเมตรบนอาคารจริง
 *
 * ผู้เรียกแปลงครึ่งหนึ่งของค่านี้เป็นพิกเซลแล้วส่งเข้า `bridgeGapPixels` เพราะการเชื่อม
 * ปิดช่องได้กว้างสองเท่าของรัศมี
 *
 * **ที่มาของ 1.00** ประตูภายในอาคารสถาบันของไทยกว้าง 0.80 ถึง 1.00 เมตรเป็นส่วนใหญ่
 * ค่านี้จึงครอบประตูเดี่ยวได้ทั้งหมด ส่วนช่องที่กว้างกว่านี้ เช่น ประตูคู่ ซุ้มโล่ง หรือ
 * ทางเชื่อมโถง ไม่ถูกเชื่อมให้ ซึ่งถูกแล้ว เพราะสองห้องที่เปิดถึงกันกว้างขนาดนั้น
 * คนประมาณราคาก็ต้องตัดสินเองอยู่ดีว่าจะนับเป็นห้องเดียวหรือสองห้อง
 *
 * **สิ่งที่แลกไป** ที่ว่างซึ่งแคบกว่า 1.00 เมตรทั้งช่วง เช่น ช่องท่อหรือตู้ฝัง จะถูกถมเป็นผนัง
 * ไปด้วย ซึ่งรับได้เพราะที่ว่างขนาดนั้นไม่ใช่ห้องที่ใครถอดปริมาณพื้นแยกเป็นรายการ
 */
export const DOOR_BRIDGE_METRES = 1.0;

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

  const drawn = new Uint8Array(image.width * image.height);
  for (let index = 0; index < drawn.length; index += 1) {
    drawn[index] = image.data[index] <= threshold ? 1 : 0;
  }
  const bridgeRadius = Math.floor(options.bridgeGapPixels ?? 0);
  const barrier = bridgeRadius > 0 ? closeMask(drawn, image.width, image.height, bridgeRadius) : drawn;
  const blocked = (x: number, y: number) => barrier[y * image.width + x] === 1;

  if (blocked(sx, sy)) {
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
      if (blocked(nx, ny)) continue;
      filled[nextIndex] = 1;
      stack.push(nextIndex);
    }
  }

  if (touchedBorder) return { ok: false, reason: "leaked", areaPixels };
  if (areaPixels < MIN_AREA_PIXELS) return { ok: false, reason: "too_small", areaPixels };

  const radius = Math.floor(options.closeRadiusPixels ?? 0);
  const shape = radius > 0 ? closeMask(filled, image.width, image.height, radius) : filled;
  let closedArea = areaPixels;
  if (shape !== filled) {
    closedArea = 0;
    for (let index = 0; index < shape.length; index += 1) if (shape[index]) closedArea += 1;
  }

  const outline = traceOutline(shape, image.width, image.height);
  return { ok: true, polygon: simplify(outline, 1.5), areaPixels: closedArea };
}

/**
 * กลบรอยเว้าและรูที่แคบกว่าสองเท่าของรัศมี โดยไม่ขยับขอบที่เป็นเส้นตรง
 *
 * เป็นการปิดทางสัณฐานวิทยา (morphological closing) คือขยายก่อนแล้วหดกลับ ผลของสองขั้นนี้
 * บนขอบตรงคือได้ขอบเดิมเป๊ะ ส่วนบนรอยเว้าแคบคือถูกเติมเต็ม เพราะตอนขยายมันเชื่อมถึงกัน
 * แล้วตอนหดกลับมันไม่ถูกแยกออกอีก
 *
 * **ทำไมมันข้ามผนังไปห้องข้าง ๆ ไม่ได้** ห้องข้าง ๆ เป็นที่ว่างกว้างกว่ารัศมีอยู่แล้ว
 * ตอนหดกลับ พิกเซลทุกตัวที่ยื่นข้ามผนังไปจึงถูกหดทิ้งหมด สิ่งที่เหลืออยู่ได้คือพิกเซลที่
 * "วงกลมรัศมีนี้วางในที่ว่างแล้วเอื้อมไปไม่ถึง" ซึ่งก็คือรอยเว้าแคบกับรูเล็ก ตรงตามที่ต้องการ
 * · การกลบนี้จึงเพิ่มพื้นที่ได้ แต่ทำให้สีรั่วออกนอกห้องไม่ได้ ซึ่งเป็นคนละเรื่องกัน
 */
export function closeMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number
): Uint8Array {
  const grown = distanceToSet(mask, width, height, 1);
  const dilated = new Uint8Array(mask.length);
  for (let index = 0; index < mask.length; index += 1) {
    dilated[index] = grown[index] <= radius ? 1 : 0;
  }
  const gap = distanceToSet(dilated, width, height, 0);
  const closed = new Uint8Array(mask.length);
  for (let index = 0; index < mask.length; index += 1) {
    closed[index] = gap[index] > radius ? 1 : 0;
  }
  return closed;
}

const FAR = 1 << 28;

/**
 * ระยะจากทุกพิกเซลไปยังพิกเซลที่ใกล้ที่สุดซึ่งมีค่าเท่ากับ `target`
 *
 * วัดแบบเชบีเชฟ คือนับก้าวที่ไปได้ทั้งแปดทิศเป็นหนึ่งก้าวเท่ากันหมด ระยะแบบนี้ตรงกับ
 * หน้าต่างสี่เหลี่ยมพอดี การขยายด้วยหน้าต่างสี่เหลี่ยมรัศมี r จึงเท่ากับ "ระยะไม่เกิน r"
 *
 * **ทำไมต้องเป็นวิธีนี้** ของเดิมไล่ดูทีละพิกเซลในหน้าต่าง ซึ่งงานโตตามรัศมี พอเอาไปใช้
 * กับภาพวิเคราะห์จริงของหน้า A3 ที่มีหลายล้านพิกเซล และรัศมีระดับยี่สิบพิกเซล มันกลายเป็น
 * หลายร้อยล้านครั้งต่อการคลิกหนึ่งครั้ง วิธีนี้เดินสองรอบจบ งานจึงไม่ขึ้นกับรัศมีเลย
 *
 * นอกขอบภาพไม่นับเป็นเป้าหมาย รูปทรงที่แตะขอบกระดาษถูกปฏิเสธไปก่อนหน้านี้แล้ว
 */
function distanceToSet(
  mask: Uint8Array,
  width: number,
  height: number,
  target: number
): Int32Array {
  const distance = new Int32Array(mask.length);
  for (let index = 0; index < mask.length; index += 1) {
    distance[index] = mask[index] === target ? 0 : FAR;
  }

  const relax = (index: number, from: number) => {
    const candidate = distance[from] + 1;
    if (candidate < distance[index]) distance[index] = candidate;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (distance[index] === 0) continue;
      if (x > 0) relax(index, index - 1);
      if (y > 0) {
        relax(index, index - width);
        if (x > 0) relax(index, index - width - 1);
        if (x < width - 1) relax(index, index - width + 1);
      }
    }
  }

  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const index = y * width + x;
      if (distance[index] === 0) continue;
      if (x < width - 1) relax(index, index + 1);
      if (y < height - 1) {
        relax(index, index + width);
        if (x < width - 1) relax(index, index + width + 1);
        if (x > 0) relax(index, index + width - 1);
      }
    }
  }

  return distance;
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
