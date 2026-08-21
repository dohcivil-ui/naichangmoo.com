export type HermesReviewFinding = {
  severity: "info" | "review" | "blocking";
  evidenceReference: string;
  summary: string;
  suggestedQuestion: string;
};

export type HermesTakeoffEvidenceReviewPayload = {
  type: "takeoff_evidence_review";
  jobId: string;
  organizationId: string;
  projectId: string;
  takeoffRunId: string;
  snapshotKey: string;
  snapshotHash: string;
  correlationId: string;
  maxRuntimeSeconds: number;
};

export type HermesTakeoffEvidenceReviewResult = {
  jobId: string;
  status: "advisory_complete" | "needs_human_review" | "failed";
  findings: HermesReviewFinding[];
  modelMetadata: { provider: string; model: string; promptHash: string };
};
