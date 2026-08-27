import { askForJson, type JsonResult, type ModelId } from "@/server/ai/provider";
import type { z } from "zod";

/**
 * ค่ายสำรองเมื่อค่ายหลักล้ม
 *
 * ตั้งอยู่บนข้อเท็จจริงที่วัดมาแล้วสองข้อ: DeepSeek V4 Flash แม่นกว่า GPT-5.4 mini ทุกเกณฑ์
 * แต่ใช้เวลา 95 วินาทีกับงานร่างแผน ซึ่งนานเกินกว่าที่คนจะนั่งรอหน้าจอ มันจึงไม่ใช่ตัวเลือกที่ดีกว่า
 * แต่เป็น **ตัวที่ทำให้เจ็ดแอปไม่ดับพร้อมกันตอน OpenAI ล่ม**
 *
 * สองเส้นแบ่งที่ทำให้ตัวสำรองไม่กลายเป็นเครื่องเผาเงิน
 *
 *   **สลับเฉพาะเมื่อค่ายหลักล้ม ไม่ใช่เมื่อมันไม่ชอบคำตอบ** — `refused` คือแบบจำลองตัดสินใจ
 *   ไม่ตอบ และ `unparsable` คือมันตอบผิดรูป ทั้งสองอย่างนี้เป็น *คำตอบ* การยิงซ้ำอีกค่าย
 *   จะได้ผลเหมือนเดิมเป็นส่วนใหญ่ แต่จ่ายเงินสองรอบทุกครั้ง
 *
 *   **เพดานเวลารวม** — ตัวสำรองได้เวลาเท่าที่เหลือจากเพดานรวม ไม่ได้เริ่มนับใหม่
 *   ไม่งั้นผู้ใช้ที่ควรรอไม่เกินหนึ่งนาที จะกลายเป็นรอสองนาทีในวันที่ระบบแย่ที่สุด
 */

/** เพดานเวลารวมของการเรียกหนึ่งครั้ง รวมตัวสำรองแล้ว */
export const ASSISTANT_DEADLINE_MS = Number(process.env.ASSISTANT_DEADLINE_MS ?? 60_000);

/** เหตุที่ควรลองค่ายสำรอง คือเหตุที่บอกว่าเราติดต่อค่ายหลักไม่ได้ ไม่ใช่ว่ามันตอบไม่ถูกใจ */
const TRANSPORT_FAILURES: ReadonlySet<string> = new Set(["failed", "no_api_key"]);

export type FailoverInput<T> = {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  schemaName: string;
  maxTokens?: number;
};

export type FailoverResult<T> = JsonResult<T> & { modelUsed?: ModelId; usedFallback?: boolean };

export async function askWithFallback<T>(
  primary: ModelId,
  fallback: ModelId | null,
  input: FailoverInput<T>,
  now = Date.now(),
  deadlineMs = ASSISTANT_DEADLINE_MS
): Promise<FailoverResult<T>> {
  const first = await askForJson(primary, { ...input, timeoutMs: deadlineMs }, now);
  if (first.ok) return { ...first, modelUsed: primary, usedFallback: false };
  if (!fallback || !TRANSPORT_FAILURES.has(first.reason)) return { ...first, modelUsed: primary, usedFallback: false };

  const remaining = deadlineMs - (Date.now() - now);
  if (remaining <= 0) {
    return {
      ok: false,
      reason: "failed",
      message: `${first.message} และหมดเวลาก่อนจะลองค่ายสำรอง ลองใหม่อีกครั้ง`,
      modelUsed: primary,
      usedFallback: false
    };
  }

  const second = await askForJson(fallback, { ...input, timeoutMs: remaining }, Date.now());
  if (second.ok) return { ...second, modelUsed: fallback, usedFallback: true };

  // รายงานอาการของค่ายหลักด้วย เพราะเป็นตัวที่ควรใช้ได้ และเป็นตัวที่ควรไปตามแก้
  return {
    ...second,
    message: `${second.message} (ค่ายหลักล้มก่อนหน้านี้: ${first.message})`,
    modelUsed: fallback,
    usedFallback: true
  };
}
