import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { assistantProposals, auditEvents } from "@/db/schema";
import type { AssistantVerb, Citation, ProposalDecision } from "@/server/ai/assistant-contract";

/**
 * ร่องรอยของผู้ช่วย — AI เสนออะไร และคนทำอะไรกับมัน
 *
 * ลำดับการเขียนคือสาระสำคัญทั้งหมดของไฟล์นี้ **จองแถวก่อนเรียกแบบจำลอง แล้วเติมทีหลัง**
 *
 * ถ้าเขียนแถวหลังโมเดลตอบ คำขอที่ล้มกลางทางจะไม่เหลือร่องรอยเลย ทั้งที่เงินออกไปแล้ว
 * และวันที่บิลมาเราจะอธิบายไม่ได้ว่าจ่ายไปกับอะไร ที่แย่กว่านั้นคือร่างที่ถูกปฏิเสธจะหายไป
 * จากประวัติ แล้วเราจะไม่มีวันรู้ว่าผู้ช่วยเสนอผิดบ่อยแค่ไหน ซึ่งเป็นตัวเลขเดียวที่บอกได้ว่า
 * ควรเปลี่ยนรุ่นหรือแก้ prompt
 *
 * นี่คือที่แรกในรีโปที่ `before_hash` กับ `after_hash` ของ `audit_events` มีค่าจริง ไม่ใช่ว่าง
 * ทั้งคอลัมน์ — ตอนเสนอ ทั้งคู่ตอบว่า "อินพุตหน้าตานี้ ทำให้ได้ร่างหน้าตานี้"
 */

const hashOf = (payload: unknown): string => createHash("sha256").update(JSON.stringify(payload ?? null)).digest("hex");

export const proposalId = () => `prop_${randomUUID()}`;

export type ReserveInput = {
  id: string;
  actorId: string;
  organizationId: string | null;
  app: string;
  verb: AssistantVerb;
  subject: string;
  modelId: string;
  promptHash: string;
};

/** เขียนแถวก่อนเงินออก คืนค่าเมื่อสำเร็จเท่านั้น ผู้เรียกต้องหยุดถ้าโยน */
export async function reserveProposal(input: ReserveInput): Promise<void> {
  await getDb().insert(assistantProposals).values({
    id: input.id,
    actorId: input.actorId,
    organizationId: input.organizationId,
    appSlug: input.app,
    verb: input.verb,
    subject: input.subject,
    modelId: input.modelId,
    promptHash: input.promptHash
  });
}

export type CompleteInput = {
  id: string;
  actorId: string;
  organizationId: string | null;
  app: string;
  verb: AssistantVerb;
  subject: string;
  /** รุ่นที่ตอบจริง อาจไม่ใช่รุ่นที่จองไว้ ถ้าสลับไปค่ายสำรอง */
  modelId: string;
  projectedInput: unknown;
  draft: unknown;
  assumptions: string[];
  citations: Citation[];
  warnings: string[];
  inputTokens: number;
  outputTokens: number;
  costMicroUsd: number;
  elapsedMs: number;
};

/** เติมแถวที่จองไว้ แล้วบันทึกเหตุการณ์ `ai.proposed` ก่อนคืนค่าให้หน้าจอ */
export async function completeProposal(input: CompleteInput): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .update(assistantProposals)
      .set({
        modelId: input.modelId,
        draft: input.draft as object,
        assumptions: input.assumptions,
        citations: input.citations,
        warnings: input.warnings,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        costMicroUsd: input.costMicroUsd,
        elapsedMs: input.elapsedMs,
        updatedAt: new Date()
      })
      .where(eq(assistantProposals.id, input.id));

    await tx.insert(auditEvents).values({
      id: `audit_${input.id}_proposed`,
      organizationId: input.organizationId,
      actorId: input.actorId,
      eventType: "ai.proposed",
      resourceType: "assistant_proposal",
      resourceId: input.id,
      correlationId: input.id,
      beforeHash: hashOf(input.projectedInput),
      afterHash: hashOf(input.draft),
      metadata: {
        appSlug: input.app,
        verb: input.verb,
        subject: input.subject,
        modelId: input.modelId,
        costMicroUsd: input.costMicroUsd,
        elapsedMs: input.elapsedMs,
        citationCount: input.citations.length,
        warningCount: input.warnings.length
      }
    });
  });
}

/** คำขอที่จ่ายเงินไปแล้วแต่ไม่ได้ร่างกลับมา ต้องอธิบายได้เหมือนกัน */
export async function failProposal(id: string, reason: string, costMicroUsd = 0, elapsedMs = 0): Promise<void> {
  await getDb()
    .update(assistantProposals)
    .set({ failureReason: reason.slice(0, 500), costMicroUsd, elapsedMs, updatedAt: new Date() })
    .where(eq(assistantProposals.id, id));
}

export type StoredProposal = {
  id: string;
  actorId: string;
  organizationId: string | null;
  appSlug: string;
  verb: string;
  subject: string;
  decision: ProposalDecision;
  createdAt: Date;
};

export async function loadProposal(id: string): Promise<StoredProposal | null> {
  const [row] = await getDb()
    .select({
      id: assistantProposals.id,
      actorId: assistantProposals.actorId,
      organizationId: assistantProposals.organizationId,
      appSlug: assistantProposals.appSlug,
      verb: assistantProposals.verb,
      subject: assistantProposals.subject,
      decision: assistantProposals.decision,
      createdAt: assistantProposals.createdAt
    })
    .from(assistantProposals)
    .where(eq(assistantProposals.id, id))
    .limit(1);

  return row ? { ...row, decision: row.decision as ProposalDecision } : null;
}

export type RecordDecisionInput = {
  proposal: StoredProposal;
  decision: Exclude<ProposalDecision, "proposed">;
  decidedBy: string;
  changedFields: string[];
  /** สถานะของสิ่งที่ถูกแก้ ก่อนและหลังรับข้อเสนอ ผู้เรียกเป็นคนรู้ว่ามันคืออะไร */
  beforeHash?: string;
  afterHash?: string;
  now?: Date;
};

const EVENT_OF: Record<Exclude<ProposalDecision, "proposed">, string> = {
  accepted: "ai.accepted",
  rejected: "ai.rejected",
  partially_accepted: "ai.partially_accepted",
  expired: "ai.expired"
};

export async function recordDecision(input: RecordDecisionInput): Promise<void> {
  const now = input.now ?? new Date();
  const db = getDb();

  await db.transaction(async (tx) => {
    await tx
      .update(assistantProposals)
      .set({
        decision: input.decision,
        decidedAt: now,
        decidedBy: input.decision === "expired" ? null : input.decidedBy,
        changedFields: input.changedFields,
        updatedAt: now
      })
      .where(eq(assistantProposals.id, input.proposal.id));

    await tx.insert(auditEvents).values({
      id: `audit_${input.proposal.id}_${input.decision}`,
      organizationId: input.proposal.organizationId,
      actorId: input.decision === "expired" ? null : input.decidedBy,
      eventType: EVENT_OF[input.decision],
      resourceType: "assistant_proposal",
      resourceId: input.proposal.id,
      correlationId: input.proposal.id,
      beforeHash: input.beforeHash ?? null,
      afterHash: input.afterHash ?? null,
      metadata: {
        appSlug: input.proposal.appSlug,
        verb: input.proposal.verb,
        subject: input.proposal.subject,
        changedFields: input.changedFields
      }
    });
  });
}

export { hashOf };
