import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  auditEvents,
  boqItems,
  estimateRevisions,
  priceSetLines,
  priceSets,
  projects,
  takeoffItems,
  takeoffRuns
} from "@/db/schema";
import { planMatches, type MatchPlan } from "@/lib/boq-matching";
import { roundPricedQuantity } from "@/lib/takeoff-quantity";
import { unitLabel } from "@/lib/takeoff-units";
import type { BoqMatchInput } from "@/server/ai/estimeter-prompt";

/**
 * บรรทัด BOQ — จุดที่ปริมาณกับราคามาเจอกัน (IP-217)
 *
 * **รหัสอ้างอิงตั้งใหม่ทุกครั้งและตั้งจากลำดับที่ตายตัว** `Q1..Qn` สำหรับรายการปริมาณ
 * และ `P1..Pn` สำหรับบรรทัดในชุดราคา เรียงด้วยคีย์เดียวกันทั้งตอนถามผู้ช่วยและตอนรับคำตอบ
 * ผลคือ id ของแถวไม่ต้องเดินทางออกไปที่เบราว์เซอร์หรือไปกับโจทย์เลย และตอนคนกดรับ
 * เซิร์ฟเวอร์แปลงรหัสสั้นกลับเป็นแถวเอง ไม่ได้เชื่อ id ที่หน้าจอส่งมา
 *
 * **ยอดเงินคำนวณที่นี่เสมอ ไม่เก็บซ้ำ** ตาราง `boq_items` ไม่มีช่องเงินสักช่อง ยอดของบรรทัด
 * คือราคาต่อหน่วยในชุดราคาคูณปริมาณที่คัดลอกไว้ ปัดที่สตางค์ตอนคูณเหมือนทุกที่ในระบบ
 */

export type MatchCandidates = {
  input: BoqMatchInput;
  /** `Q1` -> id ของรายการปริมาณ */
  itemByRef: Map<string, string>;
  /** `P1` -> id ของบรรทัดในชุดราคา */
  lineByRef: Map<string, string>;
  /**
   * `P1` -> ราคาต่อหน่วยเป็นสตางค์ **อยู่นอก `input` โดยตั้งใจ**
   *
   * `input` คือสิ่งที่เดินทางไปหาแบบจำลอง และมันต้องไม่มีเงินอยู่ในนั้นเลย ส่วนตัวนี้ใช้ฝั่งเรา
   * เพื่อคูณให้คนเห็นยอดก่อนกดรับ คนละทางกันคนละชุดข้อมูล
   */
  unitSatangByRef: Map<string, string>;
};

export type BoqLineView = {
  id: string;
  /** หมวดงานของรายการถอดปริมาณ ใบ ปร.4 แยกตามนี้ จึงต้องเดินทางมาถึงแผง BOQ ด้วย */
  category: string;
  description: string;
  unit: string;
  quantity: number;
  unitSatang: bigint;
  amountSatang: bigint;
  priceName: string;
  sourceKey: string;
  effectiveMonth: string | null;
  matchedBy: string;
  matchConfidence: string | null;
};

/**
 * รายการปริมาณที่ยืนยันแล้วของรอบล่าสุด และบรรทัดของชุดราคาที่รับมาแล้วทั้งหมด
 *
 * เอาเฉพาะรายการที่ `confirmed` เพราะรายการที่ยังไม่ยืนยันคือรายการที่ยังไม่มีหลักฐานครบ
 * การเอาไปจับคู่กับราคาแล้วขึ้นเอกสารคือการข้ามด่านที่ตั้งไว้ตั้งแต่ชั้นถอดปริมาณ
 */
export async function readMatchCandidates(organizationId: string, projectId: string): Promise<MatchCandidates | null> {
  const db = getDb();

  const found = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
    .limit(1);
  const project = found[0];
  if (!project) return null;

  const items = await db
    .select({
      id: takeoffItems.id,
      description: takeoffItems.description,
      unit: takeoffItems.unit,
      quantity: takeoffItems.quantity
    })
    .from(takeoffItems)
    .innerJoin(takeoffRuns, eq(takeoffRuns.id, takeoffItems.runId))
    .where(and(eq(takeoffRuns.projectId, projectId), eq(takeoffItems.reviewState, "confirmed")))
    // เรียงด้วยคีย์ที่ตายตัวสองชั้น เวลาที่เท่ากันเป๊ะเกิดขึ้นได้เมื่อเพิ่มหลายรายการในทรานแซกชันเดียว
    // ถ้าลำดับขยับระหว่างตอนถามกับตอนรับ รหัส Q3 จะชี้คนละรายการ ซึ่งคือการรับราคาผิดบรรทัด
    .orderBy(asc(takeoffItems.createdAt), asc(takeoffItems.id));

  const lines = await db
    .select({
      id: priceSetLines.id,
      name: priceSetLines.name,
      unit: priceSetLines.unit,
      unitSatang: priceSetLines.unitSatang
    })
    .from(priceSetLines)
    .innerJoin(priceSets, eq(priceSets.id, priceSetLines.priceSetId))
    .where(eq(priceSets.projectId, projectId))
    .orderBy(asc(priceSetLines.createdAt), asc(priceSetLines.id));

  const itemByRef = new Map<string, string>();
  const lineByRef = new Map<string, string>();
  const unitSatangByRef = new Map<string, string>();

  const projectedItems = items.map((item, index) => {
    const ref = `Q${index + 1}`;
    itemByRef.set(ref, item.id);
    // **หน่วยต้องแปลงเป็นคำไทยก่อนส่ง** ชั้นถอดปริมาณเก็บหน่วยเป็นรหัส (`cu_m`) ส่วนชุดราคา
    // เก็บเป็นคำที่ผู้ประกาศใช้ (`ลบ.ม.`) ถ้าส่งดิบทั้งสองฝั่ง คำสั่งที่บอกว่า "หน่วยต้องตรงกัน
    // ก่อนเสมอ" จะไม่มีทางเป็นจริงได้เลยสักคู่ และผู้ช่วยจะตอบว่าจับคู่ไม่ได้ทั้งหมด
    // เจอตอนเดินของจริง ไม่ใช่ตอนอ่านโค้ด เพราะทั้งสองช่องชื่อ unit เหมือนกัน
    return { ref, description: item.description, unit: unitLabel(item.unit), quantity: item.quantity };
  });

  const projectedLines = lines.map((line, index) => {
    const ref = `P${index + 1}`;
    lineByRef.set(ref, line.id);
    unitSatangByRef.set(ref, line.unitSatang.toString());
    return { ref, name: line.name, unit: line.unit };
  });

  return {
    input: { projectName: project.name, items: projectedItems, lines: projectedLines },
    itemByRef,
    lineByRef,
    unitSatangByRef
  };
}

/**
 * คิดแผนการจับคู่ด้วยอัลกอริทึมก่อนถามแบบจำลอง (IP-219)
 *
 * ผลที่ได้แบ่งงานเป็นสามกอง — คู่ที่ชัดจบที่นี่โดยไม่ต้องเสียเงินเรียกแบบจำลอง คู่ที่ไม่ชัด
 * ส่งต่อไปพร้อม **เฉพาะตัวเลือกที่ผ่านด่านแล้ว** ไม่ใช่บัญชีราคาทั้งเล่ม และรายการที่ไม่มีคู่
 * รายงานตรง ๆ ว่าทำไม
 */
export async function planProjectMatches(
  organizationId: string,
  projectId: string
): Promise<{ candidates: MatchCandidates; plan: MatchPlan } | null> {
  const candidates = await readMatchCandidates(organizationId, projectId);
  if (!candidates) return null;

  const plan = planMatches(
    candidates.input.items.map((item) => ({ ref: item.ref, description: item.description, unit: item.unit })),
    candidates.input.lines
  );
  return { candidates, plan };
}

export type AcceptRejection = "unknown_project" | "unknown_revision" | "unknown_ref" | "nothing_to_accept";

export type AcceptResult = { ok: true; accepted: number } | { ok: false; reason: AcceptRejection; message: string };

/**
 * รับคู่ที่ผู้ช่วยเสนอ ทีละคู่ที่คนติ๊กไว้
 *
 * รับ **รหัสสั้น** ไม่ใช่ id เพราะ id ที่หน้าจอส่งมาเชื่อไม่ได้ และรหัสสั้นแปลกลับได้ที่นี่
 * ด้วยลำดับเดียวกับตอนถาม รหัสที่แปลไม่ออกคือคำขอที่ปฏิเสธทั้งชุด ไม่ใช่ข้ามเฉพาะบรรทัดนั้น
 * เพราะการข้ามเงียบ ๆ ทำให้คนเห็นว่ารับไปแล้วแต่ของไม่เข้า
 */
export async function acceptMatches(input: {
  organizationId: string;
  actorId: string;
  projectId: string;
  revisionId: string;
  matches: { itemRef: string; lineRef: string; confidence: string | null; matchedBy: string }[];
}): Promise<AcceptResult> {
  if (input.matches.length === 0) {
    return { ok: false, reason: "nothing_to_accept", message: "ยังไม่ได้ติ๊กคู่ไหนไว้เลย" };
  }

  const db = getDb();
  const candidates = await readMatchCandidates(input.organizationId, input.projectId);
  if (!candidates) return { ok: false, reason: "unknown_project", message: "ไม่พบโครงการนี้" };

  const revision = await db
    .select({ id: estimateRevisions.id })
    .from(estimateRevisions)
    .innerJoin(projects, eq(projects.id, estimateRevisions.projectId))
    .where(
      and(
        eq(estimateRevisions.id, input.revisionId),
        eq(estimateRevisions.projectId, input.projectId),
        eq(projects.organizationId, input.organizationId)
      )
    )
    .limit(1);
  if (!revision[0]) return { ok: false, reason: "unknown_revision", message: "ไม่พบฉบับคำนวณนี้ในโครงการนี้" };

  const rows = input.matches.map((match) => ({
    takeoffItemId: candidates.itemByRef.get(match.itemRef),
    priceSetLineId: candidates.lineByRef.get(match.lineRef),
    confidence: match.confidence,
    // `algorithm` คือคู่ที่อัลกอริทึมตัดสินได้เอง `assistant` คือคู่ที่แบบจำลองช่วยตัดสิน
    // ทั้งสองยังต้องมีคนกดรับเหมือนกัน ต่างกันที่ใครเป็นคนเสนอ ซึ่งเป็นข้อเท็จจริงที่ต้องจดไว้
    matchedBy: match.matchedBy === "algorithm" ? "algorithm" : "assistant"
  }));
  if (rows.some((row) => !row.takeoffItemId || !row.priceSetLineId)) {
    return {
      ok: false,
      reason: "unknown_ref",
      message: "รายการเปลี่ยนไปหลังจากผู้ช่วยเสนอ กรุณาสั่งให้ผู้ช่วยจับคู่ใหม่อีกครั้ง"
    };
  }

  // ปริมาณถูกปัดเหลือสองตำแหน่งตรงนี้ ตอนที่มันกลายเป็นบรรทัดที่มีราคา ไม่ใช่ตอนแสดงผล
  // เพราะยอดของบรรทัดคิดจากค่าที่เก็บ ถ้าเก็บ 10.804 แล้วพิมพ์ 10.80 ใบจะบวกไม่ตรงกับที่ตาเห็น
  const quantityById = new Map(
    candidates.input.items.map((item) => [
      candidates.itemByRef.get(item.ref) ?? "",
      roundPricedQuantity(item.quantity)
    ])
  );

  await db.transaction(async (tx) => {
    await tx
      .insert(boqItems)
      .values(
        rows.map((row) => ({
          id: `boq_${randomUUID()}`,
          revisionId: input.revisionId,
          takeoffItemId: row.takeoffItemId!,
          priceSetLineId: row.priceSetLineId!,
          quantity: quantityById.get(row.takeoffItemId!) ?? "0",
          matchedBy: row.matchedBy,
          matchConfidence: row.confidence,
          acceptedBy: input.actorId
        }))
      )
      // รับซ้ำรายการเดิมไม่ใช่ error ให้ของเดิมชนะ เพราะบรรทัดที่ขึ้นเอกสารไปแล้วต้องนิ่ง
      .onConflictDoNothing();

    await tx.insert(auditEvents).values({
      id: `audit_boq_${randomUUID()}`,
      organizationId: input.organizationId,
      actorId: input.actorId,
      eventType: "boq_items.accepted_from_assistant",
      resourceType: "estimate_revision",
      resourceId: input.revisionId,
      correlationId: input.projectId,
      metadata: { projectId: input.projectId, acceptedCount: rows.length }
    });
  });

  return { ok: true, accepted: rows.length };
}

export async function listBoqLines(organizationId: string, revisionId: string): Promise<BoqLineView[]> {
  const rows = await getDb()
    .select({
      id: boqItems.id,
      category: takeoffItems.category,
      description: takeoffItems.description,
      unit: takeoffItems.unit,
      quantity: boqItems.quantity,
      unitSatang: priceSetLines.unitSatang,
      priceName: priceSetLines.name,
      sourceKey: priceSetLines.sourceKey,
      effectiveMonth: priceSetLines.effectiveMonth,
      matchedBy: boqItems.matchedBy,
      matchConfidence: boqItems.matchConfidence,
      // ปัดที่สตางค์ตอนคูณ ให้ตรงกับที่แผงชุดราคาแสดง ไม่ใช่ปัดตอนรวมท้ายสุด
      amountSatang: sql<string>`round(${priceSetLines.unitSatang} * ${boqItems.quantity})::text`
    })
    .from(boqItems)
    .innerJoin(estimateRevisions, eq(estimateRevisions.id, boqItems.revisionId))
    .innerJoin(projects, eq(projects.id, estimateRevisions.projectId))
    .innerJoin(takeoffItems, eq(takeoffItems.id, boqItems.takeoffItemId))
    .innerJoin(priceSetLines, eq(priceSetLines.id, boqItems.priceSetLineId))
    .where(and(eq(boqItems.revisionId, revisionId), eq(projects.organizationId, organizationId)))
    // เรียงตามหมวดก่อนเวลา เพราะใบ ปร.4 แยกตามหมวดงาน การเรียงตามเวลาที่คนกดรับ
    // จะทำให้รายการของหมวดเดียวกันกระจายอยู่คนละที่ในใบเดียว
    .orderBy(asc(takeoffItems.category), asc(boqItems.createdAt));

  return rows.map((row) => ({
    ...row,
    quantity: Number(row.quantity),
    amountSatang: BigInt(row.amountSatang)
  }));
}

/** ฉบับคำนวณที่มีบรรทัด BOQ อยู่แล้วกี่บรรทัด ใช้บอกบนหน้าจอว่าฉบับไหนมีของ */
export async function countBoqLinesByRevision(
  organizationId: string,
  revisionIds: readonly string[]
): Promise<Map<string, number>> {
  if (revisionIds.length === 0) return new Map();

  const rows = await getDb()
    .select({ revisionId: boqItems.revisionId, count: sql<number>`count(*)::int` })
    .from(boqItems)
    .innerJoin(estimateRevisions, eq(estimateRevisions.id, boqItems.revisionId))
    .innerJoin(projects, eq(projects.id, estimateRevisions.projectId))
    .where(and(inArray(boqItems.revisionId, [...revisionIds]), eq(projects.organizationId, organizationId)))
    .groupBy(boqItems.revisionId);

  return new Map(rows.map((row) => [row.revisionId, row.count]));
}
