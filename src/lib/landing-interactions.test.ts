import { describe, expect, it } from "vitest";
import { landingActionContract, landingNavigationContract, getAppInteractionContract, getLoginInteractionContract } from "@/lib/landing-interactions";
import { platformApps } from "@/lib/platform";

describe("Landing interaction contract", () => {
  it("keeps every primary navigation action on an allowed route or anchor", () => {
    expect(landingNavigationContract).toEqual([
      { id: "apps", label: "แอปของเรา", href: "/#apps" },
      { id: "hermes", label: "Hermes 24/7", href: "/#hermes" },
      { id: "pricing", label: "ราคา", href: "/pricing" },
      { id: "roadmap", label: "สถานะโครงการ", href: "/roadmap" },
      { id: "enterprise", label: "ขอใบเสนอราคา", href: "/enterprise" }
    ]);
    expect(landingActionContract).toEqual({
      homeHref: "/",
      allAppsHref: "/#apps",
      roadmapHref: "/roadmap",
      pricingHref: "/pricing"
    });
  });

  it("always gives an app card a detail route while locking direct entry until ready", () => {
    for (const app of platformApps) {
      const contract = getAppInteractionContract(app);
      expect(contract.detailHref).toBe(`/market/${app.slug}`);
      expect(contract.canEnter).toBe(app.status === "available");
      expect(contract.entryHref).toBe(app.status === "available" ? app.href : null);
    }
  });

  it("keeps Login intentional in both preview and configured modes", () => {
    expect(getLoginInteractionContract(false)).toEqual({
      kind: "preview_notice",
      label: "เข้าสู่ระบบ",
      notice: "กำลังเตรียมระบบเข้าสู่ระบบ"
    });
    expect(getLoginInteractionContract(true)).toEqual({
      kind: "google_sign_in",
      label: "เข้าสู่ระบบด้วย Google",
      provider: "google",
      callbackURL: "/apps/estimeter"
    });
  });
});
