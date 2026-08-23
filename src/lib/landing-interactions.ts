import type { PlatformApp } from "@/lib/platform";

export const landingNavigationContract = [
  { id: "apps", label: "แอปของเรา", href: "/#apps" },
  { id: "hermes", label: "Hermes 24/7", href: "/#hermes" },
  { id: "roadmap", label: "สถานะโครงการ", href: "/roadmap" },
  { id: "enterprise", label: "ขอใบเสนอราคา", href: "/enterprise" }
] as const;

export const landingActionContract = {
  homeHref: "/",
  allAppsHref: "/#apps",
  roadmapHref: "/roadmap"
} as const;

export function getAppInteractionContract(app: Pick<PlatformApp, "slug" | "href" | "status">) {
  return {
    detailHref: `/market/${app.slug}`,
    canEnter: app.status === "available",
    entryHref: app.status === "available" ? app.href : null
  };
}

export function getLoginInteractionContract(authEnabled: boolean) {
  if (!authEnabled) {
    return {
      kind: "preview_notice" as const,
      label: "เข้าสู่ระบบ",
      notice: "กำลังเตรียมระบบเข้าสู่ระบบ"
    };
  }

  return {
    kind: "google_sign_in" as const,
    label: "เข้าสู่ระบบด้วย Google",
    provider: "google" as const,
    callbackURL: "/apps/estimeter"
  };
}
