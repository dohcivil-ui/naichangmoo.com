import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  auditEvents,
  priceBasketLines,
  priceBaskets,
  priceSetLines,
  priceSets,
  projects,
  users
} from "@/db/schema";
import { readEntitlementForApp, ensurePersonalOrganization, readOrganizationOf } from "@/server/app-access";
import { authorityOfLines } from "@/lib/price-authority";
import {
  PRICEMETR_APP_SLUG,
  canPickAnotherLine,
  remainingLines,
  resolvePricemetrAllowance,
  type PricemetrAllowance
} from "@/lib/pricemetr-tier";

/**
 * รายการราคาที่หยิบไว้ — เก็บข้ามเครื่อง และส่งต่อเข้า ESTIMETR (IP-163)
 *
 * **นี่คือที่ที่เพดาน 50 บรรทัดเริ่มปฏิเสธได้จริง** (IP-215) รุ่น v0.92.0 เซิร์ฟเวอร์บอกตัวเลข
 * ได้อย่างเดียว เพราะตะกร้าอยู่ในหน่วยความจำของหน้า ไม่มีอะไรให้ปกป้อง พอตะกร้ามีที่อยู่จริง
 * ในฐานข้อมูล การนับจึงเกิดที่นี่ ในทรานแซกชันเดียวกับการเขียน ไม่ใช่ที่หน้าจอ
 *
 * ตะกร้าเป็นขององค์กร ไม่ใช่ของคน เพราะโครงการปลายทางเป็นขององค์กรอยู่แล้ว ส่วน "ใครหยิบ"
 * จดไว้ทั้งระดับใบ (`createdBy`) และระดับบรรทัด (`addedBy`)
 */

type Database = ReturnType<typeof getDb>;

/** สิ่งที่หน้าจอส่งมาเมื่อกดหยิบ — ช่องหลักฐานเก็บตอนหยิบ ไม่ใช่ตอนส่งออก */
export type PickedLineInput = {
  lineKey: string;
  sourceKey: "tpso" | "obec" | "cgd";
  catalogCode: string;
  name: string;
  unit: string;
  unitSatang: bigint;
  provinceCode?: string | null;
  effectiveMonth?: string | null;
  documentPage?: string | null;
  rateCondition?: string | null;
};

export type BasketLine = PickedLineInput & {
  id: string;
  addedBy: string;
  quantity: number;
};

export type BasketView = {
  basketId: string | null;
  lines: BasketLine[];
  allowance: PricemetrAllowance;
  /** null คือไม่จำกัด */
  remaining: number | null;
};

export type BasketResult =
  | { ok: true; view: BasketView }
  | { ok: false; reason: "not_signed_in" | "not_entitled" | "over_line_limit" | "unknown_member"; view: BasketView | null };

const basketId = (organizationId: string) => `basket_${organizationId}`;
const lineId = () => `bline_${randomUUID()}`;
const hashOf = (payload: unknown) => createHash("sha256").update(JSON.stringify(payload ?? null)).digest("hex");

const emptyView = (allowance: PricemetrAllowance): BasketView => ({
  basketId: null,
  lines: [],
  allowance,
  remaining: remainingLines(allowance, 0)
});

async function readAllowance(db: Database, userId: string, now: Date): Promise<PricemetrAllowance> {
  const record = await readEntitlementForApp(db, userId, PRICEMETR_APP_SLUG);
  return resolvePricemetrAllowance(
    { signedIn: true, entitlement: record?.entitlement ?? null, appEnabled: record?.appEnabled },
    now
  );
}

const toLine = (row: typeof priceBasketLines.$inferSelect): BasketLine => ({
  id: row.id,
  addedBy: row.addedBy,
  lineKey: row.lineKey,
  sourceKey: row.sourceKey as PickedLineInput["sourceKey"],
  catalogCode: row.catalogCode,
  name: row.name,
  unit: row.unit,
  unitSatang: row.unitSatang,
  provinceCode: row.provinceCode,
  effectiveMonth: row.effectiveMonth,
  documentPage: row.documentPage,
  rateCondition: row.rateCondition,
  quantity: Number(row.quantity)
});

/** เรียงตามลำดับที่หยิบ เพราะนั่นคือลำดับที่คนจำได้ ไม่ใช่ลำดับตามชื่อที่กระโดดไปมา */
async function readLines(db: Database, id: string): Promise<BasketLine[]> {
  const rows = await db
    .select()
    .from(priceBasketLines)
    .where(eq(priceBasketLines.basketId, id))
    .orderBy(priceBasketLines.createdAt);
  return rows.map(toLine);
}

/**
 * ทางอ่าน ไม่สร้างอะไรทั้งนั้น
 *
 * สมาชิกที่ยังไม่เคยหยิบอะไรเลยไม่มีใบตะกร้า ซึ่งเป็นสภาพปกติ ไม่ใช่สภาพที่ต้องซ่อม
 * ด้วยการเขียนใบเปล่าให้ตอนเปิดหน้า — หลักการเดียวกับ ADR 0023
 */
export async function readBasket(userId: string | null, now = new Date()): Promise<BasketView> {
  const visitor = resolvePricemetrAllowance({ signedIn: false, entitlement: null }, now);
  if (!userId) return emptyView(visitor);

  const db = getDb();
  const allowance = await readAllowance(db, userId, now);
  const organizationId = await readOrganizationOf(db, userId);
  if (!organizationId) return emptyView(allowance);

  const rows = await db
    .select({ id: priceBaskets.id })
    .from(priceBaskets)
    .where(eq(priceBaskets.organizationId, organizationId))
    .limit(1);
  const id = rows[0]?.id;
  if (!id) return emptyView(allowance);

  const lines = await readLines(db, id);
  return { basketId: id, lines, allowance, remaining: remainingLines(allowance, lines.length) };
}

/**
 * หยิบหนึ่งบรรทัด — ด่านที่ปฏิเสธได้จริง
 *
 * นับบรรทัดในทรานแซกชันเดียวกับการเขียน ไม่ใช่ตรวจก่อนแล้วค่อยเขียน เพราะสองแท็บที่กด
 * พร้อมกันตอนอยู่ที่สี่สิบเก้าบรรทัดจะผ่านการตรวจทั้งคู่แล้วได้ห้าสิบเอ็ด ส่วนการหยิบซ้ำ
 * ชนดัชนีที่ฐานข้อมูลแทนที่จะเป็นการตรวจในโค้ด ด้วยเหตุผลเดียวกัน
 */
export async function pickLine(userId: string | null, input: PickedLineInput, now = new Date()): Promise<BasketResult> {
  if (!userId) {
    return { ok: false, reason: "not_signed_in", view: emptyView(resolvePricemetrAllowance({ signedIn: false, entitlement: null }, now)) };
  }

  const db = getDb();
  const allowance = await readAllowance(db, userId, now);
  if (!allowance.canPickLines) return { ok: false, reason: "not_entitled", view: emptyView(allowance) };

  const memberRows = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  const member = memberRows[0];
  if (!member) return { ok: false, reason: "unknown_member", view: null };

  const outcome = await db.transaction(async (tx) => {
    const organizationId = await ensurePersonalOrganization(tx, userId, member.name);
    const id = basketId(organizationId);

    await tx
      .insert(priceBaskets)
      .values({ id, organizationId, createdBy: userId })
      .onConflictDoNothing();

    // แถวที่มีอยู่แล้วอาจถูกสร้างไว้ก่อนด้วย id คนละแบบ องค์กรจึงเป็นตัวตัดสิน ไม่ใช่ id ที่คำนวณเอง
    const existing = await tx
      .select({ id: priceBaskets.id })
      .from(priceBaskets)
      .where(eq(priceBaskets.organizationId, organizationId))
      .limit(1);
    const liveId = existing[0]?.id ?? id;

    const counted = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(priceBasketLines)
      .where(eq(priceBasketLines.basketId, liveId));
    const used = counted[0]?.value ?? 0;

    // การหยิบซ้ำไม่ใช่การเกินเพดาน ตรวจก่อนจึงไม่ทำให้คนที่กดของเดิมซ้ำโดนบอกว่าเต็ม
    const duplicate = await tx
      .select({ id: priceBasketLines.id })
      .from(priceBasketLines)
      .where(and(eq(priceBasketLines.basketId, liveId), eq(priceBasketLines.lineKey, input.lineKey)))
      .limit(1);
    if (duplicate.length > 0) return { basketId: liveId, blocked: false as const };

    if (!canPickAnotherLine(allowance, used)) return { basketId: liveId, blocked: true as const };

    await tx
      .insert(priceBasketLines)
      .values({
        id: lineId(),
        basketId: liveId,
        addedBy: userId,
        lineKey: input.lineKey,
        sourceKey: input.sourceKey,
        catalogCode: input.catalogCode,
        provinceCode: input.provinceCode ?? null,
        effectiveMonth: input.effectiveMonth ?? null,
        documentPage: input.documentPage ?? null,
        rateCondition: input.rateCondition ?? null,
        name: input.name,
        unit: input.unit,
        unitSatang: input.unitSatang,
        quantity: "1"
      })
      .onConflictDoNothing();

    return { basketId: liveId, blocked: false as const };
  });

  const lines = await readLines(db, outcome.basketId);
  const view: BasketView = {
    basketId: outcome.basketId,
    lines,
    allowance,
    remaining: remainingLines(allowance, lines.length)
  };
  return outcome.blocked ? { ok: false, reason: "over_line_limit", view } : { ok: true, view };
}

export async function dropLine(userId: string | null, lineKey: string, now = new Date()): Promise<BasketView> {
  const view = await readBasket(userId, now);
  if (!userId || !view.basketId) return view;

  await getDb()
    .delete(priceBasketLines)
    .where(and(eq(priceBasketLines.basketId, view.basketId), eq(priceBasketLines.lineKey, lineKey)));
  return readBasket(userId, now);
}

/** ปริมาณเป็นทศนิยมได้ เพราะงานจริงมี 12.5 ลบ.ม. ศูนย์หรือติดลบไม่ใช่ปริมาณ */
export async function setLineQuantity(
  userId: string | null,
  lineKey: string,
  quantity: number,
  now = new Date()
): Promise<BasketView> {
  const view = await readBasket(userId, now);
  if (!userId || !view.basketId) return view;
  if (!Number.isFinite(quantity) || quantity <= 0) return view;

  await getDb()
    .update(priceBasketLines)
    .set({ quantity: quantity.toFixed(4), updatedAt: new Date() })
    .where(and(eq(priceBasketLines.basketId, view.basketId), eq(priceBasketLines.lineKey, lineKey)));
  return readBasket(userId, now);
}

export type SendToProjectResult =
  | { ok: true; priceSetId: string; lineCount: number }
  | { ok: false; reason: "not_signed_in" | "empty_basket" | "unknown_project" | "not_your_project" };

/**
 * ส่งตะกร้าเข้าโครงการเป็นชุดราคาที่นิ่ง — ตะกร้าต้นทางไม่ถูกแตะ
 *
 * คัดลอก ไม่ใช่ย้าย ตามคำวินิจฉัยเจ้าของงาน 2026-08-29 ราคาที่ขึ้น ปร.4 ต้องตรวจย้อนได้ว่า
 * มาจากเดือนไหน สำเนาที่ขยับตามตะกร้าจะทำให้เอกสารที่พิมพ์ไปแล้วไม่ตรงกับของจริง
 * และตะกร้าที่หายไปหลังกดส่งจะบังคับให้คนที่ทำหลายโครงการพร้อมกันหยิบใหม่ทุกรอบ
 *
 * `payloadHash` คิดจากบรรทัดที่คัดลอกจริง ไม่ใช่จากตะกร้า จึงเป็นลายนิ้วมือของสิ่งที่
 * โครงการถืออยู่ ไม่ใช่ของสิ่งที่ตะกร้าเป็นในวันนั้น
 */
export async function sendBasketToProject(
  userId: string | null,
  projectId: string,
  options: { name?: string; now?: Date } = {}
): Promise<SendToProjectResult> {
  const now = options.now ?? new Date();
  if (!userId) return { ok: false, reason: "not_signed_in" };

  const db = getDb();
  const view = await readBasket(userId, now);
  if (view.lines.length === 0) return { ok: false, reason: "empty_basket" };

  const organizationId = await readOrganizationOf(db, userId);
  const projectRows = await db
    .select({ id: projects.id, organizationId: projects.organizationId, name: projects.name })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  const project = projectRows[0];
  if (!project) return { ok: false, reason: "unknown_project" };
  // โครงการของคนอื่นตอบเหมือนโครงการที่ไม่มีอยู่ไม่ได้ เพราะสองอย่างนี้ต่างกันสำหรับคนที่
  // เพิ่งถูกถอดออกจากองค์กร แต่ทั้งคู่จบที่ปฏิเสธเหมือนกัน
  if (!organizationId || project.organizationId !== organizationId) return { ok: false, reason: "not_your_project" };

  const priceSetId = `pset_${randomUUID()}`;
  const snapshot = view.lines.map((line) => ({
    lineKey: line.lineKey,
    sourceKey: line.sourceKey,
    catalogCode: line.catalogCode,
    provinceCode: line.provinceCode ?? null,
    effectiveMonth: line.effectiveMonth ?? null,
    documentPage: line.documentPage ?? null,
    rateCondition: line.rateCondition ?? null,
    name: line.name,
    unit: line.unit,
    unitSatang: line.unitSatang.toString(),
    quantity: line.quantity
  }));

  // หัวของชุดราคาต้องมีจังหวัดและเดือน ตะกร้าอาจมีบรรทัดจากหลายที่มา จึงใช้ค่าที่พบบ่อยที่สุด
  // ของบรรทัดที่มีค่า และบันทึกค่าจริงรายบรรทัดไว้ครบอยู่ดี หัวเป็นป้ายบอก ไม่ใช่แหล่งความจริง
  const province = mode(view.lines.map((line) => line.provinceCode).filter(Boolean) as string[]) ?? "-";
  const month = mode(view.lines.map((line) => line.effectiveMonth).filter(Boolean) as string[]) ?? "-";

  // แหล่งอำนาจคิดจากที่มาของทุกบรรทัด ณ วินาทีที่ส่ง ไม่ใช่ช่องที่ใครเลือกเอง ต่างจากจังหวัด
  // และเดือนข้างบนที่เป็นป้ายบอกซึ่งใช้ค่าที่พบบ่อยที่สุด เพราะข้อนี้เป็นด่านที่ปฏิเสธจริง
  // ตาม ADR 0008 ข้อ 5 การเลือก "ค่าที่พบบ่อยที่สุด" จะทำให้บรรทัดที่ไม่ทางการหายไปเงียบ ๆ
  const authoritySource = authorityOfLines(view.lines.map((line) => line.sourceKey));

  await db.transaction(async (tx) => {
    await tx.insert(priceSets).values({
      id: priceSetId,
      projectId,
      name: options.name?.trim() || `ชุดราคาจาก PRICEMETR ${view.lines.length} บรรทัด`,
      provinceCode: province,
      effectiveMonth: month,
      status: "draft",
      authoritySource,
      payloadHash: hashOf(snapshot)
    });

    await tx.insert(priceSetLines).values(
      view.lines.map((line) => ({
        id: `psline_${randomUUID()}`,
        priceSetId,
        addedBy: line.addedBy,
        lineKey: line.lineKey,
        sourceKey: line.sourceKey,
        catalogCode: line.catalogCode,
        provinceCode: line.provinceCode ?? null,
        effectiveMonth: line.effectiveMonth ?? null,
        documentPage: line.documentPage ?? null,
        rateCondition: line.rateCondition ?? null,
        name: line.name,
        unit: line.unit,
        unitSatang: line.unitSatang,
        quantity: line.quantity.toFixed(4)
      }))
    );

    await tx.insert(auditEvents).values({
      id: `audit_${priceSetId}_created`,
      organizationId,
      actorId: userId,
      eventType: "price_set.created_from_basket",
      resourceType: "price_set",
      resourceId: priceSetId,
      correlationId: priceSetId,
      afterHash: hashOf(snapshot),
      metadata: {
        projectId,
        lineCount: view.lines.length,
        provinceCode: province,
        effectiveMonth: month,
        authoritySource,
        basketId: view.basketId
      }
    });
  });

  return { ok: true, priceSetId, lineCount: view.lines.length };
}

/** ค่าที่พบบ่อยที่สุด เสมอกันให้ตัวแรกที่เจอชนะ เพื่อให้ผลเหมือนเดิมทุกครั้งที่รันซ้ำ */
function mode(values: string[]): string | null {
  if (values.length === 0) return null;
  const tally = new Map<string, number>();
  for (const value of values) tally.set(value, (tally.get(value) ?? 0) + 1);
  let best = values[0];
  let bestCount = 0;
  for (const value of values) {
    const count = tally.get(value) ?? 0;
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}
