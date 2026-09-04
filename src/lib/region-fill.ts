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
  /**
   * ระยะที่ยอมให้เอื้อมออกไปหาผิวในของเส้นผนัง หน่วยพิกเซล · ศูนย์แปลว่าไม่เอื้อม
   *
   * ขอบไปชิดผิวในของหมึกเสมอ ไม่เข้าไปในเนื้อผนังไม่ว่าผนังจะหนาแค่ไหน ค่านี้จึงคุม
   * แค่ว่าจะยอมเอื้อมไกลแค่ไหนเมื่อการไล่สีหยุดก่อนถึงผนัง แคบพอจะไม่ไปเกาะเส้นอื่น
   */
  snapToLinePixels?: number;
  /**
   * ระยะห่างสูงสุดระหว่างเส้นผิวสองข้างของผนัง หน่วยพิกเซล · เส้นตรงยาวจะนับเป็นผนัง
   * ต่อเมื่อมีเส้นตรงยาวอีกเส้นขนานอยู่ภายในระยะนี้ (ดู `structuralMask`)
   *
   * ต้องกว้างพอสำหรับผนังหนาสุดในแบบ แต่แคบกว่าระยะระหว่างเส้นกระเบื้อง ไม่งั้นเส้นกระเบื้อง
   * จับคู่กันเองแล้วกลายเป็นผนัง · ไม่ส่งมาใช้ค่าตั้งต้นสิบเอ็ดพิกเซล
   */
  wallThicknessPixels?: number;
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
 * ระยะที่ยอมให้เอื้อมออกไปหาผิวในของเส้นผนัง วัดเป็นเมตรบนอาคารจริง
 *
 * **ขอบไปหยุดที่ผิวในของหมึก ไม่เข้าไปในเนื้อผนัง** เจ้าของงานเคาะเมื่อ 2026-09-04 ว่า
 * "เส้นผนังเอาตามที่ผมลากเลย หนาหรือบางก็เอาชิดด้านในห้อง" · ค่านี้จึงไม่ใช่ระยะที่ดัน
 * เข้าไปในผนัง แต่เป็นระยะที่ยอมเอื้อมออกไป**หา**ผนัง เมื่อการไล่สีหยุดก่อนถึงมัน
 *
 * **ที่มาของ 0.07** การไล่สีหยุดทีละพิกเซลตามรอยหยักของภาพ จึงคลาดจากผิวจริงได้
 * หนึ่งถึงสามพิกเซล ซึ่งเท่ากับ 0.02 ถึง 0.07 เมตรที่ความละเอียดปัจจุบัน · กว้างกว่านี้
 * จะเริ่มเอื้อมข้ามที่ว่างไปเกาะเส้นอื่นที่ไม่ใช่ผนังของห้องนี้
 */
export const WALL_SNAP_METRES = 0.07;

/**
 * ระยะห่างสูงสุดระหว่างเส้นผิวสองข้างของผนัง วัดเป็นเมตรบนอาคารจริง
 *
 * **ที่มาของ 0.25** ผนังในแบบทดสอบหนา 0.10 ถึง 0.20 เมตร ส่วนเส้นตารางกระเบื้องห่างกัน
 * 0.28 ถึง 0.30 เมตร ค่านี้จึงครอบผนังทุกแบบที่เจอ และยังต่ำกว่าระยะกระเบื้องอยู่
 * · ถ้าวันหน้าเจอกระเบื้อง 0.20 เมตร เส้นกระเบื้องจะจับคู่กันเองได้ ต้องแยกด้วยลายในช่อง
 * (ช่องระหว่างเส้นกระเบื้องมีเส้นกระเบื้องตัดผ่าน ไม่สะอาดและไม่ใช่ลายผนัง) ซึ่งทำอยู่แล้ว
 */
export const WALL_THICKNESS_METRES = 0.25;

/**
 * กติกาของเสา หน่วยพิกเซล · เสาเป็นของเล็กที่ต้องกั้น ขอบห้องต้องหักเป็นขั้นอ้อมมัน
 * (ดูวิธีรู้จักเสาที่ `structuralMask`)
 */
export type ColumnRule = {
  /** ด้านของกรอบล้อมต้องอยู่ระหว่างสองค่านี้ หน่วยพิกเซล */
  min: number;
  max: number;
  /** ต้องมีสิ่งกั้นอยู่ห่างจากกรอบไม่เกินนี้ หน่วยพิกเซล */
  touch: number;
};

/**
 * พิกเซลที่จางกว่าเส้นผนังแต่ยังเห็นเป็นเส้น ใช้เฉพาะตอนมองหาสัญลักษณ์เสา
 *
 * เสาที่มุมล่างขวาของห้องพักพยาบาลหน้า 7 ถูกเขียนด้วยปากกาจางเป็นสี่เหลี่ยมมีกากบาท
 * ค่าความมืดราว 160 ซึ่งหลุดเกณฑ์ 140 ของเส้นผนัง แต่เจ้าของงานลากเส้นน้ำเงินอ้อมมัน
 * เพราะเขาเห็นว่าเป็นเสา · เกณฑ์นี้จึงหลวมกว่า แล้วไปเข้มที่รูปทรงแทน
 */
export const COLUMN_SYMBOL_THRESHOLD = 200;

/** ระยะห่างสูงสุดระหว่างเส้นผิวสองข้างของผนัง เมื่อผู้เรียกไม่ได้บอกเป็นพิกเซล */
const DEFAULT_WALL_THICKNESS_PIXELS = 11;

/**
 * คัดเฉพาะผนังกับเสาออกมาจากทุกสิ่งที่ดำในแบบ ที่เหลือมองข้ามหมด
 *
 * **กติกามาจากเจ้าของงานโดยตรง** 2026-09-04 เขาสั่งเรื่องห้องน้ำที่พื้นเต็มไปด้วยเส้นตาราง
 * กระเบื้องกับสุขภัณฑ์ว่า "ให้คิดว่ามันคือพื้นที่หนึ่ง ไม่ต้องสนใจลายเส้นต่าง ๆ ให้ยึดเสา
 * กับเส้นผนัง แนวประตู เหมือนห้องปกติ มันก็แค่กว้างคูณยาว" · ของเดิมทำกลับด้าน คือถือว่า
 * ทุกเส้นกั้นแล้วค่อยหาทางคัดสัญลักษณ์ออกทีละชนิด ซึ่งไม่มีวันครบ ตารางกระเบื้องผ่านด่าน
 * ความยาวเพราะยาวเป็นเมตร และช่องกระเบื้องแต่ละช่องยังขนาดพอดีกับเกณฑ์เสาจนพื้นทั้งห้อง
 * ถูกถมเป็นสีดำ · ของใหม่ถามว่า **อะไรคือผนัง** แล้วยอมรับเฉพาะสิ่งที่พิสูจน์ได้ว่าใช่
 *
 * **ผนัง** คือหนึ่งในสองอย่างนี้
 * - เส้นตรงยาวที่มีเส้นตรงยาวอีกเส้นขนานอยู่ในระยะความหนาผนัง และช่องระหว่างคู่นั้น
 *   เป็นลายผนัง (ลายอิฐ หรือทึบ) หรือไม่ก็สะอาดสนิท · เส้นกระเบื้องมีเส้นกระเบื้องตัดผ่าน
 *   ช่องระหว่างมันเสมอ จึงไม่เข้าข่ายทั้งสองแบบ · เส้นตัดหน้าตัดกลางห้องน้ำมีเพื่อนบ้าน
 *   เป็นเส้นประซึ่งไม่ยาวพอ · ขอบสุขภัณฑ์ที่ต่อจากปลายผนังหลุดออกเพราะจับคู่ไม่ได้
 *   จึงถูกตัดทิ้งที่ปลาย
 * - แถบทึบหนาตั้งแต่สามพิกเซลที่ยาวพอในตัวเอง เช่น ผนังที่วาดทึบ หรือแถบหน้าต่าง
 *   ความยาววัดในแถบเท่านั้น ขอบสุขภัณฑ์หนา ๆ จึงยืมความยาวจากผนังที่มันชนไม่ได้
 *
 * เส้นที่ผ่านต้องหนาจริง (มัธยฐานความหนาอย่างน้อยสองพิกเซล) และอยู่ในก้อนหมึกใหญ่ของ
 * อาคาร · ก้อนวัดจากหมึกทั้งหมด เพราะลายอิฐกับสัญลักษณ์คือสิ่งที่ร้อยผนังคนละท่อนเข้าด้วยกัน
 *
 * **เสา** คือหนึ่งในสองอย่างนี้ และต้องชิดผนังเสมอ
 * - ช่องปิดสนิทขนาดเท่าเสา (สี่เหลี่ยมเดี่ยว หรือแบ่งครึ่ง หรือกากบาทเป็นสี่ช่อง) ที่ล้อมด้วย
 *   เส้นทั้งสี่ด้าน และรอบนอกสะอาด · ถังชักโครกที่ชนผนังตกข้อรอบนอก เพราะโถต่ออยู่ข้างล่าง
 *   · ช่องกระเบื้องตกเพราะเกาะกันเป็นตารางใหญ่กว่าเสา
 * - ก้อนทึบขนาดเท่าเสา
 *
 * ทุกอย่างนอกจากนี้ — ตารางกระเบื้อง สุขภัณฑ์ ตัวอักษร กรอบป้าย สามเหลี่ยม เส้นบอกระยะ
 * เส้นตัด — ไม่กั้น · ฟังก์ชันนี้รู้จักแต่พิกเซล ผู้เรียกแปลงเมตรเป็นพิกเซลมาให้
 */
export function structuralMask(
  image: GreyImage,
  threshold: number,
  minRun: number,
  minStructure: number,
  column?: ColumnRule,
  wallThickness: number = DEFAULT_WALL_THICKNESS_PIXELS
): Uint8Array {
  const { width, height } = image;
  const dark = new Uint8Array(width * height);
  for (let index = 0; index < dark.length; index += 1) {
    dark[index] = image.data[index] <= threshold ? 1 : 0;
  }
  if (minRun <= 1 && minStructure <= 1) return dark;

  const runs = runLengths(dark, width, height);
  const big = bigComponents(dark, width, height, minStructure);
  const faces = wallFaces(dark, runs, width, height, minRun, wallThickness);
  const bands = thickBands(dark, runs, width, height, minRun);
  const walls = new Uint8Array(dark.length);
  for (let index = 0; index < dark.length; index += 1) {
    walls[index] = (faces[index] === 1 || bands[index] === 1) && big[index] === 1 ? 1 : 0;
  }
  if (!column) return walls;

  const columns = columnMask(image, dark, runs, walls, width, height, column);
  for (let index = 0; index < walls.length; index += 1) if (columns[index]) walls[index] = 1;
  return walls;
}

type RunLengths = { horizontal: Uint16Array; vertical: Uint16Array };

/** ความยาวของช่วงหมึกต่อเนื่องที่แต่ละพิกเซลอยู่ ทั้งแนวนอนและแนวตั้ง */
function runLengths(dark: Uint8Array, width: number, height: number): RunLengths {
  const horizontal = new Uint16Array(dark.length);
  const vertical = new Uint16Array(dark.length);
  for (let y = 0; y < height; y += 1) {
    let start = -1;
    for (let x = 0; x <= width; x += 1) {
      const on = x < width && dark[y * width + x] === 1;
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        const length = Math.min(65535, x - start);
        for (let k = start; k < x; k += 1) horizontal[y * width + k] = length;
        start = -1;
      }
    }
  }
  for (let x = 0; x < width; x += 1) {
    let start = -1;
    for (let y = 0; y <= height; y += 1) {
      const on = y < height && dark[y * width + x] === 1;
      if (on && start < 0) start = y;
      if (!on && start >= 0) {
        const length = Math.min(65535, y - start);
        for (let k = start; k < y; k += 1) vertical[k * width + x] = length;
        start = -1;
      }
    }
  }
  return { horizontal, vertical };
}

/**
 * ก้อนหมึกที่กรอบล้อมยาวอย่างน้อยเท่าที่กำหนด นับแบบแปดทิศบนหมึกทั้งหมด
 *
 * ลายอิฐในเนื้อผนังกับเส้นสั้น ๆ คือสิ่งที่เชื่อมผนังคนละท่อนให้เป็นโครงเดียวกัน ถ้านับก้อน
 * จากเส้นที่คัดแล้ว ผนังท่อนระหว่างประตูกับเสาจะกลายเป็นก้อนเล็กแล้วตกด่านทั้งที่เป็นผนังจริง
 * เจอเรื่องนี้ตอนทดลองกับผนังบนของห้องพักพยาบาลเมื่อ 2026-09-04
 */
function bigComponents(dark: Uint8Array, width: number, height: number, minStructure: number): Uint8Array {
  const keep = new Uint8Array(dark.length);
  if (minStructure <= 1) {
    keep.set(dark);
    return keep;
  }
  const label = new Int32Array(dark.length).fill(-1);
  const stack: number[] = [];
  let next = 0;
  for (let seed = 0; seed < dark.length; seed += 1) {
    if (dark[seed] === 0 || label[seed] >= 0) continue;
    stack.length = 0;
    stack.push(seed);
    label[seed] = next;
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
          const candidate = ny * width + nx;
          if (dark[candidate] === 0 || label[candidate] >= 0) continue;
          label[candidate] = next;
          stack.push(candidate);
        }
      }
    }
    if (Math.max(maxX - minX + 1, maxY - minY + 1) >= minStructure) {
      for (const index of members) keep[index] = 1;
    }
    next += 1;
  }
  return keep;
}

/** สัดส่วนหมึกอย่างน้อยเท่านี้ในช่องระหว่างคู่เส้น ถือว่าเป็นลายผนัง (ลายอิฐ หรือทึบ) */
const WALL_GAP_INKED = 0.15;
/** สัดส่วนหมึกไม่เกินเท่านี้ในช่องระหว่างคู่เส้น ถือว่าสะอาด คือผนังเบาที่วาดเป็นเส้นคู่เปล่า */
const WALL_GAP_CLEAN = 0.02;
/** ระยะห่างขั้นต่ำระหว่างคู่เส้นผิว · ต่ำกว่านี้คือเส้นหนาเส้นเดียว ไม่ใช่ผนังสองผิว */
const WALL_PAIR_MIN = 3;
/** ระยะระหว่างจุดสุ่มบนเส้น หน่วยพิกเซล */
const WALL_SAMPLE_STEP = 3;
/** เส้นยาวต้องมีจุดสุ่มที่จับคู่ได้อย่างน้อยครึ่งหนึ่ง จึงนับว่าเป็นผิวผนัง */
const WALL_PAIRED_FRACTION = 0.5;
/** มัธยฐานความหนาของเส้นผิวผนังต้องไม่ต่ำกว่านี้ · เส้นกระเบื้องบางหนึ่งพิกเซล */
const WALL_MIN_THICKNESS = 2;

/**
 * เส้นผิวผนัง — เส้นตรงยาวที่มีคู่ขนานอยู่ในระยะความหนาผนัง และช่องระหว่างเป็นลายผนังหรือสะอาด
 *
 * ตัดสินทีละเส้น (ช่วงหมึกต่อเนื่องยาวอย่างน้อย `minRun`) โดยสุ่มจุดตามแนวเส้น แล้วเก็บเส้น
 * ตั้งแต่จุดแรกที่จับคู่ได้ถึงจุดสุดท้ายที่จับคู่ได้ · ส่วนปลายที่จับคู่ไม่ได้ถูกตัดทิ้ง เพราะมัน
 * คือขอบสุขภัณฑ์ที่วาดต่อจากปลายผนัง · ส่วนกลางที่จับคู่ไม่ได้ (ช่องประตูอีกฝั่ง หน้าต่าง)
 * ยังคงไว้ เพราะเส้นผิวจริงวิ่งต่อเนื่องผ่านช่องพวกนั้น
 */
function wallFaces(
  dark: Uint8Array,
  runs: RunLengths,
  width: number,
  height: number,
  minRun: number,
  wallThickness: number
): Uint8Array {
  const faces = new Uint8Array(dark.length);
  const pairMax = Math.max(WALL_PAIR_MIN, Math.round(wallThickness));
  const longAcross = (horizontal: boolean, index: number) =>
    (horizontal ? runs.horizontal[index] : runs.vertical[index]) >= minRun;

  /** สัดส่วนหมึกในช่องระหว่างเส้นที่ระยะ `fixed` กับคู่ที่ระยะ `partner` รอบตำแหน่ง `along` */
  const gapInk = (horizontal: boolean, along: number, fixed: number, partner: number) => {
    const low = Math.min(fixed, partner) + 1;
    const high = Math.max(fixed, partner) - 1;
    let total = 0;
    let inked = 0;
    for (let across = low; across <= high; across += 1) {
      for (let offset = -3; offset <= 3; offset += 1) {
        const p = along + offset;
        const x = horizontal ? p : across;
        const y = horizontal ? across : p;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        total += 1;
        inked += dark[y * width + x];
      }
    }
    return total === 0 ? 0 : inked / total;
  };

  const judgeRun = (horizontal: boolean, fixed: number, start: number, end: number) => {
    const paired: boolean[] = [];
    const thickness: number[] = [];
    for (let along = start; along < end; along += WALL_SAMPLE_STEP) {
      const index = horizontal ? fixed * width + along : along * width + fixed;
      thickness.push(horizontal ? runs.vertical[index] : runs.horizontal[index]);
      let found = false;
      for (let k = WALL_PAIR_MIN; k <= pairMax && !found; k += 1) {
        for (const sign of [-1, 1]) {
          const partner = fixed + sign * k;
          if (partner < 0 || partner >= (horizontal ? height : width)) continue;
          const partnerIndex = horizontal ? partner * width + along : along * width + partner;
          if (dark[partnerIndex] === 0 || !longAcross(horizontal, partnerIndex)) continue;
          const ink = gapInk(horizontal, along, fixed, partner);
          if (ink >= WALL_GAP_INKED || ink <= WALL_GAP_CLEAN) {
            found = true;
            break;
          }
        }
      }
      paired.push(found);
    }
    thickness.sort((one, two) => one - two);
    if (thickness[Math.floor(thickness.length / 2)] < WALL_MIN_THICKNESS) return;
    const count = paired.filter(Boolean).length;
    if (count < paired.length * WALL_PAIRED_FRACTION) return;
    const first = paired.indexOf(true);
    const last = paired.lastIndexOf(true);
    const from = start + first * WALL_SAMPLE_STEP;
    const to = Math.min(end, start + (last + 1) * WALL_SAMPLE_STEP);
    for (let along = from; along < to; along += 1) {
      faces[horizontal ? fixed * width + along : along * width + fixed] = 1;
    }
  };

  for (let y = 0; y < height; y += 1) {
    let start = -1;
    for (let x = 0; x <= width; x += 1) {
      const on = x < width && runs.horizontal[y * width + x] >= minRun;
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        judgeRun(true, y, start, x);
        start = -1;
      }
    }
  }
  for (let x = 0; x < width; x += 1) {
    let start = -1;
    for (let y = 0; y <= height; y += 1) {
      const on = y < height && runs.vertical[y * width + x] >= minRun;
      if (on && start < 0) start = y;
      if (!on && start >= 0) {
        judgeRun(false, x, start, y);
        start = -1;
      }
    }
  }
  return faces;
}

/** แถบหมึกหนาตั้งแต่เท่านี้ถือว่าเป็นผนังทึบหรือแถบหน้าต่าง ไม่ใช่เส้น */
const BAND_MIN_THICKNESS = 3;

/**
 * แถบทึบที่ยาวพอในตัวเอง — ความยาววัดเฉพาะบนพิกเซลที่หนา จึงยืมความยาวจากเส้นบางไม่ได้
 *
 * ขอบถังชักโครกในห้องน้ำพยาบาลหน้า 7 หนาสามพิกเซลยาว 0.88 เมตร ชนกับผนังบน ถ้าวัด
 * ความยาวบนหมึกทั้งหมด มันจะบวกความหนาผนังเข้าไปจนยาวเกินหนึ่งเมตรแล้วกลายเป็นผนัง
 */
function thickBands(dark: Uint8Array, runs: RunLengths, width: number, height: number, minRun: number): Uint8Array {
  const band = new Uint8Array(dark.length);
  for (let index = 0; index < dark.length; index += 1) {
    if (dark[index] === 1 && Math.min(runs.horizontal[index], runs.vertical[index]) >= BAND_MIN_THICKNESS) band[index] = 1;
  }
  const kept = new Uint8Array(dark.length);
  for (let y = 0; y < height; y += 1) {
    let start = -1;
    for (let x = 0; x <= width; x += 1) {
      const on = x < width && band[y * width + x] === 1;
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        if (x - start >= minRun) for (let k = start; k < x; k += 1) kept[y * width + k] = 1;
        start = -1;
      }
    }
  }
  for (let x = 0; x < width; x += 1) {
    let start = -1;
    for (let y = 0; y <= height; y += 1) {
      const on = y < height && band[y * width + x] === 1;
      if (on && start < 0) start = y;
      if (!on && start >= 0) {
        if (y - start >= minRun) for (let k = start; k < y; k += 1) kept[k * width + x] = 1;
        start = -1;
      }
    }
  }
  return kept;
}

type Box = { minX: number; minY: number; maxX: number; maxY: number };

/** ช่องปิดสนิทต้องเต็มกรอบล้อมอย่างน้อยเท่านี้ ไม่งั้นเป็นสามเหลี่ยมหรือวงกลม ไม่ใช่เสา */
const COLUMN_CELL_FILL = 0.85;
/** ก้อนทึบต้องเต็มกรอบล้อมอย่างน้อยเท่านี้ */
const COLUMN_SOLID_FILL = 0.7;
/** ด้านยาวของเสาต้องไม่เกินสองเท่าของด้านสั้น · ถังชักโครกกับกรอบป้ายยาวกว่านั้น */
const COLUMN_MAX_ASPECT = 2;
/** เส้นล้อมช่องต้องมืดอย่างน้อยเท่านี้ของความยาวรอบช่อง */
const COLUMN_RING_DARK = 0.9;
/** หมึกรอบนอกเสา (ห่างสองถึงหกพิกเซล ไม่นับผนัง) ต้องไม่เกินเท่านี้ ไม่งั้นมันคือชิ้นส่วนของสุขภัณฑ์ */
const COLUMN_FRAME_CLUTTER = 0.3;
/** ช่องที่ห่างกันไม่เกินเท่านี้ถือว่าเป็นช่องของเสาต้นเดียวกัน (กากบาทหรือเส้นแบ่งครึ่ง) */
const COLUMN_CELL_GAP = 2;

/**
 * เสา — ช่องปิดสนิทขนาดเท่าเสาที่ล้อมด้วยเส้นครบสี่ด้านและรอบนอกสะอาด หรือก้อนทึบขนาดเท่าเสา
 *
 * **ทำไมมองด้วยเกณฑ์จางกว่าผนัง** เสาบางต้นเขียนด้วยปากกาจาง (ดู `COLUMN_SYMBOL_THRESHOLD`)
 * **ทำไมต้องรวมช่องที่ติดกัน** เสาที่มีกากบาทเป็นสี่ช่องเล็ก ถ้าดูทีละช่องจะเล็กเกินและรอบนอก
 * มีเส้นกากบาทของช่องข้าง ๆ ทำให้ตกข้อรอบนอกสะอาด · รวมเป็นก้อนเดียวก่อนแล้วค่อยตัดสิน
 * **ทำไมช่องกระเบื้องไม่ผ่าน** มันเกาะกันเป็นตารางหลายสิบช่อง รวมแล้วใหญ่กว่าเสามาก
 * **ทำไมถังชักโครกไม่ผ่าน** ตัวถังเป็นสี่เหลี่ยมชนผนังเหมือนเสาทุกอย่าง แต่โถต่ออยู่ข้างล่าง
 * รอบนอกจึงไม่สะอาด · เจอทั้งสามกรณีนี้บนแบบหน้า 7 เมื่อ 2026-09-04
 */
function columnMask(
  image: GreyImage,
  dark: Uint8Array,
  runs: RunLengths,
  walls: Uint8Array,
  width: number,
  height: number,
  rule: ColumnRule
): Uint8Array {
  const columns = new Uint8Array(dark.length);
  const faint = new Uint8Array(dark.length);
  for (let index = 0; index < faint.length; index += 1) {
    faint[index] = image.data[index] <= COLUMN_SYMBOL_THRESHOLD ? 1 : 0;
  }

  const touchesWalls = (box: Box) => {
    for (let y = Math.max(0, box.minY - rule.touch); y <= Math.min(height - 1, box.maxY + rule.touch); y += 1) {
      for (let x = Math.max(0, box.minX - rule.touch); x <= Math.min(width - 1, box.maxX + rule.touch); x += 1) {
        if (walls[y * width + x]) return true;
      }
    }
    return false;
  };
  const sizeFits = (box: Box, minSide: number) => {
    const w = box.maxX - box.minX + 1;
    const h = box.maxY - box.minY + 1;
    if (w < minSide || h < minSide || w > rule.max || h > rule.max) return false;
    return Math.max(w, h) <= COLUMN_MAX_ASPECT * Math.min(w, h);
  };
  const stamp = (box: Box) => {
    for (let y = Math.max(0, box.minY - 3); y <= Math.min(height - 1, box.maxY + 3); y += 1) {
      for (let x = Math.max(0, box.minX - 3); x <= Math.min(width - 1, box.maxX + 3); x += 1) {
        const inside = x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY;
        // ถมทั้งกรอบ แล้วเก็บเฉพาะเส้นจริงในวงแหวนรอบนอก ไม่ถมวงแหวน ไม่งั้นกินเนื้อห้อง
        if (inside || faint[y * width + x]) columns[y * width + x] = 1;
      }
    }
  };

  // ช่องขาวที่ปิดสนิท (ออกไปถึงขอบกระดาษไม่ได้) บนหมึกจาง
  const reached = new Uint8Array(faint.length);
  const queue: number[] = [];
  const push = (x: number, y: number) => {
    const index = y * width + x;
    if (faint[index] || reached[index]) return;
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

  const seen = new Uint8Array(faint.length);
  const cells: Box[] = [];
  const stack: number[] = [];
  const cellMin = 3;
  for (let seed = 0; seed < faint.length; seed += 1) {
    if (faint[seed] || reached[seed] || seen[seed]) continue;
    stack.length = 0;
    stack.push(seed);
    seen[seed] = 1;
    let filled = 0;
    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;
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
        const candidate = ny * width + nx;
        if (faint[candidate] || seen[candidate]) return;
        seen[candidate] = 1;
        stack.push(candidate);
      };
      if (x > 0) step(x - 1, y);
      if (x < width - 1) step(x + 1, y);
      if (y > 0) step(x, y - 1);
      if (y < height - 1) step(x, y + 1);
    }
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    if (w < cellMin || h < cellMin || w > rule.max || h > rule.max) continue;
    if (filled / (w * h) < COLUMN_CELL_FILL) continue;
    cells.push({ minX, minY, maxX, maxY });
  }

  /**
   * รวมช่องที่ติดกันและขนาดใกล้เคียงกันเป็นก้อนเดียว (กากบาทของเสา · ตารางกระเบื้องก็รวมกัน
   * จนใหญ่เกินเสา) · ต้องดูขนาดด้วย ไม่งั้นช่องเล็กจิ๋วของวงกบประตูที่อยู่ห่างเสาสองพิกเซล
   * จะถูกดูดเข้าก้อน ทำให้กรอบล้อมยื่นออกไปในที่ว่างแล้วตกข้อเส้นล้อมครบสี่ด้าน
   * เจอกับเสามุมบนซ้ายของห้องพักพยาบาลหน้า 7 เมื่อ 2026-09-04
   */
  const parent = cells.map((_, index) => index);
  const find = (index: number): number => (parent[index] === index ? index : (parent[index] = find(parent[index])));
  const similar = (a: Box, b: Box) => {
    const aw = a.maxX - a.minX + 1;
    const ah = a.maxY - a.minY + 1;
    const bw = b.maxX - b.minX + 1;
    const bh = b.maxY - b.minY + 1;
    return Math.max(aw, bw) <= 2 * Math.min(aw, bw) && Math.max(ah, bh) <= 2 * Math.min(ah, bh);
  };
  for (let a = 0; a < cells.length; a += 1) {
    for (let b = a + 1; b < cells.length; b += 1) {
      const gapX = Math.max(cells[b].minX - cells[a].maxX - 1, cells[a].minX - cells[b].maxX - 1, 0);
      const gapY = Math.max(cells[b].minY - cells[a].maxY - 1, cells[a].minY - cells[b].maxY - 1, 0);
      if (gapX <= COLUMN_CELL_GAP && gapY <= COLUMN_CELL_GAP && similar(cells[a], cells[b])) parent[find(a)] = find(b);
    }
  }
  const clusters = new Map<number, Box>();
  cells.forEach((cell, index) => {
    const root = find(index);
    const box = clusters.get(root);
    if (!box) {
      clusters.set(root, { ...cell });
      return;
    }
    box.minX = Math.min(box.minX, cell.minX);
    box.minY = Math.min(box.minY, cell.minY);
    box.maxX = Math.max(box.maxX, cell.maxX);
    box.maxY = Math.max(box.maxY, cell.maxY);
  });

  /**
   * เนื้อในเสาเล็กกว่าตัวเสาเท่าความหนาเส้นกรอบสองข้าง เกณฑ์ขนาดของช่องจึงลดลงสี่พิกเซล
   * 2026-09-04 เจ้าของงานทักว่าเสาขวาล่างยังถูกกิน วัดแล้วกรอบนอกกว้าง 8 ผ่านเกณฑ์ 7 แต่เนื้อใน 6
   */
  const cellSide = Math.max(cellMin, rule.min - 4);
  const ringDark = (box: Box) => {
    let total = 0;
    let darkCount = 0;
    const check = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      total += 1;
      darkCount += faint[y * width + x];
    };
    let weakest = 1;
    const side = (points: [number, number][]) => {
      total = 0;
      darkCount = 0;
      for (const [x, y] of points) check(x, y);
      weakest = Math.min(weakest, total === 0 ? 0 : darkCount / total);
    };
    const top: [number, number][] = [];
    const bottom: [number, number][] = [];
    const left: [number, number][] = [];
    const right: [number, number][] = [];
    for (let x = box.minX; x <= box.maxX; x += 1) {
      top.push([x, box.minY - 1]);
      bottom.push([x, box.maxY + 1]);
    }
    for (let y = box.minY; y <= box.maxY; y += 1) {
      left.push([box.minX - 1, y]);
      right.push([box.maxX + 1, y]);
    }
    side(top);
    side(bottom);
    side(left);
    side(right);
    return weakest;
  };
  /** พิกเซลนี้อยู่ในเนื้อผนังหรือไม่ — ห่างจากเส้นผนังไม่เกินสามพิกเซล ลายอิฐระหว่างผิวจึงไม่นับเป็นความรก */
  const insideWall = (x: number, y: number) => {
    for (let dy = -3; dy <= 3; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (walls[ny * width + nx]) return true;
      }
    }
    return false;
  };
  const frameClutter = (box: Box) => {
    let total = 0;
    let inked = 0;
    for (let y = box.minY - 6; y <= box.maxY + 6; y += 1) {
      for (let x = box.minX - 6; x <= box.maxX + 6; x += 1) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        if (x >= box.minX - 1 && x <= box.maxX + 1 && y >= box.minY - 1 && y <= box.maxY + 1) continue;
        if (insideWall(x, y)) continue;
        total += 1;
        inked += dark[y * width + x];
      }
    }
    return total === 0 ? 0 : inked / total;
  };
  for (const box of clusters.values()) {
    if (!sizeFits(box, cellSide)) continue;
    if (ringDark(box) < COLUMN_RING_DARK) continue;
    if (!touchesWalls(box)) continue;
    if (frameClutter(box) > COLUMN_FRAME_CLUTTER) continue;
    stamp(box);
  }

  // ก้อนทึบขนาดเท่าเสา — นับแปดทิศบนพิกเซลหนา เส้นผิวผนังบาง ๆ จึงไม่พาก้อนไปรวมกับผนังทั้งแผง
  const thick = new Uint8Array(dark.length);
  for (let index = 0; index < dark.length; index += 1) {
    if (dark[index] === 1 && Math.min(runs.horizontal[index], runs.vertical[index]) >= BAND_MIN_THICKNESS) thick[index] = 1;
  }
  const seenThick = new Uint8Array(dark.length);
  for (let seed = 0; seed < thick.length; seed += 1) {
    if (thick[seed] === 0 || seenThick[seed]) continue;
    stack.length = 0;
    stack.push(seed);
    seenThick[seed] = 1;
    let filled = 0;
    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;
    while (stack.length > 0) {
      const index = stack.pop() as number;
      filled += 1;
      const x = index % width;
      const y = (index - x) / width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const candidate = ny * width + nx;
          if (thick[candidate] === 0 || seenThick[candidate]) continue;
          seenThick[candidate] = 1;
          stack.push(candidate);
        }
      }
    }
    const box = { minX, minY, maxX, maxY };
    if (!sizeFits(box, rule.min)) continue;
    if (filled / ((maxX - minX + 1) * (maxY - minY + 1)) < COLUMN_SOLID_FILL) continue;
    if (!touchesWalls(box)) continue;
    stamp(box);
  }
  return columns;
}

export const regionRejectionMessage: Record<RegionRejection, string> = {
  seed_outside: "คลิกนอกขอบหน้าแบบ",
  seed_on_line: "คลิกโดนเส้นในแบบพอดี ลองคลิกกลางห้องที่ว่าง",
  leaked:
    "เส้นรอบห้องในแบบไม่ปิดสนิท สีจึงทะลุออกนอกห้อง ให้วัดพื้นที่ด้วยการคลิกไล่มุมแทน",
  too_small: "บริเวณที่ได้เล็กเกินกว่าจะเป็นห้อง ลองคลิกใหม่กลางพื้นที่ว่าง"
};

/**
 * หน้ากากผนังของหน้าหนึ่ง จำไว้กับภาพวิเคราะห์ ไม่คำนวณซ้ำทุกคลิก
 *
 * `structuralMask` กับการเชื่อมช่องประตูไม่ขึ้นกับจุดที่คลิกเลย ขึ้นกับภาพและเกณฑ์เท่านั้น
 * แต่ก่อนหน้านี้ถูกคำนวณใหม่ทุกคลิก กินไปราวครึ่งวินาทีต่อคลิกบนหน้า A3 · จำผลไว้กับภาพ
 * ด้วย WeakMap ภาพหายเมื่อไหร่ผลก็หายตาม ไม่ต้องล้างเอง · เกณฑ์เปลี่ยน (เช่น ตั้งสเกลใหม่)
 * คีย์ไม่ตรงก็คำนวณใหม่ · ผู้เรียกต้องส่ง `GreyImage` อ็อบเจ็กต์เดิมมาทุกคลิกถึงจะได้ประโยชน์
 */
const barrierCache = new WeakMap<GreyImage, { key: string; drawn: Uint8Array; barrier: Uint8Array }>();

export function structuralBarrier(
  image: GreyImage,
  options: RegionOptions = {}
): { drawn: Uint8Array; barrier: Uint8Array } {
  const threshold = options.lineThreshold ?? DEFAULT_LINE_THRESHOLD;
  const minRun = Math.floor(options.minRunPixels ?? 0);
  const minStructure = Math.floor(options.minStructurePixels ?? 0);
  const column = options.column;
  const wallThickness = options.wallThicknessPixels ?? DEFAULT_WALL_THICKNESS_PIXELS;
  const bridgeRadius = Math.floor(options.bridgeGapPixels ?? 0);
  const key = [
    threshold,
    minRun,
    minStructure,
    column ? `${column.min}/${column.max}/${column.touch}` : "-",
    wallThickness,
    bridgeRadius
  ].join("|");
  const cached = barrierCache.get(image);
  if (cached && cached.key === key) return cached;
  const drawn = structuralMask(image, threshold, minRun, minStructure, column, wallThickness);
  const barrier = bridgeRadius > 0 ? closeMask(drawn, image.width, image.height, bridgeRadius) : drawn;
  const entry = { key, drawn, barrier };
  barrierCache.set(image, entry);
  return entry;
}

/**
 * ไล่บริเวณที่ปิดล้อมรอบจุดที่คลิก แล้วคืนรูปหลายเหลี่ยมของขอบ
 *
 * **ตรวจการรั่วเสมอ** ผู้พัฒนาเครื่องมือที่เจ้าของงานให้ดูเตือนเองว่าวิธีนี้ไม่แม่นทุกครั้ง
 * ถ้าเส้นในแบบไม่ปิดสนิท สีจะทะลุออกไปทั้งหน้า เราจึงต้องจับให้ได้แล้วบอกตรง ๆ
 * ไม่ใช่คืนพื้นที่มั่ว ๆ ให้ไหลเข้าใบราคา
 */
export function traceRegion(image: GreyImage, seed: Pixel, options: RegionOptions = {}): RegionResult {
  const maxArea = (options.maxAreaFraction ?? DEFAULT_MAX_AREA_FRACTION) * image.width * image.height;

  const sx = Math.round(seed.x);
  const sy = Math.round(seed.y);
  if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) {
    return { ok: false, reason: "seed_outside", areaPixels: 0 };
  }

  const { drawn, barrier } = structuralBarrier(image, options);
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
  const tidied = removeJogs(outline, step);
  const reach = Math.round(options.snapToLinePixels ?? 0);
  const snapped = reach > 0 ? snapOutlineToLines(tidied, drawn, image.width, image.height, reach) : tidied;
  /**
   * ยุบบันได**หลัง**เกาะเส้นผนัง ไม่ใช่ก่อน · ถ้ายุบก่อน มุมฉากใหม่จะพาดทับบริเวณที่เสาแหว่ง
   * แล้วขั้นเกาะเส้นจะเห็นว่าด้านนั้นไม่มีหมึกรองรับตลอดแนว จึงดันมันลึกเข้าไปในเสาอีก
   * สองพิกเซล · เกาะก่อนแล้วค่อยยุบ ด้านยาวจึงนั่งบนผนังจริง และมุมใหม่มาจากปลายของด้านยาว
   */
  const feature = options.column?.min ?? 0;
  /**
   * ขั้นเดี่ยวที่แคบกว่าเสาต้นเล็กสุดก็ไม่ใช่ของจริงเช่นกัน · เจอบนห้องน้ำผู้ป่วยชายหน้า 7
   * เมื่อ 2026-09-04 เป็นรอยหยักกว้างสามพิกเซลตรงเสามุมที่ยื่นเข้าห้องเจ็ดเซนติเมตร
   * เจ้าของงานลากกรอบน้ำเงินเป็นสี่เหลี่ยมเกลี้ยง ๆ "มันก็แค่กว้างคูณยาว"
   * · สิ่งที่แลกไปคือปลายผนังเบาที่ยื่นเข้าห้องไม่ถึงสิบห้าเซนติเมตรจะถูกเกลี่ยไปด้วย
   */
  const polygon = feature > 1 ? removeJogs(collapseStaircases(snapped, feature), feature) : snapped;
  return { ok: true, polygon, areaPixels: closedArea };
}

/**
 * ดันแต่ละด้านของขอบไปชิดผิวด้านในของเส้นผนังที่มันหันหน้าเข้าหา
 *
 * **ผิวห้องคือขอบในของหมึก ไม่ใช่กึ่งกลางหมึก** เจ้าของงานเคาะเมื่อ 2026-09-04 ว่า
 * "เส้นผนังเอาตามที่ผมลากเลย หนาหรือบางก็เอาชิดด้านในห้อง" ซึ่งตรงกับที่บันทึกไว้ตั้งแต่
 * `docs/plans/2026-09-03-room-area-explained-and-materials.md` ว่าไล่ขอบตามเส้นผิวผนังด้านใน
 *
 * **อย่าเขียนคำว่ากึ่งกลางกับเส้นผนังอีก** 2026-09-04 มีเซสชันหนึ่งเปลี่ยนขั้นนี้ไปเล็งกึ่งกลาง
 * ความหนาหมึก แล้วอ้างในคำอธิบายว่าเป็นคำสั่งของเจ้าของงาน · เขาทักเองว่าไม่เคยพูด
 * ในคำพูดของเขา "กึ่งกลาง" เป็นของเสาเท่านั้น คือจุดตัดเส้นกริดที่ `grid-bay.ts` คำนวณ
 * ซึ่งเป็นคนละเลขกับพื้นที่ห้อง · การเล็งกึ่งกลางหมึกทำให้ขอบกินเข้าไปในเนื้อผนัง
 * และยิ่งผนังหนา ยิ่งกินลึก ซึ่งไม่ใช่พื้นที่ใช้สอยของห้อง
 *
 * **แล้วยังต้องมีขั้นนี้ไปทำไม ในเมื่อการไล่สีก็หยุดที่หมึกอยู่แล้ว** เพราะหมึกตัวแรกที่การไล่สี
 * ชนไม่ใช่ผนังเสมอไป · บนแบบหน้า 7 มีหมึกหนาสองพิกเซลเกาะอยู่ใต้เส้นผิวผนังบนของห้อง
 * พักพยาบาล ตั้งแต่กรอบหน้าต่างไปจนถึงปลายสามเหลี่ยมบอกระดับแล้วหายไป เจ้าของงานลาก
 * เส้นน้ำเงินให้ดูว่าขอบต้องอยู่ใต้เส้นผิวบางที่วิ่งตลอดแนว ไม่ใช่ใต้หมึกก้อนนั้น
 * และการเชื่อมช่องประตูก็ทำให้หน้ากากอ้วนกว่าหมึกจริงได้อีกหนึ่งถึงสองพิกเซลตรงรอยเว้าแคบ
 *
 * ขั้นนี้จึงถามทั้งด้านพร้อมกันว่า **แถวหมึกแถวไหนวิ่งตลอดด้าน** แล้วยกทั้งด้านไปชิดแถวนั้น
 * ด้านจึงเป็นเส้นตรงเส้นเดียวที่นั่งบนผิวผนังจริง มองข้ามหมึกที่โผล่มาแค่บางช่วง
 *
 * ด้านที่ไม่เจอเส้นภายในระยะที่กำหนดจะอยู่ที่เดิม ซึ่งเกิดกับด้านที่พาดช่องประตูที่ถูกเชื่อม
 * เพราะตรงนั้นไม่มีเส้นเขียนอยู่จริง จะไปชิดผิวของอะไรไม่ได้
 */
export function snapOutlineToLines(
  polygon: readonly Pixel[],
  dark: Uint8Array,
  width: number,
  height: number,
  reach: number
): Pixel[] {
  const count = polygon.length;
  if (count < 4) return polygon.map((point) => ({ ...point }));
  const on = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && dark[y * width + x] === 1;

  /** ตำแหน่งใหม่ของแนวเส้นที่แต่ละด้านนั่งอยู่ · null แปลว่าไม่เจอเส้น ให้อยู่ที่เดิม */
  const lines: (number | null)[] = [];
  for (let index = 0; index < count; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % count];
    const stepX = Math.sign(b.x - a.x);
    const stepY = Math.sign(b.y - a.y);
    const length = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (length === 0) {
      lines.push(null);
      continue;
    }
    // บริเวณอยู่ทางขวาของทิศเดินเสมอ ด้านนอกจึงอยู่ทางซ้าย
    const outX = stepY;
    const outY = -stepX;
    /**
     * นับว่าที่ระยะออกไป k พิกเซล มีจุดสุ่มกี่จุดที่เจอหมึก · จุดที่ไม่เจอหมึกเลยในระยะ
     * ที่กำหนดไม่มีสิทธิ์ออกเสียง เพราะมันอยู่ในช่องประตูที่ถูกเชื่อม ไม่มีเส้นให้เกาะ
     */
    const votes = new Array<number>(reach).fill(0);
    let voters = 0;
    const gap = Math.max(1, Math.floor(length / 12));
    for (let along = 0; along < length; along += gap) {
      /**
       * แปลงจากพิกัดมุมเป็นพิกัดพิกเซล · ด้านตั้งที่มุม x คั่นระหว่างคอลัมน์ x-1 กับ x
       * ด้านนอนที่มุม y คั่นระหว่างแถว y-1 กับ y · พิกเซลนอกตัวแรกคือฝั่งที่ทิศออกชี้ไป
       */
      let baseX: number;
      let baseY: number;
      if (stepX === 0) {
        baseX = outX > 0 ? a.x : a.x - 1;
        baseY = stepY > 0 ? a.y + along : a.y - 1 - along;
      } else {
        baseX = stepX > 0 ? a.x + along : a.x - 1 - along;
        baseY = outY > 0 ? a.y : a.y - 1;
      }
      let sawInk = false;
      for (let k = 0; k < reach; k += 1) {
        if (on(baseX + outX * k, baseY + outY * k)) {
          votes[k] += 1;
          sawInk = true;
        }
      }
      if (sawInk) voters += 1;
    }
    if (voters === 0) {
      lines.push(null);
      continue;
    }
    /**
     * **ผนังคือแถวหมึกที่วิ่งตลอดด้าน** เอาแถวแรก (นับจากในห้องออกไป) ที่จุดสุ่มเกือบทุกจุด
     * เห็นหมึก · แถวที่มีหมึกแค่บางช่วงคือสัญลักษณ์ที่เกาะอยู่ใต้ผิวผนัง ให้มองข้าม
     *
     * เกณฑ์เก้าในสิบ ไม่ใช่สิบในสิบ เพราะขอบเส้นที่เรนเดอร์มามีจุดจาง ๆ หลุดเกณฑ์ความมืด
     * ได้บ้าง · และไม่ต่ำกว่านี้ เพราะสัญลักษณ์ที่เจอจริงบนแบบหน้า 7 กินไปแปดในสิบของด้าน
     */
    let face = -1;
    for (let k = 0; k < reach; k += 1) {
      if (votes[k] >= voters * 0.9) {
        face = k;
        break;
      }
    }
    if (face < 0) {
      lines.push(null);
      continue;
    }
    const base = outX !== 0 ? a.x : a.y;
    lines.push(base + (outX !== 0 ? outX : outY) * face);
  }

  /** มุมใหม่คือจุดตัดของสองด้านที่ประกบมัน ด้านหนึ่งนอนหนึ่งตั้งเสมอ */
  return polygon.map((point, index) => {
    const before = lines[(index - 1 + count) % count];
    const here = lines[index];
    const beforeVertical = polygon[(index - 1 + count) % count].x === point.x;
    const moved = { ...point };
    if (beforeVertical) {
      if (before !== null) moved.x = before;
      if (here !== null) moved.y = here;
    } else {
      if (before !== null) moved.y = before;
      if (here !== null) moved.x = here;
    }
    return moved;
  });
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

  /**
   * ด้านของพิกเซลที่ติดกับข้างนอก เรียงทิศให้บริเวณอยู่ทางขวามือของทิศเดินเสมอ
   *
   * มุมหนึ่งมีทางออกได้สองทาง เมื่อบริเวณแตะตัวเองแค่ที่มุม (สองพิกเซลเฉียงกัน) · ของเดิม
   * เก็บทางออกได้ทางเดียว ทางที่ถูกทับหาย วงจึงเดินไม่ครบรอบแล้วปิดด้วยเส้นเฉียงข้ามห้อง
   * เจอบนห้องน้ำผู้ป่วยชายหน้า 7 เมื่อ 2026-09-04
   */
  const next = new Map<string, Pixel[]>();
  const key = (p: Pixel) => `${p.x},${p.y}`;
  const add = (from: Pixel, to: Pixel) => {
    const list = next.get(key(from));
    if (list) list.push(to);
    else next.set(key(from), [to]);
  };
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
  let heading = { x: 0, y: 0 };
  for (let guard = 0; guard <= next.size * 2; guard += 1) {
    loop.push(at);
    const choices = next.get(key(at));
    if (!choices || choices.length === 0) break;
    /**
     * ที่มุมที่มีหลายทางออก เลี้ยวขวา (ตามเข็มนาฬิกาบนจอ) เพื่อเกาะบริเวณเดิมไว้
     * ทางซ้ายจะกระโดดข้ามไปอีกฟากที่แตะกันแค่มุม · ผลคูณไขว้เป็นบวกคือเลี้ยวขวาเมื่อแกน y ชี้ลง
     */
    let step = choices[0];
    if (choices.length > 1) {
      let best = Number.NEGATIVE_INFINITY;
      for (const candidate of choices) {
        const dx = candidate.x - at.x;
        const dy = candidate.y - at.y;
        const turn = heading.x * dy - heading.y * dx;
        if (turn > best) {
          best = turn;
          step = candidate;
        }
      }
    }
    heading = { x: step.x - at.x, y: step.y - at.y };
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
 * ยุบบันไดที่ต่อกันหลายขั้น ซึ่งทุกขั้นเล็กกว่าของจริงที่เล็กที่สุดในอาคาร ให้เหลือมุมฉากเดียว
 *
 * **ทำไม `removeJogs` ทำไม่ได้** ตัวนั้นยุบทีละขั้น และยอมยุบต่อเมื่อด้านสองข้างยาวกว่าขั้นนั้น
 * แต่ในบันไดที่ต่อกัน ทุกขั้นมีเพื่อนบ้านเป็นขั้นเล็กเท่ากัน จึงไม่มีขั้นไหนเข้าเกณฑ์เลย
 * 2026-09-04 เจ้าของงานชี้มุมเสาล่างขวาของห้องพักพยาบาลที่เป็นบันไดหกขั้น ขั้นละหนึ่งถึงสาม
 * พิกเซล ทั้งที่เขาลากเส้นน้ำเงินให้ดูว่าต้องเป็นมุมฉากเดียว · บันไดนั้นเกิดจากสัญลักษณ์
 * สามเหลี่ยมที่วางทับมุมเสาพอดี พอคัดสัญลักษณ์ออก มุมเสาที่เหลือจึงแหว่ง
 *
 * **เกณฑ์ว่าขั้นไหนเล็ก** ใช้ขนาดเสาต้นเล็กสุด (`ColumnRule.min`) เพราะของจริงที่ขอบห้อง
 * ต้องหักอ้อมไม่มีอะไรเล็กกว่าเสา · ขั้นเดี่ยว ๆ ที่มีด้านยาวขนาบสองข้างไม่ใช่บันได
 * ปล่อยให้ `removeJogs` ตัดสินตามเกณฑ์ของมันเอง เพราะมันอาจเป็นปลายผนังเบาที่ยื่นเข้าห้องจริง
 *
 * **มุมใหม่อยู่ตรงไหน** ถ้าด้านยาวสองข้างตั้งฉากกัน มุมคือจุดตัดของมัน ซึ่งมีที่เดียว
 * ถ้าขนานกัน ต้องเลือกว่าจะวางด้านสั้นที่ต้นหรือปลายบันได เลือกทางที่พื้นที่**เล็กลง**
 * เพราะพิกเซลในบันไดเป็นเศษของเสาหรือผนังที่แหว่ง ไม่ใช่พื้นห้อง เอามาเป็นพื้นที่ไม่ได้
 */
export function collapseStaircases(points: readonly Pixel[], maxStep: number): Pixel[] {
  let shape = mergeStraightRuns(points.map((point) => ({ ...point })));
  if (maxStep <= 1) return shape;
  const segment = (from: Pixel, to: Pixel) => Math.abs(from.x - to.x) + Math.abs(from.y - to.y);

  for (let pass = 0; pass < 100 && shape.length >= 6; pass += 1) {
    const count = shape.length;
    const short = shape.map((point, index) => segment(point, shape[(index + 1) % count]) < maxStep);
    // เริ่มเดินจากด้านยาวด้านหนึ่ง เพื่อไม่ให้บันไดถูกตัดขาดตรงรอยต่อของอาร์เรย์
    const origin = short.indexOf(false);
    if (origin < 0) return shape;

    let chainStart = -1;
    let chainLength = 0;
    let found: { start: number; end: number } | null = null;
    for (let offset = 1; offset <= count; offset += 1) {
      const index = (origin + offset) % count;
      if (short[index]) {
        if (chainStart < 0) chainStart = index;
        chainLength += 1;
        continue;
      }
      if (chainLength >= 2) {
        found = { start: chainStart, end: index };
        break;
      }
      chainStart = -1;
      chainLength = 0;
    }
    if (!found) return shape;

    /**
     * บันไดเริ่มที่จุด start และจบที่จุด end · มุมฉากที่แทนมันได้มีสองแบบเสมอ คือหักที่
     * (x ของปลาย, y ของต้น) หรือ (x ของต้น, y ของปลาย) · แบบหนึ่งกินบริเวณบันไดเข้ามาเป็น
     * พื้นห้อง อีกแบบยกให้เป็นเสา เลือกแบบที่พื้นที่เล็กลง ตามเหตุผลในคำอธิบายข้างบน
     */
    const first = shape[found.start];
    const last = shape[found.end];
    const options: Pixel[][] = [
      [first, { x: last.x, y: first.y }, last],
      [first, { x: first.x, y: last.y }, last]
    ];
    const rebuilt = options.map((middle) => tidyLoop(spliceChain(shape, found.start, found.end, middle)));
    shape = Math.abs(signedArea(rebuilt[0])) <= Math.abs(signedArea(rebuilt[1])) ? rebuilt[0] : rebuilt[1];
  }
  return shape;
}

/** ตัดจุดซ้ำที่ติดกันออก แล้วยุบจุดที่อยู่กลางเส้นตรงเดียวกัน */
function tidyLoop(points: readonly Pixel[]): Pixel[] {
  const distinct: Pixel[] = [];
  for (const point of points) {
    const previous = distinct[distinct.length - 1];
    if (previous && previous.x === point.x && previous.y === point.y) continue;
    distinct.push(point);
  }
  const head = distinct[0];
  const tail = distinct[distinct.length - 1];
  if (distinct.length > 1 && head.x === tail.x && head.y === tail.y) distinct.pop();
  return mergeStraightRuns(distinct);
}

/** แทนช่วงจุดตั้งแต่ start ถึง end (รวมทั้งคู่ วนรอบอาร์เรย์ได้) ด้วยจุดชุดใหม่ */
function spliceChain(shape: readonly Pixel[], start: number, end: number, middle: Pixel[]): Pixel[] {
  const count = shape.length;
  const kept: Pixel[] = [];
  for (let offset = 1; offset < count; offset += 1) {
    const index = (end + offset) % count;
    if (index === start) break;
    kept.push(shape[index]);
  }
  return [...middle, ...kept];
}

function signedArea(shape: readonly Pixel[]): number {
  let total = 0;
  for (let index = 0; index < shape.length; index += 1) {
    const a = shape[index];
    const b = shape[(index + 1) % shape.length];
    total += a.x * b.y - b.x * a.y;
  }
  return total / 2;
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
