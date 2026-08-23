"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getPlatformSessionUser } from "@/lib/auth-session";
import { ESTIMETR_TRIAL_DAYS } from "@/lib/estimeter-trial";
import { activateEstimeterTrial } from "@/server/estimeter-access";

export type TrialActivationState = { ok: boolean; message: string };

/**
 * Gate 2 of ADR 0006. This is the only place a trial is issued, and it only runs because the
 * member pressed the control next to the terms, so the audit record it writes is real consent.
 */
export async function startEstimeterTrial(
  previous: TrialActivationState | undefined,
  formData: FormData
): Promise<TrialActivationState> {
  void previous;
  void formData;
  const user = await getPlatformSessionUser(await headers());
  if (!user) return { ok: false, message: "ต้องเข้าสู่ระบบด้วยบัญชีนายช่างหมูก่อนเริ่มทดลองใช้" };

  let result;
  try {
    result = await activateEstimeterTrial(user.id);
  } catch {
    return { ok: false, message: "ขณะนี้เปิดสิทธิ์ทดลองใช้ไม่ได้ กรุณาลองใหม่อีกครั้ง" };
  }

  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "already_activated"
          ? "บัญชีนี้เริ่มทดลองใช้ ESTIMETR ไปแล้ว การกดซ้ำไม่ต่อเวลาให้"
          : "ไม่พบบัญชีสมาชิกนี้ กรุณาเข้าสู่ระบบใหม่"
    };
  }

  revalidatePath("/apps/estimeter");
  return { ok: true, message: `เริ่มทดลองใช้แล้ว สิทธิ์ใช้งานได้ ${ESTIMETR_TRIAL_DAYS} วันนับจากนี้` };
}
