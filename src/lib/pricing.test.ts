import { describe, expect, it } from "vitest";
import { landingNavigationContract } from "@/lib/landing-interactions";
import { platformApps } from "@/lib/platform";
import {
  activePromotion,
  capabilityOrder,
  dayPass,
  dayPassBreakEvenDays,
  dayPassPriceBaht,
  perDayBaht,
  pricePromotions,
  pricingCapabilityRows,
  pricingTiers,
  restrictedAccessNote,
  taxBaseBaht,
  vipPriceBaht,
  vipPriceNow,
  yearlySaving,
  memberFreeAppsPendingNote,
  type PricePromotion
} from "@/lib/pricing";

/**
 * ADR 0011 approved the first price set and required it to live in one place. These tests hold the
 * approved figures and, more usefully, hold the rule that every other figure is derived from them.
 * The previous version of this file asserted that no price existed at all; that assertion did its
 * job by failing the moment a real price arrived.
 */
describe("approved prices", () => {
  it("states the figures ADR 0011 approved", () => {
    expect(vipPriceBaht.monthly).toBe(1170);
    expect(vipPriceBaht.yearly).toBe(10440);
    expect(dayPassPriceBaht).toBe(49);
  });

  it("derives the yearly saving from the two prices instead of repeating a number", () => {
    const saving = yearlySaving();
    expect(saving.baht).toBe(vipPriceBaht.monthly * 12 - vipPriceBaht.yearly);
    expect(saving.baht).toBe(3600);
    expect(saving.percent).toBeCloseTo(25.6, 1);
  });

  it("ties the 29-baht-a-day claim to the yearly cycle and nothing else", () => {
    // 10,440 / 365 = 28.60, which rounds to the 29 in the ad copy. The monthly cycle is 39.00, so
    // showing 29 beside it would quote a price the buyer will not be charged. ADR 0011 forbids it.
    expect(perDayBaht("yearly")).toBeCloseTo(28.6, 2);
    expect(Math.round(perDayBaht("yearly"))).toBe(29);
    expect(perDayBaht("monthly")).toBeCloseTo(39, 2);
    expect(Math.round(perDayBaht("monthly"))).not.toBe(29);
  });

  it("computes the VAT base from the inclusive price", () => {
    expect(taxBaseBaht(vipPriceBaht.monthly)).toBeCloseTo(1093.46, 2);
    expect(taxBaseBaht(vipPriceBaht.yearly)).toBeCloseTo(9757.01, 2);
  });

  it("keeps every figure out of the tier copy so there is one place to change a price", () => {
    const copy = pricingTiers.flatMap((tier) => [tier.name, tier.summary, ...tier.highlights]);
    for (const text of copy) expect(text).not.toMatch(/\d[\d,]*\s*บาท/);
  });
});

describe("the day pass is a separate product", () => {
  it("is not a membership tier", () => {
    // Priced as a subscription it would be 1,470 a month against VIP's 1,170 for every app, so
    // nobody would ever choose it. ADR 0011 makes it a pass sold by the day instead.
    expect(pricingTiers.map((tier) => tier.id)).not.toContain("day_pass");
    expect(dayPass.priceBaht).toBe(dayPassPriceBaht);
  });

  it("never appears as a column in the tier comparison", () => {
    for (const row of pricingCapabilityRows()) {
      expect(Object.keys(row.allowed)).not.toContain("day_pass");
    }
  });

  it("costs more per day than either subscription, which is the point of it", () => {
    // The premium is the mechanism: it prices flexibility and pushes a regular user to subscribe.
    // If someone later "corrects" the pass downward, the reason to subscribe goes with it, so the
    // ordering is asserted rather than left as a comment nobody reads.
    expect(dayPassPriceBaht).toBeGreaterThan(perDayBaht("monthly"));
    expect(perDayBaht("monthly")).toBeGreaterThan(perDayBaht("yearly"));
  });

  it("breaks even against VIP monthly at 24 days, above a working month", () => {
    // Recorded so the trade-off stays visible: a weekday-only buyer at 22 days still pays less on
    // passes (1,078) than on VIP (1,170). Raising the pass to 55 would move break-even to 22 and
    // close that gap. The owner chose 49 knowingly; this test makes the consequence surface if
    // either price moves.
    expect(dayPassBreakEvenDays("monthly")).toBe(24);
    expect(22 * dayPassPriceBaht).toBeLessThan(vipPriceBaht.monthly);
    expect(24 * dayPassPriceBaht).toBeGreaterThan(vipPriceBaht.monthly);
  });
});

describe("promotions expire on their own", () => {
  const promotion: PricePromotion = {
    id: "test-songkran",
    label: "ราคาช่วงสงกรานต์",
    target: "vip_yearly",
    promoPriceBaht: 8900,
    startsAtIso: "2026-04-01T00:00:00.000Z",
    endsAtIso: "2026-04-30T00:00:00.000Z"
  };

  const find = (now: Date) =>
    [promotion].find((p) => new Date(p.startsAtIso) <= now && now < new Date(p.endsAtIso)) ?? null;

  it("applies inside the window and stops outside it, without anyone editing the standing price", () => {
    expect(find(new Date("2026-04-15T00:00:00.000Z"))).not.toBeNull();
    expect(find(new Date("2026-03-31T23:59:59.000Z"))).toBeNull();
    expect(find(new Date("2026-04-30T00:00:00.000Z"))).toBeNull();
  });

  it("ships with no promotion, so the page shows the standing price", () => {
    expect(pricePromotions).toHaveLength(0);
    expect(activePromotion("vip_yearly")).toBeNull();
    const yearly = vipPriceNow("yearly");
    expect(yearly.payable).toBe(vipPriceBaht.yearly);
    expect(yearly.promotion).toBeNull();
  });
});

describe("access page content", () => {
  it("routes the organization tier to the quotation intake rather than to a checkout", () => {
    const organization = pricingTiers.find((tier) => tier.id === "organization");
    expect(organization?.cta.href).toBe("/enterprise");
    // ADR 0011 permits stating a price and does not open payment collection.
    expect(pricingTiers.every((tier) => !/pay|checkout|ชำระเงิน/i.test(tier.cta.label))).toBe(true);
  });

  it("names no project cap, because this page runs before entry", () => {
    // ADR 0010: no surface before entry names the cap. The access page is one of those surfaces.
    const surfaces = pricingTiers.flatMap((tier) => [tier.summary, ...tier.highlights]);
    for (const text of surfaces) expect(text).not.toContain("1 โครงการ");
  });

  it("carries the restricted app as a footnote and never as a tier", () => {
    expect(pricingTiers.map((tier) => tier.id)).not.toContain("doh_staff_only");
    expect(restrictedAccessNote(["LAND ACQUISITION V2"])).toContain("กรมทางหลวง");
  });

  it("has no footnote at all when nothing restricted has been announced", () => {
    // ADR 0014. A footnote exists to explain one app; with no app to explain, a paragraph about a
    // restriction that never names what is restricted leaves the reader worse off than silence.
    expect(restrictedAccessNote([])).toBeNull();
  });

  it("names every announced app in the footnote rather than only the first", () => {
    const note = restrictedAccessNote(["LAND ACQUISITION V2", "SURVEY V2"]);
    expect(note).toContain("LAND ACQUISITION V2");
    expect(note).toContain("SURVEY V2");
  });

  it("reaches the page from the main menu", () => {
    expect(landingNavigationContract.find((item) => item.id === "pricing")?.href).toBe("/pricing");
  });
});

describe("capability table", () => {
  it("derives every cell from the policy the server enforces, not from authored ticks", () => {
    const rows = pricingCapabilityRows();
    expect(rows.map((row) => row.capability)).toEqual([...capabilityOrder]);

    const allowed = (capability: string) => rows.find((row) => row.capability === capability)!.allowed;

    // The one difference the table exists to show: a trial may work but may not take work out.
    expect(allowed("export").trial).toBe(false);
    expect(allowed("print").trial).toBe(false);
    expect(allowed("export").vip).toBe(true);
    expect(allowed("export").member_free).toBe(true);
    expect(allowed("export").organization).toBe(true);

    expect(allowed("read").trial).toBe(true);
    expect(allowed("edit").trial).toBe(true);
    expect(allowed("run_ai").trial).toBe(true);
    expect(allowed("create_project").trial).toBe(true);
  });

  it("covers every tier in every row", () => {
    for (const row of pricingCapabilityRows()) {
      expect(Object.keys(row.allowed).sort()).toEqual(pricingTiers.map((tier) => tier.id).sort());
    }
  });
});

describe("no app is named in source", () => {
  /**
   * IP-090 / ADR 0014. Which apps are free, and which are restricted, is a statement an
   * administrator makes in the registry. Before this, two app names sat in a highlights array and
   * a third sat in the footnote, so the page kept advertising an app after it was withdrawn until
   * somebody committed a fix.
   *
   * Scanned against the real catalogue rather than against a list of strings typed here, so an app
   * added to the platform tomorrow is covered without anyone remembering to extend this test.
   */
  const appNames = platformApps.map((app) => app.name);

  it("lets a tier name only the app it is a tier of, and no other", () => {
    // The trial tier says ESTIMETR because it is that app's trial and its call to action goes to
    // that app's own page. That is a description of the tier, not a claim about which apps come
    // with it. The exception is therefore tied to a checkable fact — the tier links there — rather
    // than to a name somebody remembered to allow, which is how a carve-out survives its reason.
    for (const tier of pricingTiers) {
      const ownApp = platformApps.find((app) => tier.cta.href === `/market/${app.slug}`);
      const forbidden = appNames.filter((name) => name !== ownApp?.name);
      for (const text of [tier.name, tier.summary, ...tier.highlights]) {
        for (const name of forbidden) expect(text).not.toContain(name);
      }
    }
  });

  it("names no app at all in the tier that describes a set of apps", () => {
    // member_free is the claim IP-090 exists to move: which apps are free is the registry's to say.
    const tier = pricingTiers.find((item) => item.id === "member_free")!;
    expect(tier.cta.href).not.toMatch(/^\/market\//);
    for (const text of [tier.name, tier.summary, ...tier.highlights]) {
      for (const name of appNames) expect(text).not.toContain(name);
    }
  });

  it("keeps every app name out of the sentence shown when nothing is announced", () => {
    // The fallback is the one place a stale list would be most tempting to keep.
    for (const name of appNames) expect(memberFreeAppsPendingNote).not.toContain(name);
  });

  it("builds the restricted footnote from names it is given, never from names it holds", () => {
    // Passing nothing must produce nothing. If this file still knew an app name, it would leak here.
    expect(restrictedAccessNote([])).toBeNull();
    const note = restrictedAccessNote(["ตัวอย่างแอป"]) ?? "";
    for (const name of appNames) expect(note).not.toContain(name);
  });
});
