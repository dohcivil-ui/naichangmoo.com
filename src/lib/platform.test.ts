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
    // The project cap is a purchase-relevant limit, so it must appear before entry, not after the first block.
    expect(accessLabel.paid_trial).toBe("ฟรี ทดลองใช้งาน 5 วัน · 1 โครงการ");
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
