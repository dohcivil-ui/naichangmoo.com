import type { Capability, EffectiveEntitlementState } from "@/lib/entitlement";

/** What the workspace is allowed to render. Client components never see raw entitlement rows. */
export type EstimeterAccessView = {
  state: EffectiveEntitlementState;
  endsAtLabel: string | null;
  daysRemaining: number | null;
  projectCount: number;
  projectLimit: number | null;
  capabilities: Record<Capability, boolean>;
};

// The timezone is pinned because the server may run in UTC: without it, an expiry just
// after Bangkok midnight would be shown to the user as the previous day.
const thaiDate = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" });

export function formatTrialDate(iso: string | null): string | null {
  if (!iso) return null;
  const value = new Date(iso);
  return Number.isNaN(value.getTime()) ? null : thaiDate.format(value);
}

export function toAccessView(access: {
  state: EffectiveEntitlementState;
  endsAtIso: string | null;
  daysRemaining: number | null;
  projectCount: number;
  projectLimit: number | null;
  capabilities: Record<Capability, boolean>;
}): EstimeterAccessView {
  return {
    state: access.state,
    endsAtLabel: formatTrialDate(access.endsAtIso),
    daysRemaining: access.daysRemaining,
    projectCount: access.projectCount,
    projectLimit: access.projectLimit,
    capabilities: access.capabilities
  };
}
