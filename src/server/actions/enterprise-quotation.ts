"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { enterpriseQuotationRequests } from "@/db/schema";

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

export async function requestEnterpriseQuotation(formData: FormData) {
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

  if (!parsed.success) throw new Error("กรุณาตรวจข้อมูลคำขอใบเสนอราคาให้ครบถ้วน");

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
    consentAt: new Date()
  });
  revalidatePath("/");
}
