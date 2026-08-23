/**
 * Units and work categories for manual take-off.
 *
 * Free-text units are the fastest way to corrupt a BOQ: "ตร.ม.", "ตรม." and "m2" would all
 * be accepted and then silently summed as three different things. The allowed set is closed
 * here, and each unit carries the physical dimension it measures so quantities can never be
 * added across dimensions.
 */

export type QuantityDimension = "volume" | "area" | "length" | "mass" | "count";

export type TakeoffUnit = {
  code: string;
  label: string;
  dimension: QuantityDimension;
};

export const TAKEOFF_UNITS: readonly TakeoffUnit[] = [
  { code: "cu_m", label: "ลบ.ม.", dimension: "volume" },
  { code: "sq_m", label: "ตร.ม.", dimension: "area" },
  { code: "m", label: "ม.", dimension: "length" },
  { code: "kg", label: "กก.", dimension: "mass" },
  { code: "ton", label: "ตัน", dimension: "mass" },
  { code: "each", label: "หน่วย (ตัว/ต้น/ชุด)", dimension: "count" },
  { code: "sheet", label: "แผ่น", dimension: "count" },
  { code: "set", label: "ชุด", dimension: "count" }
] as const;

const unitByCode = new Map(TAKEOFF_UNITS.map((unit) => [unit.code, unit]));

export function findUnit(code: string): TakeoffUnit | undefined {
  return unitByCode.get(code);
}

export function isTakeoffUnit(code: string): boolean {
  return unitByCode.has(code);
}

/**
 * Broad building-work groups only. These are working groups for organizing a manual
 * take-off, not a claim of compliance with the official ปร.4 category list: that mapping
 * needs the DPT form source, which is roadmap item IP-042.
 */
export const TAKEOFF_CATEGORIES = [
  { code: "structure", label: "งานโครงสร้าง" },
  { code: "architecture", label: "งานสถาปัตยกรรม" },
  { code: "electrical", label: "งานระบบไฟฟ้าและสื่อสาร" },
  { code: "sanitary", label: "งานระบบสุขาภิบาลและดับเพลิง" },
  { code: "site", label: "งานภายนอกและงานเตรียมพื้นที่" }
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
