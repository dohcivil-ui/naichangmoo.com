import { describe, expect, it } from "vitest";
import { orderByReadiness, readinessRank } from "@/lib/app-showcase-order";

type App = { slug: string };

const claims: Record<string, { announced: boolean; open: boolean }> = {
  opened: { announced: true, open: true },
  preparing: { announced: true, open: false },
  quiet: { announced: false, open: false }
};

describe("ลำดับแอปบนแถบเลื่อน", () => {
  it("เปิดแล้วมาก่อน กำลังพัฒนามาถัดไป ยังไม่ประกาศอยู่ท้ายแถว", () => {
    expect(readinessRank(claims.opened)).toBe(0);
    expect(readinessRank(claims.preparing)).toBe(1);
    expect(readinessRank(claims.quiet)).toBe(2);
  });

  it("แอปที่ไม่มีรายการในทะเบียนเลย ถือว่ายังไม่ประกาศ", () => {
    expect(readinessRank(undefined)).toBe(2);
  });

  // ADR 0015 ห้ามเดาความพร้อมจาก source แอปที่ประกาศแล้วแต่ยังไม่เปิด ต้องไม่ถูกดันขึ้นหน้าสุด
  it("ประกาศแล้วอย่างเดียวยังไม่พอที่จะขึ้นหน้าสุด", () => {
    expect(readinessRank({ announced: true, open: false })).toBeGreaterThan(readinessRank({ announced: true, open: true }));
  });

  it("เรียงทั้งชุดตามความพร้อม", () => {
    const apps: App[] = [{ slug: "quiet" }, { slug: "preparing" }, { slug: "opened" }];
    expect(orderByReadiness(apps, (app) => claims[app.slug]).map((app) => app.slug)).toEqual([
      "opened",
      "preparing",
      "quiet"
    ]);
  });

  it("ของที่พร้อมเท่ากันคงลำดับเดิมของทะเบียนไว้", () => {
    const apps: App[] = [{ slug: "a" }, { slug: "b" }, { slug: "c" }];
    const same = () => ({ announced: true, open: false });
    expect(orderByReadiness(apps, same).map((app) => app.slug)).toEqual(["a", "b", "c"]);
  });

  it("ไม่แก้ไขอาร์เรย์ที่รับเข้ามา", () => {
    const apps: App[] = [{ slug: "quiet" }, { slug: "opened" }];
    orderByReadiness(apps, (app) => claims[app.slug]);
    expect(apps.map((app) => app.slug)).toEqual(["quiet", "opened"]);
  });
});
