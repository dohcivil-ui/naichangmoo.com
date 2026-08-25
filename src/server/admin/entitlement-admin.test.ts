import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Two rules are worth holding here, and both are held by refusing before the database is touched.
 *
 * A reason that can be blank will be blank, so the check runs first and the mock throws if any
 * query is attempted — a test that merely asserted the return value would still pass if the write
 * happened and was then reported as a failure.
 *
 * And an empty search returns nothing rather than everything. Opening the page is not a request to
 * browse the customer list.
 */

const getDb = vi.fn(() => {
  throw new Error("the database must not be reached for a request that should have been refused");
});

vi.mock("@/db", () => ({ getDb: () => getDb() }));

describe("a reason is mandatory before anything is written", () => {
  beforeEach(() => {
    vi.resetModules();
    getDb.mockClear();
  });

  const base = {
    entitlementId: "ent-1",
    state: "active" as const,
    endsAt: null,
    actorId: "admin-1"
  };

  it.each([
    ["empty", ""],
    ["whitespace only", "    "],
    ["too short to mean anything", "ok"]
  ])("refuses a reason that is %s, without reaching the database", async (_label, reason) => {
    const { updateCustomerEntitlement } = await import("@/server/admin/entitlement-admin");
    const result = await updateCustomerEntitlement({ ...base, reason });

    expect(result).toEqual({ ok: false, reason: "reason_required" });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("refuses a state outside the settable set, without reaching the database", async () => {
    const { updateCustomerEntitlement } = await import("@/server/admin/entitlement-admin");
    const result = await updateCustomerEntitlement({
      ...base,
      // A state the enum does not carry, as a form post could supply.
      state: "godmode" as never,
      reason: "ทดสอบสถานะที่ไม่มีอยู่จริง"
    });

    expect(result).toEqual({ ok: false, reason: "invalid_state" });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("only offers states the entitlement enum actually carries", async () => {
    const { ADMIN_SETTABLE_STATES } = await import("@/server/admin/entitlement-admin");
    expect([...ADMIN_SETTABLE_STATES].sort()).toEqual(
      ["active", "doh_staff_only", "expired_read_only", "member_free", "suspended", "trial"].sort()
    );
  });
});

describe("an empty search is not a request to browse", () => {
  beforeEach(() => {
    vi.resetModules();
    getDb.mockClear();
  });

  it.each([
    ["empty", ""],
    ["whitespace", "   "],
    ["a single character", "a"]
  ])("returns nothing for %s without querying", async (_label, query) => {
    const { findCustomers } = await import("@/server/admin/entitlement-admin");
    await expect(findCustomers(query)).resolves.toEqual([]);
    expect(getDb).not.toHaveBeenCalled();
  });
});
