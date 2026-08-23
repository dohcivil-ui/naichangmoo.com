"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPlatformSessionUser } from "@/lib/auth-session";
import { parseProjectForm, projectCreationDenial, type ProjectFieldErrors } from "@/lib/estimeter-project";
import { getEstimeterAccess } from "@/server/estimeter-access";
import { createProjectWithinLimit } from "@/server/estimeter/project-repository";

export type ProjectActionState = { ok: boolean; message: string; errors?: ProjectFieldErrors };

/**
 * A Server Action is a public POST endpoint, so session, entitlement and project cap are
 * checked here and not inherited from whichever page rendered the form.
 */
export async function createEstimeterProject(
  _previous: ProjectActionState | undefined,
  formData: FormData
): Promise<ProjectActionState> {
  const user = await getPlatformSessionUser(await headers());
  if (!user) return { ok: false, message: "ต้องเข้าสู่ระบบด้วยบัญชีนายช่างหมูก่อนสร้างโครงการ" };

  let access;
  try {
    access = await getEstimeterAccess(user.id);
  } catch {
    return { ok: false, message: "ขณะนี้ตรวจสอบสิทธิ์การใช้งานไม่ได้ กรุณาลองใหม่อีกครั้ง" };
  }

  const denial = projectCreationDenial(access);
  if (denial) return { ok: false, message: denial };

  const organizationId = access.organizationId;
  // Unreachable through the entitlement states that allow creation, but the write path must
  // not depend on that reasoning holding true after a future policy change.
  if (!organizationId) return { ok: false, message: "บัญชีนี้ยังไม่มีองค์กรสำหรับเก็บโครงการ" };

  const parsed = parseProjectForm(formData);
  if (!parsed.ok) return { ok: false, message: "กรุณาตรวจข้อมูลโครงการอีกครั้ง", errors: parsed.errors };

  const created = await createProjectWithinLimit({
    organizationId,
    ownerId: user.id,
    name: parsed.value.name,
    path: parsed.value.path,
    projectLimit: access.projectLimit,
    entitlementState: access.state
  });

  if (!created.ok) {
    return {
      ok: false,
      message:
        created.reason === "project_limit_reached"
          ? "จำนวนโครงการเต็มตามสิทธิ์ปัจจุบันแล้ว จึงไม่ได้สร้างโครงการใหม่"
          : "ไม่พบองค์กรของบัญชีนี้ กรุณากดเริ่มทดลองใช้ที่หน้า ESTIMETR ก่อน"
    };
  }

  revalidatePath("/apps/estimeter");
  // redirect throws a framework control-flow exception, so nothing after it runs.
  redirect(`/apps/estimeter/projects/${created.projectId}`);
}
