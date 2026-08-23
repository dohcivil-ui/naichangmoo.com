import { describe, expect, it } from "vitest";
import { currentWindowStart } from "@/server/rate-limit";

describe("rate limit fixed window", () => {
  const windowMs = 60 * 60 * 1000;

  it("buckets timestamps within the same window to one start", () => {
    const base = Date.UTC(2026, 7, 23, 10, 0, 0);
    const early = currentWindowStart(windowMs, base + 1_000);
    const late = currentWindowStart(windowMs, base + windowMs - 1);
    expect(early.getTime()).toBe(late.getTime());
  });

  it("advances to a new window start once the boundary is crossed", () => {
    const base = Date.UTC(2026, 7, 23, 10, 0, 0);
    const first = currentWindowStart(windowMs, base);
    const next = currentWindowStart(windowMs, base + windowMs);
    expect(next.getTime() - first.getTime()).toBe(windowMs);
  });
});
