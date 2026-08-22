import { describe, expect, it } from "vitest";
import { canOpenWorkflowStage, resolveDemoWorkflowStage } from "@/lib/estimation-workflow";

describe("ESTIMETR demo workflow gates", () => {
  it("advances only when each prior review has been completed", () => {
    expect(resolveDemoWorkflowStage({ reviewed: false, takeoffReviewed: false, costReviewed: false })).toBe(1);
    expect(resolveDemoWorkflowStage({ reviewed: true, takeoffReviewed: false, costReviewed: false })).toBe(2);
    expect(resolveDemoWorkflowStage({ reviewed: true, takeoffReviewed: true, costReviewed: false })).toBe(3);
    expect(resolveDemoWorkflowStage({ reviewed: true, takeoffReviewed: true, costReviewed: true })).toBe(4);
  });

  it("does not allow a locked stage to be opened before its gate", () => {
    expect(canOpenWorkflowStage(1, 1)).toBe(true);
    expect(canOpenWorkflowStage(2, 1)).toBe(false);
    expect(canOpenWorkflowStage(3, 2)).toBe(false);
    expect(canOpenWorkflowStage(4, 3)).toBe(false);
    expect(canOpenWorkflowStage(4, 4)).toBe(true);
  });
});
