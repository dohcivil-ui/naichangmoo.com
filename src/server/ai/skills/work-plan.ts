import { defineSkill, type AssistantSkill } from "@/server/ai/skill-registry";
import {
  PLAN_REVIEW_SYSTEM,
  WORK_PLAN_SYSTEM,
  buildPlanReviewTask,
  buildWorkPlanTask,
  planReviewSchema,
  workPlanSchema,
  type PlanReview,
  type WorkPlanDraft
} from "@/server/ai/work-plan-prompt";

/**
 * ผู้ช่วยแผนงานในรูปทักษะที่ลงทะเบียน
 *
 * **ใช้ `system` และ `schema` ตัวเดียวกับที่ `work-plan-assistant.ts` เรียกอยู่วันนี้**
 * ไม่ได้เขียน prompt ขึ้นใหม่ เพราะ prompt ชุดนั้นผ่านการวัดด้วยโจทย์จริงมาแล้ว
 * (`scripts/compare-work-plan-models.ts`) การเขียนสำเนาใหม่จะทำให้ผลวัดที่มีอยู่ใช้ไม่ได้
 * และเราจะเลือกรุ่นจากหลักฐานที่ไม่ตรงกับของที่ผู้ใช้เจอ
 *
 * ไฟล์นี้เพิ่มสิ่งที่ของเดิมไม่มีสามอย่าง: ตัดข้อมูลส่วนเกินก่อนเข้า prompt · ส่งข้อเท็จจริงผ่าน
 * บล็อกที่คั่นชัดเจน · และประกาศว่าคำตอบไหลเข้าการคำนวณต่อหรือไม่ ส่วนการย้ายหน้าจอ
 * ให้มาเรียกทางนี้คือ IP-184 ของเดิมจึงยังเดินเส้นทางเก่าอยู่จนกว่ารุ่นนั้นจะถึง
 */

const MODEL = "gpt-5.4-mini" as const;
/** ช้ากว่าราวสิบเท่าแต่ไม่ดับพร้อมกับ OpenAI ใช้เฉพาะตอนค่ายหลักล้ม ไม่ใช่ตอนมันปฏิเสธ */
const FALLBACK = "deepseek-v4-flash" as const;

type PlanShape = {
  projectName: string;
  contractBaht: string;
  durationDays: number;
  templateLabel: string;
  instruction?: string;
  current?: { number: string; title: string; weightPpm: string; startOffsetDays: number; durationDays: number }[];
};

const asRecord = (input: unknown): Record<string, unknown> | null =>
  typeof input === "object" && input !== null ? (input as Record<string, unknown>) : null;

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);
const whole = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : null;

/**
 * ตัดข้อมูลส่วนเกินก่อนเข้า prompt
 *
 * คัดทีละช่องที่ต้องการ ไม่ใช่ลบช่องที่ไม่ต้องการออกจากก้อนที่ได้มา — สองวิธีนี้ต่างกันตรงที่
 * วิธีหลังจะปล่อยช่องใหม่ที่ใครเพิ่มเข้ามาวันหลังไหลออกไปโดยไม่มีใครรู้ อีเมล รหัสผู้ใช้
 * รหัสองค์กร และคีย์ไฟล์ในที่เก็บ จึงไม่มีทางเดินทางถึงค่ายแบบจำลองผ่านทางนี้ได้เลย
 */
function projectPlan(input: unknown): { ok: true; value: PlanShape } | { ok: false; message: string } {
  const source = asRecord(input);
  if (!source) return { ok: false, message: "ไม่ได้รับข้อมูลโครงการ" };

  const projectName = text(source.projectName);
  const contractBaht = text(source.contractBaht);
  const durationDays = whole(source.durationDays);
  if (!projectName) return { ok: false, message: "ยังไม่ได้ตั้งชื่อโครงการ" };
  if (!contractBaht) return { ok: false, message: "ยังไม่ได้กรอกมูลค่าสัญญา" };
  if (!durationDays) return { ok: false, message: "ยังไม่ได้กรอกระยะเวลาโครงการเป็นจำนวนวัน" };

  const current = Array.isArray(source.current)
    ? source.current.flatMap((row) => {
        const activity = asRecord(row);
        if (!activity) return [];
        const number = text(activity.number);
        const title = text(activity.title);
        if (!number || !title) return [];
        return [
          {
            number,
            title,
            weightPpm: text(activity.weightPpm) ?? "0",
            startOffsetDays: whole(activity.startOffsetDays) ?? 0,
            durationDays: whole(activity.durationDays) ?? 1
          }
        ];
      })
    : undefined;

  return {
    ok: true,
    value: {
      projectName,
      contractBaht,
      durationDays,
      templateLabel: text(source.templateLabel) ?? "งานอาคารทั่วไป",
      instruction: text(source.instruction) ?? undefined,
      current: current && current.length > 0 ? current : undefined
    }
  };
}

/**
 * โจทย์ของการร่างและการแก้
 *
 * เรียก `buildWorkPlanTask` ตัวเดียวกับที่ server action เดิมและสคริปต์เทียบรุ่นเรียก แล้วส่ง
 * ข้อเท็จจริงที่ระบบคำนวณแล้วผ่านช่อง `facts` ซึ่งกลายเป็นบล็อกมาตรฐานต่อท้าย
 *
 * มูลค่าสัญญายังอยู่ในบรรทัดโจทย์เหมือนเดิม เพราะมันคือ *บริบท* ที่ระบบรู้อยู่แล้ว ไม่ใช่
 * โจทย์ให้แบบจำลองคำนวณ และ `WORK_PLAN_SYSTEM` สั่งไว้ตรง ๆ ว่าห้ามคืนค่าเป็นเงินบาท
 */
const buildDraftTask = (projected: PlanShape, facts: readonly string[]): string =>
  buildWorkPlanTask({ ...projected, facts });

const planDraftSkill = defineSkill<PlanShape, WorkPlanDraft>({
  app: "work-plan",
  verb: "draft",
  label: "ร่างแผนงานชุดแรก",
  system: WORK_PLAN_SYSTEM,
  schema: workPlanSchema,
  schemaName: "work_plan",
  model: MODEL,
  fallbackModel: FALLBACK,
  // สัดส่วนน้ำหนักไหลเข้าการแปลงเป็น satang ต่อ จึงประกาศตรง ๆ ว่าคืนตัวเลข
  returnsNumbers: true,
  // ไม่ได้อ้างเอกสารฉบับใด สัดส่วนที่เสนอเป็นข้อเสนอให้คนตรวจ ไม่ใช่ตัวเลขที่ถอดจากหนังสือ
  source: null,
  project: projectPlan,
  buildTask: buildDraftTask,
  citations: () => [],
  assumptions: (draft) => (draft.note.trim() === "" ? [] : [draft.note.trim()]),
  warnings: () => []
});

const planReviseSkill = defineSkill<PlanShape, WorkPlanDraft>({
  app: "work-plan",
  verb: "revise",
  label: "แก้แผนตามคำสั่งภาษาคน",
  system: WORK_PLAN_SYSTEM,
  schema: workPlanSchema,
  schemaName: "work_plan",
  model: MODEL,
  fallbackModel: FALLBACK,
  returnsNumbers: true,
  source: null,
  project: (input) => {
    const projected = projectPlan(input);
    if (!projected.ok) return projected;
    if (!projected.value.instruction) return { ok: false, message: "ยังไม่ได้พิมพ์คำสั่งว่าต้องการแก้อะไร" };
    if (!projected.value.current) return { ok: false, message: "ยังไม่มีแผนปัจจุบันให้แก้" };
    return projected;
  },
  buildTask: buildDraftTask,
  citations: () => [],
  assumptions: (draft) => (draft.note.trim() === "" ? [] : [draft.note.trim()]),
  warnings: () => []
});

type ReviewShape = {
  projectName: string;
  contractBaht: string;
  durationDays: number;
  milestones: { title: string; percentOfContract: string; activityTitles: string[] }[];
};

const planCritiqueSkill = defineSkill<ReviewShape, PlanReview>({
  app: "work-plan",
  verb: "critique",
  label: "ตรวจแผนก่อนยื่นกรรมการ",
  system: PLAN_REVIEW_SYSTEM,
  schema: planReviewSchema,
  schemaName: "plan_review",
  model: MODEL,
  fallbackModel: FALLBACK,
  /**
   * คืนคำเตือนเป็นข้อความล้วน ตัวเลขเสี่ยงทุกตัวคำนวณฝั่งเราจาก BigInt แล้วส่งเข้าบล็อก
   * ข้อเท็จจริงให้แบบจำลองอ้าง นี่คือจังหวะที่คู่แข่งไม่มีเลยแม้แต่จุดเดียวในทั้งสิบเมนู
   */
  returnsNumbers: false,
  source: null,
  project: (input) => {
    const source = asRecord(input);
    if (!source) return { ok: false, message: "ไม่ได้รับข้อมูลแผน" };
    const projectName = text(source.projectName);
    const contractBaht = text(source.contractBaht);
    const durationDays = whole(source.durationDays);
    if (!projectName) return { ok: false, message: "ยังไม่ได้ตั้งชื่อโครงการ" };
    if (!contractBaht) return { ok: false, message: "ยังไม่ได้กรอกมูลค่าสัญญา" };
    if (!durationDays) return { ok: false, message: "ยังไม่ได้กรอกระยะเวลาโครงการเป็นจำนวนวัน" };

    const milestones = Array.isArray(source.milestones)
      ? source.milestones.flatMap((row) => {
          const milestone = asRecord(row);
          const title = milestone ? text(milestone.title) : null;
          if (!milestone || !title) return [];
          return [
            {
              title,
              percentOfContract: text(milestone.percentOfContract) ?? "0",
              activityTitles: Array.isArray(milestone.activityTitles)
                ? milestone.activityTitles.flatMap((item) => {
                    const value = text(item);
                    return value ? [value] : [];
                  })
                : []
            }
          ];
        })
      : [];

    if (milestones.length === 0) return { ok: false, message: "ยังไม่มีงวดงานให้ตรวจ" };
    return { ok: true, value: { projectName, contractBaht, durationDays, milestones } };
  },
  buildTask: (projected, facts) =>
    buildPlanReviewTask({
      projectName: projected.projectName,
      contractBaht: projected.contractBaht,
      durationDays: projected.durationDays,
      facts,
      milestones: projected.milestones
    }),
  citations: () => [],
  assumptions: () => [],
  warnings: () => []
});

export const workPlanSkills: AssistantSkill[] = [planDraftSkill, planReviseSkill, planCritiqueSkill];
