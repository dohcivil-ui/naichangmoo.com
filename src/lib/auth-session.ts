import { isAuthRuntimeConfigured } from "@/lib/auth-availability";

export type PlatformSessionUser = {
  id: string;
  email: string;
  name: string;
  /**
   * The avatar the identity provider vouched for, captured at sign-in. Null when the provider sent
   * none. It is a URL on the provider's host, not something we store or serve, so anything showing
   * it needs a fallback for the day that URL stops resolving.
   */
  image: string | null;
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

  return { id: user.id, email: user.email, name: user.name, image: user.image ?? null };
}
