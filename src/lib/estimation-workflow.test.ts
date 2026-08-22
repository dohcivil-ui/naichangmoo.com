import { describe, expect, it } from "vitest";
import { canOpenWorkflowStage, getWorkflowBlocker, resolveDemoWorkflowStage, resolveGuidedWorkflowStage } from "@/lib/estimation-workflow";

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

describe("ESTIMETR guided workflow policy", () => {
  const initial = {
    projectPath: null,
    scaleConfirmed: false,
    drawingReviewed: false,
    takeoffReviewed: false,
    priceSetApproved: false,
    costReviewed: false,
  } as const;

  it("does not unlock take-off until project path, scale and drawing review are confirmed", () => {
    expect(resolveGuidedWorkflowStage(initial)).toBe(1);
    expect(resolveGuidedWorkflowStage({ ...initial, projectPath: "government" })).toBe(1);
    expect(resolveGuidedWorkflowStage({ ...initial, projectPath: "government", scaleConfirmed: true })).toBe(1);
    expect(resolveGuidedWorkflowStage({ ...initial, projectPath: "government", scaleConfirmed: true, drawingReviewed: true })).toBe(2);
  });

  it("requires an approved price set and unit-cost review before BOQ/document readiness", () => {
    const takeoffReady = { ...initial, projectPath: "private" as const, scaleConfirmed: true, drawingReviewed: true, takeoffReviewed: true };
    expect(resolveGuidedWorkflowStage(takeoffReady)).toBe(3);
    expect(resolveGuidedWorkflowStage({ ...takeoffReady, priceSetApproved: true })).toBe(3);
    expect(resolveGuidedWorkflowStage({ ...takeoffReady, priceSetApproved: true, costReviewed: true })).toBe(4);
  });

  it("returns an explicit reason instead of silently allowing a skipped step", () => {
    expect(getWorkflowBlocker(initial)).toContain("สายงาน");
    expect(getWorkflowBlocker({ ...initial, projectPath: "government" })).toContain("สเกล");
  });
});
