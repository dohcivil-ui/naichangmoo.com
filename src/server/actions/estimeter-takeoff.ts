"use server";

import { revalidatePath } from "next/cache";
import {
  parseEvidenceForm,
  parseTakeoffItemForm,
  type EvidenceFieldErrors,
  type TakeoffItemFieldErrors
} from "@/lib/takeoff-item";
import { GROUP_TITLE_MAX, GROUP_TITLE_MIN } from "@/lib/takeoff-outline";
import {
  parseMeasurementForm,
  parseWasteForm,
  type MeasurementFieldErrors
} from "@/lib/takeoff-measurement";
import { requireEditAccess } from "@/server/estimeter/edit-access";
import {
  addItemEvidence,
  addItemMeasurement,
  addManualItem,
  addRunGroup,
  assignItemGroup,
  closeManualRun,
  confirmManualItem,
  getScopedItem,
  removeItemMeasurement,
  removeManualItem,
  removeRunGroup,
  setItemWaste,
  startManualRun,
  type WriteRejection
} from "@/server/estimeter/takeoff-repository";

export type TakeoffActionState = {
  ok: boolean;
  message: string;
  itemErrors?: TakeoffItemFieldErrors;
  evidenceErrors?: EvidenceFieldErrors;
  measurementErrors?: MeasurementFieldErrors;
  wasteErrors?: Partial<Record<"wastePercent" | "wasteSourceNote", string>>;
};

const rejectionMessage: Record<WriteRejection, string> = {
  run_not_found: "ไม่พบรอบการถอดปริมาณนี้ในโครงการของคุณ",
  item_not_found: "ไม่พบรายการนี้ในโครงการของคุณ",
  project_not_writable: "โครงการนี้ถูกล็อกหรือเก็บถาวรแล้ว จึงแก้ไขปริมาณไม่ได้",
  run_not_open: "รอบการถอดปริมาณนี้ปิดแล้ว ต้องเปิดรอบใหม่ก่อนแก้ไข",
  item_locked: "รายการนี้ยืนยันแล้ว จึงแก้ไขหรือลบไม่ได้ เพื่อรักษาร่องรอยการตรวจ",
  evidence_required: "ต้องบันทึกหลักฐานอ้างอิงอย่างน้อยหนึ่งรายการก่อนยืนยันปริมาณ",
  measurement_required: "ต้องบันทึกรายการคำนวณอย่างน้อยหนึ่งบรรทัดก่อนยืนยันปริมาณ",
  measurement_shape_mismatch: "จำนวนระยะที่กรอกไม่ตรงกับหน่วยของรายการนี้ กรุณาเปิดฟอร์มใหม่แล้วกรอกอีกครั้ง",
  group_not_found: "ไม่พบหมวดงานนี้ในรอบการถอดปริมาณของคุณ",
  group_depth_exceeded: "หมวดงานซ้อนได้สองชั้นเท่านั้น ตามที่แบบ ปร.4 พิมพ์ได้",
  already_confirmed: "รายการนี้ยืนยันแล้ว",
  no_confirmed_items: "ยังไม่มีรายการที่ยืนยันแล้ว จึงยังปิดรอบการถอดปริมาณไม่ได้"
};

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

export async function addTakeoffMeasurement(
  _previous: TakeoffActionState | undefined,
  formData: FormData
): Promise<TakeoffActionState> {
  const guard = await requireEditAccess();
  if (!guard.ok) return { ok: false, message: guard.message };

  const itemId = String(formData.get("itemId") ?? "");
  // The unit decides how many lengths the line must carry, so it is read from the item rather
  // than taken from the form the browser posted.
  const item = await getScopedItem(guard.context.organizationId, itemId);
  if (!item) return { ok: false, message: rejectionMessage.item_not_found };

  const parsed = parseMeasurementForm(formData, item.unit);
  if (!parsed.ok) return { ok: false, message: "กรุณาตรวจรายการคำนวณอีกครั้ง", measurementErrors: parsed.errors };

  const result = await addItemMeasurement({
    ...guard.context,
    itemId,
    actorId: guard.context.userId,
    measurement: parsed.value
  });
  if (!result.ok) return { ok: false, message: rejectionMessage[result.reason] };

  revalidateTakeoff(result.value.projectId);
  return { ok: true, message: "บันทึกรายการคำนวณแล้ว ปริมาณถูกรวมใหม่ให้อัตโนมัติ" };
}

export async function removeTakeoffMeasurement(
  _previous: TakeoffActionState | undefined,
  formData: FormData
): Promise<TakeoffActionState> {
  const guard = await requireEditAccess();
  if (!guard.ok) return { ok: false, message: guard.message };

  const result = await removeItemMeasurement({
    ...guard.context,
    measurementId: String(formData.get("measurementId") ?? ""),
    actorId: guard.context.userId
  });
  if (!result.ok) return { ok: false, message: rejectionMessage[result.reason] };

  revalidateTakeoff(result.value.projectId);
  return { ok: true, message: "ลบรายการคำนวณแล้ว ปริมาณถูกรวมใหม่ให้อัตโนมัติ" };
}

export async function setTakeoffWaste(
  _previous: TakeoffActionState | undefined,
  formData: FormData
): Promise<TakeoffActionState> {
  const guard = await requireEditAccess();
  if (!guard.ok) return { ok: false, message: guard.message };

  const parsed = parseWasteForm(formData);
  if (!parsed.ok) return { ok: false, message: "กรุณาตรวจค่าเผื่ออีกครั้ง", wasteErrors: parsed.errors };

  const result = await setItemWaste({
    ...guard.context,
    itemId: String(formData.get("itemId") ?? ""),
    actorId: guard.context.userId,
    percent: parsed.percent,
    sourceNote: parsed.sourceNote
  });
  if (!result.ok) return { ok: false, message: rejectionMessage[result.reason] };

  revalidateTakeoff(result.value.projectId);
  return { ok: true, message: "บันทึกค่าเผื่อแล้ว ปริมาณถูกรวมใหม่ให้อัตโนมัติ" };
}

export async function addTakeoffGroup(
  _previous: TakeoffActionState | undefined,
  formData: FormData
): Promise<TakeoffActionState> {
  const guard = await requireEditAccess();
  if (!guard.ok) return { ok: false, message: guard.message };

  const title = String(formData.get("title") ?? "").trim();
  if (title.length < GROUP_TITLE_MIN || title.length > GROUP_TITLE_MAX) {
    return { ok: false, message: `ชื่อหมวดงานต้องมี ${GROUP_TITLE_MIN} ถึง ${GROUP_TITLE_MAX} ตัวอักษร` };
  }

  const parentRaw = String(formData.get("parentId") ?? "").trim();
  const result = await addRunGroup({
    ...guard.context,
    runId: String(formData.get("runId") ?? ""),
    actorId: guard.context.userId,
    title,
    parentId: parentRaw === "" ? null : parentRaw
  });
  if (!result.ok) return { ok: false, message: rejectionMessage[result.reason] };

  revalidateTakeoff(result.value.projectId);
  return { ok: true, message: "เพิ่มหมวดงานแล้ว ลำดับที่จะไล่ให้เองตามตำแหน่ง" };
}

export async function removeTakeoffGroup(
  _previous: TakeoffActionState | undefined,
  formData: FormData
): Promise<TakeoffActionState> {
  const guard = await requireEditAccess();
  if (!guard.ok) return { ok: false, message: guard.message };

  const result = await removeRunGroup({
    ...guard.context,
    groupId: String(formData.get("groupId") ?? ""),
    actorId: guard.context.userId
  });
  if (!result.ok) return { ok: false, message: rejectionMessage[result.reason] };

  revalidateTakeoff(result.value.projectId);
  return { ok: true, message: "ลบหมวดงานแล้ว รายการที่เคยอยู่ในหมวดนี้ยังอยู่ครบ แต่ยังไม่ได้จัดหมวด" };
}

export async function setTakeoffItemGroup(
  _previous: TakeoffActionState | undefined,
  formData: FormData
): Promise<TakeoffActionState> {
  const guard = await requireEditAccess();
  if (!guard.ok) return { ok: false, message: guard.message };

  const groupRaw = String(formData.get("groupId") ?? "").trim();
  const result = await assignItemGroup({
    ...guard.context,
    itemId: String(formData.get("itemId") ?? ""),
    groupId: groupRaw === "" ? null : groupRaw,
    actorId: guard.context.userId
  });
  if (!result.ok) return { ok: false, message: rejectionMessage[result.reason] };

  revalidateTakeoff(result.value.projectId);
  return { ok: true, message: groupRaw === "" ? "นำรายการออกจากหมวดแล้ว" : "จัดรายการเข้าหมวดแล้ว" };
}
