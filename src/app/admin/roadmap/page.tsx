import { StatusConsole } from "@/components/admin/status-console";
import { readProjectStatus } from "@/server/project-status";

export const dynamic = "force-dynamic";

/**
 * สถานะโครงการย้ายเข้าหลังบ้าน (คำสั่งเจ้าของงาน 2026-08-28) — โรดแมปกับเอกสารส่งต่องาน
 * เป็นครัวหลังบ้าน ไม่ใช่ของโชว์ลูกค้า URL สาธารณะเดิม (/roadmap) เป็น 404 ไปเลย
 * ไม่ redirect เพราะแม้แต่การเด้งก็เป็นการบอกว่ามีของอยู่ · ยามคือ admin/layout.tsx (ADR 0012)
 */
export default async function AdminRoadmapPage() {
  const initial = await readProjectStatus();
  return <StatusConsole initial={initial} />;
}
