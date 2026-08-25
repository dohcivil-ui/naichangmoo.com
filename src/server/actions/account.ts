"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getPlatformSessionUser } from "@/lib/auth-session";

export type AccountActionState = { ok: boolean; message: string };

/**
 * Ends every session except the one making the request.
 *
 * The check is here and not only on the page, because a server action is its own entry point: it is
 * reachable by anyone who can post to it. Better-auth resolves whose sessions to end from the
 * request's own cookie, so this cannot be aimed at another member even by a caller who tries.
 */
export async function signOutOtherDevices(): Promise<AccountActionState> {
  const requestHeaders = await headers();
  const user = await getPlatformSessionUser(requestHeaders);
  if (!user) return { ok: false, message: "ต้องเข้าสู่ระบบก่อน" };

  try {
    const { auth } = await import("@/lib/auth");
    await auth.api.revokeOtherSessions({ headers: requestHeaders });
  } catch {
    return { ok: false, message: "ออกจากระบบอุปกรณ์อื่นไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }

  revalidatePath("/account");
  return { ok: true, message: "ออกจากระบบอุปกรณ์อื่นเรียบร้อย อุปกรณ์นี้ยังเข้าอยู่" };
}
