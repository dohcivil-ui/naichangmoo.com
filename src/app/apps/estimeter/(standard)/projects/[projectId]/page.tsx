import Link from "next/link";
import { notFound } from "next/navigation";
import { EstimeterEntryBlocked } from "@/components/estimeter/entry-blocked";
import { BoqAssistant } from "@/components/estimeter/boq-assistant";
import { BoqPanel } from "@/components/estimeter/boq-panel";
import { PriceSetPanel } from "@/components/estimeter/price-set-panel";
import { RevisionPanel } from "@/components/estimeter/revision-panel";
import { COSTING_METHOD_LABEL } from "@/lib/price-authority";
import { listBoqLines, readMatchCandidates } from "@/server/estimeter/boq-repository";
import { listPriceSetLines, listPriceSets, type PriceSetLineView } from "@/server/estimeter/price-set-repository";
import { listRevisions } from "@/server/estimeter/revision-repository";
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
  const organizationId = result.context.access.organizationId;
  // No organization means no project of one's own, and the id is treated as not found rather
  // than probed further. Scoping by organization also makes another organization's id
  // indistinguishable from a non-existent one.
  if (!organizationId) notFound();

  const project = await getProject(organizationId, projectId);
  if (!project) notFound();

  const openRun = await getOpenManualRun(organizationId, project.id);
  const runs = await listManualRuns(organizationId, project.id);
  const items = openRun ? await listRunItems(organizationId, openRun.id) : [];
  const summary = summarizeConfirmedQuantities(items);
  const closedRuns = runs.filter((run) => run.state === "succeeded");
  const canEdit = result.context.access.capabilities.edit;

  // ชุดราคาที่ PRICEMETR ส่งเข้ามา (IP-163) อ่านบรรทัดของทุกชุดพร้อมกัน เพราะหน้านี้แสดงครบ
  // อยู่แล้ว การเปิดทีละชุดจะเพิ่มรอบไปกลับโดยไม่ได้ลดข้อมูลที่ต้องอ่าน
  const priceSets = await listPriceSets(organizationId, project.id);
  const priceSetLines = await Promise.all(priceSets.map((set) => listPriceSetLines(organizationId, set.id)));
  // ฉบับคำนวณที่ออกจากชุดราคาเหล่านั้น (IP-216)
  const revisions = await listRevisions(organizationId, project.id);

  // ผู้ช่วยจับคู่ปริมาณกับราคา และบรรทัด BOQ ที่รับไว้แล้ว (IP-217)
  //
  // ฉบับที่ผู้ช่วยจะรับเข้าคือฉบับที่ออกล่าสุด เพราะเป็นฉบับที่กำลังทำอยู่จริง ฉบับก่อนหน้า
  // ออกไปแล้วและไม่ควรมีบรรทัดงอกเพิ่มทีหลังโดยไม่มีใครสังเกต
  const newestRevision = [...revisions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
  const candidates = await readMatchCandidates(organizationId, project.id);
  const boqLines = newestRevision ? await listBoqLines(organizationId, newestRevision.id) : [];
  const linesBySet: Record<string, PriceSetLineView[]> = {};
  priceSets.forEach((set, index) => {
    linesBySet[set.id] = priceSetLines[index];
  });

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
    {
      id: 4,
      label: "ประมาณราคาและสรุป BOQ",
      note: "บัญชีราคาที่รับมา และเอกสาร",
      status:
        priceSets.length > 0
          ? `รับบัญชีราคาแล้ว ${priceSets.length} บัญชี · ${priceSets.reduce((total, set) => total + set.lineCount, 0)} บรรทัด · ${revisions.length > 0 ? `ออกประมาณราคาแล้ว ${revisions.length} ครั้ง` : "ยังไม่ได้ออกประมาณราคา"}`
          : "ยังไม่มีบัญชีราคา · หยิบราคาจากแอปราคาวัสดุแล้วส่งเข้ามาได้"
    }
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

        <PriceSetPanel
          priceSets={priceSets}
          linesBySet={linesBySet}
          projectId={project.id}
          projectName={project.name}
          canEdit={canEdit}
          lockReason={canEdit ? null : "สิทธิ์ปัจจุบันเปิดดูโครงการนี้ได้ แต่ออกประมาณราคาไม่ได้"}
        />

        <RevisionPanel revisions={revisions} />

        <BoqPanel
          lines={boqLines}
          revisionLabel={
            newestRevision
              ? `${COSTING_METHOD_LABEL[newestRevision.costingMethod]} ครั้งที่ ${newestRevision.revisionNumber}`
              : null
          }
        />

        <BoqAssistant
          projectId={project.id}
          revisionId={newestRevision?.id ?? null}
          revisionLabel={
            newestRevision
              ? `${COSTING_METHOD_LABEL[newestRevision.costingMethod]} ครั้งที่ ${newestRevision.revisionNumber}`
              : null
          }
          canEdit={canEdit}
          unitSatangByRef={Object.fromEntries(candidates?.unitSatangByRef ?? [])}
        />

        <div className="hero__actions">
          <Link className="button button--orange micro-button" href="/apps/estimeter">กลับหน้าโครงการทั้งหมด</Link>
        </div>
      </div>
    </section>
  );
}
