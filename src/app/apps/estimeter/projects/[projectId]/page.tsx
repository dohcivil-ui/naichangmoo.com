import Link from "next/link";
import { notFound } from "next/navigation";
import { EstimeterEntryBlocked } from "@/components/estimeter/entry-blocked";
import { formatThaiDateTime } from "@/lib/thai-format";
import { resolveEstimeterContext } from "@/server/estimeter/context";
import { getProject } from "@/server/estimeter/project-repository";

const stages = [
  { id: 1, label: "ตั้งโครงการ", note: "ชื่อโครงการและประเภทงาน" },
  { id: 2, label: "ตรวจแบบและยืนยันสเกล", note: "revision แบบ และจุดอ้างอิงสเกล" },
  { id: 3, label: "ถอดปริมาณพร้อมหลักฐาน", note: "หน่วย สูตร และตำแหน่งอ้างอิงในแบบ" },
  { id: 4, label: "ประมาณราคาและสรุป BOQ", note: "price set ที่อนุมัติ และเอกสาร" }
];

export default async function EstimeterProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const result = await resolveEstimeterContext();
  if (!result.ok) return <EstimeterEntryBlocked reason={result.reason} />;

  const { projectId } = await params;
  // Scoped by organization, so an id from another organization is indistinguishable from a
  // non-existent one. Nothing about the other organization's data is revealed.
  const project = await getProject(result.context.access.organizationId, projectId);
  if (!project) notFound();

  const canEdit = result.context.access.capabilities.edit;

  return (
    <section className="estimation-workspace">
      <div className="container">
        <header className="estimation-workspace__head">
          <div>
            <p className="eyebrow">PROJECT · {project.workType === "building" ? "งานอาคาร" : project.workType}</p>
            <h1>{project.name}</h1>
            <p className="estimation-workspace__lead">
              สร้างเมื่อ {formatThaiDateTime(project.createdAt)} · แก้ไขล่าสุด {formatThaiDateTime(project.updatedAt)}
            </p>
          </div>
          <div className="estimation-workspace__progress" aria-label="ความคืบหน้า 1 จาก 4 ขั้นตอน">
            <span>WORKFLOW</span><strong>1 / 4</strong><small>{stages[0].label}</small>
          </div>
        </header>

        <p className="workspace-notice">
          {canEdit
            ? <><strong>สถานะโครงการ:</strong> ตั้งโครงการเรียบร้อยแล้ว ขั้นตอนถัดไปคือการอัปโหลดแบบและยืนยันสเกล ซึ่งยังไม่เปิดใช้งานในระบบ</>
            : <><strong>อ่านอย่างเดียว:</strong> สิทธิ์ปัจจุบันเปิดดูโครงการนี้ได้ แต่แก้ไขข้อมูลไม่ได้</>}
        </p>

        <div className="workspace-panel">
          <div className="workspace-panel__title">
            <div>
              <p className="eyebrow">WORKFLOW STATUS</p>
              <h2>ลำดับงานของโครงการนี้</h2>
            </div>
            <span className="status-chip status-chip--attention">ยังไม่มีข้อมูลถอดปริมาณในระบบ</span>
          </div>
          <div className="preflight-grid">
            {stages.map((stage) => (
              <article key={stage.id}>
                <span className="review-grid__icon">{stage.id}</span>
                <div>
                  <h3>{stage.label}</h3>
                  <p>{stage.note}</p>
                  <small>{stage.id === 1 ? "เสร็จแล้ว" : "ยังไม่เปิดใช้งาน"}</small>
                </div>
              </article>
            ))}
          </div>
          <div className="prelim-boq-note">
            <strong>ยังไม่มีปริมาณงานหรือราคาในโครงการนี้</strong>
            <p>ระบบจะไม่แสดงตัวเลขปริมาณหรือราคาใด ๆ จนกว่าจะมีข้อมูลที่ผู้ใช้บันทึกและตรวจแล้วจริง</p>
          </div>
        </div>

        <div className="hero__actions">
          <Link className="button button--orange micro-button" href="/apps/estimeter">กลับหน้าโครงการทั้งหมด</Link>
        </div>
      </div>
    </section>
  );
}
