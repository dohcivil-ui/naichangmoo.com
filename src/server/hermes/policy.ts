import type { HermesTakeoffEvidenceReviewPayload } from "@/server/hermes/types";

const ALLOWED_JOB_TYPE = "takeoff_evidence_review";
const MAX_RUNTIME_SECONDS = 180;

export function validateHermesPilotJob(job: HermesTakeoffEvidenceReviewPayload) {
  if (job.type !== ALLOWED_JOB_TYPE) throw new Error("Hermes pilot only accepts takeoff evidence review jobs.");
  if (!job.snapshotKey.startsWith("job-snapshots/")) throw new Error("Hermes input must be an immutable job snapshot.");
  if (job.maxRuntimeSeconds <= 0 || job.maxRuntimeSeconds > MAX_RUNTIME_SECONDS) throw new Error("Hermes job runtime exceeds pilot policy.");
}

export const hermesPilotDeniedCapabilities = [
  "database_write",
  "price_change",
  "document_release",
  "external_message",
  "payment_action",
  "infrastructure_change"
] as const;
