import type { EntitlementLimits } from "@/lib/entitlement";

export const ESTIMETR_APP_SLUG = "estimeter";

// ADR 0003 set the trial terms and ADR 0006 set when the clock begins. ADR 0009 supersedes the
// length: seven days, so a member who activates on a Friday still gets a full working week. The
// project cap, the export and print locks and the read-only retention are unchanged, and the cap
// is still enforced — ADR 0009 only stops advertising it before entry. Changing any of these
// values needs a superseding ADR.
export const ESTIMETR_TRIAL_DAYS = 7;

export const ESTIMETR_TRIAL_LIMITS: EntitlementLimits = {
  projectLimit: 1,
  exportEnabled: false,
  printEnabled: false,
  aiEnabled: true
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The window runs from the moment the member activates the trial, which is the second of the
 * two access gates: authentication makes someone a platform member, and activation starts the
 * app entitlement. Deriving it from the registration date instead would spend the seven days
 * while the member has not opened the app, and someone arriving on day eight would find an
 * expired trial they never used. See ADR 0006, which supersedes this point in ADR 0003.
 */
export function computeTrialWindow(activatedAt: Date): { startsAt: Date; endsAt: Date } {
  return {
    startsAt: activatedAt,
    endsAt: new Date(activatedAt.getTime() + ESTIMETR_TRIAL_DAYS * DAY_MS)
  };
}

/** Whole days a user should be told are left; a partial day still counts as one. */
export function trialDaysRemaining(endsAt: Date | null | undefined, now = new Date()): number | null {
  if (!endsAt) return null;
  const remaining = endsAt.getTime() - now.getTime();
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / DAY_MS);
}
