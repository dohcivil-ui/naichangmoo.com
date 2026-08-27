import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
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

/**
 * Where a caller wants a window this module cannot derive from a duration.
 *
 * `currentWindowStart` divides epoch time, which is right for "five per minute" and wrong for
 * "three hundred per calendar month in Thailand": that boundary is not a fixed number of
 * milliseconds from any epoch, and dividing by thirty days lands the reset at 07:00 Bangkok in the
 * middle of a working day. Callers that mean a calendar boundary compute it themselves and pass it
 * in — see `src/lib/thai-time.ts`.
 */
export type RateLimitWindow = { windowStart: Date; resetAt: Date };

// Fixed-window counter kept in PostgreSQL so the same policy applies on every
// instance (Vercel pilot or VPS) without a shared in-memory store. One atomic
// upsert both records and reads the current count for the active window.
export async function consumeRateLimit(
  scope: string,
  identifier: string,
  rule: RateLimitRule,
  now = Date.now(),
  window?: RateLimitWindow
): Promise<RateLimitResult> {
  const windowStart = window?.windowStart ?? currentWindowStart(rule.windowMs, now);
  const resetAt = window?.resetAt ?? new Date(windowStart.getTime() + rule.windowMs);

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
    resetAt
  };
}

/**
 * Reads a window's count without spending one.
 *
 * The assistant checks its caps before calling a model but only counts a use once the model has
 * actually answered, so that an outage on our side does not eat somebody's quota. That split needs
 * a read that does not increment; `consumeRateLimit` cannot serve it, because its whole design is
 * that recording and reading are the same atomic statement.
 */
export async function readRateLimit(
  scope: string,
  identifier: string,
  rule: RateLimitRule,
  now = Date.now(),
  window?: RateLimitWindow
): Promise<RateLimitResult> {
  const windowStart = window?.windowStart ?? currentWindowStart(rule.windowMs, now);
  const resetAt = window?.resetAt ?? new Date(windowStart.getTime() + rule.windowMs);

  const [row] = await getDb()
    .select({ count: rateLimitCounters.count })
    .from(rateLimitCounters)
    .where(
      and(
        eq(rateLimitCounters.scope, scope),
        eq(rateLimitCounters.identifier, identifier),
        eq(rateLimitCounters.windowStart, windowStart)
      )
    )
    .limit(1);

  const count = row?.count ?? 0;
  return {
    allowed: count < rule.limit,
    count,
    remaining: Math.max(0, rule.limit - count),
    resetAt
  };
}
