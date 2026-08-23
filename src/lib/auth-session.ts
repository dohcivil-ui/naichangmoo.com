import { isAuthRuntimeConfigured } from "@/lib/auth-availability";

export type PlatformSessionUser = {
  id: string;
  email: string;
  name: string;
};

// `@/lib/auth` builds its Drizzle adapter at module scope, so importing it while
// DATABASE_URL is absent throws before any request is served. Preview builds run
// without credentials, so the import stays dynamic and callers get `null` instead.
export async function getPlatformSessionUser(requestHeaders: Headers): Promise<PlatformSessionUser | null> {
  if (!isAuthRuntimeConfigured()) return null;

  const { auth } = await import("@/lib/auth");
  const session = await auth.api.getSession({ headers: requestHeaders });
  const user = session?.user;
  if (!user) return null;

  return { id: user.id, email: user.email, name: user.name };
}
