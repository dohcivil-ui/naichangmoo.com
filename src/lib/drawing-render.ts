/**
 * แผนการวาดหน้าแบบลงผืนวาด — ความคมชัดและงบพิกเซล (IP-227)
 *
 * ไฟล์นี้ตอบคำถามเดียวคือ **หน้านี้ควรถูกวาดที่สเกลเท่าไหร่ ครอบบริเวณไหน และผืนวาดกว้างยาวเท่าไหร่**
 * มันไม่วาดเอง ไม่รู้จัก pdf.js ไม่รู้จัก React และไม่แตะ DOM เพื่อให้เทสต์เดินได้โดยไม่ต้องมีจอ
 *
 * **ทำไมต้องมีไฟล์นี้** — วัดเมื่อ 2026-09-02 ว่าโค้ดเดิมวาดหน้าแบบที่ความละเอียดเพียง 0.53 พิกเซล
 * ต่อหนึ่งพิกเซลจริงของจอ เพราะตั้งขนาดผืนวาดเท่าพิกเซล CSS ตรง ๆ ไม่เคยคูณด้วยความหนาแน่นจอ
 * เบราว์เซอร์จึงยืดภาพขึ้นเกือบสองเท่า แบบก่อสร้างที่เส้นบางอยู่แล้วจึงเบลอตอนตั้งสเกลและลากเส้น
 * ซึ่งเป็นสองจังหวะที่ผิดหนึ่งจุดแล้วติดไปกับทุกปริมาณในหน้านั้น
 *
 * **ข้อเท็จจริงที่วัดจริงและเปลี่ยนวิธีคิด** — เวลาวาดของ pdf.js **ไม่ขึ้นกับสเกลเลย** วัดหกหน้า
 * ของแบบ A3 จริงได้ 32 ถึง 75 มิลลิวินาทีเท่ากันหมด ไม่ว่าจะวาดที่ 4 ล้านจุดหรือ 17.4 ล้านจุด
 * เพราะงานหนักอยู่ที่การแปลคำสั่งวาดของหน้านั้น ไม่ใช่การระบายพิกเซล **สเกลจึงแลกด้วยหน่วยความจำ
 * อย่างเดียว ไม่ได้แลกด้วยเวลา** การวาดเฉพาะกรอบที่มองเห็นจึงเป็นทางถอยเมื่อชนงบ ไม่ใช่กลไกหลัก
 *
 * **หน่วยในไฟล์นี้** ทุกพิกัดและทุกขนาดของหน้าเป็น point ของ PDF ซึ่งคงที่ไม่ว่าจะแสดงผลที่ขนาดใด
 * ส่วนขนาดผืนวาดเป็นพิกเซลจริง สองอย่างนี้ต่างกันด้วยสเกล
 */

/** สเกลเป้าหมายของชั้นฐานและชั้นวิเคราะห์ — เท่ากับที่แอปเดิมของเจ้าของงานใช้มาตลอด */
export const BASE_TARGET_SCALE = 2.0;

/** งบพิกเซลของชั้นฐานและชั้นวิเคราะห์ 2^24 จุด ≈ 67 MB */
export const FULL_PAGE_MAX_PIXELS = 16_777_216;

/**
 * งบพิกเซลของชั้นคม 16 ล้านจุด ≈ 64 MB
 *
 * ไม่เลือก 24 ล้านเพราะเมื่อเกินสเกลที่งบนี้รองรับ ทางถอยแบบวาดเฉพาะกรอบให้ความคมเท่ากันเป๊ะ
 * งบที่ใหญ่กว่าจึงซื้อได้แค่ "วาดทั้งหน้าได้ที่ซูมสูงขึ้น" ซึ่งตาแยกไม่ออก แลกกับหน่วยความจำ
 * ที่ค้างอยู่ตลอดเวลาอีก 32 MB
 */
export const SHARP_MAX_PIXELS = 16_000_000;

/** เพดานความยาวด้านของผืนวาดที่เบราว์เซอร์รับได้ */
export const MAX_CANVAS_SIDE = 16_384;

/**
 * เพดานจำนวนพิกเซลต่อผืนวาดของเบราว์เซอร์บนเดสก์ท็อป 2^25 จุด
 *
 * ต่างจาก `FULL_PAGE_MAX_PIXELS` ตรงที่ตัวนั้นเป็น **งบที่เราตั้งเอง** ส่วนตัวนี้เป็น
 * **เพดานที่เบราว์เซอร์บังคับ** ซึ่งเกินแล้วผืนวาดกลายเป็นสีขาวเปล่าโดยไม่มี error
 * การอ่านแบบด้วยเครื่องที่ 300 dpi ต้องการ 17.4 ล้านจุดสำหรับ A3 ทั้งหน้า จึงอยู่ใต้เพดานนี้
 * แต่เกินงบของชั้นฐาน ซึ่งถูกต้องแล้วเพราะเป็นคนละงาน
 */
export const MAX_CANVAS_PIXELS = 33_554_432;

/** รอผู้ใช้หยุดมือกี่มิลลิวินาทีก่อนถ่ายชั้นคมใหม่ */
export const SHARP_SETTLE_MS = 180;

/** ระยะเผื่อรอบกรอบที่มองเห็น หน่วยพิกเซล CSS — กันขอบขาวตอนเลื่อนเล็กน้อยก่อนถ่ายรอบใหม่ */
export const SHARP_PAD_CSS_PX = 64;

/** สี่เหลี่ยมบนหน้ากระดาษ หน่วย point จุดกำเนิดอยู่มุมบนซ้ายของหน้า */
export type PageRect = { x: number; y: number; width: number; height: number };

export type RenderPlan = {
  /** ส่งให้ `page.getViewport({ scale })` */
  scale: number;
  /** ส่งให้ `page.getViewport({ offsetX, offsetY })` — เป็น 0 ทั้งคู่เมื่อวาดทั้งหน้า */
  offsetX: number;
  offsetY: number;
  /** ขนาดผืนวาดที่ต้องตั้ง เป็นจำนวนเต็มอย่างน้อย 1 */
  canvasWidth: number;
  canvasHeight: number;
  /** บริเวณของหน้าที่แผนนี้ครอบ หลังถูกหนีบเข้าขอบหน้าแล้ว */
  crop: PageRect;
};

type PageSize = { width: number; height: number };

const isPositive = (value: number) => Number.isFinite(value) && value > 0;

const hasArea = (size: PageSize) => isPositive(size.width) && isPositive(size.height);

/** ลบศูนย์ติดลบทิ้ง — `-0 * n` ให้ `-0` ซึ่งเท่ากับศูนย์แต่ไม่ผ่านการเทียบแบบเข้ม */
const withoutNegativeZero = (value: number) => (value === 0 ? 0 : value);

/**
 * สเกลสูงสุดที่วาดทั้งหน้าแล้วยังอยู่ในงบพิกเซลและใต้เพดานความยาวด้าน
 *
 * **ห้ามเพิ่มพารามิเตอร์ระดับซูมเข้าฟังก์ชันนี้เด็ดขาด** เพราะชั้นวิเคราะห์เรียกตัวนี้
 * และการดูดจุดกับการไล่พื้นที่ห้องอ่านค่าพิกเซลจากชั้นนั้น ถ้าสเกลขยับตามซูม
 * ไล่พื้นที่ห้องเดียวกันที่ซูมต่างกันจะได้รูปคนละรูป ซึ่งเป็นบั๊กเงียบที่มีอยู่ในโค้ดเดิม
 *
 * @returns 0 เมื่อหน้ายังไม่มีขนาด ผู้เรียกต้องไม่วาด
 */
export function fullPageScaleFor(
  pageSize: PageSize,
  target: number = BASE_TARGET_SCALE,
  maxPixels: number = FULL_PAGE_MAX_PIXELS,
  maxSide: number = MAX_CANVAS_SIDE
): number {
  if (!hasArea(pageSize)) return 0;
  const byPixels = Math.sqrt(maxPixels / (pageSize.width * pageSize.height));
  const bySide = maxSide / Math.max(pageSize.width, pageSize.height);
  return Math.min(target, byPixels, bySide);
}

/** หนีบสี่เหลี่ยมให้อยู่ในขอบหน้า คืน null เมื่อไม่เหลือเนื้อที่ */
function clampToPage(rect: PageRect, pageSize: PageSize): PageRect | null {
  const left = Math.max(0, Math.min(rect.x, pageSize.width));
  const top = Math.max(0, Math.min(rect.y, pageSize.height));
  const right = Math.min(pageSize.width, Math.max(rect.x + rect.width, 0));
  const bottom = Math.min(pageSize.height, Math.max(rect.y + rect.height, 0));
  const width = right - left;
  const height = bottom - top;
  if (!(width > 0) || !(height > 0)) return null;
  return { x: left, y: top, width, height };
}

/**
 * แผนวาดกรอบใด ๆ ที่สเกลใด ๆ
 *
 * เป็นทางเดียวที่ไฟล์นี้สร้าง `RenderPlan` ทุกฟังก์ชันอื่นเรียกผ่านตัวนี้ การอ่านแบบด้วยเครื่อง
 * ที่ 300 dpi ในอนาคตจึงเรียกตัวเดียวกันนี้ด้วยสเกล 4.17 ได้โดยไม่ต้องแก้โครง
 *
 * สเกลที่ขอมาถูกหนีบลงเมื่อผืนวาดจะเกินงบหรือเกินเพดานด้าน และหนีบซ้ำอีกครั้งหลังปัดขึ้นเป็น
 * จำนวนเต็ม เพราะการปัดขึ้นทำให้ผลคูณโตข้ามงบได้แม้สเกลจะพอดี
 *
 * @returns null เมื่อกรอบไม่ทับหน้าเลย หรือสเกลที่ขอไม่เป็นจำนวนบวก
 */
export function planCropRender(
  crop: PageRect,
  scale: number,
  pageSize: PageSize,
  caps?: { maxPixels?: number; maxSide?: number }
): RenderPlan | null {
  if (!hasArea(pageSize) || !isPositive(scale)) return null;
  const clamped = clampToPage(crop, pageSize);
  if (!clamped) return null;

  const maxPixels = caps?.maxPixels ?? MAX_CANVAS_PIXELS;
  const maxSide = caps?.maxSide ?? MAX_CANVAS_SIDE;

  let fitted = Math.min(
    scale,
    Math.sqrt(maxPixels / (clamped.width * clamped.height)),
    maxSide / Math.max(clamped.width, clamped.height)
  );

  // ปัดขึ้นแล้วอาจล้นงบได้อีกไม่กี่พิกเซล ลดสเกลลงตามสัดส่วนที่ล้นจริง วนไม่เกินสามรอบก็ลงตัวเสมอ
  let canvasWidth = Math.max(1, Math.ceil(clamped.width * fitted));
  let canvasHeight = Math.max(1, Math.ceil(clamped.height * fitted));
  for (let attempt = 0; attempt < 3 && canvasWidth * canvasHeight > maxPixels; attempt += 1) {
    fitted *= Math.sqrt(maxPixels / (canvasWidth * canvasHeight));
    canvasWidth = Math.max(1, Math.ceil(clamped.width * fitted));
    canvasHeight = Math.max(1, Math.ceil(clamped.height * fitted));
  }

  return {
    scale: fitted,
    offsetX: withoutNegativeZero(-clamped.x * fitted),
    offsetY: withoutNegativeZero(-clamped.y * fitted),
    canvasWidth,
    canvasHeight,
    crop: clamped
  };
}

/**
 * กรอบของหน้าที่ผู้ใช้มองเห็นอยู่บนจอ แปลงกลับเป็นหน่วย point
 *
 * จุดบนหน้ากระดาษ p ปรากฏบนจอที่ `p × view.scale + view.x` การหากรอบที่มองเห็นจึงเป็น
 * การแก้สมการนั้นย้อนกลับจากขอบจอ แล้วหนีบเข้าขอบหน้า
 *
 * @returns null เมื่อหน้าอยู่นอกจอทั้งหมด หรือค่าที่ให้มาไม่สมเหตุสมผล
 */
export function visiblePageRect(
  view: { scale: number; x: number; y: number },
  stageSize: { width: number; height: number },
  pageSize: PageSize,
  padCss: number = SHARP_PAD_CSS_PX
): PageRect | null {
  if (!hasArea(pageSize) || !hasArea(stageSize) || !isPositive(view.scale)) return null;
  const pad = Math.max(0, padCss);
  const left = (-pad - view.x) / view.scale;
  const top = (-pad - view.y) / view.scale;
  const right = (stageSize.width + pad - view.x) / view.scale;
  const bottom = (stageSize.height + pad - view.y) / view.scale;
  return clampToPage({ x: left, y: top, width: right - left, height: bottom - top }, pageSize);
}

/**
 * แผนถ่ายชั้นคมหนึ่งครั้ง
 *
 * สเกลที่อยากได้คือ `view.scale × devicePixelRatio` ซึ่งทำให้ผืนวาดหนึ่งพิกเซลตรงกับ
 * พิกเซลจริงของจอหนึ่งพิกเซลพอดี ถ้าทั้งหน้าที่สเกลนั้นยังอยู่ในงบก็วาดทั้งหน้า
 * ถ้าเกินงบจึงถอยไปวาดเฉพาะกรอบที่มองเห็นบวกระยะเผื่อ **ที่สเกลเต็มไม่ลด**
 *
 * ทางถอยไม่มีวันชนเพดานด้าน เพราะขนาดกรอบผูกกับขนาดจอ ไม่ได้โตตามระดับซูม
 *
 * @returns null เมื่อยังไม่มีหน้า หรือหน้าอยู่นอกจอทั้งหมด
 */
export function planSharpRender(input: {
  pageSize: PageSize;
  view: { scale: number; x: number; y: number };
  stageSize: { width: number; height: number };
  devicePixelRatio: number;
  maxPixels?: number;
  maxSide?: number;
  padCss?: number;
}): RenderPlan | null {
  const { pageSize, view, stageSize, devicePixelRatio } = input;
  if (!hasArea(pageSize) || !isPositive(view.scale) || !isPositive(devicePixelRatio)) return null;

  const maxPixels = input.maxPixels ?? SHARP_MAX_PIXELS;
  const maxSide = input.maxSide ?? MAX_CANVAS_SIDE;
  const wanted = view.scale * devicePixelRatio;
  const capScale = fullPageScaleFor(pageSize, Number.POSITIVE_INFINITY, maxPixels, maxSide);

  if (wanted <= capScale) {
    const whole = { x: 0, y: 0, width: pageSize.width, height: pageSize.height };
    return planCropRender(whole, wanted, pageSize, { maxPixels, maxSide });
  }

  const visible = visiblePageRect(view, stageSize, pageSize, input.padCss);
  if (!visible) return null;
  return planCropRender(visible, wanted, pageSize, { maxPixels, maxSide });
}
