import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { rateLimitCounters } from "@/db/schema";

export type RateLimitRule = { limit: number; windowMs: number };

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  remaining: number;
  resetAt: Date;
};

export function currentWindowStart(windowMs: number, now = Date.now()): Date {
  return new Date(Math.floor(now / windowMs) * windowMs);
}

// Fixed-window counter kept in PostgreSQL so the same policy applies on every
// instance (Vercel pilot or VPS) without a shared in-memory store. One atomic
// upsert both records and reads the current count for the active window.
export async function consumeRateLimit(
  scope: string,
  identifier: string,
  rule: RateLimitRule,
  now = Date.now()
): Promise<RateLimitResult> {
  const windowStart = currentWindowStart(rule.windowMs, now);

  const [row] = await getDb()
    .insert(rateLimitCounters)
    .values({ id: randomUUID(), scope, identifier, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimitCounters.scope, rateLimitCounters.identifier, rateLimitCounters.windowStart],
      set: { count: sql`${rateLimitCounters.count} + 1`, updatedAt: new Date() }
    })
    .returning({ count: rateLimitCounters.count });

  const count = row?.count ?? rule.limit + 1;
  return {
    allowed: count <= rule.limit,
    count,
    remaining: Math.max(0, rule.limit - count),
    resetAt: new Date(windowStart.getTime() + rule.windowMs)
  };
}
