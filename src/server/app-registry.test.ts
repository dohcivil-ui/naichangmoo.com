import { beforeEach, describe, expect, it, vi } from "vitest";
import { platformApps } from "@/lib/platform";

/**
 * IP-090 / ADR 0014. Three properties are worth holding here.
 *
 * A row is not an announcement. `activateEstimeterTrial` inserts one the moment a customer starts
 * a trial, so a registry that treated "the row exists" as "an administrator said so" would publish
 * a claim nobody made. Every read here is filtered on `announced_at`.
 *
 * A refusal must happen before the database is touched, so the mock throws on any query for the
 * cases that should never reach one — a test that only asserted the return value would still pass
 * if the write had happened and been reported as a failure afterwards.
 *
 * And an unreadable database must be distinguishable from an empty registry. Collapsing the two
 * is how a fail-closed page quietly becomes a page that shows nothing for the wrong reason.
 */

type AppRow = {
  slug: string;
  accessModel: string;
  enabled: boolean;
  announcedAt: Date | null;
  announcedBy: string | null;
  announcedByEmail?: string | null;
  availabilityNote?: string | null;
};

let appRows: AppRow[] = [];
let failReads = false;

/**
 * Enough of the drizzle chain for the reads in this module: `select(...).from(...)` optionally
 * followed by `leftJoin(...)`, `where(...)` and `limit(...)`, awaited as an array of whatever the test put in the
 * table. It deliberately does not interpret drizzle conditions — the rules worth holding here live
 * in the module's own code, which is why `readAnnouncedApps` decides "announced" in TypeScript
 * rather than in a WHERE clause a fake database could never enforce.
 */
function selectBuilder(rows: AppRow[]) {
  const chain = {
    from: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    limit: () => chain,
    then: (resolve: (value: AppRow[]) => unknown, reject?: (reason: unknown) => unknown) => {
      if (failReads) return Promise.reject(new Error("database unavailable")).then(resolve, reject);
      return Promise.resolve(rows).then(resolve, reject);
    }
  };
  return chain;
}

const getDb = vi.fn(() => {
  if (failReads) throw new Error("database unavailable");
  return {
    select: () => selectBuilder(appRows),
    transaction: async () => {
      throw new Error("no test in this file should reach a write");
    }
  };
});

vi.mock("@/db", () => ({ getDb: () => getDb() }));

describe("a row is not an announcement", () => {
  beforeEach(() => {
    vi.resetModules();
    getDb.mockClear();
    failReads = false;
    appRows = [];
  });

  it("leaves out an app whose row exists but was never announced", async () => {
    // Exactly the row activateEstimeterTrial writes, and the seeded access of rcopt is member_free.
    appRows = [
      { slug: "estimeter", accessModel: "paid_trial", enabled: true, announcedAt: null, announcedBy: null },
      { slug: "rcopt", accessModel: "member_free", enabled: false, announcedAt: null, announcedBy: null }
    ];

    const { readAnnouncedApps } = await import("@/server/app-registry");
    const result = await readAnnouncedApps();

    expect(result).toEqual({ ok: true, apps: [] });
  });

  it("returns an announced app with the name from the catalogue and the access from the registry", async () => {
    appRows = [
      {
        slug: "rcopt",
        accessModel: "member_free",
        enabled: false,
        announcedAt: new Date("2026-08-24T12:00:00.000Z"),
        announcedBy: "admin-1"
      }
    ];

    const { readAnnouncedApps } = await import("@/server/app-registry");
    const result = await readAnnouncedApps();

    expect(result).toEqual({
      ok: true,
      apps: [{ slug: "rcopt", name: "Retaining Wall Cantilever", access: "member_free", open: false }]
    });
  });

  it("keeps an announced-but-unopened app in the list and marks it not open", async () => {
    // The card names it and says it is being prepared. Dropping it would hide a real announcement.
    appRows = [
      { slug: "rcopt", accessModel: "member_free", enabled: false, announcedAt: new Date(), announcedBy: "a" },
      { slug: "traffic-sign", accessModel: "member_free", enabled: true, announcedAt: new Date(), announcedBy: "a" }
    ];

    const { readAnnouncedApps } = await import("@/server/app-registry");
    const result = await readAnnouncedApps();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.apps.map((app) => [app.slug, app.open])).toEqual([
      ["rcopt", false],
      ["traffic-sign", true]
    ]);
  });

  it("drops a row whose slug is no longer in the catalogue rather than rendering a blank name", async () => {
    appRows = [
      { slug: "withdrawn-app", accessModel: "member_free", enabled: true, announcedAt: new Date(), announcedBy: "a" }
    ];

    const { readAnnouncedApps } = await import("@/server/app-registry");
    expect(await readAnnouncedApps()).toEqual({ ok: true, apps: [] });
  });

  it("tells an unreadable database apart from an empty registry", async () => {
    const { readAnnouncedApps, readRegistryForAdmin } = await import("@/server/app-registry");

    expect(await readAnnouncedApps()).toEqual({ ok: true, apps: [] });

    failReads = true;
    expect(await readAnnouncedApps()).toEqual({ ok: false, reason: "unavailable" });
    expect(await readRegistryForAdmin()).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("the back office sees the catalogue, not only the rows", () => {
  beforeEach(() => {
    vi.resetModules();
    getDb.mockClear();
    failReads = false;
    appRows = [];
  });

  it("lists every app even when nothing has been announced", async () => {
    const { readRegistryForAdmin } = await import("@/server/app-registry");
    const result = await readRegistryForAdmin();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Every app in the registry, derived rather than counted — the claim is "every app", and a
    // literal would quietly stop testing that the day the catalogue grows.
    expect(result.entries).toHaveLength(platformApps.length);
    expect(result.entries.every((entry) => entry.announced === false)).toBe(true);
    expect(result.entries.every((entry) => entry.access === null)).toBe(true);
    expect(result.entries.every((entry) => entry.conflictsWithSeed === false)).toBe(true);
  });

  it("flags an announcement that disagrees with the seeded default, and only that one", async () => {
    // ADR 0014 permits the disagreement and makes the registry right; the warning is what makes it
    // visible to the next administrator rather than something only the audit log remembers.
    appRows = [
      { slug: "rcopt", accessModel: "doh_staff_only", enabled: true, announcedAt: new Date(), announcedBy: "a" },
      { slug: "traffic-sign", accessModel: "member_free", enabled: false, announcedAt: new Date(), announcedBy: "a" }
    ];

    const { readRegistryForAdmin } = await import("@/server/app-registry");
    const result = await readRegistryForAdmin();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const conflicting = result.entries.filter((entry) => entry.conflictsWithSeed).map((entry) => entry.slug);
    expect(conflicting).toEqual(["rcopt"]);
  });
});

describe("an announcement has to be justified before anything is written", () => {
  beforeEach(() => {
    vi.resetModules();
    getDb.mockClear();
    failReads = false;
    appRows = [];
  });

  const base = { slug: "rcopt", access: "member_free" as const, open: false, actorId: "admin-1" };

  it.each([
    ["empty", ""],
    ["whitespace only", "    "],
    ["too short to mean anything", "ok"]
  ])("refuses a reason that is %s, without reaching the database", async (_label, reason) => {
    const { announceApp } = await import("@/server/app-registry");
    expect(await announceApp({ ...base, reason })).toEqual({ ok: false, reason: "reason_required" });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("refuses an access model the platform does not have, without reaching the database", async () => {
    const { announceApp } = await import("@/server/app-registry");
    const result = await announceApp({ ...base, access: "free_for_everyone" as never, reason: "ทดสอบ" });
    expect(result).toEqual({ ok: false, reason: "invalid_access" });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("refuses to mark a member_free app as open, without reaching the database", async () => {
    // ADR 0014 §3. No path issues a member_free entitlement yet, so "free and open" would be a
    // claim the product refuses at the door. IP-093 is what deletes this refusal, deliberately.
    const { announceApp } = await import("@/server/app-registry");
    const result = await announceApp({ ...base, open: true, reason: "เปิดให้สมาชิกใช้ได้เลย" });
    expect(result).toEqual({ ok: false, reason: "member_free_cannot_be_open" });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("allows an app that is not member_free to be announced as open", async () => {
    // Proves the refusal above is about member_free and not a blanket ban on opening anything.
    const { announceApp } = await import("@/server/app-registry");

    // Reaching the write is the proof: it cleared every pre-database check, and the only thing
    // stopping it is this file's mock, which refuses to pretend a transaction happened.
    await expect(
      announceApp({ ...base, access: "doh_staff_only" as never, open: true, reason: "หน่วยงานยืนยันสิทธิ์แล้ว" })
    ).rejects.toThrow("no test in this file should reach a write");
    expect(getDb).toHaveBeenCalled();
  });

  it("refuses a slug the catalogue does not have, without reaching the database", async () => {
    const { announceApp } = await import("@/server/app-registry");
    const result = await announceApp({ ...base, slug: "not-an-app", reason: "ทดสอบระบบ" });
    expect(result).toEqual({ ok: false, reason: "unknown_app" });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("refuses to revoke without a reason, and refuses to revoke what was never announced", async () => {
    const { revokeAnnouncement } = await import("@/server/app-registry");

    expect(await revokeAnnouncement({ slug: "rcopt", reason: "", actorId: "admin-1" })).toEqual({
      ok: false,
      reason: "reason_required"
    });
    expect(getDb).not.toHaveBeenCalled();

    appRows = [{ slug: "rcopt", accessModel: "member_free", enabled: false, announcedAt: null, announcedBy: null }];
    expect(await revokeAnnouncement({ slug: "rcopt", reason: "ถอนออกก่อน", actorId: "admin-1" })).toEqual({
      ok: false,
      reason: "not_announced"
    });
  });
});

describe("the entry page's readiness is three-valued on purpose", () => {
  beforeEach(() => {
    vi.resetModules();
    getDb.mockClear();
    failReads = false;
    appRows = [];
  });

  it("says unknown when there is no row, so the app behaves as it did before the registry existed", async () => {
    const { readAppOpenState } = await import("@/server/app-registry");
    expect(await readAppOpenState("rcopt")).toBe("unknown");
  });

  it("says unknown when the database cannot be read, never preparing", async () => {
    // The difference matters: `preparing` closes the app. One unreadable database must not shut
    // every app on the platform, and the real gate is app_entitlements either way.
    failReads = true;
    const { readAppOpenState } = await import("@/server/app-registry");
    expect(await readAppOpenState("rcopt")).toBe("unknown");
  });

  it("reports open and preparing from the announced row", async () => {
    const { readAppOpenState } = await import("@/server/app-registry");

    appRows = [{ slug: "rcopt", accessModel: "member_free", enabled: false, announcedAt: new Date(), announcedBy: "a" }];
    expect(await readAppOpenState("rcopt")).toBe("preparing");

    appRows = [{ slug: "rcopt", accessModel: "member_free", enabled: true, announcedAt: new Date(), announcedBy: "a" }];
    expect(await readAppOpenState("rcopt")).toBe("open");
  });
});

/**
 * IP-092 / ADR 0015. The catalogue surfaces get a fourth reader with a different bargain: it has no
 * failure case, because ADR 0015 §3 decided once that "nothing announced" and "nothing readable"
 * produce the same card. That is the one place in this module where the two are deliberately the
 * same, so the tests below pin it rather than leaving it to look like a swallowed error.
 */
describe("the catalogue card says nothing the registry has not said", () => {
  beforeEach(() => {
    vi.resetModules();
    getDb.mockClear();
    failReads = false;
    appRows = [];
  });

  it("returns an entry for every app in the catalogue, all silent, when nothing is announced", async () => {
    const { readCatalogueClaims } = await import("@/server/app-registry");
    const claims = await readCatalogueClaims();

    expect(Object.keys(claims).sort()).toEqual(platformApps.map((app) => app.slug).sort());
    for (const app of platformApps) {
      expect(claims[app.slug]).toEqual({ announced: false, access: null, open: false, announcedAt: null, availabilityNote: null });
    }
  });

  it("stays silent about an app seeded member_free whose row was never announced", async () => {
    // The exact case that has been on the landing page since ADR 0014: a seeded access model and
    // an unannounced row. The card may name rcopt; it may not say what rcopt costs.
    appRows = [{ slug: "rcopt", accessModel: "member_free", enabled: true, announcedAt: null, announcedBy: null }];

    const { readCatalogueClaims } = await import("@/server/app-registry");
    const claims = await readCatalogueClaims();

    expect(claims.rcopt).toEqual({ announced: false, access: null, open: false, announcedAt: null, availabilityNote: null });
  });

  it("gives an unreadable database exactly the same answer as an empty registry", async () => {
    const { readCatalogueClaims } = await import("@/server/app-registry");
    const empty = await readCatalogueClaims();

    vi.resetModules();
    failReads = true;
    const { readCatalogueClaims: readAgain } = await import("@/server/app-registry");
    expect(await readAgain()).toEqual(empty);
  });

  it("reports the registry's access model, not the seeded one, when they disagree", async () => {
    const announcedAt = new Date("2026-08-24T12:00:00.000Z");
    // estimeter is seeded paid_trial; an administrator is entitled to announce otherwise.
    appRows = [{ slug: "estimeter", accessModel: "member_free", enabled: false, announcedAt, announcedBy: "admin-1" }];

    const { readCatalogueClaims } = await import("@/server/app-registry");
    const claims = await readCatalogueClaims();

    expect(platformApps.find((app) => app.slug === "estimeter")?.seededAccess).toBe("paid_trial");
    expect(claims.estimeter).toEqual({ announced: true, access: "member_free", open: false, announcedAt, availabilityNote: null });
  });

  it("carries the registry's availability sentence only while announced (ADR 0018)", async () => {
    const announcedAt = new Date("2026-08-26T12:00:00.000Z");
    appRows = [
      {
        slug: "estimeter",
        accessModel: "paid_trial",
        enabled: false,
        announcedAt,
        announcedBy: "admin-1",
        availabilityNote: "ทดลองใช้งานฟรี 7 วัน"
      },
      // The exact shape of the IP-122 collision: a note typed once, then the announcement revoked.
      { slug: "rcopt", accessModel: "member_free", enabled: false, announcedAt: null, announcedBy: null, availabilityNote: "สมาชิกใช้ได้ฟรี" }
    ];

    const { readCatalogueClaims } = await import("@/server/app-registry");
    const claims = await readCatalogueClaims();

    expect(claims.estimeter.availabilityNote).toBe("ทดลองใช้งานฟรี 7 วัน");
    // Revoked means silent: the sentence must not survive the announcement it belonged to.
    expect(claims.rcopt).toEqual({ announced: false, access: null, open: false, announcedAt: null, availabilityNote: null });
  });

  it("ignores a row whose slug left the catalogue instead of inventing a card for it", async () => {
    appRows = [{ slug: "retired-app", accessModel: "paid_trial", enabled: true, announcedAt: new Date(), announcedBy: "a" }];

    const { readCatalogueClaims } = await import("@/server/app-registry");
    const claims = await readCatalogueClaims();

    expect(claims["retired-app"]).toBeUndefined();
  });
});
