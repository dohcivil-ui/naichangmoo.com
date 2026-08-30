import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** ตัวอ่าน .env อย่างย่อ ให้ไฟล์นี้ไปถึงฐานข้อมูลในเครื่องได้โดยไม่ต้องพึ่งของตอนรัน */
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
 * เทสต์ที่แตะฐานข้อมูลจริงของฉบับคำนวณ (IP-216)
 *
 * เปิดด้วยธงเสมอ เพราะมันเขียนลงฐานข้อมูลที่ DATABASE_URL ชี้อยู่
 *   $env:ESTIMETR_DB_TESTS=1 ; pnpm vitest run src/server/estimeter/revision-repository.integration.test.ts
 *
 * สามข้อที่สำคัญที่สุดในไฟล์นี้ตรงกับสามกติกาของ ADR 0008 คือ เลขฉบับเดินแยกตามวิธีคิด ·
 * Factor F ใช้ได้เฉพาะชุดราคาทางการ · และองค์กรอื่นออกฉบับจากชุดนี้ไม่ได้แม้รู้ id
 *
 * ทุกแถวที่ไฟล์นี้สร้างใช้ id ที่ขึ้นต้นด้วย test-rev แล้วลบตัวเองทิ้งท้ายเทสต์
 */
const enabled = process.env.ESTIMETR_DB_TESTS === "1";
if (enabled) loadLocalEnv();

const USER_ID = "test-rev-user";
const ORG_ID = "test-rev-org";
const OTHER_ORG_ID = "test-rev-org-other";
const PROJECT_ID = "test-rev-project";
const OFFICIAL_SET = "test-rev-set-official";
const OWN_SET = "test-rev-set-own";

describe.skipIf(!enabled)("ฉบับคำนวณ แตะฐานข้อมูลจริง", () => {
  let db: Awaited<ReturnType<typeof open>>;
  let repository: typeof import("@/server/estimeter/revision-repository");
  let schema: typeof import("@/db/schema");

  async function open() {
    const { getDb } = await import("@/db");
    return getDb();
  }

  beforeAll(async () => {
    db = await open();
    repository = await import("@/server/estimeter/revision-repository");
    schema = await import("@/db/schema");
    await cleanup();

    await db.insert(schema.users).values({ id: USER_ID, email: "test-rev@example.invalid", name: "ผู้ใช้ทดสอบ" });
    await db.insert(schema.organizations).values([
      { id: ORG_ID, name: "องค์กรทดสอบฉบับคำนวณ", kind: "company" },
      { id: OTHER_ORG_ID, name: "องค์กรอื่นที่ไม่เกี่ยวข้อง", kind: "company" }
    ]);
    await db.insert(schema.projects).values({
      id: PROJECT_ID,
      organizationId: ORG_ID,
      ownerId: USER_ID,
      name: "โครงการทดสอบฉบับคำนวณ"
    });

    await db.insert(schema.priceSets).values([
      {
        id: OFFICIAL_SET,
        projectId: PROJECT_ID,
        name: "ชุดราคาทางการสำหรับทดสอบ",
        provinceCode: "10",
        effectiveMonth: "2569-07",
        status: "draft",
        authoritySource: "official",
        payloadHash: "test-rev-hash-official"
      },
      {
        id: OWN_SET,
        projectId: PROJECT_ID,
        name: "ชุดราคาที่องค์กรสืบเองสำหรับทดสอบ",
        provinceCode: "10",
        effectiveMonth: "2569-07",
        status: "draft",
        authoritySource: "organization",
        payloadHash: "test-rev-hash-own"
      }
    ]);

    // สองบรรทัด 12,345.67 กับ 1,000.00 บาท คูณปริมาณ 2 และ 3 = 2,469,134 + 300,000 สตางค์
    await db.insert(schema.priceSetLines).values([
      {
        id: "test-rev-line-1",
        priceSetId: OFFICIAL_SET,
        addedBy: USER_ID,
        lineKey: "market:test-rev-1",
        sourceKey: "tpso",
        catalogCode: "TEST-REV-1",
        name: "รายการทดสอบที่หนึ่ง",
        unit: "ลบ.ม.",
        unitSatang: 1_234_567n,
        quantity: "2.0000"
      },
      {
        id: "test-rev-line-2",
        priceSetId: OFFICIAL_SET,
        addedBy: USER_ID,
        lineKey: "market:test-rev-2",
        sourceKey: "tpso",
        catalogCode: "TEST-REV-2",
        name: "รายการทดสอบที่สอง",
        unit: "ตร.ม.",
        unitSatang: 100_000n,
        quantity: "3.0000"
      },
      {
        id: "test-rev-line-3",
        priceSetId: OWN_SET,
        addedBy: USER_ID,
        lineKey: "market:test-rev-3",
        sourceKey: "org_vendor_quote",
        catalogCode: "TEST-REV-3",
        name: "รายการที่องค์กรสืบราคาเอง",
        unit: "ชุด",
        unitSatang: 500_000n,
        quantity: "1.0000"
      }
    ]);
  });

  afterAll(async () => {
    if (enabled) await cleanup();
  });

  async function cleanup() {
    const s = schema ?? (await import("@/db/schema"));
    const d = db ?? (await open());
    await d.delete(s.auditEvents).where(eq(s.auditEvents.actorId, USER_ID));
    await d.delete(s.estimateRevisions).where(eq(s.estimateRevisions.projectId, PROJECT_ID));
    await d.delete(s.priceSetLines).where(like(s.priceSetLines.id, "test-rev-%"));
    await d.delete(s.priceSets).where(like(s.priceSets.id, "test-rev-%"));
    await d.delete(s.projects).where(eq(s.projects.id, PROJECT_ID));
    await d.delete(s.organizations).where(like(s.organizations.id, "test-rev-org%"));
    await d.delete(s.users).where(eq(s.users.id, USER_ID));
  }

  const issue = (costingMethod: "factor_f" | "contractor_cost", priceSetId = OFFICIAL_SET, organizationId = ORG_ID) =>
    repository.issueRevision({
      organizationId,
      actorId: USER_ID,
      projectId: PROJECT_ID,
      priceSetId,
      costingMethod
    });

  it("ฉบับแรกของวิธีหนึ่งได้เลข 1 และสถานะออกแล้ว ไม่ใช่ร่าง", async () => {
    const issued = await issue("factor_f");
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    expect(issued.revisionNumber).toBe(1);

    const rows = await db
      .select({ status: schema.estimateRevisions.status })
      .from(schema.estimateRevisions)
      .where(eq(schema.estimateRevisions.id, issued.revisionId));
    expect(rows[0]?.status).toBe("issued");
  });

  it("ออกซ้ำวิธีเดิมได้เลขถัดไป", async () => {
    const issued = await issue("factor_f");
    expect(issued.ok).toBe(true);
    if (issued.ok) expect(issued.revisionNumber).toBe(2);
  });

  it("อีกวิธีเดินเลขของตัวเองจาก 1 บนชุดราคาชุดเดียวกัน", async () => {
    const issued = await issue("contractor_cost");
    expect(issued.ok).toBe(true);
    if (issued.ok) expect(issued.revisionNumber).toBe(1);
  });

  it("ชุดราคาที่องค์กรสืบเองออกฉบับ Factor F ไม่ได้ แต่ออกฉบับต้นทุนผู้รับเหมาได้", async () => {
    const denied = await issue("factor_f", OWN_SET);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.reason).toBe("method_not_allowed");

    const allowed = await issue("contractor_cost", OWN_SET);
    expect(allowed.ok).toBe(true);
    // เลขเดินต่อจากฉบับต้นทุนผู้รับเหมาฉบับก่อน เพราะเลขเป็นของโครงการกับวิธี ไม่ใช่ของชุดราคา
    if (allowed.ok) expect(allowed.revisionNumber).toBe(2);
  });

  it("องค์กรอื่นออกฉบับจากชุดนี้ไม่ได้แม้รู้ id และไม่มีอะไรถูกเขียน", async () => {
    const before = await repository.listRevisions(ORG_ID, PROJECT_ID);
    const denied = await issue("contractor_cost", OFFICIAL_SET, OTHER_ORG_ID);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.reason).toBe("unknown_price_set");
    expect(await repository.listRevisions(ORG_ID, PROJECT_ID)).toHaveLength(before.length);
  });

  it("องค์กรอื่นอ่านฉบับของโครงการนี้ไม่เห็นเลย", async () => {
    expect(await repository.listRevisions(OTHER_ORG_ID, PROJECT_ID)).toEqual([]);
  });

  it("ยอดของฉบับตรงกับยอดที่คูณเองทีละบรรทัดของชุดราคาที่มันอ้าง", async () => {
    const revisions = await repository.listRevisions(ORG_ID, PROJECT_ID);
    const official = revisions.filter((revision) => revision.priceSetId === OFFICIAL_SET);
    expect(official.length).toBeGreaterThan(0);
    for (const revision of official) {
      expect(revision.totalSatang).toBe(1_234_567n * 2n + 100_000n * 3n);
      expect(revision.lineCount).toBe(2);
      expect(revision.priceSetAuthority).toBe("official");
    }
  });

  it("ทุกฉบับที่ออกลงบันทึกตรวจสอบพร้อมวิธีคิดและเลขฉบับ", async () => {
    const events = await db
      .select({
        resourceId: schema.auditEvents.resourceId,
        eventType: schema.auditEvents.eventType,
        metadata: schema.auditEvents.metadata
      })
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.actorId, USER_ID));

    const issued = events.filter((event) => event.eventType === "estimate_revision.issued");
    const revisions = await repository.listRevisions(ORG_ID, PROJECT_ID);
    expect(issued).toHaveLength(revisions.length);
    for (const event of issued) {
      const metadata = event.metadata as { costingMethod?: string; revisionNumber?: number };
      expect(metadata.costingMethod).toBeTruthy();
      expect(metadata.revisionNumber).toBeGreaterThan(0);
    }
  });
});
