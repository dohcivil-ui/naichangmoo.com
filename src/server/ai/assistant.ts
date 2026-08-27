import {
  PROPOSAL_TTL_MS,
  type AssistantProposal,
  type AssistantQuotaView,
  type AssistantRefusal,
  type AssistantRequest,
  type AssistantResult,
  type ProposalDecision
} from "@/server/ai/assistant-contract";
import {
  completeProposal,
  failProposal,
  hashOf,
  loadProposal,
  proposalId as newProposalId,
  recordDecision,
  reserveProposal
} from "@/server/ai/assistant-audit";
import {
  checkDailySpendBrake,
  checkMonthlyQuota,
  consumeBurstAllowance,
  consumeMonthlyQuota
} from "@/server/ai/assistant-quota";
import { askWithFallback } from "@/server/ai/failover";
import { cleanForDisplay, collectStrings, findFieldNames } from "@/server/ai/output-filter";
import { BAHT_PER_USD } from "@/server/ai/provider";
import { findSkill, skillSourceIsUsable } from "@/server/ai/skill-registry";
import "@/server/ai/skills";
import { decideAppCapability } from "@/server/app-access";

/**
 * ประตูเดียวของผู้ช่วย AI ทุกแอป
 *
 * ทุกอย่างที่ผิดแล้วเจ็บ — สิทธิ์ เพดานค่าใช้จ่าย ที่มาของข้อมูล ร่องรอยว่าใครเสนออะไร —
 * อยู่ในไฟล์นี้ไฟล์เดียว ไม่ใช่กระจายอยู่ในเจ็ดแอปคูณเจ็ดจังหวะ ไฟล์นี้ **ไม่รู้จักชื่อแอปสักตัว**
 * มันรู้จักแค่ทะเบียนทักษะ เพิ่มแอปใหม่จึงไม่ต้องแก้อะไรตรงนี้เลย
 *
 * ลำดับของด่านไม่ได้เรียงตามความสะดวก แต่เรียงตาม **อะไรที่ต้องรู้ก่อนจะเสียอะไร**
 *
 *   ตรวจสิทธิ์ก่อนนับโควตา — คนที่ไม่มีสิทธิ์ต้องไม่เสียโควตาจากการถูกปฏิเสธ
 *   ตรวจเพดานก่อนเรียกแบบจำลอง — เพดานที่ตรวจหลังเสียเงินไม่ใช่เพดาน
 *   จองแถวประวัติก่อนเรียกแบบจำลอง — เงินที่ออกไปโดยไม่มีร่องรอยคือเงินที่อธิบายไม่ได้
 *   นับโควตาหลังแบบจำลองตอบสำเร็จ — ระบบของเราล่มแล้วผู้ใช้ต้องไม่เป็นคนจ่าย
 */

export type Actor = { id: string } | null;

const refuse = (
  reason: AssistantRefusal["reason"],
  message: string,
  quota?: AssistantQuotaView
): AssistantRefusal => ({ ok: false, reason, message, quota });

const toMicroUsd = (costBaht: number) => Math.round((costBaht / BAHT_PER_USD) * 1_000_000);

export async function runAssistant(
  actor: Actor,
  request: AssistantRequest,
  now = new Date()
): Promise<AssistantResult> {
  if (!actor) {
    return refuse("not_signed_in", "ต้องเข้าสู่ระบบก่อนจึงจะใช้ผู้ช่วยได้");
  }

  const skill = findSkill(request.app, request.verb);
  if (!skill) {
    return refuse("unavailable", "แอปนี้ยังไม่มีผู้ช่วยสำหรับงานที่ขอ");
  }

  // ADR 0003 ปิด `expired_read_only` ให้แล้วผ่าน `run_ai` จึงไม่ต้องเช็คสถานะซ้ำที่นี่
  const access = await decideAppCapability(actor.id, request.app, "run_ai", now);
  if (!access.allowed) {
    return refuse(
      "not_entitled",
      access.reason === "app_not_open"
        ? "แอปนี้ยังไม่เปิดใช้งาน ผู้ช่วยจึงยังใช้ไม่ได้"
        : "สิทธิ์ใช้งานปัจจุบันยังใช้ผู้ช่วยไม่ได้"
    );
  }

  /*
   * ชุดข้อมูลที่ยังไม่มีใครเซ็นรับรอง ใช้ได้เฉพาะทักษะที่ไม่คืนตัวเลข
   * ล้อแบบเดียวกับที่ `computeK` และ `findFactorFTable` ปฏิเสธอยู่แล้วเมื่อ `reviewedBy` เป็น null
   */
  if (!skillSourceIsUsable(skill)) {
    return refuse(
      "source_not_reviewed",
      `${skill.source?.document ?? "ชุดข้อมูลที่ใช้"} ยังไม่มีผู้รับรองการถอดข้อมูลเทียบเอกสารต้นฉบับ จึงยังใช้กับงานที่ต้องคืนตัวเลขไม่ได้`
    );
  }

  const projected = skill.project(request.input);
  if (!projected.ok) {
    return refuse("input_incomplete", projected.message);
  }

  if (!(await consumeBurstAllowance(actor.id, now))) {
    return refuse("over_monthly_cap", "กดถี่เกินไป รออีกสักครู่แล้วลองใหม่");
  }

  const quota = await checkMonthlyQuota(actor.id, access.state, now, access.viaAdministrator);
  if (!quota.ok) {
    return refuse(quota.reason, quota.message, quota.view);
  }

  const brake = await checkDailySpendBrake(now);
  if (!brake.ok) {
    return refuse(
      "over_monthly_cap",
      "ผู้ช่วยของทั้งระบบหยุดชั่วคราวเพราะถึงเพดานค่าใช้จ่ายของวันนี้ พรุ่งนี้ใช้ได้ตามปกติ",
      quota.view
    );
  }

  const task = skill.buildTask(projected.value, request.facts ?? []);
  const promptHash = hashOf({ system: skill.system, task });
  const id = newProposalId();

  try {
    await reserveProposal({
      id,
      actorId: actor.id,
      organizationId: access.organizationId,
      app: skill.app,
      verb: skill.verb,
      subject: request.subject,
      modelId: skill.model,
      promptHash
    });
  } catch {
    // จดไม่ได้ก็ไม่เรียก ร่างที่ไม่มีประวัติคือร่างที่ตามรอยไม่ได้ในวันที่มีคนถาม
    return refuse("unavailable", "ยังบันทึกประวัติการใช้ผู้ช่วยไม่ได้ จึงยังไม่เรียกผู้ช่วย ลองใหม่อีกครั้ง", quota.view);
  }

  const answer = await askWithFallback(
    skill.model,
    skill.fallbackModel,
    { system: skill.system, user: task, schema: skill.schema, schemaName: skill.schemaName, maxTokens: skill.maxTokens },
    now.getTime()
  );

  if (!answer.ok) {
    await failProposal(id, `${answer.reason}: ${answer.message}`);
    const reason = answer.reason === "no_api_key" ? "no_api_key" : answer.reason === "refused" ? "refused" : answer.reason === "unparsable" ? "unparsable" : "unavailable";
    return refuse(reason, answer.message, quota.view);
  }

  const draft = cleanForDisplay(answer.data);
  const assumptions = cleanForDisplay(skill.assumptions(draft));
  const citations = skill.citations(projected.value);
  const warnings = [...skill.warnings(projected.value)];

  /*
   * ชื่อฟิลด์ภาษาอังกฤษที่หลุดมา ไม่ทิ้งคำตอบทั้งชุด เพราะเงินจ่ายไปแล้วและเนื้อหาที่เหลือยังใช้ได้
   * แต่บอกผู้ใช้ตรง ๆ และบันทึกไว้ เพื่อให้รู้ว่า prompt ของทักษะไหนต้องแก้ ไม่ใช่เดาเอา
   */
  const leaked = findFieldNames(collectStrings([draft, assumptions]).join(" "));
  if (leaked.length > 0) {
    warnings.push("ผู้ช่วยเผลอใช้ศัพท์ทางเทคนิคบางคำในข้อความ ถ้าอ่านไม่เข้าใจให้ข้ามคำนั้นได้");
  }

  const costMicroUsd = toMicroUsd(answer.costBaht);
  const modelUsed = answer.modelUsed ?? skill.model;

  await completeProposal({
    id,
    actorId: actor.id,
    organizationId: access.organizationId,
    app: skill.app,
    verb: skill.verb,
    subject: request.subject,
    modelId: modelUsed,
    projectedInput: projected.value,
    draft,
    assumptions,
    citations,
    warnings,
    inputTokens: answer.usage.inputTokens,
    outputTokens: answer.usage.outputTokens,
    costMicroUsd,
    elapsedMs: answer.elapsedMs
  });

  const spent = await consumeMonthlyQuota(actor.id, access.state, now, access.viaAdministrator);

  const proposal: AssistantProposal = {
    proposalId: id,
    app: skill.app,
    verb: skill.verb,
    draft,
    assumptions,
    citations,
    modelId: modelUsed,
    promptHash,
    usage: {
      inputTokens: answer.usage.inputTokens,
      outputTokens: answer.usage.outputTokens,
      costMicroUsd,
      elapsedMs: answer.elapsedMs
    },
    quota: spent,
    warnings
  };

  return { ok: true, proposal };
}

export type SettleInput = {
  proposalId: string;
  decision: Exclude<ProposalDecision, "proposed" | "expired">;
  /** ช่องที่ผู้ใช้เลือกเก็บไว้ ใช้เมื่อรับบางส่วน */
  changedFields?: string[];
  beforeHash?: string;
  afterHash?: string;
};

export type SettleResult =
  | { ok: true; decision: ProposalDecision }
  | { ok: false; reason: "not_found" | "not_yours" | "already_settled" | "expired"; message: string };

/**
 * คนตัดสิน ไม่ใช่ระบบ
 *
 * ทุกร่างต้องผ่านทางนี้ ไม่มีเส้นทางไหนที่ค่าจากแบบจำลองจะไปนั่งในข้อมูลจริงได้โดยไม่มีคนกด
 * และการปฏิเสธก็ถูกบันทึกเท่ากับการรับ เพราะอัตราการถูกปฏิเสธคือมาตรวัดเดียวที่บอกได้ว่า
 * ผู้ช่วยตัวไหนควรเปลี่ยนรุ่นหรือแก้ prompt
 */
export async function settleProposal(actor: Actor, input: SettleInput, now = new Date()): Promise<SettleResult> {
  if (!actor) return { ok: false, reason: "not_yours", message: "ต้องเข้าสู่ระบบก่อน" };

  const proposal = await loadProposal(input.proposalId);
  if (!proposal) return { ok: false, reason: "not_found", message: "ไม่พบข้อเสนอนี้" };
  if (proposal.actorId !== actor.id) return { ok: false, reason: "not_yours", message: "ข้อเสนอนี้ไม่ใช่ของบัญชีนี้" };
  if (proposal.decision !== "proposed") {
    return { ok: false, reason: "already_settled", message: "ข้อเสนอนี้ถูกตัดสินไปแล้ว" };
  }

  // หมดอายุตรวจตอนนี้ ไม่มีงานเบื้องหลังมากวาด เพราะสถานะที่ถูกต้องคือสิ่งที่ตอบตอนมีคนถาม
  if (now.getTime() - proposal.createdAt.getTime() > PROPOSAL_TTL_MS) {
    await recordDecision({ proposal, decision: "expired", decidedBy: actor.id, changedFields: [], now });
    return { ok: false, reason: "expired", message: "ข้อเสนอนี้เกินหนึ่งวันแล้ว กดขอใหม่เพื่อให้ผู้ช่วยดูข้อมูลปัจจุบัน" };
  }

  await recordDecision({
    proposal,
    decision: input.decision,
    decidedBy: actor.id,
    changedFields: input.changedFields ?? [],
    beforeHash: input.beforeHash,
    afterHash: input.afterHash,
    now
  });

  return { ok: true, decision: input.decision };
}
