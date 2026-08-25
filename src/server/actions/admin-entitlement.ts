"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_SETTABLE_STATES, updateCustomerEntitlement, type AdminSettableState } from "@/server/admin/entitlement-admin";
import { resolvePlatformAdmin } from "@/server/platform-admin";

export type EntitlementFormState = { ok: boolean; message: string };

/**
 * The authorization check is repeated here on purpose. The layout guards the pages, but a server
 * action is its own entry point: it is reachable by anyone who can post to it, layout or not.
 * Relying on the surrounding page to have checked is how an action becomes an unguarded API.
 */
export async function changeEntitlement(
  _previous: EntitlementFormState | undefined,
  formData: FormData
): Promise<EntitlementFormState> {
  const auth = await resolvePlatformAdmin();
  if (!auth.ok) return { ok: false, message: "ไม่มีสิทธิ์ดำเนินการนี้" };

  const entitlementId = String(formData.get("entitlementId") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim() as AdminSettableState;
  const endsAtRaw = String(formData.get("endsAt") ?? "").trim();
  const reason = String(formData.get("reason") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "").trim();

  if (!entitlementId) return { ok: false, message: "ไม่พบสิทธิ์ที่จะแก้" };
  if (!ADMIN_SETTABLE_STATES.includes(state)) return { ok: false, message: "สถานะที่เลือกไม่ถูกต้อง" };

  let endsAt: Date | null = null;
  if (endsAtRaw) {
    const parsed = new Date(endsAtRaw);
    if (Number.isNaN(parsed.getTime())) return { ok: false, message: "วันหมดอายุไม่ถูกต้อง" };
    endsAt = parsed;
  }

  let result;
  try {
    result = await updateCustomerEntitlement({ entitlementId, state, endsAt, reason, actorId: auth.admin.userId });
  } catch {
    return { ok: false, message: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }

  if (!result.ok) {
    if (result.reason === "reason_required") return { ok: false, message: "ต้องระบุเหตุผลอย่างน้อย 4 ตัวอักษร" };
    if (result.reason === "unknown_entitlement") return { ok: false, message: "ไม่พบสิทธิ์ที่จะแก้" };
    return { ok: false, message: "สถานะที่เลือกไม่ถูกต้อง" };
  }

  revalidatePath("/admin/entitlements");
  return {
    ok: true,
    message: organizationId ? "บันทึกแล้ว และเขียนบันทึกการเปลี่ยนแปลงไว้เรียบร้อย" : "บันทึกแล้ว"
  };
}
