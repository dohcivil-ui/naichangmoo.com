import type { EntitlementLimits } from "@/lib/entitlement";

export const ESTIMETR_APP_SLUG = "estimeter";

// ADR 0003: the ESTIMETR trial runs five days from the member record, allows one project
// and keeps export and print locked. Changing any of these values needs a superseding ADR.
export const ESTIMETR_TRIAL_DAYS = 5;

export const ESTIMETR_TRIAL_LIMITS: EntitlementLimits = {
  projectLimit: 1,
  exportEnabled: false,
  printEnabled: false,
  aiEnabled: true
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The window is derived from the member record, not from the moment the row is written,
 * so a member who reaches ESTIMETR late gets the same five days they were granted at
 * registration and a delayed backfill can never extend the trial.
 */
export function computeTrialWindow(memberCreatedAt: Date): { startsAt: Date; endsAt: Date } {
  return {
    startsAt: memberCreatedAt,
    endsAt: new Date(memberCreatedAt.getTime() + ESTIMETR_TRIAL_DAYS * DAY_MS)
  };
}

/** Whole days a user should be told are left; a partial day still counts as one. */
export function trialDaysRemaining(endsAt: Date | null | undefined, now = new Date()): number | null {
  if (!endsAt) return null;
  const remaining = endsAt.getTime() - now.getTime();
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / DAY_MS);
}
