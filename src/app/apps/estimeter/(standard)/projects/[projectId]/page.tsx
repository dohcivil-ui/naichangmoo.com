import Link from "next/link";
import { notFound } from "next/navigation";
import { EstimeterEntryBlocked } from "@/components/estimeter/entry-blocked";
import { BoqPanel } from "@/components/estimeter/boq-panel";
import { PriceSetPanel } from "@/components/estimeter/price-set-panel";
import { RevisionPanel } from "@/components/estimeter/revision-panel";
import { COSTING_METHOD_LABEL } from "@/lib/price-authority";
import { listBoqLines } from "@/server/estimeter/boq-repository";
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

  // บรรทัด BOQ ที่รับไว้แล้วของฉบับล่าสุด ซึ่งเป็นฉบับที่กำลังทำอยู่จริง
  const newestRevision = [...revisions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
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
    /**
     * ชื่อขั้นเป็นประโยคที่บอกว่าต้องทำอะไร ไม่ใช่คำนามสามคำต่อกัน (เจ้าของงานเคาะ 2026-09-04)
     *
     * กริยาคือ "ตั้งค่า" ไม่ใช่ "ตั้ง" เพราะ "ตั้งโครงการ" อ่านเหมือนก่อตั้งโครงการ ซึ่งไม่ใช่
     * สิ่งที่คนทำตรงนี้ · ส่วนคำนามคงเป็น "โครงการ" ตามที่วิชาชีพใช้ ยืนยันจาก
     * `km/Estimate1.pdf` เอกสารประกอบการสอนวิชาการประมาณราคาก่อสร้าง 1 ซึ่งใช้
     * "โครงการ" "เจ้าของโครงการ" "ผู้ประมาณราคา" ตลอดเล่ม และตรงกับช่องบนแบบ ปร.
     */
    {
      id: 1,
      label: "ตั้งค่าโครงการ",
      note: "ใส่ชื่อโครงการ ชื่อผู้ประมาณราคา และประเภทงาน",
      status: "เสร็จแล้ว"
    },
    {
      /**
       * สถานะของขั้นนี้เคยเขียนตายไว้ว่า "ยังไม่เปิดใช้งาน" ตั้งแต่ยังไม่มีหน้าแบบ แล้วไม่มีใคร
       * กลับมาแก้เมื่อ IP-227 ถึง IP-235 ทยอยเปิดใช้งานจริง เจ้าของงานจึงเห็นการ์ดบอกว่าปิดอยู่
       * ทั้งที่เขากำลังวัดบนแบบอยู่ · ที่ยังไม่มีจริงคือ**การเก็บไฟล์แบบไว้ในระบบ** ผู้ใช้ต้อง
       * เปิดไฟล์จากเครื่องใหม่ทุกครั้ง ส่วนสเกล แนวเสา และรอยวัด เก็บลงฐานแล้ว
       */
      id: 2,
      label: "เปิดแบบและยืนยันสเกล",
      note: "ตั้งสเกลของหน้า แล้ววัดบนแบบพร้อมเก็บหลักฐาน",
      status: "เปิดใช้งานแล้ว · สเกลและรอยวัดเก็บในระบบ แต่ไฟล์แบบยังต้องเปิดจากเครื่องทุกครั้ง",
      href: `/apps/estimeter/projects/${project.id}/markup`,
      linkLabel: "เปิดหน้าแบบ"
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
            <small>{openRun || closedRuns.length > 0 ? "ถอดปริมาณ" : "ตั้งค่าโครงการ"}</small>
          </div>
        </header>

        <p className="workspace-notice">
          {canEdit
            ? <><strong>ขั้นถัดไป:</strong> วัดบนแบบแล้วส่งเข้าถอดปริมาณ คลิกในห้องหนึ่งครั้งระบบไล่ขอบผนังให้ คลิกสองมุมระบบอ่านเลขจากเส้นบอกระยะให้ ทุกตัวเลขติดที่มาไปด้วย คุณแค่ตรวจแล้วกดยืนยัน</>
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
                  {/* ขั้นที่มีหน้าจอของตัวเองต้องเข้าถึงได้จากการ์ด ไม่ใช่ให้ผู้ใช้เดา URL เอง */}
                  {stage.href ? (
                    <Link className="button button--ghost micro-button" href={stage.href}>
                      {stage.linkLabel} <span>→</span>
                    </Link>
                  ) : null}
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

        {/*
         * ผู้ช่วยจับคู่ปริมาณกับบัญชีราคา (IP-217) ถูกถอดออกจากหน้านี้เมื่อ 2026-09-04
         *
         * เจ้าของงานสั่งเอาออก เหตุผลคือมันไม่ได้ลดงานคิดของคน มันขอให้คนอ่านคู่ที่เสนอ
         * แล้วติ๊กรับทีละคู่ ซึ่งเป็นงานตรวจที่เพิ่มเข้ามา ไม่ใช่งานที่หายไป · และมันโผล่อยู่
         * บนหน้าโครงการตั้งแต่ยังไม่ได้ถอดปริมาณ ทำให้ลำดับงานที่การ์ดข้างบนวางไว้เสียรูป
         *
         * ที่เขาต้องการคือผู้ช่วยที่อยู่ใน **หน้าแบบ** ซึ่งช่วยตรวจแบบ ช่วยถอดปริมาณวัสดุ
         * และช่วยคิดพื้นที่ ให้คนคิดเองน้อยที่สุด · ยังไม่ได้ออกแบบ รอ grill ก่อนเขียนโค้ด
         *
         * โค้ดของผู้ช่วยเดิม `boq-assistant.tsx` กับที่มาของข้อมูล `readMatchCandidates`
         * ยังอยู่ครบพร้อมเทสต์ ถอดแค่การแสดงผลบนหน้านี้ กลับมาเปิดใหม่ได้ถ้าเขาสั่ง
         */}

        <div className="hero__actions">
          <Link className="button button--orange micro-button" href="/apps/estimeter">กลับหน้าโครงการทั้งหมด</Link>
        </div>
      </div>
    </section>
  );
}
