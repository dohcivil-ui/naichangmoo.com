import { z } from "zod";
import { parseQuantity, type QuantityRejection } from "@/lib/takeoff-quantity";
import { isTakeoffCategory, isTakeoffUnit } from "@/lib/takeoff-units";

export const DESCRIPTION_MIN = 3;
export const DESCRIPTION_MAX = 300;
export const EVIDENCE_NOTE_MIN = 5;
export const EVIDENCE_NOTE_MAX = 1000;
export const MAX_PAGE_NUMBER = 9999;

export type TakeoffItemInput = {
  category: string;
  description: string;
  unit: string;
  quantity: string;
};

export type TakeoffItemFieldErrors = Partial<Record<"category" | "description" | "unit" | "quantity", string>>;

export type TakeoffItemParseResult =
  | { ok: true; value: TakeoffItemInput }
  | { ok: false; errors: TakeoffItemFieldErrors };

const quantityMessage: Record<QuantityRejection, string> = {
  empty: "กรอกปริมาณ",
  not_a_number: "ปริมาณต้องเป็นตัวเลข เช่น 12.5",
  not_positive: "ปริมาณต้องมากกว่าศูนย์",
  too_many_decimals: "ปริมาณเก็บทศนิยมได้ไม่เกิน 6 ตำแหน่ง",
  too_large: "ปริมาณเกินค่าที่ระบบเก็บได้ ตรวจหน่วยที่ใช้อีกครั้ง"
};

const descriptionSchema = z
  .string()
  .trim()
  .min(DESCRIPTION_MIN, `รายละเอียดต้องมีอย่างน้อย ${DESCRIPTION_MIN} ตัวอักษร`)
  .max(DESCRIPTION_MAX, `รายละเอียดยาวได้ไม่เกิน ${DESCRIPTION_MAX} ตัวอักษร`)
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "รายละเอียดต้องเป็นข้อความบรรทัดเดียว");

export function parseTakeoffItemForm(formData: FormData): TakeoffItemParseResult {
  const errors: TakeoffItemFieldErrors = {};

  const category = String(formData.get("category") ?? "").trim();
  if (!isTakeoffCategory(category)) errors.category = "เลือกหมวดงาน";

  const unit = String(formData.get("unit") ?? "").trim();
  if (!isTakeoffUnit(unit)) errors.unit = "เลือกหน่วยจากรายการ";

  const description = descriptionSchema.safeParse(formData.get("description") ?? "");
  if (!description.success) errors.description = description.error.issues[0]?.message;

  const quantity = parseQuantity(String(formData.get("quantity") ?? ""));
  if (!quantity.ok) errors.quantity = quantityMessage[quantity.reason];

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (!description.success || !quantity.ok) return { ok: false, errors };

  return { ok: true, value: { category, description: description.data, unit, quantity: quantity.canonical } };
}

export type EvidenceInput = { note: string; pageNumber: number | null };

export type EvidenceFieldErrors = Partial<Record<"note" | "pageNumber", string>>;

export type EvidenceParseResult = { ok: true; value: EvidenceInput } | { ok: false; errors: EvidenceFieldErrors };

export function parseEvidenceForm(formData: FormData): EvidenceParseResult {
  const errors: EvidenceFieldErrors = {};

  const note = String(formData.get("note") ?? "").trim();
  if (note.length < EVIDENCE_NOTE_MIN) {
    errors.note = "ระบุที่มาของปริมาณ เช่น เลขที่แบบและตำแหน่งที่วัด";
  } else if (note.length > EVIDENCE_NOTE_MAX) {
    errors.note = `ข้อความยาวได้ไม่เกิน ${EVIDENCE_NOTE_MAX} ตัวอักษร`;
  }

  const pageRaw = String(formData.get("pageNumber") ?? "").trim();
  let pageNumber: number | null = null;
  if (pageRaw !== "") {
    const parsed = Number(pageRaw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_PAGE_NUMBER) {
      errors.pageNumber = `หน้าต้องเป็นจำนวนเต็ม 1 ถึง ${MAX_PAGE_NUMBER}`;
    } else {
      pageNumber = parsed;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { note, pageNumber } };
}

/**
 * Why an item cannot be confirmed, or null when it can.
 *
 * A quantity without a stated source cannot be defended in a review meeting, so at least one
 * evidence reference is required before an item counts as confirmed. This is the gate that
 * makes the take-off auditable rather than a typed-in number.
 */
export function itemConfirmationBlocker(item: { reviewState: string; evidenceCount: number }): string | null {
  if (item.reviewState === "confirmed") return "รายการนี้ยืนยันแล้ว";
  if (item.reviewState === "rejected") return "รายการนี้ถูกตีกลับ ต้องแก้ไขก่อนยืนยัน";
  if (item.evidenceCount < 1) return "ต้องบันทึกหลักฐานอ้างอิงอย่างน้อยหนึ่งรายการก่อนยืนยันปริมาณ";
  return null;
}
