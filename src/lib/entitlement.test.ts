import { describe, expect, it } from "vitest";
import {
  canCreateAnotherProject,
  canUseCapability,
  listCapabilities,
  notActivatedCapabilities,
  resolveEntitlement,
  type Entitlement
} from "@/lib/entitlement";

const trial: Entitlement = {
  state: "trial",
  startsAt: new Date("2026-08-22T00:00:00.000Z"),
  endsAt: new Date("2026-08-27T00:00:00.000Z"),
  limits: { projectLimit: 1, exportEnabled: false, printEnabled: false, aiEnabled: true }
};

describe("ESTIMETR trial entitlement", () => {
  it("allows one project and AI review but blocks export and print during trial", () => {
    const now = new Date("2026-08-24T00:00:00.000Z");
    expect(canCreateAnotherProject(trial, 0, now)).toBe(true);
    expect(canCreateAnotherProject(trial, 1, now)).toBe(false);
    expect(canUseCapability(trial, "run_ai", now)).toBe(true);
    expect(canUseCapability(trial, "export", now)).toBe(false);
    expect(canUseCapability(trial, "print", now)).toBe(false);
  });

  // The fixture carries its own endsAt, so this covers expiry behaviour and not the trial length
  // that ADR 0009 changed; estimeter-trial.test.ts is where the length is asserted.
  it("retains read access and locks all mutations once the trial window closes", () => {
    const expired = new Date("2026-08-27T00:00:00.000Z");
    expect(resolveEntitlement(trial, expired)).toBe("expired_read_only");
    expect(canUseCapability(trial, "read", expired)).toBe(true);
    expect(canUseCapability(trial, "edit", expired)).toBe(false);
    expect(canUseCapability(trial, "run_ai", expired)).toBe(false);
  });

  it("expires a paid active entitlement to read-only once endsAt passes", () => {
    const active: Entitlement = {
      state: "active",
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      endsAt: new Date("2026-09-01T00:00:00.000Z"),
      limits: { exportEnabled: true, printEnabled: true, aiEnabled: true }
    };
    const beforeExpiry = new Date("2026-08-31T00:00:00.000Z");
    const afterExpiry = new Date("2026-09-01T00:00:00.000Z");

    expect(resolveEntitlement(active, beforeExpiry)).toBe("active");
    expect(canUseCapability(active, "export", beforeExpiry)).toBe(true);
    expect(resolveEntitlement(active, afterExpiry)).toBe("expired_read_only");
    expect(canUseCapability(active, "export", afterExpiry)).toBe(false);
    expect(canUseCapability(active, "read", afterExpiry)).toBe(true);
  });

  it("falls back to the trial policy instead of granting AI when the stored limit is absent", () => {
    const now = new Date("2026-08-24T00:00:00.000Z");
    const withoutFlags: Entitlement = { state: "trial", startsAt: trial.startsAt, endsAt: trial.endsAt, limits: {} };

    expect(canUseCapability(withoutFlags, "run_ai", now)).toBe(true);
    expect(canUseCapability(withoutFlags, "export", now)).toBe(false);
    expect(canUseCapability(withoutFlags, "print", now)).toBe(false);
    expect(canCreateAnotherProject(withoutFlags, 1, now)).toBe(false);
  });

  it("applies stored limits to a paid entitlement instead of granting everything", () => {
    const now = new Date("2026-08-24T00:00:00.000Z");
    const restrictedActive: Entitlement = {
      state: "active",
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      endsAt: new Date("2026-12-01T00:00:00.000Z"),
      limits: { projectLimit: 3, exportEnabled: false }
    };

    expect(canUseCapability(restrictedActive, "export", now)).toBe(false);
    expect(canUseCapability(restrictedActive, "print", now)).toBe(true);
    expect(canCreateAnotherProject(restrictedActive, 2, now)).toBe(true);
    expect(canCreateAnotherProject(restrictedActive, 3, now)).toBe(false);
  });

  it("never lets stored limits widen what an expired entitlement allows", () => {
    const afterExpiry = new Date("2026-08-28T00:00:00.000Z");
    const generousExpired: Entitlement = {
      state: "trial",
      startsAt: trial.startsAt,
      endsAt: trial.endsAt,
      limits: { projectLimit: 10, exportEnabled: true, printEnabled: true, aiEnabled: true }
    };

    expect(canUseCapability(generousExpired, "export", afterExpiry)).toBe(false);
    expect(canUseCapability(generousExpired, "print", afterExpiry)).toBe(false);
    expect(canCreateAnotherProject(generousExpired, 0, afterExpiry)).toBe(false);
  });

  it("grants nothing but read before the entitlement window opens", () => {
    const beforeStart = new Date("2026-08-21T00:00:00.000Z");

    expect(resolveEntitlement(trial, beforeStart)).toBe("not_started");
    expect(canUseCapability(trial, "read", beforeStart)).toBe(true);
    expect(canUseCapability(trial, "edit", beforeStart)).toBe(false);
    expect(canCreateAnotherProject(trial, 0, beforeStart)).toBe(false);
  });

  it("locks read as well when an entitlement is suspended", () => {
    const suspended: Entitlement = {
      state: "suspended",
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      endsAt: null,
      limits: {}
    };

    expect(canUseCapability(suspended, "read", new Date("2026-08-24T00:00:00.000Z"))).toBe(false);
  });

  it("reports the capability set a workspace should render for a trial at its project cap", () => {
    const now = new Date("2026-08-24T00:00:00.000Z");

    expect(listCapabilities(trial, 1, now)).toEqual({
      read: true,
      create_project: false,
      edit: true,
      run_ai: true,
      export: false,
      print: false
    });
  });

  it("gives a member who has not activated the trial read access and nothing else", () => {
    // ADR 0006: authentication alone must not grant a single writable capability.
    expect(notActivatedCapabilities()).toEqual({
      read: true,
      create_project: false,
      edit: false,
      run_ai: false,
      export: false,
      print: false
    });
  });

  it("keeps free membership usable without an end date", () => {
    const memberFree: Entitlement = {
      state: "member_free",
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      endsAt: null,
      limits: {}
    };
    const later = new Date("2030-01-01T00:00:00.000Z");
    expect(resolveEntitlement(memberFree, later)).toBe("member_free");
    expect(canUseCapability(memberFree, "edit", later)).toBe(true);
  });
});
