export type EntitlementState = "trial" | "active" | "expired_read_only" | "suspended" | "member_free" | "doh_staff_only";

/**
 * Two states are computed and never stored:
 * - `not_started`: an entitlement row exists but its startsAt is still in the future.
 * - `not_activated`: no entitlement row exists at all, so the member has passed authentication
 *   but has not started the app trial yet. See ADR 0006.
 */
export type EffectiveEntitlementState = EntitlementState | "not_started" | "not_activated";

export type EntitlementLimits = {
  projectLimit?: number;
  exportEnabled?: boolean;
  printEnabled?: boolean;
  aiEnabled?: boolean;
};

export type Entitlement = {
  state: EntitlementState;
  startsAt: Date;
  endsAt?: Date | null;
  limits: EntitlementLimits;
};

export type Capability = "read" | "create_project" | "edit" | "run_ai" | "export" | "print";

type StatePolicy = {
  read: boolean;
  mutate: boolean;
  projectLimit: number | null;
  exportEnabled: boolean;
  printEnabled: boolean;
  aiEnabled: boolean;
};

// ADR 0003 defines the trial as five days, one project, export and print locked, with AI
// review still available; expiry keeps read access and locks create/edit/AI/export/print.
// A null projectLimit means unlimited.
const STATE_POLICY: Record<EffectiveEntitlementState, StatePolicy> = {
  trial: { read: true, mutate: true, projectLimit: 1, exportEnabled: false, printEnabled: false, aiEnabled: true },
  active: { read: true, mutate: true, projectLimit: null, exportEnabled: true, printEnabled: true, aiEnabled: true },
  member_free: { read: true, mutate: true, projectLimit: null, exportEnabled: true, printEnabled: true, aiEnabled: true },
  doh_staff_only: { read: true, mutate: true, projectLimit: null, exportEnabled: true, printEnabled: true, aiEnabled: true },
  expired_read_only: { read: true, mutate: false, projectLimit: 0, exportEnabled: false, printEnabled: false, aiEnabled: false },
  suspended: { read: false, mutate: false, projectLimit: 0, exportEnabled: false, printEnabled: false, aiEnabled: false },
  not_started: { read: true, mutate: false, projectLimit: 0, exportEnabled: false, printEnabled: false, aiEnabled: false },
  // ADR 0006: a member who has not started the trial may look around and read anything they
  // already own, but nothing is writable until they accept the trial terms.
  not_activated: { read: true, mutate: false, projectLimit: 0, exportEnabled: false, printEnabled: false, aiEnabled: false }
};

/** Capabilities for a member with no entitlement row, which no `Entitlement` can represent. */
export function notActivatedCapabilities(): Record<Capability, boolean> {
  const policy = STATE_POLICY.not_activated;
  return {
    read: policy.read,
    create_project: false,
    edit: policy.mutate,
    run_ai: policy.aiEnabled,
    export: policy.exportEnabled,
    print: policy.printEnabled
  };
}

const EXPIRABLE_STATES: ReadonlySet<EntitlementState> = new Set(["trial", "active"]);

export function resolveEntitlement(entitlement: Entitlement, now = new Date()): EffectiveEntitlementState {
  if (EXPIRABLE_STATES.has(entitlement.state) && entitlement.endsAt && entitlement.endsAt <= now) {
    return "expired_read_only";
  }
  if (EXPIRABLE_STATES.has(entitlement.state) && entitlement.startsAt > now) {
    return "not_started";
  }
  return entitlement.state;
}

/**
 * Stored limits may only narrow what the state already allows. A row that says
 * `exportEnabled: true` cannot re-open export on an expired entitlement, and an
 * absent flag falls back to the state policy instead of meaning "allowed".
 */
export function resolveLimits(entitlement: Entitlement, now = new Date()): StatePolicy {
  const policy = STATE_POLICY[resolveEntitlement(entitlement, now)];
  const stored = entitlement.limits;
  const storedProjectLimit = stored.projectLimit;

  return {
    read: policy.read,
    mutate: policy.mutate,
    projectLimit:
      storedProjectLimit === undefined
        ? policy.projectLimit
        : policy.projectLimit === null
          ? storedProjectLimit
          : Math.min(policy.projectLimit, storedProjectLimit),
    exportEnabled: policy.exportEnabled && stored.exportEnabled !== false,
    printEnabled: policy.printEnabled && stored.printEnabled !== false,
    aiEnabled: policy.aiEnabled && stored.aiEnabled !== false
  };
}

export function canUseCapability(entitlement: Entitlement, capability: Capability, now = new Date()) {
  const limits = resolveLimits(entitlement, now);
  if (!limits.read) return false;
  if (capability === "read") return true;
  if (!limits.mutate) return false;
  if (capability === "export") return limits.exportEnabled;
  if (capability === "print") return limits.printEnabled;
  if (capability === "run_ai") return limits.aiEnabled;
  if (capability === "create_project") return limits.projectLimit === null || limits.projectLimit > 0;
  return true;
}

export function canCreateAnotherProject(entitlement: Entitlement, existingProjectCount: number, now = new Date()) {
  if (!canUseCapability(entitlement, "create_project", now)) return false;
  const limit = resolveLimits(entitlement, now).projectLimit;
  return limit === null || existingProjectCount < limit;
}

export function listCapabilities(entitlement: Entitlement, existingProjectCount: number, now = new Date()): Record<Capability, boolean> {
  return {
    read: canUseCapability(entitlement, "read", now),
    create_project: canCreateAnotherProject(entitlement, existingProjectCount, now),
    edit: canUseCapability(entitlement, "edit", now),
    run_ai: canUseCapability(entitlement, "run_ai", now),
    export: canUseCapability(entitlement, "export", now),
    print: canUseCapability(entitlement, "print", now)
  };
}
