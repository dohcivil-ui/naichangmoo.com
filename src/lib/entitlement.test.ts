import { describe, expect, it } from "vitest";
import { canCreateAnotherProject, canUseCapability, resolveEntitlement, type Entitlement } from "@/lib/entitlement";

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

  it("retains read access and locks all mutations after the five-day trial", () => {
    const expired = new Date("2026-08-27T00:00:00.000Z");
    expect(resolveEntitlement(trial, expired)).toBe("expired_read_only");
    expect(canUseCapability(trial, "read", expired)).toBe(true);
    expect(canUseCapability(trial, "edit", expired)).toBe(false);
    expect(canUseCapability(trial, "run_ai", expired)).toBe(false);
  });
});
