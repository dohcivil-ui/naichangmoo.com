import { describe, expect, it } from "vitest";
import { accessLabel, availabilityNotePresets, marketCategories, platformApps } from "@/lib/platform";

describe("Civil Apps Market registry", () => {
  it("maps every marketplace app to one approved work category", () => {
    const categoryIds = new Set(marketCategories.map((category) => category.id));

    expect(marketCategories.map((category) => category.label)).toEqual([
      "หมวดต้นทุนและประมาณราคาก่อสร้าง",
      "การบริหารและจัดการงานก่อสร้าง",
      "หมวดงานออกแบบวิศวกรรมโยธา",
      "หมวดงานอุปกรณ์อำนวยความปลอดภัย",
      "หมวดงานสำนักจัดกรรมสิทธิ์ที่ดิน"
    ]);
    // Deliberately not a count. A literal here only ever gets bumped when an app is added, which
    // guards nothing; what matters is that the registry is not empty and every entry below holds.
    expect(platformApps.length).toBeGreaterThan(0);
    expect(platformApps.every((app) => categoryIds.has(app.categoryId))).toBe(true);
    // ADR 0009 reverses the earlier rule that the project cap had to appear before entry. The cap
    // is still enforced server-side and is still stated on the activation screen and the in-app
    // counter; what changed is that a limit is no longer the first thing said about the tool.
    expect(accessLabel.paid_trial).toBe("ฟรี ทดลองใช้งาน 7 วัน");
    expect(accessLabel.paid_trial).not.toContain("โครงการ");
    // ADR 0010: no surface before entry names the cap, so an accidental walk-back is caught here.
    for (const app of platformApps) expect(app.marketDetail.availabilityNote).not.toContain("โครงการ");
    // The preset sentences an administrator picks from (ADR 0018) must obey the same rule.
    for (const preset of availabilityNotePresets) {
      expect(preset.trim().length).toBeGreaterThan(0);
      expect(preset).not.toContain("โครงการ");
    }
  });

  it("keeps a truthful pre-entry detail route and readiness content for every app", () => {
    for (const app of platformApps) {
      expect(`/market/${app.slug}`).toMatch(/^\/market\//);
      expect(app.marketDetail.outcome.length).toBeGreaterThan(0);
      expect(app.marketDetail.preparation.length).toBeGreaterThan(0);
      expect(app.marketDetail.flow.length).toBeGreaterThan(0);
      expect(app.marketDetail.availabilityNote.length).toBeGreaterThan(0);
    }
  });

  /**
   * The app header renders these two on every app page, so an app that ships without them ships an
   * anonymous header. Failing here is cheaper than someone noticing a blank title in production.
   */
  it("gives every app a Thai program name and a one-line purpose", () => {
    for (const app of platformApps) {
      expect(app.programName.trim().length, `${app.slug} programName`).toBeGreaterThan(0);
      expect(app.purpose.trim().length, `${app.slug} purpose`).toBeGreaterThan(0);
      // The purpose is a sentence about the app, not a repeat of its brand name.
      expect(app.purpose, `${app.slug} purpose`).not.toBe(app.name);
      expect(app.programName, `${app.slug} programName`).not.toBe(app.purpose);
    }
  });

  it("keeps every slug unique, so two apps cannot claim one route", () => {
    const slugs = platformApps.map((app) => app.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
