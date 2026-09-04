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
  /**
   * ความยาวขั้นต่ำของเส้นตรงที่จะนับว่าเป็นสิ่งกั้น หน่วยเป็นพิกเซลของภาพวิเคราะห์
   *
   * ด่านชั้นแรกของการคัดเส้น · วัดเป็นช่วงพิกเซลมืดที่ต่อกันในแนวนอนหรือแนวตั้ง
   * ผิวผนังยาวหลายเมตรจึงผ่าน ส่วนวงโค้งบานสวิงประตู ตัวอักษร สามเหลี่ยมบอกระดับ
   * และเส้นประของแนวเสา ให้ช่วงต่อเนื่องแค่ไม่กี่พิกเซลจึงตกด่านนี้
   */
  minRunPixels?: number;
  /**
   * ขนาดขั้นต่ำของก้อนที่จะนับว่าเป็นโครงสร้าง วัดจากด้านที่ยาวกว่าของกรอบล้อม
   *
   * ด่านชั้นสองของการคัดเส้น · โครงผนังของทั้งอาคารเชื่อมถึงกันเป็นก้อนเดียวยาวหลายสิบเมตร
   * ส่วนกรอบป้ายชนิดพื้นและฝ้าอย่าง `F1+0.60 C1` เป็นก้อนอิสระกว้างราวสองเมตร ตกด่านนี้
   * ทั้งที่ขอบบนขอบล่างของมันเป็นเส้นตรงยาวพอจะผ่านด่านแรก
   */
  minStructurePixels?: number;
  /**
   * กติกาของเสา หน่วยพิกเซลของภาพวิเคราะห์ · ไม่ส่งมาแปลว่าไม่รู้จักเสา
   *
   * เสาเป็นข้อยกเว้นของด่านขนาดก้อน เพราะมันเล็กและเป็นก้อนอิสระที่ไม่ต่อกับผนัง
   * แต่มันคือโครงสร้างที่ต้องกั้น ขอบห้องต้องหักเป็นขั้นอ้อมมัน ไม่ใช่ตัดผ่าน
   */
  column?: ColumnRule;
  /**
   * ขั้นบันไดที่สั้นกว่านี้ถือว่าเป็นความหยาบของภาพ ไม่ใช่รูปทรงของอาคาร หน่วยพิกเซล
   *
   * ขอบที่ไล่มาจากภาพย่อมมีขั้นเล็ก ๆ หนึ่งถึงสองพิกเซลตามความคมของเส้น · ค่านี้ต้องเล็ก
   * กว่าขั้นที่หลบเสาซึ่งกว้างอย่างน้อย 0.20 เมตร มิฉะนั้นมุมเสาที่เป็นของจริงจะถูกยุบไปด้วย
   */
  minStepPixels?: number;
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
 * **เคยมีค่าคงที่ `SYMBOL_CLOSE_METRES = 0.4` ตรงนี้ ถอดออกแล้ว อย่าใส่กลับ**
 *
 * มันเป็นรัศมีที่ส่งเข้า `closeRadiusPixels` เพื่อกลบรอยเว้าที่สัญลักษณ์ทิ้งไว้ ซึ่งกลบ
 * สามเหลี่ยมบอกระดับได้จริง แต่เจ้าของงานดูรูปแล้วจับได้ทันทีเมื่อ 2026-09-04 ว่าขอบห้อง
 * ลอยห่างผนังและมุมมน เพราะการกลบทำงานกับ**ก้อนพื้นที่** มันจึงมนมุมจริงของห้องไปด้วย
 * และยังเอากรอบป้ายที่กว้างสองเมตรกับวงสวิงประตูไม่อยู่อยู่ดี
 *
 * ตอนนี้สัญลักษณ์ถูกคัดออกตั้งแต่ชั้นเส้นด้วย `structuralMask` จึงไม่มีรอยเว้าให้กลบ
 * ถ้าวันหน้าเจอรอยเว้าที่คัดไม่ออก ให้ไปแก้เกณฑ์การคัดเส้น ไม่ใช่กลับมาเปิดการกลบ
 */

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

/**
 * เส้นที่สั้นกว่านี้ไม่ใช่ผนัง วัดเป็นเมตรบนอาคารจริง
 *
 * **ที่มาของ 1.00** บานประตูภายในยาว 0.80 ถึง 0.90 เมตร วงโค้งบานสวิงให้ช่วงต่อเนื่อง
 * แค่ไม่กี่พิกเซลต่อแถวอยู่แล้ว ค่านี้จึงคัดทั้งบานและวงออกได้ ส่วนผิวผนังของห้องที่เล็กที่สุด
 * ในแบบทดสอบยังยาวเกินหนึ่งเมตร · ผนังท่อนที่สั้นกว่านี้จะหลุดออกไปด้วย แต่ช่องที่มันทิ้งไว้
 * แคบกว่า `DOOR_BRIDGE_METRES` จึงถูกเชื่อมกลับในขั้นถัดไป
 */
export const MIN_WALL_RUN_METRES = 1.0;

/**
 * ก้อนที่เล็กกว่านี้ไม่ใช่โครงสร้าง วัดจากด้านที่ยาวกว่าของกรอบล้อม เป็นเมตรบนอาคารจริง
 *
 * **ที่มาของ 4.00** กรอบป้ายชนิดพื้นและฝ้าอย่าง `F1+0.60 C1` กว้างราวสองเมตร และรูป
 * สุขภัณฑ์กว้างไม่ถึงหนึ่งเมตร ทั้งคู่จึงตกด่านนี้ ส่วนโครงผนังของอาคารทั้งหลังเชื่อมถึงกัน
 * เป็นก้อนเดียวกว้าง 28 เมตรในแบบทดสอบ · เสาลอยที่ไม่ติดผนังจะตกด่านนี้ด้วย
 * ซึ่งยังไม่เจอในแบบที่ทดสอบ ถ้าเจอเมื่อไหร่ต้องเพิ่มด่านที่รู้จักเสาโดยเฉพาะ ไม่ใช่ลดค่านี้
 */
export const MIN_STRUCTURE_METRES = 4.0;

/**
 * ช่วงขนาดของสิ่งที่ถือว่าเป็นเสา วัดเป็นเมตรบนอาคารจริง
 *
 * **ทำไมเสาต้องมีกติกาของตัวเอง** เสาถูกวาดเป็นสี่เหลี่ยมเล็ก ๆ กว้างราว 0.33 เมตร
 * และเป็นก้อนอิสระที่ไม่ต่อกับผนัง มันจึงตกด่าน `MIN_STRUCTURE_METRES` ไปพร้อมกับป้าย
 * และสัญลักษณ์ · เจ้าของงานทักเมื่อ 2026-09-04 ว่า "คุณไฮไลท์กินพื้นที่เสา ด้านล่าง
 * และไม่หักตรงมุมเสา" ซึ่งตรงกับภาพหน้ากากที่เรนเดอร์ออกมาดู เสาเป็นรูโหว่ในสิ่งกั้นจริง
 *
 * 0.15 กันธรณีประตูกับจุดเล็ก ๆ ที่ไม่ใช่เสา · 0.80 กันกรอบป้ายชนิดพื้นซึ่งกว้างราวสองเมตร
 */
export const COLUMN_MIN_METRES = 0.15;
export const COLUMN_MAX_METRES = 0.8;

/** เสาต้องอยู่ห่างจากโครงผนังไม่เกินนี้ กันสี่เหลี่ยมเล็กกลางห้องอย่างป้ายเตียงไม่ให้กลายเป็นเสา */
export const COLUMN_TOUCH_METRES = 0.1;

/**
 * ขั้นบันไดบนขอบที่สั้นกว่านี้ถือว่าเป็นความหยาบของภาพ ไม่ใช่รูปทรงของอาคาร วัดเป็นเมตรจริง
 *
 * **ที่มาของ 0.05** ขอบที่ไล่จากภาพมีขั้นหนึ่งถึงสองพิกเซลตามความคมของเส้น ซึ่งเท่ากับ
 * 0.02 ถึง 0.04 เมตรที่ความละเอียดปัจจุบัน · ค่านี้จึงกวาดความหยาบทิ้งได้หมด
 * และยังเล็กกว่าขั้นที่หลบเสาซึ่งแคบที่สุดราว 0.20 เมตรอยู่สี่เท่า มุมเสาจึงไม่ถูกยุบไปด้วย
 */
export const OUTLINE_MIN_STEP_METRES = 0.05;

/**
 * คัดเฉพาะเส้นที่เป็นผนังหรือโครงสร้างออกมาจากทุกสิ่งที่ดำในแบบ
 *
 * **ทำไมต้องคัดก่อน ไม่ใช่ไล่สีแล้วค่อยแก้ทีหลัง** เจ้าของงานชี้เมื่อ 2026-09-04 ว่า
 * "ปัญหาหลักของคุณคือ ตีโจทย์ยังไม่แยก แยกเส้นขอบผนัง เส้นขอบเสาไม่ขาด และเส้นบอก
 * สัญลักษณ์คุณก็แยกไม่ออก เลยไม่ได้พื้นที่จริง" · ก่อนหน้านั้นเราลองแก้ด้วยการขยาย-หด
 * ก้อนพื้นที่ที่ไล่ได้ ซึ่งกลบสามเหลี่ยมเล็ก ๆ ได้ แต่เอากรอบป้ายที่กว้างสองเมตรกับวงสวิง
 * ประตูไม่อยู่ และยังมนมุมจริงของห้องจนขอบลอยห่างผนัง — ปัญหาของเส้นต้องแก้ที่เส้น
 *
 * **สองด่านต้องผ่านทั้งคู่** ยาวพอ และอยู่ในก้อนที่ใหญ่พอ · ด่านเดียวไม่พอเพราะขอบบน
 * ขอบล่างของกรอบป้ายเป็นเส้นตรงยาวพอจะผ่านด่านแรกได้ ส่วนวงสวิงประตูต่อกับผนังจึงอยู่
 * ในก้อนใหญ่และผ่านด่านที่สองได้ ต้องใช้คู่กันถึงจะคัดออกได้ทั้งสองอย่าง
 */
export type ColumnRule = {
  /** ด้านของกรอบล้อมต้องอยู่ระหว่างสองค่านี้ หน่วยพิกเซล */
  min: number;
  max: number;
  /** ต้องมีสิ่งกั้นอยู่ห่างจากกรอบไม่เกินนี้ หน่วยพิกเซล */
  touch: number;
};

export function structuralMask(
  image: GreyImage,
  threshold: number,
  minRun: number,
  minStructure: number,
  column?: ColumnRule
): Uint8Array {
  const { width, height } = image;
  const dark = new Uint8Array(width * height);
  for (let index = 0; index < dark.length; index += 1) {
    dark[index] = image.data[index] <= threshold ? 1 : 0;
  }
  if (minRun <= 1 && minStructure <= 1) return dark;

  const longEnough = new Uint8Array(dark.length);
  const markRuns = (outer: number, inner: number, at: (o: number, i: number) => number) => {
    for (let o = 0; o < outer; o += 1) {
      let start = -1;
      for (let i = 0; i <= inner; i += 1) {
        const on = i < inner && dark[at(o, i)] === 1;
        if (on && start < 0) start = i;
        if (!on && start >= 0) {
          if (i - start >= minRun) {
            for (let k = start; k < i; k += 1) longEnough[at(o, k)] = 1;
          }
          start = -1;
        }
      }
    }
  };
  markRuns(height, width, (y, x) => y * width + x);
  markRuns(width, height, (x, y) => y * width + x);

  if (minStructure <= 1) return longEnough;

  /**
   * ก้อนคำนวณจากพิกเซลดำทั้งหมด ไม่ใช่จากเส้นที่ผ่านด่านแรก เพราะลายขีดในเนื้อผนัง
   * กับเส้นสั้น ๆ คือสิ่งที่เชื่อมผนังคนละท่อนให้เป็นโครงเดียวกัน ถ้าตัดทิ้งไปก่อนนับก้อน
   * ผนังจะแตกเป็นชิ้นเล็กชิ้นน้อยแล้วตกด่านที่สองทั้งหมด
   */
  const component = new Int32Array(dark.length).fill(-1);
  const keep = new Uint8Array(dark.length);
  const stack: number[] = [];
  /** ก้อนเล็กที่รูปร่างเข้าข่ายเสา เก็บไว้ตัดสินทีหลัง เพราะต้องรู้ก่อนว่าโครงผนังอยู่ตรงไหน */
  const columnBoxes: { minX: number; minY: number; maxX: number; maxY: number }[] = [];
  let label = 0;
  for (let seed = 0; seed < dark.length; seed += 1) {
    if (dark[seed] === 0 || component[seed] >= 0) continue;
    stack.length = 0;
    stack.push(seed);
    component[seed] = label;
    const members: number[] = [];
    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;
    while (stack.length > 0) {
      const index = stack.pop() as number;
      members.push(index);
      const x = index % width;
      const y = (index - x) / width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          if (dark[next] === 0 || component[next] >= 0) continue;
          component[next] = label;
          stack.push(next);
        }
      }
    }
    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    if (Math.max(boxWidth, boxHeight) >= minStructure) {
      for (const index of members) keep[index] = 1;
    } else if (column && looksLikeColumn(members, minX, minY, boxWidth, boxHeight, width, column)) {
      columnBoxes.push({ minX, minY, maxX, maxY });
    }
    label += 1;
  }

  const structural = new Uint8Array(dark.length);
  for (let index = 0; index < dark.length; index += 1) {
    structural[index] = longEnough[index] === 1 && keep[index] === 1 ? 1 : 0;
  }

  /**
   * เสาถูกถมทั้งกรอบ ไม่ใช่เก็บแค่เส้นขอบ เพราะเนื้อในเสาไม่ใช่พื้นที่ห้อง
   * ถ้าเก็บแค่ขอบ สีจะไหลเข้าไปข้างในแล้วขอบห้องจะมีรูตรงกลางเสา
   */
  if (column) {
    for (const box of columnBoxes) {
      if (!touchesStructure(structural, width, height, box, column.touch)) continue;
      fillBox(structural, width, height, box, 0);
    }
    /**
     * **เนื้อในเสาเล็กกว่าตัวเสาเสมอ เท่าความหนาเส้นกรอบสองข้าง**
     *
     * เกณฑ์ `COLUMN_MIN_METRES` วัดขนาดนอกของเสา ถ้าเอาไปใช้กับเนื้อในตรง ๆ เสาต้นเล็ก
     * จะตกเกณฑ์ทั้งที่ตัวมันผ่าน · 2026-09-04 เจ้าของงานทักว่าเสาขวาล่างยังถูกกิน
     * วัดแล้วพบว่ากรอบนอกกว้าง 8 พิกเซลซึ่งผ่านเกณฑ์ 7 แต่เนื้อในเหลือ 6 จึงตกไป
     */
    const gapRule = { ...column, min: Math.max(3, column.min - 4) };
    for (const box of enclosedGaps(dark, width, height, gapRule)) {
      if (!touchesStructure(structural, width, height, box, column.touch)) continue;
      fillBox(structural, width, height, box, 0);
      /**
       * ขยายออกไปเก็บเส้นกรอบของเสาด้วย แต่**เฉพาะพิกเซลที่เป็นเส้นจริง**
       * ถ้าถมทั้งวงแหวนรอบนอก สิ่งกั้นจะกินเนื้อห้องออกไปอีกด้านละสามพิกเซล
       */
      const left = Math.max(0, box.minX - 3);
      const right = Math.min(width - 1, box.maxX + 3);
      const top = Math.max(0, box.minY - 3);
      const bottom = Math.min(height - 1, box.maxY + 3);
      for (let y = top; y <= bottom; y += 1) {
        for (let x = left; x <= right; x += 1) {
          const index = y * width + x;
          if (dark[index] === 1) structural[index] = 1;
        }
      }
    }
  }
  return structural;
}

function fillBox(
  mask: Uint8Array,
  width: number,
  height: number,
  box: { minX: number; minY: number; maxX: number; maxY: number },
  grow: number
): void {
  const left = Math.max(0, box.minX - grow);
  const right = Math.min(width - 1, box.maxX + grow);
  const top = Math.max(0, box.minY - grow);
  const bottom = Math.min(height - 1, box.maxY + grow);
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) mask[y * width + x] = 1;
  }
}

/**
 * ช่องว่างเล็ก ๆ ที่ถูกเส้นล้อมปิดสนิท ซึ่งคือเนื้อในของเสาที่วาดเป็นกรอบ
 *
 * **ทำไมต้องมีทางนี้เพิ่ม** เสาส่วนใหญ่ถูกเขียนให้ขอบชนกับเส้นผนัง มันจึงกลายเป็นส่วนหนึ่ง
 * ของก้อนผนังยักษ์ กติกา "ก้อนเล็กที่รูปร่างเหมือนเสา" จึงมองไม่เห็นมันเลย เรนเดอร์หน้ากาก
 * ออกมาดูที่กำลังขยายหกเท่าเมื่อ 2026-09-04 จึงเห็นว่าเสายังเป็นรูโหว่อยู่ทั้งที่ใส่กติกาไปแล้ว
 *
 * ที่ว่างปิดสนิทขนาดเท่าเสาคือลายเซ็นที่เชื่อถือได้ เพราะห้องจริงเปิดออกสู่ขอบกระดาษเสมอ
 * ส่วนช่องในกรอบป้ายชนิดพื้นก็ปิดสนิทเหมือนกัน แต่มันลอยอยู่กลางห้องไม่ติดโครงผนัง
 * จึงถูกด่านระยะชิดคัดออก
 */
function enclosedGaps(
  dark: Uint8Array,
  width: number,
  height: number,
  rule: ColumnRule
): { minX: number; minY: number; maxX: number; maxY: number }[] {
  const reached = new Uint8Array(dark.length);
  const queue: number[] = [];
  const push = (x: number, y: number) => {
    const index = y * width + x;
    if (dark[index] === 1 || reached[index] === 1) return;
    reached[index] = 1;
    queue.push(index);
  };
  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }
  while (queue.length > 0) {
    const index = queue.pop() as number;
    const x = index % width;
    const y = (index - x) / width;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }

  const seen = new Uint8Array(dark.length);
  const found: { minX: number; minY: number; maxX: number; maxY: number }[] = [];
  const stack: number[] = [];
  for (let seed = 0; seed < dark.length; seed += 1) {
    if (dark[seed] === 1 || reached[seed] === 1 || seen[seed] === 1) continue;
    stack.length = 0;
    stack.push(seed);
    seen[seed] = 1;
    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;
    let filled = 0;
    while (stack.length > 0) {
      const index = stack.pop() as number;
      filled += 1;
      const x = index % width;
      const y = (index - x) / width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const step = (nx: number, ny: number) => {
        const next = ny * width + nx;
        if (dark[next] === 1 || seen[next] === 1) return;
        seen[next] = 1;
        stack.push(next);
      };
      if (x > 0) step(x - 1, y);
      if (x < width - 1) step(x + 1, y);
      if (y > 0) step(x, y - 1);
      if (y < height - 1) step(x, y + 1);
    }
    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    if (boxWidth < rule.min || boxHeight < rule.min) continue;
    if (boxWidth > rule.max || boxHeight > rule.max) continue;
    /**
     * **ช่องต้องเต็มกรอบเกือบทั้งหมด ไม่งั้นมันไม่ใช่เสา**
     *
     * เนื้อในเสาเป็นสี่เหลี่ยม จึงเต็มกรอบล้อมของมันเกือบร้อยเปอร์เซ็นต์ ส่วนเนื้อใน
     * สามเหลี่ยมสัญลักษณ์ประตูเต็มแค่ราวครึ่งเดียว และเนื้อในวงกลมเลขแนวเสาเต็มราว
     * เจ็ดสิบแปดเปอร์เซ็นต์ ทั้งสองอย่างจึงตกด่านนี้
     *
     * ข้อนี้มีเพราะเมื่อ 2026-09-04 ผมลืมตรวจรูปร่างในทางนี้ ทั้งที่ตรวจในอีกทางแล้ว
     * ผลคือสามเหลี่ยมสัญลักษณ์ที่คร่อมผนังทุกบานกลายเป็นเสาปลอม ขอบห้องจึงโป่งเข้าไป
     * ในเนื้อผนังทุกจุดที่มีประตูหรือหน้าต่าง เจ้าของงานจับได้จากรูปทันที
     */
    if (filled / (boxWidth * boxHeight) < 0.85) continue;
    found.push({ minX, minY, maxX, maxY });
  }
  return found;
}

/**
 * ก้อนนี้หน้าตาเป็นเสาหรือไม่ — ดูจากขนาดและรูปร่าง ยังไม่ดูตำแหน่ง
 *
 * รับสองแบบที่ช่างเขียนแบบใช้จริง คือวาดเป็น**กรอบสี่เหลี่ยม**ซึ่งพิกเซลเกือบทั้งหมด
 * อยู่บนขอบกรอบ กับวาดเป็น**สี่เหลี่ยมทึบ**ซึ่งพิกเซลเต็มกรอบ · วงกลมเลขแนวเสาถูกคัดออก
 * เพราะเส้นรอบวงพาดกลางกรอบ ส่วนสามเหลี่ยมบอกระดับถูกคัดเพราะด้านเอียงสองด้านก็พาดกลางกรอบ
 */
function looksLikeColumn(
  members: readonly number[],
  minX: number,
  minY: number,
  boxWidth: number,
  boxHeight: number,
  width: number,
  rule: ColumnRule
): boolean {
  if (boxWidth < rule.min || boxHeight < rule.min) return false;
  if (boxWidth > rule.max || boxHeight > rule.max) return false;
  const edge = Math.max(2, Math.round(rule.min / 3));
  let onBorder = 0;
  for (const index of members) {
    const x = index % width;
    const y = (index - x) / width;
    const fromLeft = x - minX;
    const fromTop = y - minY;
    const fromRight = boxWidth - 1 - fromLeft;
    const fromBottom = boxHeight - 1 - fromTop;
    if (Math.min(fromLeft, fromRight, fromTop, fromBottom) < edge) onBorder += 1;
  }
  const area = boxWidth * boxHeight;
  return onBorder / members.length >= 0.9 || members.length / area >= 0.7;
}

/** มีสิ่งกั้นอยู่ในระยะรอบกรอบนี้หรือไม่ — เสาจริงต้องเกาะโครงผนัง ไม่ใช่ลอยกลางห้อง */
function touchesStructure(
  structural: Uint8Array,
  width: number,
  height: number,
  box: { minX: number; minY: number; maxX: number; maxY: number },
  reach: number
): boolean {
  const left = Math.max(0, box.minX - reach);
  const right = Math.min(width - 1, box.maxX + reach);
  const top = Math.max(0, box.minY - reach);
  const bottom = Math.min(height - 1, box.maxY + reach);
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (structural[y * width + x] === 1) return true;
    }
  }
  return false;
}

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

  const drawn = structuralMask(
    image,
    threshold,
    Math.floor(options.minRunPixels ?? 0),
    Math.floor(options.minStructurePixels ?? 0),
    options.column
  );
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

  const outline = traceRectilinearOutline(shape, image.width, image.height);
  const step = Math.max(1, Math.round(options.minStepPixels ?? 0));
  return { ok: true, polygon: removeJogs(outline, step), areaPixels: closedArea };
}

/**
 * ขอบของบริเวณที่เติม เดินตามรอยต่อระหว่างพิกเซล จึงเป็นแนวนอนกับแนวตั้งล้วน
 *
 * **ทำไมต้องเปลี่ยนจากของเดิม** ของเดิมเดินตามใจกลางพิกเซลทั้งแปดทิศ แล้วลดจุดด้วย
 * Douglas–Peucker ซึ่งยอมแทนบันไดพิกเซลด้วยเส้นเฉียงได้ถ้าคลาดไม่เกินค่าที่ตั้งไว้
 * ผลคือมุมเสาถูกตัดเฉียงเป็นสามเหลี่ยม เจ้าของงานทักเมื่อ 2026-09-04 ว่า
 * "ลักษณะของเส้นที่วิ่งตามขอบมักจะไม่มีโค้ง เพราะองค์อาคารส่วนใหญ่เป็นแบบเหลี่ยม"
 *
 * วิธีนี้เก็บ**ด้านของพิกเซล**ที่ติดกับบริเวณนอก แล้วร้อยให้เป็นวง ทุกด้านยาวหนึ่งพิกเซล
 * และตั้งฉากกันเสมอ เส้นเฉียงจึงเกิดขึ้นไม่ได้เลยโดยโครงสร้าง ไม่ใช่โดยการตั้งค่า
 *
 * พิกัดที่คืนเป็นมุมของพิกเซล ไม่ใช่ใจกลางพิกเซล ขอบจึงอยู่บนรอยต่อจริงระหว่าง
 * พื้นที่ห้องกับเส้นผนัง ไม่เหลื่อมเข้าไปครึ่งพิกเซลอย่างวิธีเดิม
 */
export function traceRectilinearOutline(
  filled: Uint8Array,
  width: number,
  height: number
): Pixel[] {
  const on = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && filled[y * width + x] === 1;

  /** ด้านของพิกเซลที่ติดกับข้างนอก เรียงทิศให้บริเวณอยู่ทางขวามือของทิศเดินเสมอ */
  const next = new Map<string, Pixel>();
  const key = (p: Pixel) => `${p.x},${p.y}`;
  const add = (from: Pixel, to: Pixel) => next.set(key(from), to);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!on(x, y)) continue;
      if (!on(x, y - 1)) add({ x, y }, { x: x + 1, y });
      if (!on(x + 1, y)) add({ x: x + 1, y }, { x: x + 1, y: y + 1 });
      if (!on(x, y + 1)) add({ x: x + 1, y: y + 1 }, { x, y: y + 1 });
      if (!on(x - 1, y)) add({ x, y: y + 1 }, { x, y });
    }
  }
  if (next.size === 0) return [];

  let start: Pixel | null = null;
  for (let y = 0; y < height && !start; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (on(x, y)) {
        start = { x, y };
        break;
      }
    }
  }
  if (!start) return [];

  const loop: Pixel[] = [];
  let at: Pixel = start;
  for (let guard = 0; guard <= next.size; guard += 1) {
    loop.push(at);
    const step = next.get(key(at));
    if (!step) break;
    at = step;
    if (at.x === start.x && at.y === start.y) break;
  }
  return mergeStraightRuns(loop);
}

/** ยุบจุดที่อยู่กลางเส้นตรงเดียวกันทิ้ง เหลือเฉพาะมุมจริง */
function mergeStraightRuns(points: readonly Pixel[]): Pixel[] {
  if (points.length < 3) return [...points];
  const kept: Pixel[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const before = points[(index - 1 + points.length) % points.length];
    const here = points[index];
    const after = points[(index + 1) % points.length];
    const straight =
      (before.x === here.x && here.x === after.x) ||
      (before.y === here.y && here.y === after.y);
    if (!straight) kept.push(here);
  }
  return kept.length >= 3 ? kept : [...points];
}

/**
 * ยุบขั้นบันไดที่สั้นกว่าค่าที่กำหนด ให้เหลือแต่มุมที่เป็นของจริง
 *
 * ขอบของภาพที่มาจากการแปลงเป็นจุดภาพย่อมมีขั้นเล็ก ๆ ขนาดหนึ่งถึงสองพิกเซลตามความเอียง
 * ของเส้นและความคมของภาพ ขั้นพวกนั้นไม่ใช่รูปทรงของอาคาร · **แต่ห้ามยุบแรงเกินไป**
 * เพราะขั้นที่หลบเสากว้างเพียง 0.20 เมตรก็เป็นของจริงที่ต้องเห็น ค่าที่ใช้จึงต้องเล็กกว่านั้นมาก
 *
 * ยุบโดยเลื่อนขั้นสั้นไปชนแนวของด้านที่ยาวกว่า รูปจึงยังเป็นแนวนอนกับแนวตั้งล้วนหลังยุบ
 */
export function removeJogs(points: readonly Pixel[], minStep: number): Pixel[] {
  let shape = points.map((point) => ({ ...point }));
  if (minStep <= 1) return shape;

  for (let pass = 0; pass < 40 && shape.length >= 6; pass += 1) {
    const count = shape.length;
    let target = -1;
    let shortest = minStep;
    for (let index = 0; index < count; index += 1) {
      const b = shape[index];
      const c = shape[(index + 1) % count];
      const jog = Math.abs(b.x - c.x) + Math.abs(b.y - c.y);
      if (jog === 0 || jog >= shortest) continue;
      const a = shape[(index - 1 + count) % count];
      const d = shape[(index + 2) % count];
      // ยุบได้ต่อเมื่อด้านสองข้างยาวกว่าขั้นเอง ไม่งั้นจะไปกินมุมจริงที่อยู่ติดกัน
      if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= jog) continue;
      if (Math.abs(c.x - d.x) + Math.abs(c.y - d.y) <= jog) continue;
      shortest = jog;
      target = index;
    }
    if (target < 0) return shape;

    const b = shape[target];
    const c = shape[(target + 1) % count];
    const a = shape[(target - 1 + count) % count];
    const d = shape[(target + 2) % count];
    const horizontal = b.y === c.y;
    const keepBefore =
      Math.abs(a.x - b.x) + Math.abs(a.y - b.y) >= Math.abs(c.x - d.x) + Math.abs(c.y - d.y);
    const line = horizontal ? (keepBefore ? b.x : c.x) : keepBefore ? b.y : c.y;
    if (horizontal) {
      a.x = line;
      d.x = line;
    } else {
      a.y = line;
      d.y = line;
    }
    shape = shape.filter((_, at) => at !== target && at !== (target + 1) % count);
    shape = mergeStraightRuns(shape);
  }
  return shape;
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
