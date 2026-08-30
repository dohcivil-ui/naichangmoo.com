"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getPlatformSessionUser } from "@/server/auth-session";
import { isCostingMethod } from "@/lib/price-authority";
import { getEstimeterAccess } from "@/server/estimeter-access";
import { issueRevision } from "@/server/estimeter/revision-repository";

/**
 * ประตูของการออกฉบับคำนวณ (IP-216)
 *
 * Server Action คือ POST endpoint สาธารณะ session สิทธิ์แก้ไข และองค์กรจึงตรวจที่นี่
 * ไม่ใช่สืบทอดมาจากหน้าที่เรนเดอร์ฟอร์ม ส่วนกติกาของ ADR 0008 ทั้งหมด — ชุดราคาต้องเป็น
 * ของโครงการนี้ ชุดต้องมีบรรทัด และ Factor F ต้องใช้ชุดทางการ — อยู่ใน repository ชั้นล่าง
 * ที่นี่ไม่ตัดสินอะไรเองเลย
 *
 * ห้ามใช้ `await import()` ในไฟล์ action ตามที่ v0.94.0 เจอมาแล้วว่าคำขอค้างเงียบ ๆ
 */

export type RevisionActionState = { ok: boolean; message: string };

export async function issueEstimateRevision(
  _previous: RevisionActionState | undefined,
  formData: FormData
): Promise<RevisionActionState> {
  const user = await getPlatformSessionUser(await headers());
  if (!user) return { ok: false, message: "ต้องเข้าสู่ระบบด้วยบัญชีนายช่างหมูก่อนออกฉบับคำนวณ" };

  const projectId = String(formData.get("projectId") ?? "");
  const priceSetId = String(formData.get("priceSetId") ?? "");
  const method = formData.get("costingMethod");
  if (!projectId || !priceSetId) return { ok: false, message: "คำขอไม่ครบ กรุณาลองใหม่จากหน้าโครงการ" };
  if (!isCostingMethod(method)) return { ok: false, message: "วิธีคิดราคาไม่ถูกต้อง" };

  let access;
  try {
    access = await getEstimeterAccess(user.id);
  } catch {
    return { ok: false, message: "ขณะนี้ตรวจสอบสิทธิ์การใช้งานไม่ได้ กรุณาลองใหม่อีกครั้ง" };
  }

  if (!access.capabilities.edit) {
    return { ok: false, message: "สิทธิ์ปัจจุบันเปิดดูโครงการได้ แต่ออกฉบับคำนวณไม่ได้" };
  }
  const organizationId = access.organizationId;
  if (!organizationId) return { ok: false, message: "บัญชีนี้ยังไม่มีองค์กรสำหรับเก็บโครงการ" };

  const issued = await issueRevision({
    organizationId,
    actorId: user.id,
    projectId,
    priceSetId,
    costingMethod: method
  });

  if (!issued.ok) return { ok: false, message: issued.message };

  revalidatePath(`/apps/estimeter/projects/${projectId}`);
  return { ok: true, message: `ออกฉบับที่ ${issued.revisionNumber} แล้ว` };
}
