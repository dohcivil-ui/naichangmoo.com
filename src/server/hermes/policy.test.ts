import { describe, expect, it } from "vitest";
import { hermesPilotDeniedCapabilities, validateHermesPilotJob } from "@/server/hermes/policy";

describe("Hermes pilot policy", () => {
  const baseJob = {
    type: "takeoff_evidence_review" as const,
    jobId: "job-1",
    organizationId: "org-1",
    projectId: "project-1",
    takeoffRunId: "run-1",
    snapshotKey: "job-snapshots/job-1.json",
    snapshotHash: "sha256:example",
    correlationId: "corr-1",
    maxRuntimeSeconds: 120
  };

  it("accepts only bounded review jobs with immutable snapshots", () => {
    expect(() => validateHermesPilotJob(baseJob)).not.toThrow();
    expect(() => validateHermesPilotJob({ ...baseJob, snapshotKey: "projects/project-1/input.json" })).toThrow();
    expect(() => validateHermesPilotJob({ ...baseJob, maxRuntimeSeconds: 181 })).toThrow();
  });

  it("explicitly denies business mutations and external effects", () => {
    expect(hermesPilotDeniedCapabilities).toContain("price_change");
    expect(hermesPilotDeniedCapabilities).toContain("document_release");
    expect(hermesPilotDeniedCapabilities).toContain("external_message");
  });
});
