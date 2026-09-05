/**
 * สถานะสี่ขั้นของโครงการ อ่านจากของที่บันทึกไว้จริง — สำหรับหน้าแรกของ ESTIMETR (IP-235)
 *
 * ไฟล์นี้ไม่แตะฐานข้อมูลและไม่แตะ React เลย มันรับตัวเลขที่นับมาแล้วเข้าไป แล้วคืนคำที่จะขึ้นจอ
 * เหตุผลที่แยกออกมาคือ **ทุกตัวเลขบนหน้าแรกต้องตรวจซ้ำได้** ถ้าคำว่า "ค้างอยู่ที่ขั้นนี้" ไปฝัง
 * อยู่กลาง JSX ก็จะไม่มีใครพิสูจน์ได้ว่ามันมาจากอะไร นอกจากเปิดเบราว์เซอร์ดูทีละกรณี
 *
 * กติกาว่าขั้นไหน "จบแล้ว" ตั้งใจให้เดินหน้าทางเดียวและวัดจากผลงานที่ขั้นนั้นผลิตออกมา
 * ไม่ใช่จากการที่ผู้ใช้เคยเปิดหน้าจอนั้น — เปิดหน้าจอไม่ใช่ผลงาน
 *
 * | ขั้น | จบเมื่อ | เหตุผล |
 * |---|---|---|
 * | 1 ตั้งค่าโครงการ | มีแถวโครงการอยู่ | หน้านี้อ่านจากรายการโครงการ จึงมีอยู่แน่นอน |
 * | 2 เปิดแบบและยืนยันสเกล | ตั้งสเกลแล้วอย่างน้อยหนึ่งหน้า | ไม่มีสเกล เครื่องมือวัดกดไม่ได้ |
 * | 3 ถอดปริมาณพร้อมหลักฐาน | มีปริมาณที่ยืนยันแล้วอย่างน้อยหนึ่งรายการ | รายการที่ยังไม่ยืนยันยังคิดราคาไม่ได้ |
 * | 4 ประมาณราคาและสรุป BOQ | ออกประมาณราคาแล้วอย่างน้อยหนึ่งฉบับ | รับบัญชีราคามาเฉย ๆ ยังไม่ได้ราคา |
 *
 * ขั้นที่กำลังทำอยู่คือขั้นแรกที่ยังไม่จบ ซึ่งแปลว่าไม่มีทางข้ามขั้น และไม่มีทางมีสองขั้นสว่างพร้อมกัน
 */

export type HomeStageTone = "done" | "now" | "wait";

export type HomeStage = {
  id: number;
  label: string;
  note: string;
  /** คำบนป้ายสถานะ — เป็นเลขจริงเมื่อมีเลขให้บอก */
  badge: string;
  tone: HomeStageTone;
};

/** ความคืบหน้าของแบบ นับข้ามทุกไฟล์ในโครงการ */
export type DrawingProgress = {
  documentCount: number;
  /** จำนวนหน้ารวมของแบบทุกไฟล์ · null = ไม่มีไฟล์ไหนบอกจำนวนหน้ามา ซึ่งไม่เท่ากับ 0 */
  pageCount: number | null;
  calibratedPages: number;
  /** สเกลที่ยืนยันล่าสุด เช่น "1:125" · null = ยังไม่เคยตั้งสเกล */
  scaleLabel: string | null;
  latestPage: number | null;
};

export type TakeoffProgress = {
  itemCount: number;
  confirmedItems: number;
  closedRuns: number;
};

export type PricingProgress = {
  priceSetCount: number;
  revisionCount: number;
};

export type HomeProgress = {
  drawing: DrawingProgress;
  takeoff: TakeoffProgress;
  pricing: PricingProgress;
};

/**
 * ชื่อสี่ขั้น ต้องตรงกับทะเบียนแอปและการ์ดบนหน้าโครงการเป๊ะ
 * เทสต์ในไฟล์คู่กันเทียบกับ `platformApps` ให้ ไม่ให้ชุดคำแตกเป็นสามชุดอีก
 */
const STAGE_LABELS = [
  "ตั้งค่าโครงการ",
  "เปิดแบบและยืนยันสเกล",
  "ถอดปริมาณพร้อมหลักฐาน",
  "ประมาณราคาและสรุป BOQ"
] as const;

const STAGE_NOTES = [
  "ใส่ชื่อโครงการ ชื่อผู้ประมาณราคา และประเภทงาน",
  "เปิดไฟล์แบบ PDF แล้วตั้งสเกลของแต่ละหน้าที่จะวัด",
  "วัดบนแบบ ระบบจดที่มาของทุกตัวเลขให้เอง",
  "ดึงราคาจากบัญชีราคาที่รับมา แล้วออก BOQ"
] as const;

/**
 * สี่ขั้นตอนที่ยังไม่มีโครงการสักใบ — ขั้นหนึ่งคือสิ่งที่ต้องทำ ไม่ใช่สิ่งที่ทำเสร็จแล้ว
 *
 * แยกออกจาก `homeStages` เพราะกติกาต่างกันจริง ไม่ใช่ต่างกันแค่คำ: `homeStages` ตั้งอยู่บน
 * สมมติฐานว่ามีแถวโครงการอยู่แล้ว ขั้นหนึ่งจึงจบเสมอ ส่วนที่นี่ยังไม่มีอะไรเลย
 */
export function firstRunStages(): HomeStage[] {
  return STAGE_LABELS.map((label, index) => ({
    id: index + 1,
    label,
    note: STAGE_NOTES[index],
    badge: index === 0 ? "เริ่มที่นี่" : "ยังไม่เริ่ม",
    tone: index === 0 ? "now" : "wait"
  }));
}

/** ขั้นแรกที่ยังไม่จบ · 4 เมื่อออกประมาณราคาแล้ว เพราะไม่มีขั้นที่ห้า */
export function currentStage(progress: HomeProgress): number {
  if (progress.drawing.calibratedPages === 0) return 2;
  if (progress.takeoff.confirmedItems === 0) return 3;
  if (progress.pricing.revisionCount === 0) return 4;
  return 4;
}

function drawingBadge(drawing: DrawingProgress): string {
  if (drawing.documentCount === 0) return "ยังไม่ได้เปิดแบบ";
  if (drawing.calibratedPages === 0) return "เปิดแบบแล้ว ยังไม่ได้ตั้งสเกล";
  if (drawing.pageCount === null) return `ตั้งสเกลแล้ว ${drawing.calibratedPages} หน้า`;
  return `ตั้งสเกลแล้ว ${drawing.calibratedPages} จาก ${drawing.pageCount} หน้า`;
}

function takeoffBadge(takeoff: TakeoffProgress): string {
  if (takeoff.itemCount === 0 && takeoff.closedRuns === 0) return "ยังไม่เริ่ม";
  if (takeoff.itemCount === 0) return `ปิดรอบแล้ว ${takeoff.closedRuns} รอบ`;
  return `${takeoff.itemCount} รายการ ยืนยันแล้ว ${takeoff.confirmedItems}`;
}

function pricingBadge(pricing: PricingProgress): string {
  if (pricing.priceSetCount === 0) return "ยังไม่มีบัญชีราคา";
  if (pricing.revisionCount === 0) return `รับมาแล้ว ${pricing.priceSetCount} บัญชี`;
  return `ออกประมาณราคาแล้ว ${pricing.revisionCount} ครั้ง`;
}

export function homeStages(progress: HomeProgress): HomeStage[] {
  const here = currentStage(progress);
  const badges = ["เสร็จแล้ว", drawingBadge(progress.drawing), takeoffBadge(progress.takeoff), pricingBadge(progress.pricing)];

  return STAGE_LABELS.map((label, index) => {
    const id = index + 1;
    return {
      id,
      label,
      note: STAGE_NOTES[index],
      badge: badges[index],
      tone: id < here ? "done" : id === here ? "now" : "wait"
    };
  });
}

/**
 * บรรทัดสีส้มในการ์ดงานค้าง — บอกสิ่งถัดไปที่ต้องทำ เป็นประโยคเดียว
 *
 * ทุกประโยคพูดถึงของที่นับได้จริงเท่านั้น กรณีที่ไม่มีเลขให้บอก ก็ไม่มีเลขในประโยค
 * ห้ามเติมคำว่า "อีกไม่กี่หน้า" หรือประมาณการใด ๆ ที่ฐานข้อมูลไม่ได้บอก
 */
export function nextActionLine(progress: HomeProgress): string {
  const { drawing, takeoff, pricing } = progress;
  const here = currentStage(progress);

  if (here === 2) {
    if (drawing.documentCount === 0) return "ยังไม่ได้เปิดไฟล์แบบเข้ามา เริ่มจากเปิดหน้าแบบแล้วเลือกไฟล์ PDF จากเครื่อง";
    return "เปิดแบบไว้แล้ว แต่ยังไม่ได้ตั้งสเกลสักหน้า เครื่องมือวัดบนหน้าที่ยังไม่ตั้งสเกลจะกดไม่ได้";
  }

  if (here === 3) {
    const scale =
      drawing.latestPage !== null && drawing.scaleLabel
        ? `หน้า ${drawing.latestPage} ตั้งสเกล ${drawing.scaleLabel} แล้ว`
        : `ตั้งสเกลแล้ว ${drawing.calibratedPages} หน้า`;
    const rest =
      drawing.pageCount !== null && drawing.pageCount > drawing.calibratedPages
        ? ` ที่เหลืออีก ${drawing.pageCount - drawing.calibratedPages} หน้ายังไม่ได้ตั้ง`
        : "";
    const waiting = takeoff.itemCount > 0 ? ` · มี ${takeoff.itemCount} รายการรอยืนยัน` : "";
    return `${scale}${rest}${waiting}`;
  }

  if (pricing.priceSetCount === 0) {
    return `ยืนยันปริมาณแล้ว ${takeoff.confirmedItems} รายการ ยังไม่มีบัญชีราคา หยิบราคาจากแอปราคาวัสดุแล้วส่งเข้ามาได้`;
  }
  if (pricing.revisionCount === 0) {
    return `รับบัญชีราคามาแล้ว ${pricing.priceSetCount} บัญชี ยังไม่ได้ออกประมาณราคา`;
  }
  return `ออกประมาณราคาแล้ว ${pricing.revisionCount} ครั้ง เปิดดูหรือออกฉบับใหม่ได้`;
}
