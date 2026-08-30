"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getPlatformSessionUser } from "@/server/auth-session";
import { getEstimeterAccess } from "@/server/estimeter-access";
import { acceptMatches, readMatchCandidates } from "@/server/estimeter/boq-repository";
import type { BoqMatchInput } from "@/server/ai/estimeter-prompt";

/**
 * ประตูของบรรทัด BOQ (IP-217)
 *
 * สองอย่างที่หน้าจอเรียก — ขอโจทย์สำหรับผู้ช่วย และรับคู่ที่คนติ๊กไว้ ตัวเรียกผู้ช่วยเองยังเป็น
 * ประตูกลาง `requestAssistant` เหมือนทุกแอป ไฟล์นี้จึงไม่แตะแบบจำลองเลยสักบรรทัด
 *
 * **หน้าจอไม่เคยส่ง id ของแถวมา** มันส่งรหัสสั้นที่เซิร์ฟเวอร์ตั้งให้ตอนขอโจทย์ แล้วที่นี่แปลกลับ
 * ด้วยลำดับเดิม การเชื่อ id ที่หน้าจอส่งมาคือการเปิดทางให้ใครก็ตามยิงตรงเข้ามาผูกราคาของ
 * โครงการหนึ่งเข้ากับปริมาณของอีกโครงการหนึ่ง
 *
 * ห้ามใช้ `await import()` ในไฟล์ action ตามที่ v0.94.0 เจอมาแล้วว่าคำขอค้างเงียบ ๆ
 */

export type BoqActionState = { ok: boolean; message: string };

async function viewer() {
  const user = await getPlatformSessionUser(await headers());
  if (!user) return null;
  try {
    const access = await getEstimeterAccess(user.id);
    return { userId: user.id, access };
  } catch {
    return null;
  }
}

export type MatchCandidatesResult =
  | { ok: true; input: BoqMatchInput }
  | { ok: false; message: string };

/** โจทย์ที่จะส่งให้ผู้ช่วย ประกอบที่เซิร์ฟเวอร์ทุกครั้ง ไม่ใช่ให้หน้าจอประกอบเอง */
export async function loadBoqMatchInput(projectId: string): Promise<MatchCandidatesResult> {
  const current = await viewer();
  if (!current) return { ok: false, message: "ต้องเข้าสู่ระบบก่อนใช้ผู้ช่วย" };
  const organizationId = current.access.organizationId;
  if (!organizationId) return { ok: false, message: "บัญชีนี้ยังไม่มีองค์กรสำหรับเก็บโครงการ" };

  const candidates = await readMatchCandidates(organizationId, projectId);
  if (!candidates) return { ok: false, message: "ไม่พบโครงการนี้" };
  if (candidates.input.items.length === 0) {
    return { ok: false, message: "ยังไม่มีรายการปริมาณที่ยืนยันแล้ว ผู้ช่วยจึงยังไม่มีอะไรให้จับคู่" };
  }
  if (candidates.input.lines.length === 0) {
    return { ok: false, message: "โครงการนี้ยังไม่มีชุดราคา หยิบราคาจากแอปราคาวัสดุแล้วส่งเข้ามาก่อน" };
  }
  return { ok: true, input: candidates.input };
}

export type AcceptMatchesInput = {
  projectId: string;
  revisionId: string;
  matches: { itemRef: string; lineRef: string; confidence: string | null }[];
};

export async function acceptBoqMatches(input: AcceptMatchesInput): Promise<BoqActionState> {
  const current = await viewer();
  if (!current) return { ok: false, message: "ต้องเข้าสู่ระบบก่อนรับคู่ที่ผู้ช่วยเสนอ" };
  if (!current.access.capabilities.edit) {
    return { ok: false, message: "สิทธิ์ปัจจุบันเปิดดูโครงการได้ แต่รับคู่เข้า BOQ ไม่ได้" };
  }
  const organizationId = current.access.organizationId;
  if (!organizationId) return { ok: false, message: "บัญชีนี้ยังไม่มีองค์กรสำหรับเก็บโครงการ" };

  const accepted = await acceptMatches({
    organizationId,
    actorId: current.userId,
    projectId: input.projectId,
    revisionId: input.revisionId,
    matches: input.matches
  });
  if (!accepted.ok) return { ok: false, message: accepted.message };

  revalidatePath(`/apps/estimeter/projects/${input.projectId}`);
  return { ok: true, message: `รับเข้า BOQ แล้ว ${accepted.accepted} บรรทัด` };
}
