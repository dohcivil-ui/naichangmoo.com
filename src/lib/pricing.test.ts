import { describe, expect, it } from "vitest";
import { ESTIMETR_TRIAL_DAYS } from "@/lib/estimeter-trial";
import { landingNavigationContract } from "@/lib/landing-interactions";
import { capabilityOrder, pricingCapabilityRows, pricingTiers, restrictedAccessNote } from "@/lib/pricing";

describe("access page content", () => {
  it("states no numeric price anywhere, which is the requirement it exists under", () => {
    // docs/requirements/civil-apps-market.md forbids a numeric package price. A tier that carried
    // one would read as approved pricing, so the absence is asserted rather than assumed.
    const surfaces = pricingTiers.flatMap((tier) => [tier.accessNote, tier.summary, tier.name, ...tier.highlights]);
    for (const text of surfaces) {
      expect(text).not.toMatch(/บาท|THB|EUR|\$/);
      // The trial length is the one figure allowed, so digits are only tolerated when they are it.
      const digits = text.match(/\d+/g) ?? [];
      for (const digit of digits) expect(digit).toBe(String(ESTIMETR_TRIAL_DAYS));
    }
  });

  it("names no project cap, because this page runs before entry", () => {
    // ADR 0010: no surface before entry names the cap. The access page is one of those surfaces.
    const surfaces = pricingTiers.flatMap((tier) => [tier.accessNote, tier.summary, ...tier.highlights]);
    for (const text of surfaces) expect(text).not.toContain("โครงการ");
  });

  it("routes the organization tier to the quotation intake rather than to a checkout", () => {
    const organization = pricingTiers.find((tier) => tier.id === "organization");
    expect(organization?.cta.href).toBe("/enterprise");
    expect(pricingTiers.every((tier) => !/pay|checkout|ชำระ/i.test(tier.cta.label))).toBe(true);
  });

  it("carries the restricted app as a footnote and never as a tier", () => {
    expect(pricingTiers.map((tier) => tier.id)).not.toContain("doh_staff_only");
    expect(restrictedAccessNote).toContain("กรมทางหลวง");
  });

  it("reaches the page from the main menu", () => {
    const entry = landingNavigationContract.find((item) => item.id === "pricing");
    expect(entry?.href).toBe("/pricing");
  });
});

describe("capability table", () => {
  it("derives every cell from the policy the server enforces, not from authored ticks", () => {
    const rows = pricingCapabilityRows();
    expect(rows.map((row) => row.capability)).toEqual([...capabilityOrder]);

    const trialRow = (capability: string) => rows.find((row) => row.capability === capability)!.allowed;

    // The one difference the table exists to show: a trial may work but may not take work out.
    expect(trialRow("export").trial).toBe(false);
    expect(trialRow("print").trial).toBe(false);
    expect(trialRow("export").member_free).toBe(true);
    expect(trialRow("export").organization).toBe(true);

    // And the things a trial can do, so a false negative here is caught too.
    expect(trialRow("read").trial).toBe(true);
    expect(trialRow("edit").trial).toBe(true);
    expect(trialRow("run_ai").trial).toBe(true);
    expect(trialRow("create_project").trial).toBe(true);
  });

  it("covers every tier in every row", () => {
    for (const row of pricingCapabilityRows()) {
      expect(Object.keys(row.allowed).sort()).toEqual(pricingTiers.map((tier) => tier.id).sort());
    }
  });
});
