"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getPlatformSessionUser } from "@/lib/auth-session";
import {
  parseEvidenceForm,
  parseTakeoffItemForm,
  type EvidenceFieldErrors,
  type TakeoffItemFieldErrors
} from "@/lib/takeoff-item";
import { getEstimeterAccess } from "@/server/estimeter-access";
import {
  addItemEvidence,
  addManualItem,
  closeManualRun,
  confirmManualItem,
  removeManualItem,
  startManualRun,
  type WriteRejection
} from "@/server/estimeter/takeoff-repository";

export type TakeoffActionState = {
  ok: boolean;
  message: string;
  itemErrors?: TakeoffItemFieldErrors;
  evidenceErrors?: EvidenceFieldErrors;
};

const rejectionMessage: Record<WriteRejection, string> = {
  run_not_found: "ไม่พบรอบการถอดปริมาณนี้ในโครงการของคุณ",
  item_not_found: "ไม่พบรายการนี้ในโครงการของคุณ",
  project_not_writable: "โครงการนี้ถูกล็อกหรือเก็บถาวรแล้ว จึงแก้ไขปริมาณไม่ได้",
  run_not_open: "รอบการถอดปริมาณนี้ปิดแล้ว ต้องเปิดรอบใหม่ก่อนแก้ไข",
  item_locked: "รายการนี้ยืนยันแล้ว จึงแก้ไขหรือลบไม่ได้ เพื่อรักษาร่องรอยการตรวจ",
  evidence_required: "ต้องบันทึกหลักฐานอ้างอิงอย่างน้อยหนึ่งรายการก่อนยืนยันปริมาณ",
  already_confirmed: "รายการนี้ยืนยันแล้ว",
  no_confirmed_items: "ยังไม่มีรายการที่ยืนยันแล้ว จึงยังปิดรอบการถอดปริมาณไม่ได้"
};

type EditContext = { userId: string; organizationId: string };

/**
 * Every take-off action is a public POST endpoint, so the session, the entitlement and the
 * organization are resolved here rather than trusted from the page that rendered the form.
 */
async function requireEditAccess(): Promise<{ ok: true; context: EditContext } | { ok: false; message: string }> {
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
          : "สิทธิ์ปัจจุบันไม่อนุญาตให้แก้ไขข้อมูลใน ESTIMETR"
    };
  }

  return { ok: true, context: { userId: user.id, organizationId: access.organizationId } };
}

function revalidateTakeoff(projectId: string) {
  revalidatePath(`/apps/estimeter/projects/${projectId}/takeoff`);
  revalidatePath(`/apps/estimeter/projects/${projectId}`);
}

export async function startManualTakeoff(
  _previous: TakeoffActionState | undefined,
  formData: FormData
): Promise<TakeoffActionState> {
  const guard = await requireEditAccess();
  if (!guard.ok) return { ok: false, message: guard.message };

  const projectId = String(formData.get("projectId") ?? "");
  const result = await startManualRun({ ...guard.context, projectId, actorId: guard.context.userId });
  if (!result.ok) return { ok: false, message: rejectionMessage[result.reason] };

  revalidateTakeoff(result.value.projectId);
  return { ok: true, message: "เปิดรอบการถอดปริมาณด้วยมือแล้ว" };
}

export async function addTakeoffItem(
  _previous: TakeoffActionState | undefined,
  formData: FormData
): Promise<TakeoffActionState> {
  const guard = await requireEditAccess();
  if (!guard.ok) return { ok: false, message: guard.message };

  const parsed = parseTakeoffItemForm(formData);
  if (!parsed.ok) return { ok: false, message: "กรุณาตรวจข้อมูลรายการอีกครั้ง", itemErrors: parsed.errors };

  const result = await addManualItem({
    ...guard.context,
    runId: String(formData.get("runId") ?? ""),
    actorId: guard.context.userId,
    item: parsed.value
  });
  if (!result.ok) return { ok: false, message: rejectionMessage[result.reason] };

  revalidateTakeoff(result.value.projectId);
  return { ok: true, message: "บันทึกรายการแล้ว ขั้นถัดไปคือบันทึกหลักฐานอ้างอิงแล้วจึงยืนยัน" };
}

export async function addTakeoffEvidence(
  _previous: TakeoffActionState | undefined,
  formData: FormData
): Promise<TakeoffActionState> {
  const guard = await requireEditAccess();
  if (!guard.ok) return { ok: false, message: guard.message };

  const parsed = parseEvidenceForm(formData);
  if (!parsed.ok) return { ok: false, message: "กรุณาตรวจข้อมูลหลักฐานอีกครั้ง", evidenceErrors: parsed.errors };

  const result = await addItemEvidence({
    ...guard.context,
    itemId: String(formData.get("itemId") ?? ""),
    actorId: guard.context.userId,
    evidence: parsed.value
  });
  if (!result.ok) return { ok: false, message: rejectionMessage[result.reason] };

  revalidateTakeoff(result.value.projectId);
  return { ok: true, message: "บันทึกหลักฐานอ้างอิงแล้ว" };
}

export async function confirmTakeoffItem(
  _previous: TakeoffActionState | undefined,
  formData: FormData
): Promise<TakeoffActionState> {
  const guard = await requireEditAccess();
  if (!guard.ok) return { ok: false, message: guard.message };

  const result = await confirmManualItem({
    ...guard.context,
    itemId: String(formData.get("itemId") ?? ""),
    actorId: guard.context.userId
  });
  if (!result.ok) return { ok: false, message: rejectionMessage[result.reason] };

  revalidateTakeoff(result.value.projectId);
  return { ok: true, message: "ยืนยันปริมาณแล้ว รายการนี้ถูกล็อกไว้เพื่อรักษาร่องรอยการตรวจ" };
}

export async function removeTakeoffItem(
  _previous: TakeoffActionState | undefined,
  formData: FormData
): Promise<TakeoffActionState> {
  const guard = await requireEditAccess();
  if (!guard.ok) return { ok: false, message: guard.message };

  const result = await removeManualItem({
    ...guard.context,
    itemId: String(formData.get("itemId") ?? ""),
    actorId: guard.context.userId
  });
  if (!result.ok) return { ok: false, message: rejectionMessage[result.reason] };

  revalidateTakeoff(result.value.projectId);
  return { ok: true, message: "ลบรายการที่ยังไม่ยืนยันแล้ว" };
}

export async function closeTakeoffRun(
  _previous: TakeoffActionState | undefined,
  formData: FormData
): Promise<TakeoffActionState> {
  const guard = await requireEditAccess();
  if (!guard.ok) return { ok: false, message: guard.message };

  const result = await closeManualRun({
    ...guard.context,
    runId: String(formData.get("runId") ?? ""),
    actorId: guard.context.userId
  });
  if (!result.ok) return { ok: false, message: rejectionMessage[result.reason] };

  revalidateTakeoff(result.value.projectId);
  const skipped = result.value.unconfirmedCount;
  return {
    ok: true,
    message:
      skipped > 0
        ? `ปิดรอบแล้ว โดยนับเฉพาะ ${result.value.confirmedCount} รายการที่ยืนยัน และไม่นับ ${skipped} รายการที่ยังไม่ยืนยัน`
        : `ปิดรอบแล้ว โดยบันทึกลายนิ้วมือของ ${result.value.confirmedCount} รายการที่ยืนยัน`
  };
}
