import type { PlanActivity } from "./work-plan";
import type { Milestone } from "./payment-milestone";
import type { IsoDate, MilestoneActual, MoneyEvent } from "./work-plan-actuals";

/**
 * เก็บงานที่ทำค้างไว้ในเบราว์เซอร์ ให้รีโหลดแล้วไม่หาย
 *
 * มีอยู่เพราะการกรอกสามยอดสามวันครบทุกงวดคืองานสิบนาที ถ้ารีเฟรชแล้วหาย เราจะไม่มีวัน
 * ทดสอบมันจริงจังได้เลย และผู้ใช้จะไม่มีวันกรอกจนจบ
 *
 * สามข้อที่กำหนดรูปร่างของโมดูลนี้:
 *
 * หนึ่ง — **`JSON.stringify` โยน TypeError ทันทีเมื่อเจอ BigInt** และเงินทั้งระบบเราเป็น BigInt สตางค์
 * จึงต้องแปลงเป็นสตริงสตางค์ตอนเขียน แล้วแปลงกลับตอนอ่าน ตัวแปลงอยู่ที่นี่และมี test คุม
 * ไม่ใช่เขียนสด ๆ ในคอมโพเนนต์ เพราะถ้าพลาดคือเงินเพี้ยนแบบเงียบ ๆ
 *
 * สอง — **อ่านไม่ผ่านให้ทิ้งแล้วเริ่มใหม่ ห้ามพังทั้งหน้า** ข้อมูลเก่าคนละรุ่น ข้อมูลที่คนแก้เอง
 * ในเครื่องมือนักพัฒนา หรือพื้นที่เต็มกลางคัน ล้วนทำให้ค่าที่อ่านมาไม่ตรงรูปร่าง
 * หน้าจอที่ขาวทั้งหน้าเพราะข้อมูลเก่าหนึ่งก้อน แย่กว่าการเริ่มใหม่
 *
 * สาม — **เก็บเฉพาะโครงการที่เปิดอยู่ และห้ามเก็บรูป** ระบบที่เราไปดูมาแสดงบนหน้าจอตัวเองว่า
 * ใช้พื้นที่ไปแล้ว 2.02 MB จากเพดานราว 4 MB ด้วยข้อมูลเพียงสามโครงการ
 * (`docs/research/changkid-easy-planning-hands-on-2026-08-26.md`) เพดานนี้เป็นของจริงและมาถึงเร็ว
 * ที่นี่จึงเป็นสะพานชั่วคราวไปฐานข้อมูลใน IP-139 เท่านั้น ไม่ใช่ที่เก็บถาวร
 */

export const WORK_PLAN_STORAGE_KEY = "naichangmoo.work-plan.v1";

/** ขึ้นเลขนี้เมื่อรูปร่างข้อมูลเปลี่ยนจนของเก่าอ่านไม่ได้ ของเก่าจะถูกทิ้งแล้วเริ่มใหม่ */
export const WORK_PLAN_SCHEMA_VERSION = 1;

export type StoredSetup = {
  projectName: string;
  contract: string;
  startDate: string;
  duration: string;
  templateId: string;
  advance: string;
  advanceRecovery: string;
  retention: string;
  retentionMethod: string;
  vat: string;
  withholding: string;
};

export type WorkPlanSnapshot = {
  setup: StoredSetup;
  activities: PlanActivity[];
  milestones: Milestone[];
  actuals: MilestoneActual[];
  /** ว่างได้ แปลว่ายังไม่เคยตั้งวันตัดข้อมูลเอง ให้ผู้เรียกไปคำนวณค่าตั้งต้น */
  dataDate: IsoDate | "";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const str = (value: unknown): string => (typeof value === "string" ? value : "");

/** สตริงสตางค์กลับเป็น BigInt โดยไม่ยอมรับอะไรที่ไม่ใช่จำนวนเต็ม */
const toSatang = (value: unknown): bigint | null => {
  if (typeof value !== "string" || !/^-?\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
};

const readEvent = (value: unknown): MoneyEvent | undefined => {
  if (!isRecord(value)) return undefined;
  const satang = toSatang(value.satang);
  const date = str(value.date);
  if (satang === null || date === "") return undefined;
  return { satang, date };
};

const writeEvent = (event: MoneyEvent | undefined) =>
  event ? { satang: event.satang.toString(), date: event.date } : undefined;

/**
 * แปลงภาพรวมทั้งใบเป็นข้อความ พร้อมกำกับรุ่นของรูปร่างข้อมูล
 *
 * ไม่ใช้ตัวแทนค่าของ `JSON.stringify` เพราะตัวแทนค่าที่แปลง BigInt ให้เองทั้งไฟล์
 * จะกลืนความผิดพลาดตอนอ่านกลับด้วย เราอยากให้ทุกช่องที่เป็นเงินถูกแปลงอย่างตั้งใจทีละช่อง
 */
export function serialiseWorkPlan(snapshot: WorkPlanSnapshot): string {
  return JSON.stringify({
    schemaVersion: WORK_PLAN_SCHEMA_VERSION,
    setup: snapshot.setup,
    dataDate: snapshot.dataDate,
    activities: snapshot.activities.map((activity) => ({
      id: activity.id,
      number: activity.number,
      title: activity.title,
      startOffsetDays: activity.startOffsetDays,
      durationDays: activity.durationDays,
      costSatang: activity.costSatang.toString()
    })),
    milestones: snapshot.milestones.map((milestone) => ({
      id: milestone.id,
      ordinal: milestone.ordinal,
      title: milestone.title,
      activityIds: [...milestone.activityIds]
    })),
    actuals: snapshot.actuals.map((actual) => ({
      milestoneId: actual.milestoneId,
      requested: writeEvent(actual.requested),
      certified: writeEvent(actual.certified),
      received: writeEvent(actual.received),
      note: actual.note,
      reference: actual.reference
    }))
  });
}

/**
 * อ่านกลับ พร้อมตรวจรูปร่างทุกชั้น คืน null เมื่ออ่านไม่ได้
 *
 * คืน null ดีกว่าคืนของครึ่ง ๆ กลาง ๆ เพราะบันทึกจริงที่ชี้ไปยังงวดที่ไม่มีตัวตน
 * แย่กว่าการไม่มีบันทึกเลย ผู้เรียกจะได้รู้ตัวและเริ่มใหม่
 */
export function parseWorkPlan(raw: string | null): WorkPlanSnapshot | null {
  if (!raw) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(value)) return null;
  if (value.schemaVersion !== WORK_PLAN_SCHEMA_VERSION) return null;
  if (!isRecord(value.setup) || !Array.isArray(value.activities) || !Array.isArray(value.milestones)) return null;

  const setupSource = value.setup;
  const setup: StoredSetup = {
    projectName: str(setupSource.projectName),
    contract: str(setupSource.contract),
    startDate: str(setupSource.startDate),
    duration: str(setupSource.duration),
    templateId: str(setupSource.templateId),
    advance: str(setupSource.advance),
    advanceRecovery: str(setupSource.advanceRecovery),
    retention: str(setupSource.retention),
    retentionMethod: str(setupSource.retentionMethod),
    vat: str(setupSource.vat),
    withholding: str(setupSource.withholding)
  };

  const activities: PlanActivity[] = [];
  for (const entry of value.activities) {
    if (!isRecord(entry)) return null;
    const costSatang = toSatang(entry.costSatang);
    const id = str(entry.id);
    if (costSatang === null || id === "") return null;
    if (typeof entry.startOffsetDays !== "number" || typeof entry.durationDays !== "number") return null;
    activities.push({
      id,
      number: str(entry.number),
      title: str(entry.title),
      startOffsetDays: entry.startOffsetDays,
      durationDays: entry.durationDays,
      costSatang
    });
  }

  const known = new Set(activities.map((activity) => activity.id));

  const milestones: Milestone[] = [];
  for (const entry of value.milestones) {
    if (!isRecord(entry)) return null;
    const id = str(entry.id);
    if (id === "" || typeof entry.ordinal !== "number") return null;
    const ids = Array.isArray(entry.activityIds) ? entry.activityIds.filter((one): one is string => typeof one === "string") : [];
    milestones.push({
      id,
      ordinal: entry.ordinal,
      title: str(entry.title),
      // ทิ้งงานที่ถูกลบไปแล้วแต่ยังค้างอยู่ในงวด ไม่งั้นน้ำหนักจะหายไปเงียบ ๆ
      activityIds: ids.filter((one) => known.has(one))
    });
  }

  const milestoneIds = new Set(milestones.map((milestone) => milestone.id));

  const actuals: MilestoneActual[] = [];
  if (value.actuals !== undefined) {
    if (!Array.isArray(value.actuals)) return null;
    for (const entry of value.actuals) {
      if (!isRecord(entry)) return null;
      const milestoneId = str(entry.milestoneId);
      // บันทึกจริงที่ชี้ไปยังงวดที่ไม่มีอยู่แล้ว ต้องทิ้ง ไม่ใช่เก็บไว้ให้ยอดเพี้ยน
      if (milestoneId === "" || !milestoneIds.has(milestoneId)) continue;
      actuals.push({
        milestoneId,
        requested: readEvent(entry.requested),
        certified: readEvent(entry.certified),
        received: readEvent(entry.received),
        note: typeof entry.note === "string" ? entry.note : undefined,
        reference: typeof entry.reference === "string" ? entry.reference : undefined
      });
    }
  }

  return { setup, activities, milestones, actuals, dataDate: str(value.dataDate) };
}

/**
 * เขียนลงเบราว์เซอร์ คืน false เมื่อเขียนไม่ได้
 *
 * `localStorage` โยน error ได้จริงในหน้าต่างส่วนตัว ในเบราว์เซอร์ที่ปิดการเก็บข้อมูลเว็บ
 * และเมื่อพื้นที่เต็ม — สามกรณีนี้ไม่ใช่ของหายาก จึงต้องคืนผลให้ผู้เรียกบอกผู้ใช้ได้
 * ห้ามกลืนเงียบ เพราะผู้ใช้จะเข้าใจว่างานถูกบันทึกแล้วทั้งที่ไม่ได้บันทึก
 */
export function saveWorkPlan(snapshot: WorkPlanSnapshot): boolean {
  if (typeof window === "undefined") return false;
  let ok = false;
  try {
    window.localStorage.setItem(WORK_PLAN_STORAGE_KEY, serialiseWorkPlan(snapshot));
    ok = true;
  } catch {
    ok = false;
  }
  // แจ้งเฉพาะตอนผลเปลี่ยน เพื่อไม่ให้ทุกการพิมพ์หนึ่งตัวอักษรกลายเป็นการวาดหน้าจอใหม่ทั้งหน้า
  if (lastSaveFailed === ok) {
    lastSaveFailed = !ok;
    window.dispatchEvent(new Event(STORE_CHANGED));
  }
  return ok;
}

/**
 * ที่เก็บภายนอกขนาดเล็กสำหรับ `useSyncExternalStore`
 *
 * มีอยู่เพราะสองอย่างที่ React ต้องการรู้ ไม่ได้อยู่ในสถานะของคอมโพเนนต์:
 * เนื้อหาที่ค้างอยู่ในเบราว์เซอร์ตอนเปิดหน้า และผลของการเขียนครั้งล่าสุด
 * ทั้งคู่เป็นค่าที่เซิร์ฟเวอร์มองไม่เห็น ซึ่งเป็นงานที่ `useSyncExternalStore` ถูกสร้างมาเพื่อทำ
 * และเป็นแบบแผนเดียวกับที่ `cookie-notice.tsx` ใช้อยู่แล้วในโปรเจกต์นี้
 */
const STORE_CHANGED = "naichangmoo:work-plan-store";

/** สแนปช็อตฝั่งเซิร์ฟเวอร์คงที่เสมอ เพื่อให้การ hydrate ตรงกันแล้วค่อยสลับเป็นของจริง */
const SERVER_RAW = "";

let lastSaveFailed = false;

export function subscribeWorkPlanStore(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(STORE_CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(STORE_CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function getWorkPlanRaw(): string {
  if (typeof window === "undefined") return SERVER_RAW;
  try {
    return window.localStorage.getItem(WORK_PLAN_STORAGE_KEY) ?? SERVER_RAW;
  } catch {
    return SERVER_RAW;
  }
}

export const getWorkPlanServerRaw = (): string => SERVER_RAW;

/** true เมื่อการเขียนครั้งล่าสุดล้มเหลว ใช้บอกผู้ใช้ว่างานที่ทำอยู่จะหาย */
export const getSaveFailed = (): boolean => lastSaveFailed;
export const getSaveFailedOnServer = (): boolean => false;

export function loadWorkPlan(): WorkPlanSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    return parseWorkPlan(window.localStorage.getItem(WORK_PLAN_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function clearWorkPlan(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(WORK_PLAN_STORAGE_KEY);
  } catch {
    // ลบไม่ได้ก็ไม่เป็นไร รอบหน้าที่อ่านไม่ผ่านจะถูกทิ้งเองอยู่แล้ว
  }
}
