import Link from "next/link";
import { notFound } from "next/navigation";
import { EstimeterEntryBlocked } from "@/components/estimeter/entry-blocked";
import { formatQuantity } from "@/lib/takeoff-quantity";
import { summarizeConfirmedQuantities } from "@/lib/takeoff-summary";
import { unitLabel } from "@/lib/takeoff-units";
import { formatThaiDateTime } from "@/lib/thai-format";
import { resolveEstimeterContext } from "@/server/estimeter/context";
import { getProject } from "@/server/estimeter/project-repository";
import { getOpenManualRun, listManualRuns, listRunItems } from "@/server/estimeter/takeoff-repository";

export default async function EstimeterProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const result = await resolveEstimeterContext();
  if (!result.ok) return <EstimeterEntryBlocked reason={result.reason} />;

  const { projectId } = await params;
  // Scoped by organization, so an id from another organization is indistinguishable from a
  // non-existent one. Nothing about the other organization's data is revealed.
  const project = await getProject(result.context.access.organizationId, projectId);
  if (!project) notFound();

  const organizationId = result.context.access.organizationId;
  const openRun = await getOpenManualRun(organizationId, project.id);
  const runs = await listManualRuns(organizationId, project.id);
  const items = openRun ? await listRunItems(organizationId, openRun.id) : [];
  const summary = summarizeConfirmedQuantities(items);
  const closedRuns = runs.filter((run) => run.state === "succeeded");
  const canEdit = result.context.access.capabilities.edit;

  const takeoffStatus = openRun
    ? `กำลังทำงาน · ${items.length} รายการ ยืนยันแล้ว ${summary.reduce((total, row) => total + row.itemCount, 0)}`
    : closedRuns.length > 0
      ? `ปิดรอบแล้ว ${closedRuns.length} รอบ`
      : "ยังไม่เริ่ม";

  const stages = [
    { id: 1, label: "ตั้งโครงการ", note: "ชื่อโครงการและประเภทงาน", status: "เสร็จแล้ว" },
    {
      id: 2,
      label: "อัปโหลดแบบและยืนยันสเกล",
      note: "ผูกหลักฐานกับไฟล์แบบในระบบ",
      status: "ยังไม่เปิดใช้งาน · ระหว่างนี้อ้างอิงแบบเป็นข้อความได้"
    },
    { id: 3, label: "ถอดปริมาณพร้อมหลักฐาน", note: "หน่วย ปริมาณ และที่มาของการวัด", status: takeoffStatus },
    { id: 4, label: "ประมาณราคาและสรุป BOQ", note: "price set ที่อนุมัติ และเอกสาร", status: "ยังไม่เปิดใช้งาน" }
  ];

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
          <div className="estimation-workspace__progress" aria-label="ความคืบหน้าของโครงการ">
            <span>WORKFLOW</span>
            <strong>{openRun || closedRuns.length > 0 ? "3 / 4" : "1 / 4"}</strong>
            <small>{openRun || closedRuns.length > 0 ? "ถอดปริมาณ" : "ตั้งโครงการ"}</small>
          </div>
        </header>

        <p className="workspace-notice">
          {canEdit
            ? <><strong>ขั้นถัดไป:</strong> ถอดปริมาณด้วยมือพร้อมบันทึกที่มาของแต่ละรายการ ปริมาณที่ยืนยันแล้วจะเป็นฐานของการประมาณราคาในขั้นถัดไป</>
            : <><strong>อ่านอย่างเดียว:</strong> สิทธิ์ปัจจุบันเปิดดูโครงการนี้ได้ แต่แก้ไขข้อมูลไม่ได้</>}
        </p>

        <div className="workspace-panel">
          <div className="workspace-panel__title">
            <div>
              <p className="eyebrow">WORKFLOW STATUS</p>
              <h2>ลำดับงานของโครงการนี้</h2>
            </div>
            <span className={summary.length > 0 ? "status-chip status-chip--ready" : "status-chip status-chip--attention"}>
              {summary.length > 0 ? "มีปริมาณที่ยืนยันแล้ว" : "ยังไม่มีปริมาณที่ยืนยัน"}
            </span>
          </div>

          <div className="preflight-grid">
            {stages.map((stage) => (
              <article key={stage.id}>
                <span className="review-grid__icon">{stage.id}</span>
                <div>
                  <h3>{stage.label}</h3>
                  <p>{stage.note}</p>
                  <small>{stage.status}</small>
                </div>
              </article>
            ))}
          </div>

          {summary.length === 0 ? (
            <div className="prelim-boq-note">
              <div>
                <strong>ยังไม่มีปริมาณที่ยืนยันแล้วในโครงการนี้</strong>
                <p>
                  ระบบจะไม่แสดงยอดปริมาณหรือราคาใด ๆ จนกว่ารายการจะมีหลักฐานอ้างอิงและถูกยืนยันแล้ว
                </p>
              </div>
              <Link className="button button--orange micro-button" href={`/apps/estimeter/projects/${project.id}/takeoff`}>
                ไปหน้าถอดปริมาณ <span>→</span>
              </Link>
            </div>
          ) : (
            <>
              <div className="workspace-callout">
                <div>
                  <strong>ยอดรวมของปริมาณที่ยืนยันแล้ว</strong>
                  <p>รวมแยกตามหน่วยและไม่ปัดค่า ยังไม่มีการคิดราคาในขั้นนี้</p>
                </div>
                <Link className="button button--orange micro-button" href={`/apps/estimeter/projects/${project.id}/takeoff`}>
                  เปิดหน้าถอดปริมาณ <span>→</span>
                </Link>
              </div>
              <div className="takeoff-table-wrap">
                <table className="takeoff-table">
                  <thead>
                    <tr>
                      <th>หน่วย</th>
                      <th className="number-cell">ยอดรวม</th>
                      <th className="number-cell">จำนวนรายการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((row) => (
                      <tr key={row.unit}>
                        <td>{unitLabel(row.unit)}</td>
                        <td className="number-cell">{formatQuantity(row.total)}</td>
                        <td className="number-cell">{row.itemCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="hero__actions">
          <Link className="button button--orange micro-button" href="/apps/estimeter">กลับหน้าโครงการทั้งหมด</Link>
        </div>
      </div>
    </section>
  );
}
