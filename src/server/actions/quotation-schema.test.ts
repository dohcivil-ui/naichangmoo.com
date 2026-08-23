import { describe, expect, it } from "vitest";
import { isHoneypotTriggered, parseQuotationForm } from "@/server/actions/quotation-schema";

function buildForm(overrides: Record<string, string | string[]> = {}): FormData {
  const base: Record<string, string | string[]> = {
    organizationName: "กรมทางหลวง",
    organizationType: "government",
    contactName: "สมชาย ใจดี",
    contactEmail: "somchai@example.go.th",
    contactPhone: "021234567",
    teamSize: "25",
    intendedApps: ["estimeter"],
    procurementNote: "จัดซื้อผ่านระบบ e-GP",
    requirementNote: "ต้องการใช้ประมาณราคางานอาคารสำหรับ 25 ผู้ใช้",
    consent: "yes",
    ...overrides
  };

  const form = new FormData();
  for (const [key, value] of Object.entries(base)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => form.append(key, entry));
    } else {
      form.set(key, value);
    }
  }
  return form;
}

describe("quotation form parsing", () => {
  it("accepts a complete valid submission and maps procurement note", () => {
    const result = parseQuotationForm(buildForm());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.organizationName).toBe("กรมทางหลวง");
      expect(result.value.intendedApps).toEqual(["estimeter"]);
      expect(result.value.procurementNote).toBe("จัดซื้อผ่านระบบ e-GP");
      expect(result.value.teamSize).toBe(25);
    }
  });

  it("treats procurement note as optional", () => {
    const form = buildForm();
    form.delete("procurementNote");
    const result = parseQuotationForm(form);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.procurementNote).toBeUndefined();
  });

  it("rejects submissions without consent", () => {
    const form = buildForm();
    form.delete("consent");
    expect(parseQuotationForm(form).ok).toBe(false);
  });

  it("rejects an invalid email and a too-short requirement", () => {
    expect(parseQuotationForm(buildForm({ contactEmail: "not-an-email" })).ok).toBe(false);
    expect(parseQuotationForm(buildForm({ requirementNote: "สั้น" })).ok).toBe(false);
  });

  it("rejects unknown intended app slugs", () => {
    expect(parseQuotationForm(buildForm({ intendedApps: ["unknown-app"] })).ok).toBe(false);
  });
});

describe("honeypot detection", () => {
  it("flags a filled hidden field and ignores empty values", () => {
    expect(isHoneypotTriggered("http://spam.example")).toBe(true);
    expect(isHoneypotTriggered("   ")).toBe(false);
    expect(isHoneypotTriggered("")).toBe(false);
    expect(isHoneypotTriggered(null)).toBe(false);
  });
});
