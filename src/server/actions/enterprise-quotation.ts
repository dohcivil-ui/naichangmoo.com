"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { enterpriseQuotationRequests } from "@/db/schema";
import { consumeRateLimit } from "@/server/rate-limit";
import { getClientIpHash } from "@/server/request-identity";

export type QuotationActionResult = { ok: boolean; message: string };

// Generous enough for a genuine person retrying a form, low enough to stop a flood.
const QUOTE_RATE_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 } as const;

const quotationSchema = z.object({
  organizationName: z.string().trim().min(2).max(200),
  organizationType: z.enum(["government", "company", "education", "other"]),
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email().max(320),
  contactPhone: z.string().trim().max(50).optional(),
  teamSize: z.number().int().positive().max(100000).optional(),
  intendedApps: z.array(z.string()).max(4),
  requirementNote: z.string().trim().min(10).max(5000),
  consent: z.literal("yes")
});

export async function requestEnterpriseQuotation(
  _previous: QuotationActionResult | undefined,
  formData: FormData
): Promise<QuotationActionResult> {
  // Honeypot: a hidden field real users never see. If it is filled, treat the
  // sender as a bot and return a neutral success without touching the database.
  const honeypot = formData.get("companyWebsite");
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return { ok: true, message: "ได้รับคำขอของคุณแล้ว ทีมงานจะติดต่อกลับ" };
  }

  const ipHash = await getClientIpHash();
  const rate = await consumeRateLimit("enterprise_quote", ipHash, QUOTE_RATE_LIMIT);
  if (!rate.allowed) {
    return { ok: false, message: "มีคำขอจากคุณมากเกินไปในช่วงนี้ กรุณาลองใหม่อีกครั้งภายหลัง" };
  }

  const parsed = quotationSchema.safeParse({
    organizationName: formData.get("organizationName"),
    organizationType: formData.get("organizationType"),
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone") || undefined,
    teamSize: formData.get("teamSize") ? Number(formData.get("teamSize")) : undefined,
    intendedApps: formData.getAll("intendedApps"),
    requirementNote: formData.get("requirementNote"),
    consent: formData.get("consent")
  });

  if (!parsed.success) {
    return { ok: false, message: "กรุณาตรวจข้อมูลคำขอใบเสนอราคาให้ครบถ้วน" };
  }

  const value = parsed.data;
  await getDb().insert(enterpriseQuotationRequests).values({
    id: randomUUID(),
    organizationName: value.organizationName,
    organizationType: value.organizationType,
    contactName: value.contactName,
    contactEmail: value.contactEmail,
    contactPhone: value.contactPhone,
    teamSize: value.teamSize,
    intendedApps: value.intendedApps,
    requirementNote: value.requirementNote,
    consentAt: new Date(),
    ipHash
  });
  revalidatePath("/");
  return { ok: true, message: "ส่งคำขอเรียบร้อยแล้ว ทีมงานจะติดต่อกลับตามข้อมูลที่ให้ไว้" };
}
