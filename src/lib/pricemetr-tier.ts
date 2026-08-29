import { resolveEntitlement, type EffectiveEntitlementState, type Entitlement } from "@/lib/entitlement";

/**
 * PRICEMETR — สามระดับสิทธิ์ แปลจาก `docs/requirements/pricemetr-membership.md` เป็นตัวเลข
 *
 * ไฟล์นี้ตั้งใจไม่รู้จักฐานข้อมูล ไม่รู้จัก session และไม่รู้จัก Next เลย มันรับสถานะเข้ามาแล้ว
 * ตอบว่าได้อะไรบ้าง เท่านั้น เพราะการตัดสินสิทธิ์คือส่วนที่ต้องทดสอบให้ครบทุกสถานะ และการ
 * ทดสอบที่ต้องยก Postgres ขึ้นมาก่อนคือการทดสอบที่จะไม่มีใครรัน
 *
 * ทำไมไม่ไปเติมใน `entitlement.ts` — `STATE_POLICY` ที่นั่นเป็นตารางของ ESTIMETR ทั้งใบ
 * (projectLimit, exportEnabled, printEnabled, aiEnabled) และมีอีกหกแอปพึ่งมันอยู่ การเอา
 * "จำนวนเดือนย้อนหลัง" กับ "จำนวนบรรทัดที่หยิบได้" ซึ่งเป็นศัพท์ของแอปเดียวไปแขวนไว้ในนั้น
 * จะทำให้ทุกแอปต้องแบกช่องที่ตัวเองไม่ใช้ ไฟล์นี้จึง **เรียก** ของกลางใช้ ไม่ได้ลอกมาเขียนใหม่
 */

export const PRICEMETR_APP_SLUG = "pricemetr";

/** กราฟย้อนหลังของคนที่ยังไม่ได้จ่าย ตามตารางข้อ 2 ของเอกสารเส้นแบ่ง */
export const FREE_HISTORY_MONTHS = 6;

/**
 * ย้อนหลังเต็มของ VIP นับจากมกราคม 2545 ที่ต้นทางเริ่มมีข้อมูล คือ 24 ปี = 288 เดือน
 *
 * เป็นตัวเลขมีขอบ ไม่ใช่ไม่จำกัด เพราะค่านี้ไปจบที่คำขอจริงไปยัง สนค. คำขอที่ขอ 9,999 เดือน
 * คือคำขอที่ทำให้ต้นทางช้าลงโดยไม่มีใครได้อะไรเพิ่ม ขอบนี้ขยับได้เมื่อต้นทางมีข้อมูลเก่ากว่านี้
 */
export const VIP_HISTORY_MONTHS = 288;

/** สมาชิกฟรีหยิบราคาเข้ารายการได้กี่บรรทัด — คำวินิจฉัยเจ้าของงาน 2026-08-29 */
export const FREE_LINE_LIMIT = 50;

export type PricemetrTier = "visitor" | "member_free" | "vip";

export type PricemetrAllowance = {
  tier: PricemetrTier;
  /** จำนวนเดือนย้อนหลังสูงสุดที่เซิร์ฟเวอร์จะตอบให้ ไม่ว่าหน้าจอจะขอมาเท่าไร */
  historyMonths: number;
  /** จำนวนบรรทัดสูงสุดของรายการที่หยิบไว้ · null คือไม่จำกัด */
  lineLimit: number | null;
  canPickLines: boolean;
  canExportSummary: boolean;
};

const ALLOWANCE: Record<PricemetrTier, Omit<PricemetrAllowance, "tier">> = {
  // ผู้มาเยือนเห็นราคาครบเท่าสมาชิกฟรี ห้ามเบลอ ห้ามสุ่ม ห้ามตัดทอน — ข้อห้ามข้อ 1
  // ที่ต่างคือหยิบเข้ารายการไม่ได้ เพราะรายการต้องผูกบัญชีถึงจะเก็บข้ามเครื่องได้
  visitor: { historyMonths: FREE_HISTORY_MONTHS, lineLimit: 0, canPickLines: false, canExportSummary: false },
  member_free: { historyMonths: FREE_HISTORY_MONTHS, lineLimit: FREE_LINE_LIMIT, canPickLines: true, canExportSummary: false },
  vip: { historyMonths: VIP_HISTORY_MONTHS, lineLimit: null, canPickLines: true, canExportSummary: true }
};

/**
 * สถานะสิทธิ์ของแพลตฟอร์ม → ระดับของแอปนี้
 *
 * `expired_read_only` ตกลงมาเป็นสมาชิกฟรี ไม่ใช่ผู้มาเยือน เพราะ VIP ที่หมดอายุยังเป็นสมาชิก
 * ของแพลตฟอร์มอยู่ การถีบเขากลับไปเท่าคนที่ไม่เคยสมัครคือการลงโทษที่ไม่มีใครสั่ง
 *
 * `suspended` ลงมาเป็นผู้มาเยือน คือยังอ่านราคาได้ (เป็นข้อมูลเปิด ไม่มีใครห้ามได้)
 * แต่หยิบเข้ารายการไม่ได้
 */
const TIER_OF_STATE: Record<EffectiveEntitlementState, PricemetrTier> = {
  active: "vip",
  trial: "vip",
  member_free: "member_free",
  doh_staff_only: "member_free",
  not_activated: "member_free",
  not_started: "member_free",
  expired_read_only: "member_free",
  suspended: "visitor"
};

export type TierInput = {
  signedIn: boolean;
  /** null เมื่อยังไม่มีแถวสิทธิ์ ซึ่งเป็นกรณีปกติของสมาชิกฟรี ไม่ใช่กรณีผิดพลาด */
  entitlement: Entitlement | null;
  /** สวิตช์ปิดของทะเบียนแอป ชนะทุกอย่าง */
  appEnabled?: boolean;
};

export function resolvePricemetrTier(input: TierInput, now = new Date()): PricemetrTier {
  if (!input.signedIn) return "visitor";
  if (input.appEnabled === false) return "visitor";
  // ไม่มีแถว = สมาชิกฟรี และไม่มีอะไรต้องเขียนลงฐานข้อมูล — ADR 0023
  if (!input.entitlement) return "member_free";
  return TIER_OF_STATE[resolveEntitlement(input.entitlement, now)];
}

export function allowanceOf(tier: PricemetrTier): PricemetrAllowance {
  return { tier, ...ALLOWANCE[tier] };
}

export function resolvePricemetrAllowance(input: TierInput, now = new Date()): PricemetrAllowance {
  return allowanceOf(resolvePricemetrTier(input, now));
}

/**
 * หนีบจำนวนเดือนที่หน้าจอขอมาให้อยู่ในสิทธิ์ — **หนีบ ไม่ใช่ปฏิเสธ**
 *
 * คำขอที่เกินสิทธิ์ไม่ใช่การโจมตี มันคือหน้าจอที่ขอเผื่อไว้ การตอบ 403 กลับไปแปลว่ากราฟหาย
 * ทั้งใบทั้งที่หกเดือนแรกเขามีสิทธิ์เต็ม ๆ ผู้เรียกต้องบอกกลับไปด้วยว่าให้มาเท่าไร เพื่อให้
 * หน้าจอพูดความจริงได้ ไม่ใช่เดาเอง — ข้อห้ามข้อ 3 ของเอกสารเส้นแบ่ง
 */
export function clampHistoryMonths(requested: number | undefined, allowance: PricemetrAllowance): number {
  const asked = Number.isFinite(requested) && (requested as number) > 0 ? Math.floor(requested as number) : FREE_HISTORY_MONTHS;
  return Math.min(asked, allowance.historyMonths);
}

/** เหลือหยิบได้อีกกี่บรรทัด · null คือไม่จำกัด ใช้ทั้งฝั่งหน้าจอและฝั่งเซิร์ฟเวอร์ตอน IP-163 มาถึง */
export function remainingLines(allowance: PricemetrAllowance, picked: number): number | null {
  if (allowance.lineLimit === null) return null;
  return Math.max(0, allowance.lineLimit - picked);
}

export function canPickAnotherLine(allowance: PricemetrAllowance, picked: number): boolean {
  if (!allowance.canPickLines) return false;
  const left = remainingLines(allowance, picked);
  return left === null || left > 0;
}
