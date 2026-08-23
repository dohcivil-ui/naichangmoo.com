import { createHash } from "node:crypto";
import { headers } from "next/headers";

// The raw client IP is never stored. We keep only a salted hash so abuse controls
// and audit tracing work without retaining personal network identifiers.
export async function getClientIpHash(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headerList.get("x-real-ip")?.trim() || "unknown";
  const salt = process.env.RATE_LIMIT_SALT ?? process.env.BETTER_AUTH_SECRET ?? "naichangmoo-local-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}
