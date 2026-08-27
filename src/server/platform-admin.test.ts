import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ADR 0012 turns on one property: the check refuses unless it can prove a grant. The case worth
 * testing hardest is the third one — a database that cannot be read. Systems fail open there,
 * because "we could not check, so carry on" looks like resilience and is actually an open door.
 */

const getPlatformSessionUser = vi.fn();
const getDb = vi.fn();

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/server/auth-session", () => ({ getPlatformSessionUser: (...args: unknown[]) => getPlatformSessionUser(...args) }));
vi.mock("@/db", () => ({ getDb: () => getDb() }));

/** Mimics the drizzle chain used by the lookup: select().from().where().limit(). */
function dbReturning(rows: unknown[]) {
  const chain = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(rows),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(rows).then(resolve)
  };
  return chain;
}

function dbThatThrows() {
  return {
    select: () => {
      throw new Error("connection refused");
    }
  };
}

const session = { id: "user-1", email: "admin@example.com", name: "ผู้ดูแล" };

describe("resolvePlatformAdmin fails closed", () => {
  beforeEach(() => {
    vi.resetModules();
    getPlatformSessionUser.mockReset();
    getDb.mockReset();
  });

  it("refuses when there is no session", async () => {
    getPlatformSessionUser.mockResolvedValue(null);
    getDb.mockReturnValue(dbReturning([{ id: "admin-row", grantedAt: new Date() }]));

    const { resolvePlatformAdmin } = await import("@/server/platform-admin");
    const result = await resolvePlatformAdmin();

    expect(result).toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("refuses a signed-in member who holds no grant", async () => {
    getPlatformSessionUser.mockResolvedValue(session);
    getDb.mockReturnValue(dbReturning([]));

    const { resolvePlatformAdmin } = await import("@/server/platform-admin");
    const result = await resolvePlatformAdmin();

    expect(result).toEqual({ ok: false, reason: "not_an_administrator" });
  });

  it("refuses when the grant cannot be read at all", async () => {
    // The failure mode this exists for: an unreadable table is not evidence of permission.
    getPlatformSessionUser.mockResolvedValue(session);
    getDb.mockReturnValue(dbThatThrows());

    const { resolvePlatformAdmin } = await import("@/server/platform-admin");
    const result = await resolvePlatformAdmin();

    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });

  it("allows only when an unrevoked grant is found", async () => {
    const grantedAt = new Date("2026-08-24T00:00:00.000Z");
    getPlatformSessionUser.mockResolvedValue(session);
    getDb.mockReturnValue(dbReturning([{ id: "admin-row", grantedAt }]));

    const { resolvePlatformAdmin } = await import("@/server/platform-admin");
    const result = await resolvePlatformAdmin();

    expect(result).toEqual({
      ok: true,
      admin: { userId: "user-1", email: "admin@example.com", name: "ผู้ดูแล", grantedAt }
    });
  });
});
