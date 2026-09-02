import { headers } from "next/headers";
import { AccountMenu } from "@/components/platform/account-menu";
import { PlatformNav } from "@/components/platform/platform-nav";
import { getPlatformSessionUser } from "@/server/auth-session";
import { readMemberAppAccess } from "@/server/member-account";
import { resolvePlatformAdmin } from "@/server/platform-admin";

/**
 * Who is looking, read once. Both the full nav and the bare account menu need the same three
 * answers, and a second copy of these calls is how the two would drift apart the day one of them
 * learns something new.
 *
 * The administrator lookup only runs for someone already signed in, and only decides whether to
 * draw a shortcut. `/admin` still refuses on its own — ADR 0012 puts that check on the server, in
 * the layout, precisely so that no drawn or undrawn link is load-bearing.
 */
async function readViewer() {
  const user = await getPlatformSessionUser(await headers());
  if (!user) return { user: null, isPlatformAdmin: false, apps: [] };

  const [administrator, apps] = await Promise.all([resolvePlatformAdmin(), readMemberAppAccess(user.id)]);
  return { user: { name: user.name, email: user.email }, isPlatformAdmin: administrator.ok, apps };
}

/**
 * Resolves who is looking, then renders the nav. Every public page mounts this rather than the nav
 * directly, so the session is read in one place instead of once per page that happens to remember.
 *
 * Reading it on the server is the point. A client-side session check would render "เข้าสู่ระบบ" on
 * every page load and swap it for the member's name a moment later, which reads as being signed out
 * and then signed back in on every navigation.
 */
export async function SiteHeader({ workspace }: { workspace?: string }) {
  const viewer = await readViewer();

  return (
    <PlatformNav
      workspace={workspace}
      user={viewer.user}
      isPlatformAdmin={viewer.isPlatformAdmin}
      apps={viewer.apps}
    />
  );
}

/**
 * เมนูบัญชีล้วน ไม่มีแถบนำทางห่อ
 *
 * หน้าที่เป็นพื้นที่ทำงานเต็มจอไม่มีที่ว่างพอให้แถบนำทางของหน้าแรก แต่ทางเข้าบัญชีต้องไม่หาย
 * เพราะมันคือที่เดียวที่คนออกจากระบบ ดูสิทธิ์ที่ตัวเองมี และเข้าหลังบ้านได้
 */
export async function AccountMenuSlot() {
  const viewer = await readViewer();

  return <AccountMenu user={viewer.user} isPlatformAdmin={viewer.isPlatformAdmin} apps={viewer.apps} />;
}
