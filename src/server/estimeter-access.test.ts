import { describe, expect, it } from "vitest";
import { canUseCapability, type Entitlement } from "@/lib/entitlement";
import { parseStoredLimits } from "@/server/estimeter-access";

describe("stored entitlement limits", () => {
  it("keeps only values of the expected type", () => {
    expect(parseStoredLimits({ projectLimit: 3, exportEnabled: true, printEnabled: false, aiEnabled: true })).toEqual({
      projectLimit: 3,
      exportEnabled: true,
      printEnabled: false,
      aiEnabled: true
    });
  });

  it("ignores wrong types instead of coercing them into permissions", () => {
    const parsed = parseStoredLimits({ projectLimit: "5", exportEnabled: "true", printEnabled: 1, aiEnabled: null });

    expect(parsed.projectLimit).toBeUndefined();
    expect(parsed.exportEnabled).toBeUndefined();
    expect(parsed.printEnabled).toBeUndefined();
    expect(parsed.aiEnabled).toBeUndefined();
  });

  it("treats a missing or non-object column as no stored limits", () => {
    expect(parseStoredLimits(null)).toEqual({});
    expect(parseStoredLimits("{}")).toEqual({});
  });

  it("cannot unlock export on a trial by editing the limits column", () => {
    const tampered: Entitlement = {
      state: "trial",
      startsAt: new Date("2026-08-23T00:00:00.000Z"),
      endsAt: new Date("2026-08-28T00:00:00.000Z"),
      limits: parseStoredLimits({ exportEnabled: true, printEnabled: true, projectLimit: 99 })
    };
    const now = new Date("2026-08-24T00:00:00.000Z");

    expect(canUseCapability(tampered, "export", now)).toBe(false);
    expect(canUseCapability(tampered, "print", now)).toBe(false);
  });
});
