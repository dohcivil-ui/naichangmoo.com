export type EstimationStage = 1 | 2 | 3 | 4;

export type DemoWorkflowReview = {
  reviewed: boolean;
  takeoffReviewed: boolean;
  costReviewed: boolean;
};

export function resolveDemoWorkflowStage({ reviewed, takeoffReviewed, costReviewed }: DemoWorkflowReview): EstimationStage {
  if (costReviewed) return 4;
  if (takeoffReviewed) return 3;
  if (reviewed) return 2;
  return 1;
}

export function canOpenWorkflowStage(requested: EstimationStage, unlocked: EstimationStage) {
  return requested <= unlocked;
}
