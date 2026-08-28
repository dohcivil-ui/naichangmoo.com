import { NextResponse } from "next/server";
import { resolvePlatformAdmin } from "@/server/platform-admin";
import { readProjectStatus } from "@/server/project-status";

export const dynamic = "force-dynamic";

/**
 * สถานะโครงการเป็นความลับภายใน (คำสั่งเจ้าของงาน 2026-08-28) — เดิม API นี้เปิดโล่งที่
 * /api/project-status ใครก็ดูดโรดแมปและเอกสารส่งต่องานทั้งก้อนได้ ตอนนี้อยู่ใต้ /api/admin
 * และตอบ 404 (ไม่ใช่ 403) เมื่อไม่ใช่ผู้ดูแล — คำปฏิเสธที่บอกว่า "มีของแต่ห้ามดู"
 * ก็เป็นการเผยความลับแบบหนึ่ง (ADR 0012 ให้ปฏิเสธแม้ตอนอ่านฐานข้อมูลไม่ได้)
 */
export async function GET() {
  const admin = await resolvePlatformAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  try {
    return NextResponse.json(await readProjectStatus(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to read project status." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
