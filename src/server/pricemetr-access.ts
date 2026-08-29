import { getDb } from "@/db";
import { readEntitlementForApp } from "@/server/app-access";
import { getPlatformSessionUser } from "@/server/auth-session";
import {
  PRICEMETR_APP_SLUG,
  resolvePricemetrAllowance,
  type PricemetrAllowance
} from "@/lib/pricemetr-tier";

/**
 * PRICEMETR อ่านสิทธิ์ — ด่านเดียวที่หน้าจอกับ API เชื่อ
 *
 * ล้อ `estimeter-access.ts` แต่ **ไม่มีด่านเปิดสิทธิ์** ESTIMETR ใช้ ADR 0006 สองด่าน คือ
 * เข้าสู่ระบบแล้วต้องกดยอมรับอีกทีนาฬิกาทดลองใช้ถึงเดิน แอปนี้ไม่มีนาฬิกาให้เริ่มและไม่มี
 * เงื่อนไขให้ยอมรับ สิทธิ์ฟรีจึงมาจากการเป็นสมาชิก ไม่ใช่จากการกด — ADR 0023
 *
 * ผลสำคัญคือ **ทางอ่านไม่เขียนอะไรลงฐานข้อมูลเลย** สมาชิกที่ไม่มีแถวสิทธิ์คือสมาชิกฟรี
 * ซึ่งเป็นสภาพปกติของคนส่วนใหญ่ ไม่ใช่สภาพที่ต้องซ่อมด้วยการแอบเขียนแถวตอนมีคนเปิดหน้า
 * แถวสิทธิ์จะเกิดวันที่มีคนได้ VIP เท่านั้น และวันนั้นมันคือหลักฐานว่ามีคนให้สิทธิ์จริง
 */

export type PricemetrAccess = PricemetrAllowance & {
  signedIn: boolean;
};

export async function getPricemetrAccess(requestHeaders: Headers, now = new Date()): Promise<PricemetrAccess> {
  const user = await getPlatformSessionUser(requestHeaders);

  // ไม่มี session ก็จบตรงนี้ ไม่แตะฐานข้อมูล — หน้านี้เปิดให้คนทั่วไปอ่านราคาได้
  // และการยิงคิวรีทุกครั้งที่คนไม่ล็อกอินเปิดหน้าคือภาระที่ไม่ได้อะไรกลับมา
  if (!user) return { signedIn: false, ...resolvePricemetrAllowance({ signedIn: false, entitlement: null }, now) };

  const record = await readEntitlementForApp(getDb(), user.id, PRICEMETR_APP_SLUG);

  return {
    signedIn: true,
    ...resolvePricemetrAllowance(
      { signedIn: true, entitlement: record?.entitlement ?? null, appEnabled: record?.appEnabled },
      now
    )
  };
}
