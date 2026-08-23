import type { Capability, EffectiveEntitlementState } from "@/lib/entitlement";
import { formatThaiDate } from "@/lib/thai-format";

/** What the workspace is allowed to render. Client components never see raw entitlement rows. */
export type EstimeterAccessView = {
  state: EffectiveEntitlementState;
  endsAtLabel: string | null;
  daysRemaining: number | null;
  projectCount: number;
  projectLimit: number | null;
  capabilities: Record<Capability, boolean>;
};

export function formatTrialDate(iso: string | null): string | null {
  return formatThaiDate(iso);
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
