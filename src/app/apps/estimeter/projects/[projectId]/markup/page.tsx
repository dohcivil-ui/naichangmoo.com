import Link from "next/link";
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
 * **รอบนี้แบบยังไม่ถูกส่งขึ้นที่เก็บไฟล์** ผู้ใช้เปิดไฟล์จากเครื่องตัวเองแล้ววัดได้เลย
 * เพราะการวาดและการวัดเกิดในเบราว์เซอร์ทั้งหมด ที่เก็บไฟล์บนคลาวด์จำเป็นตอนที่ต้อง
 * กลับมาทำงานต่อในภายหลังหรือให้คนอื่นเปิดดู ซึ่งเป็นงานรอบถัดไปและรอ ADR 0002 ถูกนำมาใช้จริง
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

  return (
    <div className="container">
      <nav aria-label="เส้นทาง">
        <Link href={`/apps/estimeter/projects/${projectId}`}>กลับไปหน้าโครงการ</Link>
      </nav>

      <h1>วัดปริมาณบนแบบ — {project.name}</h1>
      <p>
        เปิดไฟล์แบบ PDF จากเครื่องของคุณ ตั้งสเกลของหน้านั้นก่อน แล้วจึงวัดได้
        เครื่องมือที่ต้องใช้สเกลจะกดไม่ได้จนกว่าจะตั้งสเกลเสร็จ เพราะสเกลผิดทำให้ทุกปริมาณในหน้านั้นผิดตาม
      </p>

      {canEdit ? (
        <DrawingMarkup />
      ) : (
        <p role="status">
          โครงการนี้อยู่ในสถานะที่แก้ไขไม่ได้ หรือสิทธิ์ของคุณเปิดให้อ่านอย่างเดียว
        </p>
      )}
    </div>
  );
}
