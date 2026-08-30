import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { priceSetLines, priceSets, projects } from "@/db/schema";
import type { PriceAuthoritySource } from "@/lib/price-authority";

/**
 * ชุดราคาที่โครงการรับมาแล้ว — ฝั่งรับของ IP-163
 *
 * PRICEMETR เป็นฝั่งส่ง ไฟล์นี้เป็นฝั่งอ่าน และตั้งใจให้อ่านอย่างเดียว ไม่มีทางเขียนอยู่ที่นี่เลย
 * ชุดราคาที่โครงการถืออยู่ต้องนิ่งตาม ADR 0008 การเปิดทางแก้ไว้ในฝั่งที่คนเปิดดูทุกวัน
 * คือการเปิดโอกาสให้เอกสารที่พิมพ์ไปแล้วขยับโดยไม่มีใครรู้ตัว
 *
 * ทุกการอ่านรับ `organizationId` เข้ามาแล้วผูกที่ join เหมือน `takeoff-repository`
 * ไม่ใช่ตรวจทีหลัง เพราะ id ของโครงการองค์กรอื่นต้องแยกไม่ออกจาก id ที่ไม่มีอยู่จริง
 */

export type PriceSetSummary = {
  id: string;
  name: string;
  provinceCode: string;
  effectiveMonth: string;
  status: string;
  /** ทางการหรือขององค์กร — ตัดสินว่าชุดนี้ออกฉบับแบบ Factor F ได้หรือไม่ (ADR 0008 ข้อ 5) */
  authoritySource: PriceAuthoritySource;
  payloadHash: string;
  lineCount: number;
  /** ยอดรวมเป็นสตางค์ คิดที่ฐานข้อมูลจากบรรทัดจริง ไม่ใช่ตัวเลขที่ใครพิมพ์เก็บไว้ */
  totalSatang: bigint;
  createdAt: Date;
};

export type PriceSetLineView = {
  id: string;
  lineKey: string;
  sourceKey: string;
  catalogCode: string;
  provinceCode: string | null;
  effectiveMonth: string | null;
  documentPage: string | null;
  rateCondition: string | null;
  name: string;
  unit: string;
  unitSatang: bigint;
  quantity: number;
  addedBy: string;
};

export async function listPriceSets(organizationId: string, projectId: string): Promise<PriceSetSummary[]> {
  const rows = await getDb()
    .select({
      id: priceSets.id,
      name: priceSets.name,
      provinceCode: priceSets.provinceCode,
      effectiveMonth: priceSets.effectiveMonth,
      status: priceSets.status,
      authoritySource: priceSets.authoritySource,
      payloadHash: priceSets.payloadHash,
      createdAt: priceSets.createdAt,
      lineCount: sql<number>`count(${priceSetLines.id})::int`,
      // ปัดที่สตางค์ตอนคูณ ให้ตรงกับ lineCost ที่หน้าจอใช้ ไม่ใช่ปัดตอนรวมท้ายสุด
      // ไม่งั้นยอดรวมของ ESTIMETR กับของ PRICEMETR จะต่างกันในหลักสตางค์โดยไม่มีใครอธิบายได้
      totalSatang: sql<string>`coalesce(sum(round(${priceSetLines.unitSatang} * ${priceSetLines.quantity})), 0)::text`
    })
    .from(priceSets)
    .innerJoin(projects, eq(projects.id, priceSets.projectId))
    .leftJoin(priceSetLines, eq(priceSetLines.priceSetId, priceSets.id))
    .where(and(eq(priceSets.projectId, projectId), eq(projects.organizationId, organizationId)))
    .groupBy(priceSets.id)
    .orderBy(desc(priceSets.createdAt));

  return rows.map((row) => ({ ...row, totalSatang: BigInt(row.totalSatang) }));
}

export async function listPriceSetLines(organizationId: string, priceSetId: string): Promise<PriceSetLineView[]> {
  const rows = await getDb()
    .select({
      id: priceSetLines.id,
      lineKey: priceSetLines.lineKey,
      sourceKey: priceSetLines.sourceKey,
      catalogCode: priceSetLines.catalogCode,
      provinceCode: priceSetLines.provinceCode,
      effectiveMonth: priceSetLines.effectiveMonth,
      documentPage: priceSetLines.documentPage,
      rateCondition: priceSetLines.rateCondition,
      name: priceSetLines.name,
      unit: priceSetLines.unit,
      unitSatang: priceSetLines.unitSatang,
      quantity: priceSetLines.quantity,
      addedBy: priceSetLines.addedBy
    })
    .from(priceSetLines)
    .innerJoin(priceSets, eq(priceSets.id, priceSetLines.priceSetId))
    .innerJoin(projects, eq(projects.id, priceSets.projectId))
    .where(and(eq(priceSetLines.priceSetId, priceSetId), eq(projects.organizationId, organizationId)))
    .orderBy(asc(priceSetLines.createdAt));

  return rows.map((row) => ({ ...row, quantity: Number(row.quantity) }));
}
