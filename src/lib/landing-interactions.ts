import type { PlatformApp } from "@/lib/platform";
import { entitlementStateLabel } from "@/lib/platform-admin-labels";
import { formatThaiDate } from "@/lib/thai-format";

export const landingNavigationContract = [
  { id: "apps", label: "แอปของเรา", href: "/#apps" },
  { id: "hermes", label: "Hermes 24/7", href: "/#hermes" },
  { id: "pricing", label: "ราคา", href: "/pricing" },
  { id: "roadmap", label: "สถานะโครงการ", href: "/roadmap" },
  { id: "enterprise", label: "ขอใบเสนอราคา", href: "/enterprise" }
] as const;

export const landingActionContract = {
  homeHref: "/",
  allAppsHref: "/#apps",
  roadmapHref: "/roadmap",
  pricingHref: "/pricing"
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

export type AccountViewer = { name: string; email: string; image?: string | null };

/** One app the member holds access to, already resolved against the clock by the server. */
export type AccountAppAccess = {
  slug: string;
  name: string;
  state: string;
  endsAtIso: string | null;
  daysRemaining: number | null;
};

/** Two letters for the avatar. Latin names give initials; Thai gives the first character. */
function initialsFor(label: string) {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (/^[A-Za-z]/.test(words[0])) {
    return words
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join("");
  }
  return words[0].slice(0, 1);
}

/**
 * A day count is only worth saying while it is short enough to act on. "เหลือ 335 วัน" on a yearly
 * subscription is noise, and noise in a status line is how a status line stops being read.
 */
const DAYS_WORTH_COUNTING = 30;

function describeAppAccess(app: AccountAppAccess) {
  const until = formatThaiDate(app.endsAtIso);
  const counted = app.daysRemaining !== null && app.daysRemaining <= DAYS_WORTH_COUNTING;

  return {
    slug: app.slug,
    name: app.name,
    href: `/apps/${app.slug}`,
    stateLabel: entitlementStateLabel[app.state] ?? app.state,
    // Expiring soon is the one thing here a member may need to act on, so it is a separate flag
    // rather than something the reader has to infer from the sentence.
    expiringSoon: counted && app.daysRemaining !== null && app.daysRemaining > 0,
    note: until ? (counted ? `เหลือ ${app.daysRemaining} วัน · ถึง ${until}` : `ถึง ${until}`) : null
  };
}

/**
 * What the account corner of the site header offers the person looking at it.
 *
 * The rule that matters is the last one: a member sees a way out. A site that can sign someone in
 * and offers no way to sign out has taken a decision away from them, and on a shared machine that
 * is not a cosmetic gap.
 *
 * `isPlatformAdmin` only decides whether a shortcut is drawn. It is not a permission check and must
 * never be treated as one — `/admin` refuses on its own, from the server, per ADR 0012. Passing
 * true here for someone without a grant would draw a link that leads to a refusal, not an entry.
 */
export function getAccountInteractionContract({
  user,
  isPlatformAdmin = false,
  apps = []
}: {
  user: AccountViewer | null;
  isPlatformAdmin?: boolean;
  apps?: AccountAppAccess[];
}) {
  if (!user) return { kind: "signed_out" as const };

  // An OAuth profile can arrive without a name. The email is the one thing a signed-in member
  // always has, so it stands in rather than leaving the corner blank.
  const label = user.name.trim() || user.email;

  return {
    kind: "signed_in" as const,
    label,
    email: user.email,
    // The initials are not a second-best avatar; they are the one that always renders. The photo
    // is layered over them and can fail, so they stay in the contract either way.
    initials: initialsFor(label),
    avatarUrl: user.image?.trim() ? user.image : null,
    // Which side of ADR 0012 the viewer is on, said out loud. Two people with different powers
    // were seeing near-identical menus, told apart only by one extra link being present.
    roleLabel: isPlatformAdmin ? "ผู้ดูแลแพลตฟอร์ม" : "สมาชิก",
    isPlatformAdmin,
    openLabel: "เปิดเมนูบัญชี",
    closeLabel: "ปิดเมนูบัญชี",
    appsHeading: "แอปที่ใช้ได้",
    // There is no single "account status" to report. Status belongs to an entitlement, and a
    // member can hold several in different states at once, so the panel lists them instead of
    // inventing one summary word that would be wrong for every app but the first.
    apps: apps.map(describeAppAccess),
    appsEmptyLabel: "ยังไม่มีสิทธิ์ใช้แอปใด เริ่มทดลองใช้ได้จากหน้าแอป",
    accountHref: "/account" as const,
    accountLabel: "ตั้งค่าบัญชี",
    adminHref: isPlatformAdmin ? ("/admin" as const) : null,
    adminLabel: "หลังบ้าน",
    signOutLabel: "ออกจากระบบ",
    signingOutLabel: "กำลังออก…",
    afterSignOutHref: landingActionContract.homeHref
  };
}
