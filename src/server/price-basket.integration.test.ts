import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { eq, inArray, like } from "drizzle-orm";
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
 * เทสต์ที่แตะฐานข้อมูลจริงของรายการราคาที่หยิบไว้ (IP-163, IP-215)
 *
 * เปิดด้วยธงเสมอ เหมือน `price-archive.integration.test.ts` เพราะมันเขียนลงฐานข้อมูลที่
 * DATABASE_URL ชี้อยู่
 *   $env:PRICE_BASKET_DB_TESTS=1 ; pnpm vitest run src/server/price-basket.integration.test.ts
 *
 * **ข้อที่สำคัญที่สุดในไฟล์นี้คือข้อเพดาน** เพราะมันคือสิ่งที่รุ่น v0.92.0 ทำไม่ได้
 * ตอนนั้นเซิร์ฟเวอร์บอกตัวเลขได้อย่างเดียว หน้าจอเป็นคนบังคับ ซึ่งแปลว่าใครก็ตามที่เรียก
 * server action ตรงก็หยิบเกินได้ ข้อนี้พิสูจน์ว่าตอนนี้เซิร์ฟเวอร์ปฏิเสธเอง
 *
 * ทุกแถวที่ไฟล์นี้สร้างใช้ id ที่ขึ้นต้นด้วย test-basket แล้วลบตัวเองทิ้งท้ายเทสต์
 */
const enabled = process.env.PRICE_BASKET_DB_TESTS === "1";
if (enabled) loadLocalEnv();

const USER_ID = "test-basket-user";
const ORG_ID = `org_personal_${USER_ID}`;

const line = (index: number) => ({
  lineKey: `market:test-basket-${index}`,
  sourceKey: "tpso" as const,
  catalogCode: `TEST-BASKET-${index}`,
  name: `รายการทดสอบที่ ${index}`,
  unit: "ลบ.ม.",
  unitSatang: BigInt(100_00 + index),
  provinceCode: "10",
  effectiveMonth: "2569-07"
});

describe.skipIf(!enabled)("รายการราคาที่หยิบไว้ แตะฐานข้อมูลจริง", () => {
  let db: Awaited<ReturnType<typeof open>>;
  let mod: typeof import("@/server/price-basket");
  let schema: typeof import("@/db/schema");

  async function open() {
    const { getDb } = await import("@/db");
    return getDb();
  }

  beforeAll(async () => {
    db = await open();
    mod = await import("@/server/price-basket");
    schema = await import("@/db/schema");
    await cleanup();
    await db.insert(schema.users).values({ id: USER_ID, email: "test-basket@example.invalid", name: "ผู้ใช้ทดสอบ" });
  });

  afterAll(async () => {
    if (enabled) await cleanup();
  });

  async function cleanup() {
    const s = schema ?? (await import("@/db/schema"));
    const d = db ?? (await open());
    const sets = await d.select({ id: s.priceSets.id }).from(s.priceSets).where(like(s.priceSets.id, "pset_%"));
    const ids = sets.map((row) => row.id);
    if (ids.length > 0) {
      await d.delete(s.priceSetLines).where(inArray(s.priceSetLines.priceSetId, ids));
    }
    await d.delete(s.auditEvents).where(eq(s.auditEvents.actorId, USER_ID));
    await d.delete(s.priceSets).where(like(s.priceSets.name, "%PRICEMETR%"));
    await d.delete(s.projects).where(eq(s.projects.ownerId, USER_ID));
    await d.delete(s.priceBasketLines).where(like(s.priceBasketLines.lineKey, "market:test-basket-%"));
    await d.delete(s.priceBaskets).where(eq(s.priceBaskets.organizationId, ORG_ID));
    await d.delete(s.organizationMembers).where(eq(s.organizationMembers.userId, USER_ID));
    await d.delete(s.organizations).where(eq(s.organizations.id, ORG_ID));
    await d.delete(s.users).where(eq(s.users.id, USER_ID));
  }

  it("คนที่ไม่ได้เข้าสู่ระบบหยิบไม่ได้ และไม่มีอะไรถูกเขียน", async () => {
    const result = await mod.pickLine(null, line(0));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_signed_in");
    expect(result.view?.lines).toEqual([]);
  });

  it("หยิบครั้งแรกสร้างองค์กรส่วนบุคคลกับใบตะกร้าให้เอง", async () => {
    const result = await mod.pickLine(USER_ID, line(1));
    expect(result.ok).toBe(true);
    expect(result.view?.lines).toHaveLength(1);
    expect(result.view?.allowance.tier).toBe("member_free");
    expect(result.view?.remaining).toBe(49);
  });

  it("การอ่านอย่างเดียวไม่สร้างอะไรเพิ่ม", async () => {
    const before = await db.select({ id: schema.priceBaskets.id }).from(schema.priceBaskets);
    await mod.readBasket(USER_ID);
    const after = await db.select({ id: schema.priceBaskets.id }).from(schema.priceBaskets);
    expect(after.length).toBe(before.length);
  });

  it("หยิบซ้ำบรรทัดเดิมไม่เพิ่มแถว และไม่นับเป็นการเกินเพดาน", async () => {
    const result = await mod.pickLine(USER_ID, line(1));
    expect(result.ok).toBe(true);
    expect(result.view?.lines).toHaveLength(1);
  });

  it("เก็บหลักฐานครบทุกช่องที่ใบสรุปต้องใช้ ไม่ใช่แค่ชื่อกับราคา", async () => {
    const view = await mod.readBasket(USER_ID);
    const stored = view.lines[0];
    expect(stored.catalogCode).toBe("TEST-BASKET-1");
    expect(stored.sourceKey).toBe("tpso");
    expect(stored.provinceCode).toBe("10");
    expect(stored.effectiveMonth).toBe("2569-07");
    expect(stored.unitSatang).toBe(BigInt(100_01));
    expect(stored.addedBy).toBe(USER_ID);
  });

  it("แก้ปริมาณเป็นทศนิยมได้ ศูนย์กับติดลบไม่ใช่ปริมาณ", async () => {
    const changed = await mod.setLineQuantity(USER_ID, line(1).lineKey, 12.5);
    expect(changed.lines[0].quantity).toBe(12.5);
    const refused = await mod.setLineQuantity(USER_ID, line(1).lineKey, 0);
    expect(refused.lines[0].quantity).toBe(12.5);
    const refusedNegative = await mod.setLineQuantity(USER_ID, line(1).lineKey, -3);
    expect(refusedNegative.lines[0].quantity).toBe(12.5);
  });

  it("เซิร์ฟเวอร์ปฏิเสธเองเมื่อครบห้าสิบบรรทัด — นี่คือสิ่งที่ v0.92.0 ทำไม่ได้", async () => {
    for (let index = 2; index <= 50; index += 1) {
      const step = await mod.pickLine(USER_ID, line(index));
      expect(step.ok).toBe(true);
    }
    const full = await mod.readBasket(USER_ID);
    expect(full.lines).toHaveLength(50);
    expect(full.remaining).toBe(0);

    const blocked = await mod.pickLine(USER_ID, line(51));
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe("over_line_limit");

    // ของจริงในฐานข้อมูล ไม่ใช่แค่คำตอบที่ฟังก์ชันคืนมา
    const rows = await db
      .select({ id: schema.priceBasketLines.id })
      .from(schema.priceBasketLines)
      .where(like(schema.priceBasketLines.lineKey, "market:test-basket-%"));
    expect(rows).toHaveLength(50);
  });

  it("เอาบรรทัดออกแล้วหยิบใหม่ได้ เพดานเป็นเพดาน ไม่ใช่โควตาที่ใช้แล้วหมดไป", async () => {
    await mod.dropLine(USER_ID, line(50).lineKey);
    const after = await mod.readBasket(USER_ID);
    expect(after.lines).toHaveLength(49);
    expect(after.remaining).toBe(1);

    const again = await mod.pickLine(USER_ID, line(51));
    expect(again.ok).toBe(true);
    expect(again.view?.lines).toHaveLength(50);
  });

  it("ส่งเข้าโครงการของคนอื่นไม่ได้", async () => {
    const foreignOrg = "test-basket-foreign-org";
    const foreignProject = "test-basket-foreign-project";
    await db.insert(schema.organizations).values({ id: foreignOrg, kind: "company", name: "องค์กรอื่น" });
    await db.insert(schema.projects).values({ id: foreignProject, organizationId: foreignOrg, ownerId: USER_ID, name: "โครงการของคนอื่น" });

    const result = await mod.sendBasketToProject(USER_ID, foreignProject);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_your_project");

    await db.delete(schema.projects).where(eq(schema.projects.id, foreignProject));
    await db.delete(schema.organizations).where(eq(schema.organizations.id, foreignOrg));
  });

  it("ส่งเข้าโครงการของตัวเองได้ชุดราคาที่นิ่ง และตะกร้ายังอยู่ครบ", async () => {
    const projectId = "test-basket-project";
    await db.insert(schema.projects).values({ id: projectId, organizationId: ORG_ID, ownerId: USER_ID, name: "โครงการทดสอบ" });

    const result = await mod.sendBasketToProject(USER_ID, projectId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lineCount).toBe(50);

    const copied = await db
      .select()
      .from(schema.priceSetLines)
      .where(eq(schema.priceSetLines.priceSetId, result.priceSetId));
    expect(copied).toHaveLength(50);
    // หลักฐานเดินทางไปกับสำเนา ไม่ได้หายตอนคัดลอก
    expect(copied.every((row) => row.catalogCode.startsWith("TEST-BASKET-"))).toBe(true);
    expect(copied.every((row) => row.addedBy === USER_ID)).toBe(true);

    // ตะกร้ายังอยู่ครบ คนที่ทำหลายโครงการพร้อมกันไม่ต้องหยิบใหม่
    const stillThere = await mod.readBasket(USER_ID);
    expect(stillThere.lines).toHaveLength(50);

    // แก้ตะกร้าหลังส่งแล้ว ชุดราคาที่ส่งไปต้องไม่ขยับตาม
    await mod.setLineQuantity(USER_ID, line(1).lineKey, 99);
    const frozen = await db
      .select({ quantity: schema.priceSetLines.quantity })
      .from(schema.priceSetLines)
      .where(eq(schema.priceSetLines.priceSetId, result.priceSetId));
    expect(frozen.some((row) => Number(row.quantity) === 99)).toBe(false);

    const audits = await db
      .select({ eventType: schema.auditEvents.eventType })
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.resourceId, result.priceSetId));
    expect(audits[0]?.eventType).toBe("price_set.created_from_basket");
  });

  it("ฝั่ง ESTIMETR อ่านชุดราคาที่รับมาได้ครบ พร้อมหลักฐานรายบรรทัด", async () => {
    const repo = await import("@/server/estimeter/price-set-repository");
    const sets = await repo.listPriceSets(ORG_ID, "test-basket-project");
    expect(sets).toHaveLength(1);
    expect(sets[0].lineCount).toBe(50);
    expect(sets[0].provinceCode).toBe("10");
    expect(sets[0].effectiveMonth).toBe("2569-07");
    // ยอดรวมคิดที่ฐานข้อมูลจากบรรทัดจริง ไม่ใช่ตัวเลขที่ใครพิมพ์เก็บไว้
    expect(sets[0].totalSatang).toBeGreaterThan(0n);

    const lines = await repo.listPriceSetLines(ORG_ID, sets[0].id);
    expect(lines).toHaveLength(50);
    const one = lines.find((row) => row.catalogCode === "TEST-BASKET-1");
    expect(one?.sourceKey).toBe("tpso");
    expect(one?.effectiveMonth).toBe("2569-07");
    expect(one?.provinceCode).toBe("10");
    expect(one?.addedBy).toBe(USER_ID);
  });

  it("ยอดรวมของฝั่งรับตรงกับที่คูณเองทีละบรรทัด ไม่เพี้ยนในหลักสตางค์", async () => {
    const repo = await import("@/server/estimeter/price-set-repository");
    const [set] = await repo.listPriceSets(ORG_ID, "test-basket-project");
    const lines = await repo.listPriceSetLines(ORG_ID, set.id);
    const byHand = lines.reduce((total, row) => total + BigInt(Math.round(Number(row.unitSatang) * row.quantity)), 0n);
    expect(set.totalSatang).toBe(byHand);
  });

  it("องค์กรอื่นอ่านชุดราคาของโครงการนี้ไม่ได้ แม้จะรู้ id", async () => {
    const repo = await import("@/server/estimeter/price-set-repository");
    const [set] = await repo.listPriceSets(ORG_ID, "test-basket-project");
    // ขอบเขตผูกที่ join ไม่ใช่ตรวจทีหลัง id ขององค์กรอื่นจึงแยกไม่ออกจาก id ที่ไม่มีอยู่จริง
    expect(await repo.listPriceSets("test-basket-not-my-org", "test-basket-project")).toEqual([]);
    expect(await repo.listPriceSetLines("test-basket-not-my-org", set.id)).toEqual([]);
  });

  it("ตะกร้าว่างส่งไม่ได้", async () => {
    for (const row of (await mod.readBasket(USER_ID)).lines) {
      await mod.dropLine(USER_ID, row.lineKey);
    }
    const result = await mod.sendBasketToProject(USER_ID, "test-basket-project");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("empty_basket");
  });
});
