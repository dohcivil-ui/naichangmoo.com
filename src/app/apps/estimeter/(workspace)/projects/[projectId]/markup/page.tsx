import { notFound } from "next/navigation";
import { EstimeterEntryBlocked } from "@/components/estimeter/entry-blocked";
import { DrawingMarkup } from "@/components/estimeter/markup/drawing-markup";
import { resolveEstimeterContext } from "@/server/estimeter/context";
import { getProject } from "@/server/estimeter/project-repository";

/**
 * หน้าวัดปริมาณบนแบบก่อสร้าง (IP-227)
 *
 * ด่านสิทธิ์ตรวจซ้ำที่นี่แม้ layout จะตรวจแล้ว เพราะ Next.js ยังรันหน้าที่ layout ห่อไว้เสมอ
 * การมาถึงหน้านี้ได้จึงไม่ได้แปลว่ามีสิทธิ์ ตามแบบเดียวกับหน้าถอดแบบด้วยมือ
 *
 * **หน้านี้ไม่มีหัวเรื่องและไม่มีเส้นทางเป็นบล็อกของตัวเอง** ชื่อโครงการกับทางกลับย้ายไปอยู่
 * ในแถบของเครื่องมือ เพราะพื้นที่ทำงานต้องเต็มจอ — บล็อกหัวเรื่องกินความสูงที่ผืนวาดต้องใช้
 * และดันผืนวาดลงไปจนต้องเลื่อนหน้าเว็บหา (เจ้าของงานทักเมื่อ 2026-09-02)
 *
 * **ไฟล์ PDF ยังอยู่ในเครื่องผู้ใช้ แต่งานวัดลงฐานข้อมูลแล้ว** (IP-233) เบราว์เซอร์คำนวณ
 * checksum ของไฟล์ที่เปิด แล้วใช้ค่านั้นเป็นตัวตนของแบบใบนั้น สเกลที่ยืนยัน แนวเสาที่ร่าง
 * ระยะจริงที่กรอก และจุดที่ค้างอยู่ จึงกลับมาครบเมื่อเปิดไฟล์เดิมซ้ำ โดยไม่มีไบต์ไหนของแบบ
 * ออกจากเครื่องเขา · ที่เก็บไฟล์บนคลาวด์ยังจำเป็นในวันที่เพื่อนร่วมทีมต้องเปิดแบบใบเดียวกันต่อ
 * ซึ่งเป็นงานรอบถัดไปและรอ ADR 0002 ถูกนำมาใช้จริง
 */
export default async function DrawingMarkupPage({ params }: { params: Promise<{ projectId: string }> }) {
  const result = await resolveEstimeterContext();
  if (!result.ok) return <EstimeterEntryBlocked reason={result.reason} />;

  const { access } = result.context;
  const { projectId } = await params;
  const organizationId = access.organizationId;
  if (!organizationId) notFound();

  const project = await getProject(organizationId, projectId);
  if (!project) notFound();

  const canEdit = access.capabilities.edit && (project.state === "draft" || project.state === "active");

  if (!canEdit) {
    return (
      <p className="markup__blocked" role="status">
        โครงการนี้อยู่ในสถานะที่แก้ไขไม่ได้ หรือสิทธิ์ของคุณเปิดให้อ่านอย่างเดียว
      </p>
    );
  }

  return (
    <DrawingMarkup
      projectName={project.name}
      projectHref={`/apps/estimeter/projects/${projectId}`}
      projectId={projectId}
    />
  );
}
