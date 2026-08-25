import { headers } from "next/headers";
import { PlatformNav } from "@/components/platform/platform-nav";
import { getPlatformSessionUser } from "@/lib/auth-session";
import { readMemberAppAccess } from "@/server/member-account";
import { resolvePlatformAdmin } from "@/server/platform-admin";

/**
 * Resolves who is looking, then renders the nav. Every public page mounts this rather than the nav
 * directly, so the session is read in one place instead of once per page that happens to remember.
 *
 * Reading it on the server is the point. A client-side session check would render "เข้าสู่ระบบ" on
 * every page load and swap it for the member's name a moment later, which reads as being signed out
 * and then signed back in on every navigation.
 *
 * The administrator lookup only runs for someone already signed in, and only decides whether to
 * draw a shortcut. `/admin` still refuses on its own — ADR 0012 puts that check on the server, in
 * the layout, precisely so that no drawn or undrawn link is load-bearing.
 */
export async function SiteHeader({ workspace }: { workspace?: string }) {
  const user = await getPlatformSessionUser(await headers());
  if (!user) return <PlatformNav workspace={workspace} />;

  const [administrator, apps] = await Promise.all([resolvePlatformAdmin(), readMemberAppAccess(user.id)]);

  return (
    <PlatformNav
      workspace={workspace}
      user={{ name: user.name, email: user.email }}
      isPlatformAdmin={administrator.ok}
      apps={apps}
    />
  );
}
