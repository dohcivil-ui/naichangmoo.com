import { describe, expect, it } from "vitest";
import { canUseCapability, resolveEntitlement, type Entitlement } from "@/lib/entitlement";
import { ESTIMETR_TRIAL_LIMITS, computeTrialWindow, trialDaysRemaining } from "@/lib/estimeter-trial";

describe("ESTIMETR trial window", () => {
  it("runs exactly five days from the moment of activation", () => {
    const activatedAt = new Date("2026-08-23T09:15:00.000Z");
    const window = computeTrialWindow(activatedAt);

    expect(window.startsAt).toEqual(activatedAt);
    expect(window.endsAt.toISOString()).toBe("2026-08-28T09:15:00.000Z");
  });

  it("does not move when the same activation instant is written later", () => {
    const activatedAt = new Date("2026-08-23T09:15:00.000Z");
    const writtenFourDaysLater = computeTrialWindow(activatedAt);
    const writtenImmediately = computeTrialWindow(activatedAt);

    expect(writtenFourDaysLater.endsAt).toEqual(writtenImmediately.endsAt);
  });

  it("counts a partial day as a remaining day and stops at zero", () => {
    const endsAt = new Date("2026-08-28T09:15:00.000Z");

    expect(trialDaysRemaining(endsAt, new Date("2026-08-23T09:15:00.000Z"))).toBe(5);
    expect(trialDaysRemaining(endsAt, new Date("2026-08-27T21:15:00.000Z"))).toBe(1);
    expect(trialDaysRemaining(endsAt, new Date("2026-08-28T09:15:00.000Z"))).toBe(0);
    expect(trialDaysRemaining(endsAt, new Date("2026-09-10T00:00:00.000Z"))).toBe(0);
    expect(trialDaysRemaining(null)).toBeNull();
  });

  it("produces an entitlement that matches the approved trial policy end to end", () => {
    const activatedAt = new Date("2026-08-23T00:00:00.000Z");
    const window = computeTrialWindow(activatedAt);
    const entitlement: Entitlement = { state: "trial", ...window, limits: ESTIMETR_TRIAL_LIMITS };
    const dayThree = new Date("2026-08-26T00:00:00.000Z");
    const afterExpiry = new Date("2026-08-28T00:00:00.000Z");

    expect(resolveEntitlement(entitlement, dayThree)).toBe("trial");
    expect(canUseCapability(entitlement, "run_ai", dayThree)).toBe(true);
    expect(canUseCapability(entitlement, "export", dayThree)).toBe(false);
    expect(resolveEntitlement(entitlement, afterExpiry)).toBe("expired_read_only");
    expect(canUseCapability(entitlement, "read", afterExpiry)).toBe(true);
    expect(canUseCapability(entitlement, "edit", afterExpiry)).toBe(false);
  });
});
