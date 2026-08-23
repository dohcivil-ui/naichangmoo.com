import { z } from "zod";

export const INTENDED_APP_SLUGS = ["estimeter", "rcopt", "traffic-sign", "land-acquisition"] as const;

export const quotationSchema = z.object({
  organizationName: z.string().trim().min(2).max(200),
  organizationType: z.enum(["government", "company", "education", "other"]),
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email().max(320),
  contactPhone: z.string().trim().max(50).optional(),
  teamSize: z.number().int().positive().max(100000).optional(),
  intendedApps: z.array(z.enum(INTENDED_APP_SLUGS)).max(4),
  procurementNote: z.string().trim().max(2000).optional(),
  requirementNote: z.string().trim().min(10).max(5000),
  consent: z.literal("yes")
});

export type QuotationInput = z.infer<typeof quotationSchema>;

export type QuotationParseResult = { ok: true; value: QuotationInput } | { ok: false };

export type QuotationActionResult = { ok: boolean; message: string };

// A hidden field real users never see. Any value means an automated submission.
export function isHoneypotTriggered(value: FormDataEntryValue | null): boolean {
  return typeof value === "string" && value.trim() !== "";
}

export function parseQuotationForm(formData: FormData): QuotationParseResult {
  const teamSizeRaw = formData.get("teamSize");
  const parsed = quotationSchema.safeParse({
    organizationName: formData.get("organizationName"),
    organizationType: formData.get("organizationType"),
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone") || undefined,
    teamSize: teamSizeRaw ? Number(teamSizeRaw) : undefined,
    intendedApps: formData.getAll("intendedApps").filter((entry): entry is string => typeof entry === "string"),
    procurementNote: formData.get("procurementNote") || undefined,
    requirementNote: formData.get("requirementNote"),
    consent: formData.get("consent")
  });

  return parsed.success ? { ok: true, value: parsed.data } : { ok: false };
}
