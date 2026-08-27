"use server";

import { WEIGHT_SCALE, normaliseWeights, type PlanActivity } from "@/lib/work-plan";
import type { Milestone } from "@/lib/payment-milestone";
import { MODELS, askForJson, isModelId, type ModelId } from "@/server/ai/provider";
import { WORK_PLAN_SYSTEM, buildWorkPlanTask, workPlanSchema, type WorkPlanDraft, PLAN_REVIEW_SYSTEM, buildPlanReviewTask, planReviewSchema } from "@/server/ai/work-plan-prompt";

/**
 * ผู้ช่วยร่างและแก้แผนงาน
 *
 * เส้นแบ่งหน้าที่ที่สำคัญที่สุดของไฟล์นี้: **แบบจำลองเสนอโครงสร้างและสัดส่วน ส่วนโค้ดของเราคิดเงิน**
 *
 * แบบจำลองคืนค่ามาเป็นน้ำหนักหน่วย ppm กับจำนวนวันเท่านั้น ไม่เคยคืนเป็นบาท เพราะเงินในระบบนี้
 * เป็น satang แบบ bigint ที่ต้องบวกกันได้ลงตัวเป๊ะทุกครั้ง (ดู src/lib/thai-baht.ts) การให้
 * แบบจำลองคำนวณเงินเองแปลว่ายอมให้เลขทศนิยมที่ตรวจไม่ได้ไหลเข้าเอกสารที่ใช้ยื่นเบิก
 * ที่นี่จึงรับแค่สัดส่วน แล้วแปลงเป็นเงินด้วยกฎเดียวกับที่ทั้งระบบใช้ และปรับให้รวมได้ 100% เสมอ
 *
 * ถ้าแบบจำลองส่งน้ำหนักที่รวมกันไม่ครบหรือเกิน โค้ดนี้จะเกลี่ยให้เอง ไม่ปฏิเสธทั้งคำตอบ
 * เพราะร่างที่ใกล้เคียงแล้วให้คนแก้ต่อ มีประโยชน์กว่าข้อความว่าล้มเหลว
 */

/**
 * แบบจำลองที่ใช้จริง ตั้งค่าได้ด้วย WORK_PLAN_MODEL ใน .env
 *
 * ค่าเริ่มต้นเป็น GPT-5.4 mini จากผลวัดด้วยโจทย์จริงเมื่อ 2026-08-26 เทียบสี่ตัว
 * (scripts/compare-work-plan-models.ts) มันเร็วกว่าตัวรองลงมาสิบเท่าที่ 8.9 วินาที
 * และถูกกว่า DeepSeek V4 Flash สามเท่าที่ 0.22 บาทต่อครั้ง ทั้งที่ราคาต่อ token แพงกว่า
 * เพราะมันเขียนกระชับกว่า และค่า output คือตัวกำหนดต้นทุนของงานนี้
 *
 * ข้อด้อยของมันคือผลรวมน้ำหนักคลาดจาก 1,000,000 อยู่บ้าง ซึ่งไม่กระทบยอดเงิน
 * เพราะ normaliseWeights() เกลี่ยตามสัดส่วนก่อนคิดเงินเสมอ สัดส่วนสัมพัทธ์จึงคงเดิม
 *
 * DeepSeek V4 Flash แม่นกว่าทุกเกณฑ์แต่ใช้เวลา 95 วินาที ซึ่งนานเกินกว่าที่คนจะรอ
 * เก็บไว้เป็นตัวสำรองเมื่อ OpenAI ล่ม ส่วน GPT-5 nano ตกรอบเพราะลืมผูกงานเข้างวด 7 รายการ
 */
const defaultModel = (): ModelId => {
  const configured = process.env.WORK_PLAN_MODEL;
  return configured && isModelId(configured) ? configured : "gpt-5.4-mini";
};

type Draft = WorkPlanDraft;

/**
 * ค่างานส่งกลับเป็นข้อความ ไม่ใช่ bigint
 *
 * server action ส่งค่าข้ามเน็ตด้วยการ serialize และ bigint เดินทางข้ามเส้นนี้ไม่ได้เสมอไป
 * แปลงกลับเป็น bigint ที่ฝั่งหน้าจอทันทีที่รับ เพื่อไม่ให้มีเลขทศนิยมโผล่ระหว่างทาง
 */
export type AssistantPlan = {
  note: string;
  activities: (Omit<PlanActivity, "costSatang"> & { costSatang: string })[];
  milestones: Milestone[];
};

export type AssistantResult =
  | { ok: true; plan: AssistantPlan }
  | { ok: false; reason: "no_api_key" | "disabled_in_production" | "refused" | "unavailable"; message: string };

const toPlan = (draft: Draft, contractSatang: bigint, durationDays: number): AssistantPlan => {
  const weights = normaliseWeights(draft.activities.map((activity) => activity.weightPpm));

  let allocated = 0n;
  const activities: AssistantPlan["activities"] = draft.activities.map((activity, index) => {
    const isLast = index === draft.activities.length - 1;
    const costSatang = isLast ? contractSatang - allocated : (contractSatang * weights[index]!) / WEIGHT_SCALE;
    allocated += costSatang;

    const start = Math.max(0, Math.min(activity.startOffsetDays, durationDays));
    return {
      id: `ai-${activity.number}-${index}`,
      number: activity.number,
      title: activity.title,
      startOffsetDays: start,
      durationDays: Math.max(1, Math.min(activity.durationDays, durationDays - start || 1)),
      costSatang: costSatang.toString()
    };
  });

  const byNumber = new Map(activities.map((activity) => [activity.number, activity.id]));
  const claimed = new Set<string>();
  const milestones: Milestone[] = draft.milestones.map((milestone, index) => ({
    id: `ai-milestone-${index + 1}`,
    ordinal: index + 1,
    title: milestone.title,
    activityIds: milestone.activityNumbers
      .map((number) => byNumber.get(number))
      .filter((id): id is string => id !== undefined && !claimed.has(id) && (claimed.add(id), true))
  }));

  // กิจกรรมที่แบบจำลองลืมผูกเข้างวด ต้องไม่หายไปเงียบ ๆ จึงต่อท้ายงวดสุดท้าย
  const orphans = activities.filter((activity) => !claimed.has(activity.id)).map((activity) => activity.id);
  if (orphans.length > 0) {
    if (milestones.length === 0) {
      milestones.push({ id: "ai-milestone-1", ordinal: 1, title: "งวดที่ 1", activityIds: orphans });
    } else {
      const last = milestones[milestones.length - 1]!;
      milestones[milestones.length - 1] = { ...last, activityIds: [...last.activityIds, ...orphans] };
    }
  }

  return { note: draft.note, activities, milestones };
};

export type AssistantRequest = {
  projectName: string;
  contractBaht: string;
  durationDays: number;
  templateLabel: string;
  /** คำสั่งแก้เป็นภาษาคน ว่างไว้เมื่อเป็นการร่างครั้งแรก */
  instruction?: string;
  /** แผนปัจจุบัน ส่งไปเมื่อเป็นการแก้ ไม่ใช่การร่างใหม่ */
  current?: { number: string; title: string; weightPpm: string; startOffsetDays: number; durationDays: number }[];
};

export async function askWorkPlanAssistant(
  request: AssistantRequest,
  contractSatangText: string
): Promise<AssistantResult> {
  /*
   * หน้าต้นแบบเปิดได้โดยไม่ต้องเข้าสู่ระบบ การปล่อยให้ action ที่เรียก API แบบมีค่าใช้จ่าย
   * ทำงานบนเครื่องจริงจึงเท่ากับเปิดให้ใครก็ได้ใช้เงินของเรา ปิดไว้ที่นี่จนกว่าจะมีระบบสิทธิ์จริง
   */
  if (process.env.NODE_ENV === "production") {
    return { ok: false, reason: "disabled_in_production", message: "ผู้ช่วยยังปิดอยู่นอกเครื่องพัฒนา จนกว่าจะผูกกับระบบสิทธิ์" };
  }

  const model = defaultModel();
  const spec = MODELS[model];

  if (!process.env[spec.apiKeyEnv]) {
    return {
      ok: false,
      reason: "no_api_key",
      message: `ยังไม่ได้ตั้ง ${spec.apiKeyEnv} ในไฟล์ .env จึงยังเรียกผู้ช่วยไม่ได้`
    };
  }

  const contractSatang = BigInt(contractSatangText);

  const result = await askForJson(
    model,
    {
      system: WORK_PLAN_SYSTEM,
      user: buildWorkPlanTask(request),
      schema: workPlanSchema,
      schemaName: "work_plan"
    },
    Date.now()
  );

  if (!result.ok) {
    const reason = result.reason === "no_api_key" ? "no_api_key" : result.reason === "refused" ? "refused" : "unavailable";
    return { ok: false, reason, message: result.message };
  }

  if (result.data.activities.length === 0) {
    return { ok: false, reason: "unavailable", message: "ผู้ช่วยตอบกลับมาไม่ครบ ลองกดใหม่อีกครั้ง" };
  }

  return { ok: true, plan: toPlan(result.data, contractSatang, request.durationDays) };
}

/**
 * ผู้ช่วยตรวจแผน
 *
 * จุดต่างที่ทำให้เหนือคู่แข่ง: คู่แข่งไม่มี AI ตรวจแผนเลย และของเราคำนวณตัวเลขเสี่ยงฝั่งเราจาก
 * BigInt แล้วให้แบบจำลองแค่เรียบเรียงเป็นคำเตือน ตัวเลขเงินจึงเชื่อถือได้เท่ากับที่ระบบคิดเอง
 */
export type ReviewFinding = { severity: "high" | "medium" | "low"; title: string; detail: string };

export type ReviewResult =
  | { ok: true; findings: ReviewFinding[] }
  | { ok: false; reason: "no_api_key" | "disabled_in_production" | "unavailable"; message: string };

export type ReviewMilestoneInput = {
  title: string;
  /** ร้อยละของสัญญาที่ระบบคำนวณแล้ว เป็นข้อความ */
  percentOfContract: string;
  /** มูลค่างานงวดนี้เป็น satang ข้อความ */
  periodWorkSatang: string;
  activityTitles: string[];
  /** ช่วงครึ่งเดือนที่งวดนี้คาดว่าจะไปถึง */
  finishPeriod: number;
};

export type ReviewRequest = {
  projectName: string;
  contractBaht: string;
  durationDays: number;
  milestones: ReviewMilestoneInput[];
};

const formatThaiBaht = (satang: bigint) => {
  const baht = satang / 100n;
  return baht.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export async function reviewWorkPlan(request: ReviewRequest): Promise<ReviewResult> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, reason: "disabled_in_production", message: "ผู้ช่วยยังปิดอยู่นอกเครื่องพัฒนา" };
  }

  const model = defaultModel();
  const spec = MODELS[model];
  if (!process.env[spec.apiKeyEnv]) {
    return { ok: false, reason: "no_api_key", message: `ยังไม่ได้ตั้ง ${spec.apiKeyEnv} ในไฟล์ .env` };
  }

  // ตัวเลขเสี่ยงคำนวณฝั่งเราทั้งหมด แบบจำลองแค่เรียบเรียง
  const contractSatang = BigInt(request.contractBaht.replace(/,/g, "")) * 100n;
  const facts: string[] = [];

  const heaviest = [...request.milestones].sort(
    (a, b) => Number(BigInt(b.periodWorkSatang) - BigInt(a.periodWorkSatang))
  )[0];
  if (heaviest && contractSatang > 0n) {
    const share = (BigInt(heaviest.periodWorkSatang) * 100n) / contractSatang;
    facts.push(`งวดที่หนักที่สุดคือ ${heaviest.title} คิดเป็น ${share}% ของมูลค่าสัญญา`);
  }

  // เงินทุนหมุนเวียนหยาบ: มูลค่างานก่อนงวดแรกจะได้รับเงิน ประมาณจากงวดแรก
  const firstMilestone = request.milestones[0];
  if (firstMilestone) {
    facts.push(
      `เงินงวดแรก ${firstMilestone.title} มูลค่างาน ${formatThaiBaht(BigInt(firstMilestone.periodWorkSatang))} บาท ` +
        `จะได้รับหลังผ่านการตรวจรับ ผู้รับจ้างต้องสำรองค่าวัสดุและค่าแรงก่อนหน้านั้นเอง`
    );
  }
  facts.push(`มูลค่าสัญญารวม ${formatThaiBaht(contractSatang)} บาท จำนวนงวด ${request.milestones.length} งวด`);

  const result = await askForJson(
    model,
    {
      system: PLAN_REVIEW_SYSTEM,
      user: buildPlanReviewTask({
        projectName: request.projectName,
        contractBaht: request.contractBaht,
        durationDays: request.durationDays,
        facts,
        milestones: request.milestones.map((milestone) => ({
          title: milestone.title,
          percentOfContract: milestone.percentOfContract,
          activityTitles: milestone.activityTitles
        }))
      }),
      schema: planReviewSchema,
      schemaName: "plan_review"
    },
    Date.now()
  );

  if (!result.ok) {
    return { ok: false, reason: "unavailable", message: result.message };
  }

  return { ok: true, findings: result.data.findings };
}
