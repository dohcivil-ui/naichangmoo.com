export type EntitlementState = "trial" | "active" | "expired_read_only" | "suspended" | "member_free" | "doh_staff_only";

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

export function resolveEntitlement(entitlement: Entitlement, now = new Date()): EntitlementState {
  if (entitlement.state === "trial" && entitlement.endsAt && entitlement.endsAt <= now) {
    return "expired_read_only";
  }
  return entitlement.state;
}

export function canUseCapability(entitlement: Entitlement, capability: Capability, now = new Date()) {
  const state = resolveEntitlement(entitlement, now);
  if (state === "suspended") return false;
  if (capability === "read") return true;
  if (state === "expired_read_only") return false;
  if (state === "member_free" || state === "doh_staff_only" || state === "active") return true;
  if (state !== "trial") return false;

  if (capability === "export") return entitlement.limits.exportEnabled === true;
  if (capability === "print") return entitlement.limits.printEnabled === true;
  if (capability === "run_ai") return entitlement.limits.aiEnabled !== false;
  return true;
}

export function canCreateAnotherProject(entitlement: Entitlement, existingProjectCount: number, now = new Date()) {
  if (!canUseCapability(entitlement, "create_project", now)) return false;
  const limit = entitlement.limits.projectLimit;
  return limit === undefined || existingProjectCount < limit;
}
