import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, estimateRevisions, priceSetLines, priceSets, projects } from "@/db/schema";
import {
  costingMethodDenial,
  type CostingMethod,
  type PriceAuthoritySource
} from "@/lib/price-authority";

/**
 * ฉบับคำนวณของโครงการ — ขั้นที่ผูกชุดราคาเข้ากับวิธีคิดราคา ตาม ADR 0008 (IP-216)
 *
 * ตาราง `estimate_revisions` มีอยู่ตั้งแต่ v0.17.0 แต่ไม่เคยมีโค้ดไหนอ่านหรือเขียนเลย ไฟล์นี้
 * คือฝั่งเขียนตัวแรกของมัน กติกาที่ถือไว้มีสามข้อ
 *
 * **หนึ่ง ฉบับเกิดจากชุดราคาเสมอ** ฉบับที่ไม่มีราคาคิดอะไรไม่ได้ จึงไม่มีทางสร้างฉบับเปล่า
 * ไว้รอเติมทีหลัง `price_set_id` เป็น NOT NULL ที่ฐานข้อมูลด้วย ไม่ใช่แค่กติกาในโค้ด
 *
 * **สอง เลขฉบับนับแยกตามวิธีคิด** ตาม ADR 0008 ข้อ 4 โครงการจึงไม่มี "ฉบับปัจจุบัน" เดี่ยว ๆ
 *
 * **สาม ฉบับแบบ Factor F ต้องใช้ชุดราคาทางการ** ตาม ADR 0008 ข้อ 5 ด่านนี้อยู่ที่นี่
 * ไม่ใช่ที่หน้าจอ เพราะสิ่งที่หน้าจอเรียกได้ คนก็เรียกตรงได้
 *
 * ทุกการอ่านและการเขียนรับ `organizationId` แล้วผูกที่ join เหมือน `price-set-repository`
 * ไม่ใช่ตรวจทีหลัง เพราะ id ของโครงการองค์กรอื่นต้องแยกไม่ออกจาก id ที่ไม่มีอยู่จริง
 */

export type EstimateRevisionView = {
  id: string;
  costingMethod: CostingMethod;
  revisionNumber: number;
  status: string;
  priceSetId: string;
  priceSetName: string;
  priceSetAuthority: PriceAuthoritySource;
  lineCount: number;
  totalSatang: bigint;
  createdAt: Date;
};

export type IssueRevisionRejection =
  | "unknown_price_set"
  | "empty_price_set"
  | "method_not_allowed"
  | "number_collision";

export type IssueRevisionResult =
  | { ok: true; revisionId: string; revisionNumber: number }
  | { ok: false; reason: IssueRevisionRejection; message: string };

/**
 * ฉบับที่ออกแล้วนิ่งทันที ไม่มีสถานะร่างที่รอใครมากดปิด
 *
 * CONTEXT.md นิยาม Estimate Revision ว่าเป็น "ผลการคำนวณหนึ่งชุดที่แช่แข็งแล้ว" และเขียน
 * _Avoid_ ไว้ตรง ๆ ว่าห้ามเป็น "draft ที่ยังแก้ได้" ในรุ่นนี้ไม่มีทางแก้ฉบับหลังออกจริง ๆ
 * เพราะชุดราคาต้นทางก็แก้ไม่ได้อยู่แล้ว การเรียกมันว่าร่างจึงเป็นการตั้งชื่อที่ขัดกับของจริง
 */
const ISSUED = "issued";

/** ครั้งที่ลองใหม่เมื่อสองคนกดออกฉบับวิธีเดียวกันพร้อมกันจนเลขชนกัน */
const NUMBER_RETRIES = 3;

export async function listRevisions(organizationId: string, projectId: string): Promise<EstimateRevisionView[]> {
  const rows = await getDb()
    .select({
      id: estimateRevisions.id,
      costingMethod: estimateRevisions.costingMethod,
      revisionNumber: estimateRevisions.revisionNumber,
      status: estimateRevisions.status,
      priceSetId: estimateRevisions.priceSetId,
      priceSetName: priceSets.name,
      priceSetAuthority: priceSets.authoritySource,
      createdAt: estimateRevisions.createdAt,
      lineCount: sql<number>`count(${priceSetLines.id})::int`,
      // ปัดที่สตางค์ตอนคูณเหมือน `listPriceSets` ไม่ใช่ปัดตอนรวมท้ายสุด ยอดของฉบับกับยอดของ
      // ชุดราคาที่มันอ้างต้องตรงกันทุกสตางค์ ไม่งั้นสองแผงบนหน้าเดียวกันจะเถียงกันเอง
      totalSatang: sql<string>`coalesce(sum(round(${priceSetLines.unitSatang} * ${priceSetLines.quantity})), 0)::text`
    })
    .from(estimateRevisions)
    .innerJoin(projects, eq(projects.id, estimateRevisions.projectId))
    .innerJoin(priceSets, eq(priceSets.id, estimateRevisions.priceSetId))
    .leftJoin(priceSetLines, eq(priceSetLines.priceSetId, priceSets.id))
    .where(and(eq(estimateRevisions.projectId, projectId), eq(projects.organizationId, organizationId)))
    .groupBy(estimateRevisions.id, priceSets.name, priceSets.authoritySource)
    .orderBy(asc(estimateRevisions.costingMethod), desc(estimateRevisions.revisionNumber));

  return rows.map((row) => ({ ...row, totalSatang: BigInt(row.totalSatang) }));
}

export async function issueRevision(input: {
  organizationId: string;
  actorId: string;
  projectId: string;
  priceSetId: string;
  costingMethod: CostingMethod;
}): Promise<IssueRevisionResult> {
  const db = getDb();

  // ชุดราคาต้องเป็นของโครงการนี้ และโครงการต้องเป็นขององค์กรนี้ ทั้งสองข้อผูกที่ join
  // ชุดของโครงการอื่นจึงตอบเหมือนชุดที่ไม่มีอยู่จริง
  const found = await db
    .select({
      id: priceSets.id,
      name: priceSets.name,
      authoritySource: priceSets.authoritySource,
      lineCount: sql<number>`count(${priceSetLines.id})::int`
    })
    .from(priceSets)
    .innerJoin(projects, eq(projects.id, priceSets.projectId))
    .leftJoin(priceSetLines, eq(priceSetLines.priceSetId, priceSets.id))
    .where(
      and(
        eq(priceSets.id, input.priceSetId),
        eq(priceSets.projectId, input.projectId),
        eq(projects.organizationId, input.organizationId)
      )
    )
    .groupBy(priceSets.id)
    .limit(1);

  const priceSet = found[0];
  if (!priceSet) {
    return { ok: false, reason: "unknown_price_set", message: "ไม่พบชุดราคานี้ในโครงการนี้" };
  }
  if (priceSet.lineCount === 0) {
    return { ok: false, reason: "empty_price_set", message: "ชุดราคานี้ไม่มีบรรทัดเลย จึงออกฉบับคำนวณไม่ได้" };
  }

  const denial = costingMethodDenial(input.costingMethod, priceSet.authoritySource);
  if (denial) return { ok: false, reason: "method_not_allowed", message: denial };

  for (let attempt = 0; attempt < NUMBER_RETRIES; attempt += 1) {
    const revisionId = `rev_${randomUUID()}`;
    try {
      const revisionNumber = await db.transaction(async (tx) => {
        // เลขถัดไปของ "วิธีนี้ในโครงการนี้" เท่านั้น อีกวิธีเดินเลขของตัวเองแยกกัน
        const highest = await tx
          .select({ current: sql<number>`coalesce(max(${estimateRevisions.revisionNumber}), 0)::int` })
          .from(estimateRevisions)
          .where(
            and(
              eq(estimateRevisions.projectId, input.projectId),
              eq(estimateRevisions.costingMethod, input.costingMethod)
            )
          );
        const next = (highest[0]?.current ?? 0) + 1;

        await tx.insert(estimateRevisions).values({
          id: revisionId,
          projectId: input.projectId,
          priceSetId: input.priceSetId,
          costingMethod: input.costingMethod,
          revisionNumber: next,
          status: ISSUED
        });

        await tx.insert(auditEvents).values({
          id: `audit_${revisionId}_issued`,
          organizationId: input.organizationId,
          actorId: input.actorId,
          eventType: "estimate_revision.issued",
          resourceType: "estimate_revision",
          resourceId: revisionId,
          correlationId: input.priceSetId,
          metadata: {
            projectId: input.projectId,
            priceSetId: input.priceSetId,
            costingMethod: input.costingMethod,
            revisionNumber: next,
            priceSetAuthority: priceSet.authoritySource,
            lineCount: priceSet.lineCount
          }
        });

        return next;
      });

      return { ok: true, revisionId, revisionNumber };
    } catch (error) {
      // สองคนกดออกฉบับวิธีเดียวกันพร้อมกันจะอ่าน max ได้เลขเดียวกัน แล้วดัชนี unique
      // ปฏิเสธคนที่สอง ซึ่งเป็นพฤติกรรมที่ถูก ลองใหม่จึงได้เลขถัดไปจริง ไม่ใช่เลขที่ชนกัน
      if (attempt === NUMBER_RETRIES - 1 || !isUniqueViolation(error)) throw error;
    }
  }

  return { ok: false, reason: "number_collision", message: "มีการออกฉบับพร้อมกันหลายรายการ กรุณากดอีกครั้ง" };
}

/**
 * `23505` คือรหัสที่ PostgreSQL ใช้บอกว่าดัชนี unique ปฏิเสธแถวนี้
 *
 * ไล่ตาม `cause` ด้วย เพราะชั้น driver ห่อ error ของ PostgreSQL ไว้ในบางเส้นทาง การอ่าน
 * เฉพาะชั้นนอกจะทำให้การชนกันของเลขฉบับกลายเป็น error ที่โยนออกไปแทนที่จะลองใหม่
 */
function isUniqueViolation(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 5 && typeof current === "object" && current !== null; depth += 1) {
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
