import type { ReactNode } from "react";
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
import { summarizeDrawingProgress } from "@/server/estimeter/drawing-repository";
import { Button } from "@/components/platform/button";

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

  /**
   * ความคืบหน้าของแบบ อ่านจากฐานจริง ไม่ใช่ข้อความที่เขียนตายไว้
   *
   * สถานะของขั้นสองเคยเป็นประโยคที่คนพิมพ์ทิ้งไว้ ("เปิดใช้งานแล้ว · สเกลและรอยวัดเก็บใน
   * ระบบ แต่ไฟล์แบบยังต้องเปิดจากเครื่องทุกครั้ง") ซึ่งเป็นคำอธิบายว่าระบบทำอะไรได้
   * ไม่ใช่สถานะของโครงการใบนี้ · มันเลยพูดเหมือนกันหมดทุกโครงการ ทั้งใบที่ยังไม่เคยเปิดแบบ
   * และใบที่ยืนยันสเกลไปแล้วสิบหน้า `summarizeDrawingProgress` ตอบเรื่องนี้ได้อยู่แล้ว
   * และหน้าแรกของแอปก็อ่านจากตัวเดียวกันนี้
   */
  const drawings = await summarizeDrawingProgress(organizationId, project.id);

  /**
   * ป้ายสถานะบนการ์ดต้องสั้น — มันคือคำบอกสถานะ ไม่ใช่ประโยคอธิบาย
   *
   * ของเดิมยาวถึง "ยังไม่มีบัญชีราคา · หยิบราคาจากแอปราคาวัสดุแล้วส่งเข้ามาได้" ซึ่งพอกลาย
   * เป็นป้ายทรงแคปซูลที่ห้ามตัดบรรทัด มันล้นออกนอกขอบการ์ดไปทางขวา · คำแนะนำยาว ๆ
   * มีที่อยู่ของมันอยู่แล้วในแผงข้างล่างที่พูดเรื่องเดียวกัน
   *
   * เลขทุกตัวห่อด้วย `estimation-workspace__num` เพราะฟอนต์หลักของเว็บคือ Prompt
   * ซึ่งไม่มีชุดตัวเลขที่กว้างเท่ากัน ป้ายที่มีเลขจึงต้องยืมฟอนต์ตัวเลขของระบบมาใช้
   */
  const num = (value: number) => <b className="estimation-workspace__num">{value}</b>;

  const takeoffStatus = openRun ? (
    <>กำลังทำ {num(items.length)} รายการ</>
  ) : closedRuns.length > 0 ? (
    <>ปิดรอบแล้ว {num(closedRuns.length)} รอบ</>
  ) : (
    "ยังไม่เริ่ม"
  );

  /**
   * สถานะของขั้นหนึ่งขั้น มีสามค่าเท่านั้น ตามป้ายสามโทนบนผืนออกแบบ
   *
   * `doing` คือขั้นที่เริ่มแล้วแต่ยังไม่จบ ส่วนขั้นที่ยังไม่เริ่มเป็น `idle` · การ์ดที่มีขอบส้ม
   * คือขั้นแรกที่ยังไม่ `done` ซึ่งไม่จำเป็นต้องเป็นขั้นเดียวกับที่มีสถานะ `doing`
   * เช่นคนที่เปิดแบบไว้แล้วแต่ยังไม่ตั้งสเกล ขั้นสองเป็นทั้ง `doing` และเป็นขั้นที่ค้างอยู่
   */
  type StageState = "done" | "doing" | "idle";

  const stages: {
    id: number;
    label: string;
    note: string;
    state: StageState;
    status: ReactNode;
    href?: string;
    linkLabel?: string;
  }[] = [
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
      state: "done",
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
      state: drawings.calibratedPages > 0 ? "done" : drawings.documentCount > 0 ? "doing" : "idle",
      status:
        drawings.calibratedPages > 0 ? (
          <>ยืนยันสเกลแล้ว {num(drawings.calibratedPages)} หน้า</>
        ) : drawings.documentCount > 0 ? (
          "เปิดแบบแล้ว ยังไม่ยืนยันสเกล"
        ) : (
          "ยังไม่ได้เปิดแบบ"
        ),
      href: `/apps/estimeter/projects/${project.id}/markup`,
      linkLabel: "เปิดหน้าแบบ"
    },
    {
      id: 3,
      label: "ถอดปริมาณพร้อมหลักฐาน",
      note: "หน่วย ปริมาณ และที่มาของการวัด",
      state: closedRuns.length > 0 ? "done" : openRun ? "doing" : "idle",
      status: takeoffStatus
    },
    {
      id: 4,
      label: "ประมาณราคาและสรุป BOQ",
      note: "บัญชีราคาที่รับมา และเอกสาร",
      state: revisions.length > 0 ? "done" : priceSets.length > 0 ? "doing" : "idle",
      status:
        revisions.length > 0 ? (
          <>ออกประมาณราคาแล้ว {num(revisions.length)} ครั้ง</>
        ) : priceSets.length > 0 ? (
          <>รับบัญชีราคาแล้ว {num(priceSets.length)} บัญชี</>
        ) : (
          "ยังไม่มีบัญชีราคา"
        )
    }
  ];

  /**
   * ขั้นที่ค้างอยู่ คือขั้นแรกที่ยังไม่ `done` — ไม่ใช่เลขที่เขียนตายไว้
   *
   * ของเดิมกล่องความคืบหน้าตอบได้แค่ "1 / 4" กับ "3 / 4" เพราะดูแค่ว่ามีรอบถอดปริมาณไหม
   * โครงการที่เปิดแบบและยืนยันสเกลไปแล้วจึงยังขึ้นว่าอยู่ขั้นหนึ่ง ทั้งที่ทำขั้นสองจบไปแล้ว
   */
  const currentIndex = stages.findIndex((stage) => stage.state !== "done");
  const currentStage = currentIndex === -1 ? null : stages[currentIndex];
  const doneCount = stages.filter((stage) => stage.state === "done").length;

  return (
    <section className="estimation-workspace">
      <div className="container">
        {/*
          ชื่อโครงการเป็น h2 ไม่ใช่ h1 — เปลือกของแอปวาง h1 ไว้แล้วหนึ่งตัวคือชื่อแอป
          (`app-identity` ใน AppShell) หน้านี้เคยวาง h1 ตัวที่สองทับลงไปด้วยขนาด 57.6px
          ซึ่งใหญ่กว่าชื่อแอปที่ 24px อยู่ 2.4 เท่า อ่านเป็นหัวเรื่องสองชั้นที่ชนกันเอง
          และทำให้หน้าเดียวมี h1 สองตัว ซึ่งโปรแกรมอ่านหน้าจอไล่โครงเรื่องไม่ถูก
          คำกำกับใน AppShell เขียนเตือนเรื่องนี้ไว้เองตั้งแต่ต้นว่า "two large headings
          stacked read as a layout mistake rather than as a hierarchy"
        */}
        <header className="estimation-workspace__head">
          <div>
            <p className="eyebrow">โครงการ · {project.workType === "building" ? "งานอาคาร" : project.workType}</p>
            <h2>{project.name}</h2>
            <p className="estimation-workspace__lead">
              สร้างเมื่อ {formatThaiDateTime(project.createdAt)} · แก้ไขล่าสุด {formatThaiDateTime(project.updatedAt)}
            </p>
          </div>
          <div className="estimation-workspace__progress" aria-label="ความคืบหน้าของโครงการ">
            <span>ความคืบหน้า</span>
            <strong>
              <b className="estimation-workspace__num">{doneCount}</b> จาก{" "}
              <b className="estimation-workspace__num">{stages.length}</b>
            </strong>
            <small>{currentStage ? `ค้างอยู่ที่ ${currentStage.label}` : "ครบทุกขั้นแล้ว"}</small>
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
              <p className="eyebrow">ภาพรวม</p>
              <h2>ลำดับงานของโครงการนี้</h2>
            </div>
            <span className={summary.length > 0 ? "status-chip status-chip--done" : "status-chip status-chip--attention"}>
              {summary.length > 0 ? "มีปริมาณที่ยืนยันแล้ว" : "ยังไม่มีปริมาณที่ยืนยัน"}
            </span>
          </div>

          <div className="stage-grid">
            {stages.map((stage, index) => (
              <article
                key={stage.id}
                className={index === currentIndex ? "stage-card stage-card--current" : "stage-card"}
              >
                <span className="stage-card__n">{stage.id}</span>
                <h3>{stage.label}</h3>
                <p>{stage.note}</p>
                <span
                  className={`status-chip status-chip--${stage.state === "done" ? "done" : stage.state === "doing" ? "attention" : "idle"}`}
                >
                  {stage.status}
                </span>
                {/* ขั้นที่มีหน้าจอของตัวเองต้องเข้าถึงได้จากการ์ด ไม่ใช่ให้ผู้ใช้เดา URL เอง */}
                {stage.href ? (
                  <Button tone="quiet" href={stage.href} arrow>
                    {stage.linkLabel}</Button>
                ) : null}
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
              <Button tone="primary" href={`/apps/estimeter/projects/${project.id}/takeoff`} arrow>
                ไปหน้าถอดปริมาณ</Button>
            </div>
          ) : (
            <>
              <div className="workspace-callout">
                <div>
                  <strong>ยอดรวมของปริมาณที่ยืนยันแล้ว</strong>
                  <p>รวมแยกตามหน่วยและไม่ปัดค่า ยังไม่มีการคิดราคาในขั้นนี้</p>
                </div>
                <Button tone="primary" href={`/apps/estimeter/projects/${project.id}/takeoff`} arrow>
                  เปิดหน้าถอดปริมาณ</Button>
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

        {/* เคยห่อด้วย `hero__actions` ซึ่งเป็นคลาสของแถบปุ่มบนหน้าขาย ไม่ใช่หน้าทำงาน
            คลาสที่ยืมมาจากหน้าคนละชนิด คือทางที่หน้าสองหน้าเริ่มขยับตามกันโดยไม่มีใครตั้งใจ */}
        {/* ทางเข้าหน้าหลักฐานการคำนวณ (IP-243) · อยู่ตรงนี้เพราะมันคือของที่หยิบไปใช้
            หลังทำงานเสร็จ ไม่ใช่ขั้นตอนหนึ่งของงาน จึงไม่ควรไปแทรกในบันไดสี่ขั้นข้างบน */}
        <div className="workspace-foot">
          <Button tone="quiet" href={`/apps/estimeter/projects/${project.id}/evidence`} arrow>
            หลักฐานการคำนวณ พิมพ์ออกได้
          </Button>
          <Button tone="quiet" href="/apps/estimeter">กลับหน้าโครงการทั้งหมด</Button>
        </div>
      </div>
    </section>
  );
}
