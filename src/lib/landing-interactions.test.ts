import { describe, expect, it } from "vitest";
import { landingActionContract, landingNavigationContract, getAccountInteractionContract, getAppInteractionContract, getLoginInteractionContract } from "@/lib/landing-interactions";
import { platformApps } from "@/lib/platform";

describe("Landing interaction contract", () => {
  it("keeps every primary navigation action on an allowed route or anchor", () => {
    expect(landingNavigationContract).toEqual([
      { id: "home", label: "หน้าแรก", href: "/" },
      { id: "apps", label: "แอปของเรา", href: "/#apps" },
      { id: "hermes", label: "Hermes 24/7", href: "/#hermes" },
      { id: "pricing", label: "ราคา", href: "/pricing" },
      { id: "roadmap", label: "สถานะโครงการ", href: "/roadmap" },
      { id: "enterprise", label: "ขอใบเสนอราคา", href: "/enterprise" }
    ]);
    expect(landingActionContract).toEqual({
      homeHref: "/",
      homeLabel: "หน้าแรก",
      allAppsHref: "/#apps",
      allAppsLabel: "แอปทั้งหมด",
      roadmapHref: "/roadmap",
      pricingHref: "/pricing",
      cookiesHref: "/cookies",
      cookiesLabel: "นโยบายการใช้คุกกี้"
    });
  });

  it("always gives an app card a detail route while locking direct entry until the registry opens it", () => {
    for (const app of platformApps) {
      const closed = getAppInteractionContract(app, false);
      expect(closed.detailHref).toBe(`/market/${app.slug}`);
      expect(closed.canEnter).toBe(false);
      expect(closed.entryHref).toBeNull();

      const open = getAppInteractionContract(app, true);
      expect(open.detailHref).toBe(`/market/${app.slug}`);
      expect(open.canEnter).toBe(true);
      expect(open.entryHref).toBe(app.href);
    }
  });

  // ADR 0015: `status` is a seeded default, and offering a way into an app is a claim that there
  // is one. An app seeded "available" that no administrator announced must still be shut.
  it("refuses to open an app on the strength of its seeded status alone", () => {
    const seededAvailable = platformApps.filter((app) => app.status === "available");
    expect(seededAvailable.length).toBeGreaterThan(0);
    for (const app of seededAvailable) {
      expect(getAppInteractionContract(app, false).entryHref).toBeNull();
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

describe("the account corner tells a member where they stand", () => {
  const member = { name: "สมชาย ทองดี", email: "somchai@example.co.th" };

  /** The contract is a union; every case below is about the signed-in arm of it. */
  const signedIn = (options: Parameters<typeof getAccountInteractionContract>[0]) => {
    const contract = getAccountInteractionContract(options);
    if (contract.kind !== "signed_in") throw new Error(`expected a signed-in contract, got ${contract.kind}`);
    return contract;
  };

  it("offers a way in when nobody is signed in", () => {
    expect(getAccountInteractionContract({ user: null })).toEqual({ kind: "signed_out" });
    expect(getAccountInteractionContract({ user: null, isPlatformAdmin: true })).toEqual({ kind: "signed_out" });
  });

  // A signed-in member is the person most affected by what is stored about them, and the least
  // likely to go hunting in the footer for it. The menu carries the same link the footer does.
  it("offers a signed-in member the cookie disclosure without making them find the footer", () => {
    const contract = signedIn({ user: member });

    expect(contract.cookiesHref).toBe(landingActionContract.cookiesHref);
    expect(contract.cookiesLabel).toBe(landingActionContract.cookiesLabel);
  });

  it("always offers a signed-in member a way out", () => {
    const contract = getAccountInteractionContract({ user: member });
    expect(contract.kind).toBe("signed_in");
    expect(contract).toMatchObject({
      label: "สมชาย ทองดี",
      email: "somchai@example.co.th",
      signOutLabel: "ออกจากระบบ",
      afterSignOutHref: landingActionContract.homeHref
    });
  });

  it("falls back to the email when the provider sent no name", () => {
    expect(getAccountInteractionContract({ user: { name: "   ", email: "no.name@example.co.th" } })).toMatchObject({
      label: "no.name@example.co.th"
    });
  });

  it("draws the back-office shortcut only for an administrator", () => {
    expect(getAccountInteractionContract({ user: member })).toMatchObject({ adminHref: null });
    expect(getAccountInteractionContract({ user: member, isPlatformAdmin: true })).toMatchObject({
      adminHref: "/admin",
      adminLabel: "หลังบ้าน"
    });
  });

  it("says which apps the member holds, and says so plainly when there are none", () => {
    expect(signedIn({ user: member }).apps).toEqual([]);

    const [app] = signedIn({
      user: member,
      apps: [
        { slug: "estimeter", name: "ESTIMETR", state: "trial", endsAtIso: "2026-08-31T00:00:00.000Z", daysRemaining: 7 }
      ]
    }).apps;

    expect(app).toMatchObject({
      slug: "estimeter",
      name: "ESTIMETR",
      href: "/apps/estimeter",
      stateLabel: "ทดลองใช้งาน",
      expiringSoon: true
    });
    expect(app.note).toContain("เหลือ 7 วัน");
  });

  it("stops counting days once the number is too far off to act on", () => {
    const [yearly] = signedIn({
      user: member,
      apps: [
        { slug: "estimeter", name: "ESTIMETR", state: "active", endsAtIso: "2027-07-25T00:00:00.000Z", daysRemaining: 335 }
      ]
    }).apps;

    expect(yearly.expiringSoon).toBe(false);
    expect(yearly.note).not.toContain("เหลือ");
    expect(yearly.note).toContain("ถึง");
  });

  it("says nothing about an end date an entitlement does not have", () => {
    const [openEnded] = signedIn({
      user: member,
      apps: [{ slug: "estimeter", name: "ESTIMETR", state: "member_free", endsAtIso: null, daysRemaining: null }]
    }).apps;

    expect(openEnded).toMatchObject({ note: null, stateLabel: "สมาชิกใช้ฟรี", expiringSoon: false });
  });

  it("says which side of the administrator line the viewer is on", () => {
    expect(signedIn({ user: member })).toMatchObject({ roleLabel: "สมาชิก", isPlatformAdmin: false });
    expect(signedIn({ user: member, isPlatformAdmin: true })).toMatchObject({
      roleLabel: "ผู้ดูแลแพลตฟอร์ม",
      isPlatformAdmin: true
    });
  });

  it("passes the provider photo through, and treats a blank one as absent", () => {
    expect(signedIn({ user: { ...member, image: "https://lh3.googleusercontent.com/a/x=s96-c" } })).toMatchObject({
      avatarUrl: "https://lh3.googleusercontent.com/a/x=s96-c"
    });
    expect(signedIn({ user: { ...member, image: "   " } })).toMatchObject({ avatarUrl: null });
    expect(signedIn({ user: member })).toMatchObject({ avatarUrl: null });
  });

  it("gives the avatar readable initials from either script", () => {
    expect(getAccountInteractionContract({ user: { name: "Suriya Patchotchai", email: "a@b.c" } })).toMatchObject({
      initials: "SP"
    });
    expect(getAccountInteractionContract({ user: { name: "สมชาย ทองดี", email: "a@b.c" } })).toMatchObject({
      initials: "ส"
    });
    expect(getAccountInteractionContract({ user: { name: "  ", email: "no.name@example.co.th" } })).toMatchObject({
      initials: "N"
    });
  });
});
