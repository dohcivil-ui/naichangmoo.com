import { and, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { assistantProposals } from "@/db/schema";
import type { EffectiveEntitlementState } from "@/lib/entitlement";
import { thaiDayStart, thaiMonthStart, thaiNextMonthStart } from "@/lib/thai-time";
import type { AssistantQuotaView } from "@/server/ai/assistant-contract";
import { BAHT_PER_USD } from "@/server/ai/provider";
import { consumeRateLimit, readRateLimit } from "@/server/rate-limit";

/**
 * เพดานการใช้ผู้ช่วย — ที่เดียวที่รู้จักตัวเลข
 *
 * สามชั้น และแต่ละชั้นกันคนละอย่าง ไม่ใช่ชั้นเดียวกันที่ตั้งค่าต่างกัน
 *
 *   **ต่อคนต่อเดือน** คือคำสัญญาเชิงพาณิชย์ที่ผู้ใช้เห็น นับรวมข้ามทุกแอปเป็นถังเดียว
 *   เพราะสิ่งที่เราขายคือ "ผู้ช่วย" ไม่ใช่ "ผู้ช่วยของแอปนั้น" และถังแยกรายแอปจะทำให้
 *   คนที่ใช้แอปเดียวหนัก ๆ ถูกปฏิเสธทั้งที่ยอดรวมยังไม่ถึงครึ่ง
 *
 *   **ต่อคนต่อนาที** กันการกดรัว นับตอนกดส่ง ไม่ใช่ตอนสำเร็จ เพราะสิ่งที่มันกันคือ
 *   *การกด* ไม่ใช่ *ผลลัพธ์* — การนับเฉพาะตอนสำเร็จจะทำให้คนที่ยิงคำขอที่ล้มเหลวรัว ๆ
 *   ไม่โดนอะไรเลย ทั้งที่นั่นคือรูปแบบที่อันตรายที่สุด
 *
 *   **ค่าใช้จ่ายรวมทั้งแพลตฟอร์มต่อวัน** คือเบรกมือ ไม่ใช่เพดานของใครคนหนึ่ง มันมีไว้กัน
 *   วันที่บั๊กวนซ้ำเผาเงินข้ามคืน ทะลุแล้วผู้ช่วยดับทั้งระบบพร้อมข้อความบอกผู้ใช้ ไม่ใช่เงียบ
 *   และนับจาก **ค่าใช้จ่ายจริง** ที่บันทึกไว้ ไม่ใช่จำนวนครั้งคูณราคาที่เดาเอา เพราะราคาต่อครั้ง
 *   ต่างกันได้หลายเท่าเมื่อทักษะคนละตัวใช้รุ่นคนละรุ่น
 *
 * ตัวเลขทุกตัวเป็นค่าชั่วคราวรอราคาขาย (IP-081) และแก้ได้ด้วย `.env` โดยไม่ต้องแก้โค้ด
 */

const envNumber = (name: string, fallback: number): number => {
  const raw = process.env[name];
  const parsed = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

/**
 * ครั้งต่อเดือนตามหมวดสิทธิ์ ที่ต้นทุนวัดจริง 0.22 บาทต่อครั้ง เพดาน 300 ครั้งคือราว 66 บาทต่อเดือน
 *
 * `viaAdministrator` มีโควตาของตัวเองแยกต่างหาก ไม่ใช่ยืมของหมวดใดหมวดหนึ่ง
 *
 * เพราะผู้ดูแลที่ผ่านด่านสิทธิ์มาได้ด้วยการเป็นผู้ดูแล ไม่มีแถว entitlement ให้อ่านสถานะ
 * สถานะที่ได้จึงเป็น `not_activated` ซึ่งเพดานเป็นศูนย์ตามนิยาม ถ้าไม่แยกออกมา ผู้ดูแลจะถูก
 * ปฏิเสธทุกครั้งทั้งที่เพิ่งอนุญาตให้ผ่าน — ซึ่งเป็นบั๊กที่เทสต์ของปลอมมองไม่เห็น เพราะมันตั้ง
 * สถานะเองได้ และเป็นบั๊กที่การยิงจริงครั้งแรกจับได้ทันที
 *
 * ตัวเลขแยกยังทำให้ค่าใช้จ่ายของการทดสอบภายในมองเห็นได้ในบัญชี ไม่ปนกับของลูกค้า
 */
export function monthlyCapFor(state: EffectiveEntitlementState, viaAdministrator = false): number {
  if (viaAdministrator) return envNumber("ASSISTANT_CAP_ADMIN", 100);
  switch (state) {
    case "active":
      return envNumber("ASSISTANT_CAP_ACTIVE", 300);
    case "doh_staff_only":
      return envNumber("ASSISTANT_CAP_DOH_STAFF", 100);
    case "member_free":
      return envNumber("ASSISTANT_CAP_MEMBER_FREE", 30);
    case "trial":
      return envNumber("ASSISTANT_CAP_TRIAL", 20);
    default:
      // สถานะที่เหลือไม่มีสิทธิ์ `run_ai` อยู่แล้ว ด่านสิทธิ์ปฏิเสธก่อนจะมาถึงบรรทัดนี้
      return 0;
  }
}

export const perMinuteCap = () => envNumber("ASSISTANT_CAP_PER_MINUTE", 5);

/** เบรกมือรวมต่อวัน ตั้งเป็นบาทเพราะคนคิดเป็นบาท เก็บและเทียบเป็น micro USD */
export const dailySpendCapMicroUsd = () =>
  Math.round((envNumber("ASSISTANT_DAILY_SPEND_BAHT", 300) / BAHT_PER_USD) * 1_000_000);

const MONTH_SCOPE = "ai:month";
const MINUTE_SCOPE = "ai:minute";
const MINUTE_MS = 60_000;

/** ถังเดือนถือเป็นหน้าต่างเดียวยาวทั้งเดือน จึงส่งขอบเขตของเดือนไทยเข้าไปเอง */
const monthWindow = (now: Date) => ({ windowStart: thaiMonthStart(now), resetAt: thaiNextMonthStart(now) });

export type QuotaCheck =
  | { ok: true; view: AssistantQuotaView }
  | { ok: false; reason: "over_monthly_cap"; message: string; view: AssistantQuotaView };

const view = (used: number, limit: number, resetsAt: Date): AssistantQuotaView => ({
  used,
  limit,
  resetsAtIso: resetsAt.toISOString()
});

/** อ่านยอดใช้ของเดือนนี้โดยไม่บวก ใช้ตอนตรวจก่อนเรียกแบบจำลอง */
export async function checkMonthlyQuota(
  userId: string,
  state: EffectiveEntitlementState,
  now = new Date(),
  viaAdministrator = false
): Promise<QuotaCheck> {
  const limit = monthlyCapFor(state, viaAdministrator);
  const window = monthWindow(now);
  const result = await readRateLimit(MONTH_SCOPE, userId, { limit, windowMs: 0 }, now.getTime(), window);
  const current = view(result.count, limit, window.resetAt);

  if (!result.allowed) {
    return {
      ok: false,
      reason: "over_monthly_cap",
      message: `ใช้ผู้ช่วยครบ ${limit} ครั้งของเดือนนี้แล้ว โควตาจะคืนให้ต้นเดือนหน้า`,
      view: current
    };
  }
  return { ok: true, view: current };
}

/** บวกหนึ่งครั้งหลังแบบจำลองตอบสำเร็จแล้วเท่านั้น */
export async function consumeMonthlyQuota(
  userId: string,
  state: EffectiveEntitlementState,
  now = new Date(),
  viaAdministrator = false
): Promise<AssistantQuotaView> {
  const limit = monthlyCapFor(state, viaAdministrator);
  const window = monthWindow(now);
  const result = await consumeRateLimit(MONTH_SCOPE, userId, { limit, windowMs: 0 }, now.getTime(), window);
  return view(result.count, limit, window.resetAt);
}

/** นับตอนกดส่ง เพราะสิ่งที่กันคือการกด ไม่ใช่ผลลัพธ์ */
export async function consumeBurstAllowance(userId: string, now = new Date()): Promise<boolean> {
  const result = await consumeRateLimit(MINUTE_SCOPE, userId, { limit: perMinuteCap(), windowMs: MINUTE_MS }, now.getTime());
  return result.allowed;
}

export type SpendBrake = { ok: true; spentMicroUsd: number } | { ok: false; spentMicroUsd: number; capMicroUsd: number };

/**
 * ยอดใช้จ่ายจริงของทั้งแพลตฟอร์มตั้งแต่ต้นวันไทย
 *
 * นับแถวที่จองไว้แล้วยังไม่สำเร็จด้วย เพราะเงินของคำขอที่ล้มกลางทางก็ออกไปแล้วเหมือนกัน
 * เบรกที่มองข้ามคำขอที่ล้ม จะปล่อยให้บั๊กวนซ้ำที่ล้มทุกครั้งเผาเงินได้ไม่จำกัด
 */
export async function checkDailySpendBrake(now = new Date()): Promise<SpendBrake> {
  const cap = dailySpendCapMicroUsd();
  const [row] = await getDb()
    .select({ total: sql<string>`coalesce(sum(${assistantProposals.costMicroUsd}), 0)` })
    .from(assistantProposals)
    .where(and(gte(assistantProposals.createdAt, thaiDayStart(now))));

  const spent = Number(row?.total ?? 0);
  if (spent >= cap) return { ok: false, spentMicroUsd: spent, capMicroUsd: cap };
  return { ok: true, spentMicroUsd: spent };
}
