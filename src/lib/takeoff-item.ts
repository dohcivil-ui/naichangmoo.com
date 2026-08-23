import { z } from "zod";
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
};

export type TakeoffItemFieldErrors = Partial<Record<"category" | "description" | "unit", string>>;

export type TakeoffItemParseResult =
  | { ok: true; value: TakeoffItemInput }
  | { ok: false; errors: TakeoffItemFieldErrors };

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

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (!description.success) return { ok: false, errors };

  // No quantity is read here. Since v0.17.0 an item's quantity is the total of its measurement
  // lines, so a new item starts at zero and cannot be confirmed until it has been measured.
  return { ok: true, value: { category, description: description.data, unit } };
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
 * Defending a quantity in a review meeting takes two different things, so both are required.
 * Evidence answers "where did you read this off the drawing"; measurement lines answer "how did
 * you arrive at the number". A line with only one of them can still be argued with: a cited
 * quantity whose arithmetic is invisible cannot be re-checked, and arithmetic with no drawing
 * reference cannot be located. Items measured before v0.17.0 carry no measurement lines and are
 * measured again rather than confirmed on their typed-in figure.
 */
export function itemConfirmationBlocker(item: {
  reviewState: string;
  evidenceCount: number;
  measurementCount: number;
}): string | null {
  if (item.reviewState === "confirmed") return "รายการนี้ยืนยันแล้ว";
  if (item.reviewState === "rejected") return "รายการนี้ถูกตีกลับ ต้องแก้ไขก่อนยืนยัน";
  if (item.measurementCount < 1) return "ต้องบันทึกรายการคำนวณอย่างน้อยหนึ่งบรรทัดก่อนยืนยันปริมาณ";
  if (item.evidenceCount < 1) return "ต้องบันทึกหลักฐานอ้างอิงอย่างน้อยหนึ่งรายการก่อนยืนยันปริมาณ";
  return null;
}
