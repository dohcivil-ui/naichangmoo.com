import { headers } from "next/headers";
import { getPlatformSessionUser, type PlatformSessionUser } from "@/lib/auth-session";
import { getEstimeterAccess, type EstimeterAccess } from "@/server/estimeter-access";

export type EstimeterContext = { user: PlatformSessionUser; access: EstimeterAccess };

export type EstimeterContextResult =
  | { ok: true; context: EstimeterContext }
  | { ok: false; reason: "unauthenticated" | "entitlement_unavailable" };

/**
 * The single entry check for every ESTIMETR page. It fails closed: if the entitlement
 * cannot be read, no page renders workspace content on the assumption that it is allowed.
 */
export async function resolveEstimeterContext(): Promise<EstimeterContextResult> {
  const user = await getPlatformSessionUser(await headers());
  if (!user) return { ok: false, reason: "unauthenticated" };

  try {
    return { ok: true, context: { user, access: await getEstimeterAccess(user.id) } };
  } catch {
    return { ok: false, reason: "entitlement_unavailable" };
  }
}
