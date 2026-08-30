"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getPlatformSessionUser } from "@/server/auth-session";
import { getEstimeterAccess } from "@/server/estimeter-access";
import { acceptMatches, planProjectMatches } from "@/server/estimeter/boq-repository";
import type { MatchPlan } from "@/lib/boq-matching";
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
  | {
      ok: true;
      /** ชื่อและหน่วยทั้งสองฝั่ง สำหรับหน้าจอใช้แสดงผล */
      input: BoqMatchInput;
      /** ผลของอัลกอริทึม คู่ที่ชัด คู่ที่ไม่ชัด และรายการที่ไม่มีคู่ */
      plan: MatchPlan;
      /**
       * โจทย์ที่จะส่งให้แบบจำลอง **เฉพาะคู่ที่อัลกอริทึมตัดสินไม่ได้** และเฉพาะตัวเลือกที่
       * ผ่านด่านแล้ว `null` เมื่อไม่มีอะไรต้องถาม ซึ่งแปลว่าไม่ต้องเรียกแบบจำลองเลยรอบนั้น
       */
      modelInput: BoqMatchInput | null;
    }
  | { ok: false; message: string };

/** โจทย์ที่จะส่งให้ผู้ช่วย ประกอบที่เซิร์ฟเวอร์ทุกครั้ง ไม่ใช่ให้หน้าจอประกอบเอง */
export async function loadBoqMatchInput(projectId: string): Promise<MatchCandidatesResult> {
  const current = await viewer();
  if (!current) return { ok: false, message: "ต้องเข้าสู่ระบบก่อนใช้ผู้ช่วย" };
  const organizationId = current.access.organizationId;
  if (!organizationId) return { ok: false, message: "บัญชีนี้ยังไม่มีองค์กรสำหรับเก็บโครงการ" };

  const planned = await planProjectMatches(organizationId, projectId);
  if (!planned) return { ok: false, message: "ไม่พบโครงการนี้" };

  const { candidates, plan } = planned;
  if (candidates.input.items.length === 0) {
    return { ok: false, message: "ยังไม่มีรายการปริมาณที่ยืนยันแล้ว ผู้ช่วยจึงยังไม่มีอะไรให้จับคู่" };
  }
  if (candidates.input.lines.length === 0) {
    return { ok: false, message: "โครงการนี้ยังไม่มีชุดราคา หยิบราคาจากแอปราคาวัสดุแล้วส่งเข้ามาก่อน" };
  }

  // คู่ที่ไม่ชัดเท่านั้นที่ต้องถามแบบจำลอง และถามพร้อมเฉพาะตัวเลือกที่ผ่านด่านหน่วยกับ
  // คะแนนขั้นต่ำแล้ว บัญชีราคาทั้งเล่มไม่ต้องเดินทางไปกับโจทย์อีกต่อไป
  const unclear = plan.matched.filter((match) => match.band === "ไม่ชัด");
  const unclearItemRefs = new Set(unclear.map((match) => match.itemRef));
  const unclearLineRefs = new Set(unclear.flatMap((match) => match.shortlist.map((candidate) => candidate.lineRef)));

  const modelInput: BoqMatchInput | null =
    unclear.length === 0
      ? null
      : {
          projectName: candidates.input.projectName,
          items: candidates.input.items.filter((item) => unclearItemRefs.has(item.ref)),
          lines: candidates.input.lines.filter((line) => unclearLineRefs.has(line.ref))
        };

  return { ok: true, input: candidates.input, plan, modelInput };
}

export type AcceptMatchesInput = {
  projectId: string;
  revisionId: string;
  matches: { itemRef: string; lineRef: string; confidence: string | null; matchedBy: string }[];
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
