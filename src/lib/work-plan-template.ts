import type { Milestone } from "./payment-milestone";
import { WEIGHT_SCALE, type PlanActivity } from "./work-plan";

/**
 * แม่แบบสำหรับร่างแผนงานจากค่าตั้งต้นเพียงไม่กี่ค่า
 *
 * แม่แบบเดียวที่มีในตอนนี้ถอดมาจาก **ตัวอย่างโครงการจริงในหนังสือหลักสูตร วสท.** หน้า 92-96
 * (65,000,000 บาท 14 เดือน) ทั้งรายการงาน สัดส่วนค่างาน และลำดับก่อนหลัง ไม่ได้แต่งขึ้นเอง
 * รายละเอียดอยู่ใน `docs/research/s-curve-rules-2026-08-25.md`
 *
 * ประเภทงานอื่นยังไม่มีแม่แบบ เพราะสัดส่วนค่างานของอาคารแต่ละแบบต้องถอดจากเอกสารงวดงาน
 * ของแบบมาตรฐานใน `km/แบบรูปรายการแบบมาตรฐาน… ปีงบประมาณ 2562/` ก่อน ซึ่งยังไม่ได้ทำ
 * หน้าจอจึงต้องบอกตรง ๆ ว่ายังไม่มี ไม่ใช่เดาสัดส่วนขึ้นมาให้ดูเหมือนมีของ — ตัวเลขที่ไม่มีที่มา
 * จะไหลเข้าไปอยู่ในเอกสารยื่นเบิกโดยที่ไม่มีใครรู้ว่ามันมาจากไหน
 */

export type TemplateId = "general-building" | "school-building" | "office-building" | "utility-work";

export type TemplateOption = {
  id: TemplateId;
  label: string;
  /** ที่มาของสัดส่วน หรือ null เมื่อยังไม่มีแม่แบบ */
  source: string | null;
};

export const templateOptions: readonly TemplateOption[] = [
  { id: "general-building", label: "อาคารทั่วไป", source: "ตัวอย่างในหนังสือหลักสูตร วสท. หน้า 92-96" },
  { id: "school-building", label: "อาคารเรียน", source: null },
  { id: "office-building", label: "อาคารสำนักงาน", source: null },
  { id: "utility-work", label: "งานระบบสาธารณูปโภค", source: null }
];

type TemplateLine = {
  number: string;
  title: string;
  /** ส่วนในล้านของค่างานทั้งโครงการ */
  weightPpm: number;
  /** จุดเริ่มและระยะเวลา เป็นสัดส่วนของระยะเวลาโครงการ อ้างจากตารางในหนังสือที่ยาว 420 วัน */
  startFraction: number;
  durationFraction: number;
};

const BOOK_PROJECT_DAYS = 420;
const day = (days: number) => days / BOOK_PROJECT_DAYS;

/**
 * สัดส่วนทั้งหมดต่อไปนี้คือค่างานหารด้วย 65,000,000 ของตัวอย่างในหนังสือ
 * เช่น งานผนังสำเร็จรูป 7,000,000 ÷ 65,000,000 = 107,692 ppm ซึ่งหนังสือพิมพ์ไว้ว่า 10.77%
 */
const generalBuilding: readonly TemplateLine[] = [
  { number: "1.1", title: "งานเตรียมการและวางผัง", weightPpm: 23_077, startFraction: day(0), durationFraction: day(30) },
  { number: "1.2", title: "งานเสาเข็ม", weightPpm: 30_769, startFraction: day(30), durationFraction: day(60) },
  { number: "1.3", title: "งานขุดและตัดหัวเข็ม", weightPpm: 7_692, startFraction: day(60), durationFraction: day(30) },
  { number: "1.4", title: "งานฐานราก", weightPpm: 30_769, startFraction: day(60), durationFraction: day(60) },
  { number: "1.5", title: "งานโครงสร้างชั้นล่าง", weightPpm: 102_564, startFraction: day(120), durationFraction: day(60) },
  { number: "1.6", title: "งานโครงสร้างชั้นกลาง", weightPpm: 102_564, startFraction: day(180), durationFraction: day(60) },
  { number: "1.7", title: "งานโครงสร้างชั้นบน", weightPpm: 102_564, startFraction: day(240), durationFraction: day(45) },
  { number: "1.8", title: "งานโครงสร้างหลังคา", weightPpm: 15_385, startFraction: day(270), durationFraction: day(30) },
  { number: "2.1", title: "งานผนังสำเร็จรูป", weightPpm: 107_692, startFraction: day(0), durationFraction: day(150) },
  { number: "2.2", title: "งานผนังก่ออิฐ", weightPpm: 46_154, startFraction: day(120), durationFraction: day(120) },
  { number: "2.3", title: "งานฉาบปูน", weightPpm: 69_231, startFraction: day(135), durationFraction: day(120) },
  { number: "2.4", title: "งานปูกระเบื้องพื้นและผนัง", weightPpm: 76_923, startFraction: day(150), durationFraction: day(120) },
  { number: "2.5", title: "งานฝ้าเพดาน", weightPpm: 23_077, startFraction: day(180), durationFraction: day(90) },
  { number: "2.6", title: "งานติดตั้งประตูและหน้าต่าง", weightPpm: 53_846, startFraction: day(270), durationFraction: day(30) },
  { number: "2.7", title: "งานทาสี", weightPpm: 27_692, startFraction: day(300), durationFraction: day(60) },
  { number: "2.8", title: "งานติดตั้งสุขภัณฑ์", weightPpm: 30_769, startFraction: day(345), durationFraction: day(30) },
  { number: "3.1", title: "งานระบบสุขาภิบาล", weightPpm: 73_846, startFraction: day(240), durationFraction: day(120) },
  { number: "3.2", title: "งานระบบไฟฟ้า", weightPpm: 67_692, startFraction: day(240), durationFraction: day(120) },
  { number: "3.3", title: "งานเก็บงานและทำความสะอาด", weightPpm: 7_692, startFraction: day(345), durationFraction: day(60) }
];

const templates: Partial<Record<TemplateId, readonly TemplateLine[]>> = {
  "general-building": generalBuilding
};

export const templateSource = (id: TemplateId): string | null =>
  templateOptions.find((option) => option.id === id)?.source ?? null;

export const hasTemplate = (id: TemplateId): boolean => templates[id] !== undefined;

/**
 * ร่างรายการงานจากมูลค่าสัญญาและระยะเวลา
 *
 * ค่างานของแต่ละกิจกรรมแบ่งจากมูลค่าสัญญาตามสัดส่วนของแม่แบบ และ **แบ่งให้ผลรวมเท่ามูลค่าสัญญาเป๊ะ**
 * โดยโยนเศษที่เหลือเข้ากิจกรรมสุดท้าย เพราะร่างที่ยอดรวมไม่ตรงสัญญาตั้งแต่บรรทัดแรก
 * คือร่างที่ผู้ใช้ต้องไล่แก้เองทุกครั้ง ซึ่งขัดกับเหตุผลที่มีปุ่มร่างให้ตั้งแต่ต้น
 */
export function draftActivities(
  templateId: TemplateId,
  contractSatang: bigint,
  durationDays: number
): PlanActivity[] {
  const lines = templates[templateId];
  if (!lines) return [];

  const span = Math.max(durationDays, 1);
  let allocated = 0n;

  return lines.map((line, index) => {
    const isLast = index === lines.length - 1;
    const costSatang = isLast
      ? contractSatang - allocated
      : (contractSatang * BigInt(line.weightPpm)) / WEIGHT_SCALE;
    allocated += costSatang;

    return {
      id: `draft-${line.number}`,
      number: line.number,
      title: line.title,
      startOffsetDays: Math.round(line.startFraction * span),
      durationDays: Math.max(Math.round(line.durationFraction * span), 1),
      costSatang
    };
  });
}

/**
 * ร่างการแบ่งงวดโดยตัดตามลำดับงาน ให้แต่ละงวดมีน้ำหนักใกล้เคียงกัน
 *
 * นี่เป็น **ข้อเสนอ ไม่ใช่คำตอบ** งวดงานจริงต้องตรงกับที่หน่วยงานอนุมัติ ผู้ใช้จึงย้ายกิจกรรม
 * ข้ามงวดได้ทุกตัวในแท็บงวดงาน และเมื่อย้ายแล้วยอดทุกงวดจะคำนวณใหม่ให้เอง
 */
export function draftMilestones(activities: readonly PlanActivity[], milestoneCount: number): Milestone[] {
  const count = Math.max(1, Math.min(milestoneCount, activities.length || 1));
  const totalCost = activities.reduce((sum, activity) => sum + activity.costSatang, 0n);
  const buckets: string[][] = Array.from({ length: count }, () => []);

  let running = 0n;
  for (const activity of activities) {
    running += activity.costSatang;
    const reached = totalCost > 0n ? Number((running * BigInt(count)) / totalCost) : 0;
    const index = Math.min(count - 1, Math.max(0, reached === 0 ? 0 : reached - 1));
    buckets[index]!.push(activity.id);
  }

  // งวดที่ว่างเปล่าอ่านแล้วเหมือนระบบลืมงาน จึงยุบทิ้งแล้วเรียงเลขใหม่ให้ต่อเนื่อง
  return buckets
    .filter((bucket) => bucket.length > 0)
    .map((activityIds, index) => ({
      id: `milestone-${index + 1}`,
      ordinal: index + 1,
      title: `งวดที่ ${index + 1}`,
      activityIds
    }));
}
