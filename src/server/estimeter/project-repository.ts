import { randomUUID } from "node:crypto";
import { and, count, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, organizations, projects } from "@/db/schema";
import type { EffectiveEntitlementState } from "@/lib/entitlement";
import { ESTIMETR_WORK_TYPE, type ProjectPathCode } from "@/lib/estimeter-project";

export type ProjectSummary = {
  id: string;
  name: string;
  state: string;
  workType: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateProjectInput = {
  organizationId: string;
  ownerId: string;
  name: string;
  path: ProjectPathCode;
  projectLimit: number | null;
  entitlementState: EffectiveEntitlementState;
};

export type CreateProjectResult =
  | { ok: true; projectId: string }
  | { ok: false; reason: "project_limit_reached" | "organization_missing" };

const summaryColumns = {
  id: projects.id,
  name: projects.name,
  state: projects.state,
  workType: projects.workType,
  path: projects.path,
  createdAt: projects.createdAt,
  updatedAt: projects.updatedAt
};

// Every read takes the organization id, so an owner cannot reach another organization's
// project by guessing an id. Scoping lives here rather than in each page or action.
export async function listProjects(organizationId: string): Promise<ProjectSummary[]> {
  return getDb()
    .select(summaryColumns)
    .from(projects)
    .where(eq(projects.organizationId, organizationId))
    .orderBy(desc(projects.createdAt));
}

export async function getProject(organizationId: string, projectId: string): Promise<ProjectSummary | null> {
  const rows = await getDb()
    .select(summaryColumns)
    .from(projects)
    .where(and(eq(projects.organizationId, organizationId), eq(projects.id, projectId)))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Counting outside a transaction and inserting after it would let two submits that arrive
 * together both see the last free slot. The organization row is locked first, which
 * serializes project creation per organization without needing a new constraint.
 */
export async function createProjectWithinLimit(input: CreateProjectInput): Promise<CreateProjectResult> {
  return getDb().transaction(async (tx) => {
    const locked = await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, input.organizationId))
      .limit(1)
      .for("update");
    if (!locked[0]) return { ok: false, reason: "organization_missing" };

    if (input.projectLimit !== null) {
      const counted = await tx
        .select({ value: count() })
        .from(projects)
        .where(eq(projects.organizationId, input.organizationId));
      if ((counted[0]?.value ?? 0) >= input.projectLimit) return { ok: false, reason: "project_limit_reached" };
    }

    const projectId = randomUUID();
    await tx.insert(projects).values({
      id: projectId,
      organizationId: input.organizationId,
      ownerId: input.ownerId,
      name: input.name,
      workType: ESTIMETR_WORK_TYPE,
      path: input.path,
      state: "draft"
    });

    await tx.insert(auditEvents).values({
      id: randomUUID(),
      organizationId: input.organizationId,
      actorId: input.ownerId,
      eventType: "project.created",
      resourceType: "project",
      resourceId: projectId,
      metadata: {
        name: input.name,
        workType: ESTIMETR_WORK_TYPE,
        path: input.path,
        // Recording which entitlement allowed the write keeps the decision auditable later.
        entitlementState: input.entitlementState,
        projectLimit: input.projectLimit
      }
    });

    return { ok: true, projectId };
  });
}
