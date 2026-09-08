"use server";

import { revalidatePath } from "next/cache";
import { announceApp, isAppAccess, revokeAnnouncement, setExpectedOpenMonth } from "@/server/app-registry";
import { resolvePlatformAdmin } from "@/server/platform-admin";
import type { AppAccess } from "@/lib/platform";

export type AppRegistryFormState = { ok: boolean; message: string };

/**
 * The authorization check is repeated here rather than inherited from the layout. A server action
 * is its own entry point: anyone who can post to it reaches this function, layout or not, and an
 * action that trusts the page around it is an unguarded API with a nice front door.
 *
 * Both actions revalidate `/pricing` as well as the back-office page, because the whole point of
 * the registry is that what an administrator says here is what the public page says next.
 */
export async function declareApp(
  _previous: AppRegistryFormState | undefined,
  formData: FormData
): Promise<AppRegistryFormState> {
  const auth = await resolvePlatformAdmin();
  if (!auth.ok) return { ok: false, message: "ไม่มีสิทธิ์ดำเนินการนี้" };

  const slug = String(formData.get("slug") ?? "").trim();
  const access = String(formData.get("access") ?? "").trim();
  const open = String(formData.get("open") ?? "") === "open";
  const reason = String(formData.get("reason") ?? "");
  const availabilityNote = String(formData.get("availability_note") ?? "");

  if (!slug) return { ok: false, message: "ไม่พบแอปที่จะประกาศ" };
  if (!isAppAccess(access)) return { ok: false, message: "สิทธิ์ที่เลือกไม่ถูกต้อง" };

  let result;
  try {
    result = await announceApp({ slug, access: access as AppAccess, open, reason, availabilityNote, actorId: auth.admin.userId });
  } catch {
    return { ok: false, message: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }

  if (!result.ok) {
    if (result.reason === "reason_required") return { ok: false, message: "ต้องระบุเหตุผลอย่างน้อย 4 ตัวอักษร" };
    if (result.reason === "unknown_app") return { ok: false, message: "ไม่พบแอปที่จะประกาศ" };
    if (result.reason === "member_free_cannot_be_open") {
      return {
        ok: false,
        message: "แอปที่ประกาศเป็นสมาชิกใช้ฟรี ยังตั้งเป็นเปิดใช้แล้วไม่ได้ เพราะยังไม่มีเส้นทางออกสิทธิ์ให้สมาชิกจริง"
      };
    }
    return { ok: false, message: "สิทธิ์ที่เลือกไม่ถูกต้อง" };
  }

  revalidatePath("/admin/apps");
  revalidatePath("/pricing");
  return { ok: true, message: "ประกาศแล้ว และเขียนบันทึกการเปลี่ยนแปลงไว้เรียบร้อย" };
}

/**
 * เดือนที่คาดว่าเปิด — ADR 0025
 *
 * **ช่องว่างคือการลบเดือนออก ไม่ใช่การไม่ได้กรอก** ฟอร์มนี้ส่งค่าเดือนมาเสมอ ส่งว่างมาแปลว่า
 * ผู้ดูแลตั้งใจลบ ซึ่งทำให้แอปถอยกลับขั้นที่หนึ่งทันที และเป็นการกระทำที่ต้องมีเหตุผล
 * และลงบันทึกเท่ากับการกรอก · ตัวเขียนใน `app-registry.ts` เป็นคนบังคับเรื่องนี้ ที่นี่แค่ส่งต่อ
 *
 * `revalidatePath` ครอบ `/` ด้วย เพราะแถบความพร้อมบนหน้าแรกอ่านค่านี้ ไม่ใช่แค่หน้าราคา
 */
export async function setAppExpectedMonth(
  _previous: AppRegistryFormState | undefined,
  formData: FormData
): Promise<AppRegistryFormState> {
  const auth = await resolvePlatformAdmin();
  if (!auth.ok) return { ok: false, message: "ไม่มีสิทธิ์ดำเนินการนี้" };

  const slug = String(formData.get("slug") ?? "").trim();
  const month = String(formData.get("expected_open_month") ?? "");
  const reason = String(formData.get("reason") ?? "");
  if (!slug) return { ok: false, message: "ไม่พบแอปที่จะบันทึกเดือน" };

  let result;
  try {
    result = await setExpectedOpenMonth({ slug, month, reason, actorId: auth.admin.userId });
  } catch {
    return { ok: false, message: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }

  if (!result.ok) {
    if (result.reason === "reason_required") return { ok: false, message: "ต้องระบุเหตุผลอย่างน้อย 4 ตัวอักษร" };
    if (result.reason === "invalid_month") return { ok: false, message: "เดือนต้องอยู่ในรูป ปี ค.ศ. สี่หลัก ขีดกลาง เดือนสองหลัก เช่น 2026-10" };
    if (result.reason === "not_announced") {
      return { ok: false, message: "ต้องประกาศแอปนี้ก่อน เพราะขั้นกลางคือประกาศแล้วและบอกเดือนที่คาด" };
    }
    return { ok: false, message: "ไม่พบแอปที่จะบันทึกเดือน" };
  }

  revalidatePath("/admin/apps");
  revalidatePath("/pricing");
  revalidatePath("/");
  const cleared = month.trim() === "";
  return {
    ok: true,
    message: cleared
      ? "ลบเดือนออกแล้ว แอปนี้ถอยกลับไปเป็นประกาศแล้วโดยไม่มีเดือน และบันทึกการลบไว้เรียบร้อย"
      : "บันทึกเดือนที่คาดว่าเปิดแล้ว พร้อมเขียนบันทึกการเปลี่ยนแปลงไว้"
  };
}

export async function withdrawApp(
  _previous: AppRegistryFormState | undefined,
  formData: FormData
): Promise<AppRegistryFormState> {
  const auth = await resolvePlatformAdmin();
  if (!auth.ok) return { ok: false, message: "ไม่มีสิทธิ์ดำเนินการนี้" };

  const slug = String(formData.get("slug") ?? "").trim();
  const reason = String(formData.get("reason") ?? "");
  if (!slug) return { ok: false, message: "ไม่พบแอปที่จะถอนคำประกาศ" };

  let result;
  try {
    result = await revokeAnnouncement({ slug, reason, actorId: auth.admin.userId });
  } catch {
    return { ok: false, message: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }

  if (!result.ok) {
    if (result.reason === "reason_required") return { ok: false, message: "ต้องระบุเหตุผลอย่างน้อย 4 ตัวอักษร" };
    if (result.reason === "not_announced") return { ok: false, message: "แอปนี้ยังไม่เคยถูกประกาศ" };
    return { ok: false, message: "ไม่พบแอปที่จะถอนคำประกาศ" };
  }

  revalidatePath("/admin/apps");
  revalidatePath("/pricing");
  return { ok: true, message: "ถอนคำประกาศแล้ว สิทธิ์ของลูกค้าที่ผูกกับแอปนี้ไม่ถูกแตะต้อง" };
}
