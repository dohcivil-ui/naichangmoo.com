export type EntitlementState = "trial" | "active" | "expired_read_only" | "suspended" | "member_free" | "doh_staff_only";

/** `not_started` is computed, never stored: it covers an entitlement whose startsAt is still in the future. */
export type EffectiveEntitlementState = EntitlementState | "not_started";

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
  not_started: { read: true, mutate: false, projectLimit: 0, exportEnabled: false, printEnabled: false, aiEnabled: false }
};

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
