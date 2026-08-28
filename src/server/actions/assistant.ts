"use server";

import { headers } from "next/headers";
import { getPlatformSessionUser } from "@/server/auth-session";
import { runAssistant, settleProposal, type SettleResult } from "@/server/ai/assistant";
import { hashOf } from "@/server/ai/assistant-audit";
import type { AssistantRequest, AssistantResult } from "@/server/ai/assistant-contract";

/**
 * ประตูกลางฉบับ server action — ชั้นอ้างอิงสำหรับทุกแอป (IP-184: work-plan เป็นรายแรก)
 *
 * บางที่สุดเท่าที่จะบางได้ และ**ไม่รู้จักชื่อแอปสักตัว**: อ่านผู้ใช้จาก session แล้วส่งต่อให้
 * runAssistant/settleProposal ซึ่งถือด่านทั้งหมดอยู่แล้ว (สิทธิ์ → โควตา → จองประวัติ →
 * เรียกแบบจำลอง) การเพิ่มผู้ช่วยให้แอปใหม่จึงไม่ต้องเขียน action ใหม่เลย
 *
 * เส้นทางเก่าของ work-plan (work-plan-assistant.ts) ที่เรียกแบบจำลองตรงโดยไม่มีโควตา
 * ไม่มีบันทึกตรวจสอบ ถูกลบทิ้งในรุ่นเดียวกันนี้ — ด่านตรวจ assistant-path ปิดทางงอกกลับ
 */
export async function requestAssistant(request: AssistantRequest): Promise<AssistantResult> {
  const user = await getPlatformSessionUser(await headers());
  return runAssistant(user ? { id: user.id } : null, request);
}

export type SettleAssistantInput = {
  proposalId: string;
  decision: "accepted" | "rejected";
  /** สภาพข้อมูลก่อน/หลังรับ — hash คิดที่เซิร์ฟเวอร์ เพราะ hash ที่ client คิดเองเชื่อไม่ได้ */
  before?: unknown;
  after?: unknown;
};

export async function settleAssistantProposal(input: SettleAssistantInput): Promise<SettleResult> {
  const user = await getPlatformSessionUser(await headers());
  return settleProposal(user ? { id: user.id } : null, {
    proposalId: input.proposalId,
    decision: input.decision,
    beforeHash: input.before === undefined ? undefined : hashOf(input.before),
    afterHash: input.after === undefined ? undefined : hashOf(input.after)
  });
}
