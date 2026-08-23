import { z } from "zod";
import type { Capability, EffectiveEntitlementState } from "@/lib/entitlement";

// PROJECT.md scopes ESTIMETR to building work, and projects.work_type has no other
// approved value yet, so it is set by the server instead of asked for in the form.
export const ESTIMETR_WORK_TYPE = "building";

export const PROJECT_NAME_MIN = 3;
export const PROJECT_NAME_MAX = 120;

const projectNameSchema = z
  .string()
  .trim()
  .min(PROJECT_NAME_MIN, `ชื่อโครงการต้องมีอย่างน้อย ${PROJECT_NAME_MIN} ตัวอักษร`)
  .max(PROJECT_NAME_MAX, `ชื่อโครงการยาวได้ไม่เกิน ${PROJECT_NAME_MAX} ตัวอักษร`)
  // Names end up in printed BOQ headers, so line breaks and control characters are refused here.
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "ชื่อโครงการต้องเป็นข้อความบรรทัดเดียว");

/**
 * Which costing stack this project's quantities will be priced through (ADR 0007).
 *
 * Asked once, at creation. A government estimate reaches its price by multiplying the cost of
 * the work by a published Factor F that already contains overhead, interest and profit; a
 * private one builds its price up from direct cost through the company's own margins. The two
 * numbers are not comparable, so switching a project between them later would silently change
 * what its stored figures mean.
 */
export const PROJECT_PATHS = [
  {
    code: "government",
    label: "งานราชการ",
    hint: "ราคากลางตามหลักเกณฑ์ ปร.4 ปร.5 ปร.6 และตาราง Factor F ที่ทางราชการประกาศ"
  },
  {
    code: "private",
    label: "งานเอกชน",
    hint: "ต้นทุนตรงบวกค่าดำเนินการและกำไรตามนโยบายของบริษัท"
  }
] as const;

export type ProjectPathCode = (typeof PROJECT_PATHS)[number]["code"];

export function isProjectPath(value: string): value is ProjectPathCode {
  return PROJECT_PATHS.some((path) => path.code === value);
}

export function projectPathLabel(code: string): string {
  return PROJECT_PATHS.find((path) => path.code === code)?.label ?? code;
}

export type ProjectFieldErrors = { name?: string; path?: string };

export type ProjectParseResult =
  | { ok: true; value: { name: string; path: ProjectPathCode } }
  | { ok: false; errors: ProjectFieldErrors };

export function parseProjectForm(formData: FormData): ProjectParseResult {
  const errors: ProjectFieldErrors = {};

  const parsed = projectNameSchema.safeParse(formData.get("name") ?? "");
  if (!parsed.success) errors.name = parsed.error.issues[0]?.message ?? "กรุณากรอกชื่อโครงการ";

  const path = String(formData.get("path") ?? "").trim();
  if (!isProjectPath(path)) errors.path = "เลือกสายงานราชการหรือเอกชน";

  if (!parsed.success || !isProjectPath(path)) return { ok: false, errors };
  return { ok: true, value: { name: parsed.data, path } };
}

type CreationCheckInput = {
  state: EffectiveEntitlementState;
  capabilities: Record<Capability, boolean>;
  projectCount: number;
  projectLimit: number | null;
};

/**
 * The reason a member cannot start a project, or null when they can. The same function
 * feeds the disabled control, the form page and the server action, so the screen and the
 * write path can never disagree about why something is blocked.
 */
export function projectCreationDenial(access: CreationCheckInput): string | null {
  if (access.state === "expired_read_only") {
    return "สิทธิ์ทดลองใช้หมดอายุแล้ว เปิดดูโครงการเดิมได้ แต่สร้างโครงการใหม่ไม่ได้ หากต้องการใช้งานต่อ ขอใบเสนอราคาสำหรับองค์กรได้";
  }
  if (access.state === "suspended") return "สิทธิ์การใช้งานถูกระงับ กรุณาติดต่อผู้ดูแลสิทธิ์";
  if (access.state === "not_started") return "สิทธิ์การใช้งานยังไม่เริ่ม จึงยังสร้างโครงการไม่ได้";
  if (access.state === "not_activated") {
    return "บัญชีนี้ยังไม่ได้เริ่มทดลองใช้ ESTIMETR กดเริ่มทดลองใช้ก่อนจึงจะสร้างโครงการได้";
  }

  if (access.projectLimit !== null && access.projectCount >= access.projectLimit) {
    return `สิทธิ์ปัจจุบันสร้างได้ ${access.projectLimit} โครงการ และใช้ครบแล้ว หากต้องการเพิ่มจำนวนโครงการ ขอใบเสนอราคาสำหรับองค์กรได้`;
  }
  if (!access.capabilities.create_project) return "บัญชีนี้ยังไม่มีสิทธิ์สร้างโครงการใน ESTIMETR";

  return null;
}
