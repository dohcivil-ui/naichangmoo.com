import { headers } from "next/headers";
import { getPlatformSessionUser } from "@/server/auth-session";
import { getEstimeterAccess } from "@/server/estimeter-access";

/**
 * The session, entitlement and organization every ESTIMETR write action resolves for itself.
 *
 * This module has no `"use server"` directive on purpose: such a file may export nothing but
 * async functions, and the type below has to travel with the guard that produces it.
 */
export type EditContext = { userId: string; organizationId: string };

/**
 * Every take-off action is a public POST endpoint, so the session, the entitlement and the
 * organization are resolved here rather than trusted from the page that rendered the form.
 */
export async function requireEditAccess(): Promise<
  { ok: true; context: EditContext } | { ok: false; message: string }
> {
  const user = await getPlatformSessionUser(await headers());
  if (!user) return { ok: false, message: "ต้องเข้าสู่ระบบด้วยบัญชีนายช่างหมูก่อนแก้ไขปริมาณ" };

  let access;
  try {
    access = await getEstimeterAccess(user.id);
  } catch {
    return { ok: false, message: "ขณะนี้ตรวจสอบสิทธิ์การใช้งานไม่ได้ กรุณาลองใหม่อีกครั้ง" };
  }

  if (!access.capabilities.edit) {
    return {
      ok: false,
      message:
        access.state === "expired_read_only"
          ? "สิทธิ์ทดลองใช้หมดอายุแล้ว เปิดดูข้อมูลเดิมได้ แต่แก้ไขปริมาณไม่ได้"
          : access.state === "not_activated"
            ? "บัญชีนี้ยังไม่ได้เริ่มทดลองใช้ ESTIMETR กดเริ่มทดลองใช้ก่อนจึงจะบันทึกปริมาณได้"
            : "สิทธิ์ปัจจุบันไม่อนุญาตให้แก้ไขข้อมูลใน ESTIMETR"
    };
  }

  if (!access.organizationId) return { ok: false, message: "บัญชีนี้ยังไม่มีองค์กรสำหรับเก็บข้อมูลการถอดปริมาณ" };

  return { ok: true, context: { userId: user.id, organizationId: access.organizationId } };
}
