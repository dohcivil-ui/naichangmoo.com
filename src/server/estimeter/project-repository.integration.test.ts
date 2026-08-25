import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

/** Minimal .env reader so this file can reach the local database without a runtime dependency. */
function loadLocalEnv() {
  const file = path.join(process.cwd(), ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (process.env[key] !== undefined) continue;
    process.env[key] = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
  }
}

/**
 * Opt-in because it writes to whatever database DATABASE_URL points at. Run it against a
 * local database only:
 *   $env:ESTIMETR_DB_TESTS=1 ; pnpm vitest run src/server/estimeter/project-repository.integration.test.ts
 */
const enabled = process.env.ESTIMETR_DB_TESTS === "1";

describe.skipIf(!enabled)("ESTIMETR project writes against PostgreSQL", () => {
  loadLocalEnv();

  const userIds: string[] = [];
  const organizationIds: string[] = [];

  afterAll(async () => {
    if (!enabled || userIds.length === 0) return;
    const { getDb } = await import("@/db");
    const { auditEvents, organizations, users } = await import("@/db/schema");
    const db = getDb();

    // audit_events has no cascade; organizations cascades projects, members and entitlements.
    await db.delete(auditEvents).where(inArray(auditEvents.organizationId, organizationIds));
    await db.delete(organizations).where(inArray(organizations.id, organizationIds));
    await db.delete(users).where(inArray(users.id, userIds));
  });

  async function createOrganizationWithOwner() {
    const { getDb } = await import("@/db");
    const { organizations, users } = await import("@/db/schema");
    const suffix = randomUUID();
    const userId = `test_${suffix}`;
    const organizationId = `org_test_${suffix}`;
    userIds.push(userId);
    organizationIds.push(organizationId);

    const db = getDb();
    await db.insert(users).values({
      id: userId,
      name: "Integration Test Member",
      email: `${userId}@integration.invalid`
    });
    await db.insert(organizations).values({ id: organizationId, kind: "personal", name: "Integration Test Org" });

    return { userId, organizationId };
  }

  it("accepts the first project on a trial and refuses the second at the write path", async () => {
    const { createProjectWithinLimit, listProjects } = await import("@/server/estimeter/project-repository");
    const { userId, organizationId } = await createOrganizationWithOwner();
    const input = { organizationId, ownerId: userId, path: "government" as const, siteLocation: null, agencyName: null, projectLimit: 1, entitlementState: "trial" as const };

    const first = await createProjectWithinLimit({ ...input, name: "อาคารสำนักงาน 3 ชั้น" });
    const second = await createProjectWithinLimit({ ...input, name: "อาคารเรียน 4 ชั้น" });

    expect(first).toEqual({ ok: true, projectId: expect.any(String) });
    expect(second).toEqual({ ok: false, reason: "project_limit_reached" });
    expect(await listProjects(organizationId)).toHaveLength(1);
  });

  it("records who created the project and under which entitlement", async () => {
    const { createProjectWithinLimit } = await import("@/server/estimeter/project-repository");
    const { getDb } = await import("@/db");
    const { auditEvents } = await import("@/db/schema");
    const { userId, organizationId } = await createOrganizationWithOwner();

    const created = await createProjectWithinLimit({
      organizationId,
      ownerId: userId,
      name: "อาคารพักอาศัย 2 ชั้น",
      path: "government" as const,
      siteLocation: null,
      agencyName: null,
      projectLimit: 1,
      entitlementState: "trial"
    });
    if (!created.ok) throw new Error("expected the first project to be created");

    const audits = await getDb()
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.organizationId, organizationId), eq(auditEvents.eventType, "project.created")));

    expect(audits).toHaveLength(1);
    expect(audits[0]?.resourceId).toBe(created.projectId);
    expect(audits[0]?.actorId).toBe(userId);
    expect(audits[0]?.metadata).toMatchObject({ entitlementState: "trial", workType: "building", projectLimit: 1 });
  });

  /**
   * Two submits that merely start together may still be serialized by chance, so this test
   * holds the organization lock open and proves the second submit waits for it and then
   * sees the project the first one wrote. Removing the row lock makes it fail.
   */
  it("makes a second submit wait for the lock instead of counting stale rows", async () => {
    const { createProjectWithinLimit, listProjects } = await import("@/server/estimeter/project-repository");
    const { getDb } = await import("@/db");
    const { organizations, projects } = await import("@/db/schema");
    const { userId, organizationId } = await createOrganizationWithOwner();

    let lockAcquired: () => void;
    let releaseHolder: () => void;
    const acquired = new Promise<void>((resolve) => (lockAcquired = resolve));
    const released = new Promise<void>((resolve) => (releaseHolder = resolve));

    const holder = getDb().transaction(async (tx) => {
      await tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .for("update");
      lockAcquired();
      await released;
      await tx.insert(projects).values({
        id: randomUUID(),
        organizationId,
        ownerId: userId,
        name: "โครงการที่ยึด lock ไว้",
        workType: "building",
        state: "draft"
      });
    });

    await acquired;
    const contender = createProjectWithinLimit({
      organizationId,
      ownerId: userId,
      name: "โครงการที่ยิงเข้ามาระหว่างถือ lock",
      path: "government" as const,
      siteLocation: null,
      agencyName: null,
      projectLimit: 1,
      entitlementState: "trial"
    });
    const early = await Promise.race([
      contender.then(() => "finished"),
      new Promise((resolve) => setTimeout(() => resolve("still waiting"), 300))
    ]);
    expect(early).toBe("still waiting");

    releaseHolder!();
    await holder;

    expect(await contender).toEqual({ ok: false, reason: "project_limit_reached" });
    expect(await listProjects(organizationId)).toHaveLength(1);
  });

  it("hides a project from another organization instead of returning it", async () => {
    const { createProjectWithinLimit, getProject, listProjects } = await import("@/server/estimeter/project-repository");
    const owner = await createOrganizationWithOwner();
    const outsider = await createOrganizationWithOwner();

    const created = await createProjectWithinLimit({
      organizationId: owner.organizationId,
      ownerId: owner.userId,
      name: "โครงการขององค์กรแรก",
      path: "government" as const,
      siteLocation: null,
      agencyName: null,
      projectLimit: 1,
      entitlementState: "trial"
    });
    if (!created.ok) throw new Error("expected the project to be created");

    expect(await getProject(owner.organizationId, created.projectId)).not.toBeNull();
    expect(await getProject(outsider.organizationId, created.projectId)).toBeNull();
    expect(await listProjects(outsider.organizationId)).toHaveLength(0);
  });

  it("still reads projects when the entitlement no longer allows creating them", async () => {
    const { createProjectWithinLimit, getProject } = await import("@/server/estimeter/project-repository");
    const { projectCreationDenial } = await import("@/lib/estimeter-project");
    const { userId, organizationId } = await createOrganizationWithOwner();

    const created = await createProjectWithinLimit({
      organizationId,
      ownerId: userId,
      name: "โครงการก่อนสิทธิ์หมดอายุ",
      path: "government" as const,
      siteLocation: null,
      agencyName: null,
      projectLimit: 1,
      entitlementState: "trial"
    });
    if (!created.ok) throw new Error("expected the project to be created");

    const expiredAccess = {
      state: "expired_read_only" as const,
      capabilities: { read: true, create_project: false, edit: false, run_ai: false, export: false, print: false },
      projectCount: 1,
      path: "government" as const,
      siteLocation: null,
      agencyName: null,
      projectLimit: 0
    };

    expect(projectCreationDenial(expiredAccess)).toBeTruthy();
    // The cap is enforced on the write path too, so a direct POST cannot bypass the UI state.
    expect(
      await createProjectWithinLimit({
        organizationId,
        ownerId: userId,
        name: "โครงการหลังหมดอายุ",
        path: "government" as const,
        siteLocation: null,
        agencyName: null,
        projectLimit: 0,
        entitlementState: "expired_read_only"
      })
    ).toEqual({ ok: false, reason: "project_limit_reached" });
    expect(await getProject(organizationId, created.projectId)).not.toBeNull();
  });

  it("refuses to write a project for an organization that does not exist", async () => {
    const { createProjectWithinLimit } = await import("@/server/estimeter/project-repository");
    const { userId } = await createOrganizationWithOwner();

    const result = await createProjectWithinLimit({
      organizationId: `org_missing_${randomUUID()}`,
      ownerId: userId,
      name: "โครงการไร้องค์กร",
      path: "government" as const,
      siteLocation: null,
      agencyName: null,
      projectLimit: 1,
      entitlementState: "trial"
    });

    expect(result).toEqual({ ok: false, reason: "organization_missing" });
  });
});
