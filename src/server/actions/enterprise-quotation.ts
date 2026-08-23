"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { enterpriseQuotationRequests } from "@/db/schema";
import {
  isHoneypotTriggered,
  parseQuotationForm,
  type QuotationActionResult
} from "@/server/actions/quotation-schema";
import { consumeRateLimit } from "@/server/rate-limit";
import { getClientIpHash } from "@/server/request-identity";

// Generous enough for a genuine person retrying a form, low enough to stop a flood.
const QUOTE_RATE_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 } as const;

export async function requestEnterpriseQuotation(
  _previous: QuotationActionResult | undefined,
  formData: FormData
): Promise<QuotationActionResult> {
  // Bots that fill the hidden field get a neutral success and never touch the database.
  if (isHoneypotTriggered(formData.get("companyWebsite"))) {
    return { ok: true, message: "ได้รับคำขอของคุณแล้ว ทีมงานจะติดต่อกลับ" };
  }

  const ipHash = await getClientIpHash();
  const rate = await consumeRateLimit("enterprise_quote", ipHash, QUOTE_RATE_LIMIT);
  if (!rate.allowed) {
    return { ok: false, message: "มีคำขอจากคุณมากเกินไปในช่วงนี้ กรุณาลองใหม่อีกครั้งภายหลัง" };
  }

  const parsed = parseQuotationForm(formData);
  if (!parsed.ok) {
    return { ok: false, message: "กรุณาตรวจข้อมูลคำขอใบเสนอราคาให้ครบถ้วน" };
  }

  const value = parsed.value;
  await getDb().insert(enterpriseQuotationRequests).values({
    id: randomUUID(),
    organizationName: value.organizationName,
    organizationType: value.organizationType,
    contactName: value.contactName,
    contactEmail: value.contactEmail,
    contactPhone: value.contactPhone,
    teamSize: value.teamSize,
    intendedApps: value.intendedApps,
    procurementNote: value.procurementNote,
    requirementNote: value.requirementNote,
    consentAt: new Date(),
    ipHash
  });
  revalidatePath("/");
  return { ok: true, message: "ส่งคำขอเรียบร้อยแล้ว ทีมงานจะติดต่อกลับตามข้อมูลที่ให้ไว้" };
}
