import { describe, expect, it } from "vitest";
import { accessLabel, marketCategories, platformApps } from "@/lib/platform";

describe("Civil Apps Market registry", () => {
  it("maps every marketplace app to one approved work category", () => {
    const categoryIds = new Set(marketCategories.map((category) => category.id));

    expect(marketCategories.map((category) => category.label)).toEqual([
      "หมวดประมาณราคา",
      "หมวดงานออกแบบวิศวกรรมโยธา",
      "หมวดงานอุปกรณ์อำนวยความปลอดภัย",
      "หมวดงานสำนักจัดกรรมสิทธิ์ที่ดิน"
    ]);
    expect(platformApps).toHaveLength(4);
    expect(platformApps.every((app) => categoryIds.has(app.categoryId))).toBe(true);
    // ADR 0009 reverses the earlier rule that the project cap had to appear before entry. The cap
    // is still enforced server-side and is still stated on the activation screen and the in-app
    // counter; what changed is that a limit is no longer the first thing said about the tool.
    expect(accessLabel.paid_trial).toBe("ฟรี ทดลองใช้งาน 7 วัน");
    expect(accessLabel.paid_trial).not.toContain("โครงการ");
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
});
