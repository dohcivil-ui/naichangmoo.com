import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
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
 * local database only:  $env:ASSISTANT_DB_TESTS=1 ; pnpm vitest run src/server/ai/assistant-proposals.integration.test.ts
 *
 * What it proves that the mocked tests cannot: the row survives a real round trip through
 * PostgreSQL with its real column types and foreign keys, the enum accepts every decision the
 * code can produce, and the audit trail can actually be read back by correlation id — which is
 * the only question an audit ever asks.
 */
const enabled = process.env.ASSISTANT_DB_TESTS === "1";

describe.skipIf(!enabled)("assistant proposals against PostgreSQL", () => {
  loadLocalEnv();

  const userIds: string[] = [];
  const proposalIds: string[] = [];

  afterAll(async () => {
    if (!enabled || userIds.length === 0) return;
    const { getDb } = await import("@/db");
    const { assistantProposals, auditEvents, organizationMembers, organizations, users } = await import("@/db/schema");
    const db = getDb();
    const orgIds = userIds.map((id) => `org_assistant_${id}`);

    await db.delete(auditEvents).where(inArray(auditEvents.resourceId, proposalIds));
    await db.delete(assistantProposals).where(inArray(assistantProposals.id, proposalIds));
    await db.delete(organizationMembers).where(inArray(organizationMembers.organizationId, orgIds));
    await db.delete(organizations).where(inArray(organizations.id, orgIds));
    await db.delete(users).where(inArray(users.id, userIds));
  });

  async function seedMember() {
    const { getDb } = await import("@/db");
    const { organizationMembers, organizations, users } = await import("@/db/schema");
    const db = getDb();

    const userId = `user_assistant_${randomUUID()}`;
    const organizationId = `org_assistant_${userId}`;
    userIds.push(userId);

    await db.insert(users).values({ id: userId, name: "ผู้ทดสอบผู้ช่วย", email: `${userId}@example.test` });
    await db.insert(organizations).values({ id: organizationId, kind: "personal", name: "ผู้ทดสอบผู้ช่วย" });
    await db
      .insert(organizationMembers)
      .values({ id: `member_${organizationId}_${userId}`, organizationId, userId, role: "owner" });

    return { userId, organizationId };
  }

  it("reserves a row before the model is called and completes it afterwards", async () => {
    const { getDb } = await import("@/db");
    const { assistantProposals, auditEvents } = await import("@/db/schema");
    const { completeProposal, proposalId, reserveProposal } = await import("@/server/ai/assistant-audit");
    const db = getDb();

    const { userId, organizationId } = await seedMember();
    const id = proposalId();
    proposalIds.push(id);

    await reserveProposal({
      id,
      actorId: userId,
      organizationId,
      app: "work-plan",
      verb: "critique",
      subject: "project:integration",
      modelId: "gpt-5.4-mini",
      promptHash: "a".repeat(64)
    });

    const [reserved] = await db.select().from(assistantProposals).where(eq(assistantProposals.id, id));
    expect(reserved?.decision).toBe("proposed");
    expect(reserved?.costMicroUsd).toBe(0);
    expect(reserved?.draft).toEqual({});

    await completeProposal({
      id,
      actorId: userId,
      organizationId,
      app: "work-plan",
      verb: "critique",
      subject: "project:integration",
      modelId: "gpt-5.4-mini",
      projectedInput: { projectName: "อาคารทดสอบ" },
      draft: { findings: [{ severity: "high", title: "งวดแรกหนัก", detail: "ระวัง" }] },
      assumptions: ["สมมติว่าเริ่มงานทันที"],
      citations: [],
      warnings: ["ทดสอบ"],
      inputTokens: 900,
      outputTokens: 300,
      costMicroUsd: 6_286,
      elapsedMs: 8_900
    });

    const [completed] = await db.select().from(assistantProposals).where(eq(assistantProposals.id, id));
    expect(completed?.costMicroUsd).toBe(6_286);
    expect(completed?.inputTokens).toBe(900);

    const events = await db.select().from(auditEvents).where(eq(auditEvents.correlationId, id));
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("ai.proposed");
    // The first row in this repo where these two columns are not null.
    expect(events[0]?.beforeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(events[0]?.afterHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("records a decision under the same correlation id as the proposal", async () => {
    const { getDb } = await import("@/db");
    const { assistantProposals, auditEvents } = await import("@/db/schema");
    const { loadProposal, proposalId, recordDecision, reserveProposal } = await import("@/server/ai/assistant-audit");
    const db = getDb();

    const { userId, organizationId } = await seedMember();
    const id = proposalId();
    proposalIds.push(id);

    await reserveProposal({
      id,
      actorId: userId,
      organizationId,
      app: "escalation-k",
      verb: "explain",
      subject: "claim:integration",
      modelId: "gpt-5.4-mini",
      promptHash: "b".repeat(64)
    });

    const stored = await loadProposal(id);
    expect(stored?.appSlug).toBe("escalation-k");

    await recordDecision({
      proposal: stored!,
      decision: "partially_accepted",
      decidedBy: userId,
      changedFields: ["งวดที่ 1"]
    });

    const [settled] = await db.select().from(assistantProposals).where(eq(assistantProposals.id, id));
    expect(settled?.decision).toBe("partially_accepted");
    expect(settled?.decidedBy).toBe(userId);
    expect(settled?.changedFields).toEqual(["งวดที่ 1"]);

    const events = await db.select().from(auditEvents).where(eq(auditEvents.correlationId, id));
    expect(events.map((event) => event.eventType)).toContain("ai.partially_accepted");
  });

  it("counts spend from the proposals table, including calls that failed after paying", async () => {
    const { proposalId, failProposal, reserveProposal } = await import("@/server/ai/assistant-audit");
    const { checkDailySpendBrake } = await import("@/server/ai/assistant-quota");

    const before = await checkDailySpendBrake();
    const { userId, organizationId } = await seedMember();
    const id = proposalId();
    proposalIds.push(id);

    await reserveProposal({
      id,
      actorId: userId,
      organizationId,
      app: "work-plan",
      verb: "draft",
      subject: "project:integration",
      modelId: "gpt-5.4-mini",
      promptHash: "c".repeat(64)
    });
    await failProposal(id, "failed: 503", 1_234, 4_000);

    const after = await checkDailySpendBrake();
    expect(after.spentMicroUsd - before.spentMicroUsd).toBe(1_234);
  });
});
