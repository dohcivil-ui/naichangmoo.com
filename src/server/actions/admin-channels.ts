"use server";

import { revalidatePath } from "next/cache";
import { setChannel } from "@/server/platform-channels";
import { resolvePlatformAdmin } from "@/server/platform-admin";

export type ChannelFormState = { ok: boolean; message: string };

/**
 * ตรวจสิทธิ์ซ้ำที่นี่แม้ layout จะกันแล้ว — server action เป็นประตูของตัวเอง ใครยิงตรงมาก็ถึง
 * revalidate ทั้งเว็บด้วย layout เพราะท้ายเว็บอยู่ทุกหน้า: สิ่งที่ผู้ดูแลกรอกที่นี่คือสิ่งที่ทุกหน้าพูดต่อ
 */
export async function saveChannel(
  _previous: ChannelFormState | undefined,
  formData: FormData
): Promise<ChannelFormState> {
  const auth = await resolvePlatformAdmin();
  if (!auth.ok) return { ok: false, message: "ไม่มีสิทธิ์ดำเนินการนี้" };

  const key = String(formData.get("key") ?? "").trim();
  const clear = String(formData.get("intent") ?? "") === "clear";
  const value = clear ? null : String(formData.get("value") ?? "");
  const reason = String(formData.get("reason") ?? "");

  let result;
  try {
    result = await setChannel({ key, value, reason, actorId: auth.admin.userId });
  } catch {
    return { ok: false, message: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }

  if (!result.ok) {
    if (result.reason === "reason_required") return { ok: false, message: "ต้องระบุเหตุผลอย่างน้อย 4 ตัวอักษร" };
    if (result.reason === "invalid_value") return { ok: false, message: result.message ?? "ค่าที่กรอกไม่ถูกต้อง" };
    return { ok: false, message: "ไม่รู้จักช่องทางนี้" };
  }

  revalidatePath("/admin/channels");
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: clear
      ? "ล้างค่าแล้ว ช่องนี้จะหายจากท้ายเว็บทุกหน้าทันที"
      : "บันทึกแล้ว ช่องนี้ขึ้นท้ายเว็บทุกหน้าทันที และเขียนบันทึกการเปลี่ยนแปลงไว้เรียบร้อย"
  };
}
