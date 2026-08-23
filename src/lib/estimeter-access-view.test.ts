import { describe, expect, it } from "vitest";
import { formatTrialDate, toAccessView } from "@/lib/estimeter-access-view";

describe("ESTIMETR access view", () => {
  it("labels the expiry in Bangkok time so a late-evening UTC expiry is not shown a day early", () => {
    // 2026-08-27T17:30:00Z is already 2026-08-28 00:30 in Bangkok.
    const label = formatTrialDate("2026-08-27T17:30:00.000Z");

    expect(label).toContain("28");
    expect(label).toContain("2569");
  });

  it("returns no label for a missing or unparsable date", () => {
    expect(formatTrialDate(null)).toBeNull();
    expect(formatTrialDate("not-a-date")).toBeNull();
  });

  it("carries the server decision through without recomputing it", () => {
    const view = toAccessView({
      state: "expired_read_only",
      endsAtIso: "2026-08-28T00:00:00.000Z",
      daysRemaining: 0,
      projectCount: 1,
      projectLimit: 0,
      capabilities: { read: true, create_project: false, edit: false, run_ai: false, export: false, print: false }
    });

    expect(view.state).toBe("expired_read_only");
    expect(view.projectCount).toBe(1);
    expect(view.projectLimit).toBe(0);
    expect(view.capabilities.edit).toBe(false);
    expect(view.endsAtLabel).not.toBeNull();
  });
});
