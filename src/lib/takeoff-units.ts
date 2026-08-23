/**
 * Units and work categories for manual take-off.
 *
 * Free-text units are the fastest way to corrupt a BOQ: "ตร.ม.", "ตรม." and "m2" would all
 * be accepted and then silently summed as three different things. The allowed set is closed
 * here, and each unit carries the physical dimension it measures so quantities can never be
 * added across dimensions.
 */

/**
 * "lump" is not a physical dimension. It marks work that is priced as one whole thing with
 * nothing to measure — ระบบกำจัดปลวก, งานตัวอักษรป้าย — which real ปร.4 sheets carry as `1.00 งาน`.
 * It is kept apart from "count" so the rules can insist its quantity is exactly one: three of a
 * lump sum is not a measurement, it is a mistake.
 */
export type QuantityDimension = "volume" | "area" | "length" | "mass" | "count" | "lump";

export type TakeoffUnit = {
  code: string;
  label: string;
  dimension: QuantityDimension;
};

/**
 * The set is closed, and it is closed around what real ปร.4 sheets actually use.
 *
 * Checked against a complete priced set for อาคารฟอกไต ปุญโญภาส: across its 91 measured lines the
 * units are ชุด, ตร.ม., ท่อน, ตัว, ม้วน, ม., งาน, ลบ.ม., ถัง and แผ่น. Reinforcement there is priced
 * by the bar, not by weight, which is why ท่อน is second only to ชุด in frequency and why กก. and
 * ตัน do not appear on that sheet at all. They stay because weight is how steel is bought and how
 * some sheets do price it; they are simply not the common case.
 */
export const TAKEOFF_UNITS: readonly TakeoffUnit[] = [
  { code: "cu_m", label: "ลบ.ม.", dimension: "volume" },
  { code: "sq_m", label: "ตร.ม.", dimension: "area" },
  { code: "m", label: "ม.", dimension: "length" },
  { code: "kg", label: "กก.", dimension: "mass" },
  { code: "ton", label: "ตัน", dimension: "mass" },
  { code: "bar", label: "ท่อน", dimension: "count" },
  { code: "sheet", label: "แผ่น", dimension: "count" },
  { code: "roll", label: "ม้วน", dimension: "count" },
  { code: "tank", label: "ถัง", dimension: "count" },
  { code: "set", label: "ชุด", dimension: "count" },
  { code: "each", label: "ตัว", dimension: "count" },
  { code: "lump", label: "งาน", dimension: "lump" }
] as const;

const unitByCode = new Map(TAKEOFF_UNITS.map((unit) => [unit.code, unit]));

export function findUnit(code: string): TakeoffUnit | undefined {
  return unitByCode.get(code);
}

export function isTakeoffUnit(code: string): boolean {
  return unitByCode.has(code);
}

/**
 * Working groups for organizing a manual take-off, following the divisions a real priced sheet
 * uses: อาคารฟอกไต ปุญโญภาส splits its work into งานดินขุด-ดินถม, งานโครงสร้าง, งานโครงหลังคา,
 * งานสถาปัตยกรรม, งานประตู-หน้าต่าง, งานไฟฟ้า, งานสุขภัณฑ์-สุขาภิบาล and งานอื่นๆ.
 *
 * This is still not a claim of compliance with the official ปร.4 category list; that mapping
 * needs the DPT form source, which is roadmap item IP-042.
 */
export const TAKEOFF_CATEGORIES = [
  { code: "site", label: "งานดินและงานเตรียมพื้นที่" },
  { code: "structure", label: "งานโครงสร้าง" },
  { code: "roof", label: "งานโครงหลังคาและหลังคา" },
  { code: "architecture", label: "งานสถาปัตยกรรม" },
  { code: "opening", label: "งานประตู-หน้าต่าง" },
  { code: "electrical", label: "งานระบบไฟฟ้าและสื่อสาร" },
  { code: "sanitary", label: "งานสุขภัณฑ์และระบบสุขาภิบาล" },
  { code: "other", label: "งานอื่นๆ" }
] as const;

export type TakeoffCategoryCode = (typeof TAKEOFF_CATEGORIES)[number]["code"];

const categoryByCode = new Map(TAKEOFF_CATEGORIES.map((category) => [category.code, category]));

export function isTakeoffCategory(code: string): code is TakeoffCategoryCode {
  return categoryByCode.has(code as TakeoffCategoryCode);
}

export function categoryLabel(code: string): string {
  return categoryByCode.get(code as TakeoffCategoryCode)?.label ?? code;
}

export function unitLabel(code: string): string {
  return unitByCode.get(code)?.label ?? code;
}
