import { EstimeterEntryBlocked } from "@/components/estimeter/entry-blocked";
import { EstimeterHomeAssistant } from "@/components/estimeter/home-assistant";
import { EstimeterHomeBoard, type ResumeView } from "@/components/estimeter/home-board";
import { TrialActivation } from "@/components/estimeter/trial-activation";
import { formatScaleRatio } from "@/lib/drawing-scale";
import { toAccessView } from "@/lib/estimeter-access-view";
import { homeAssistantScript } from "@/lib/estimeter-home-assistant";
import {
  currentStage,
  firstRunStages,
  homeStages,
  nextActionLine,
  type HomeProgress
} from "@/lib/estimeter-home-status";
import { projectCreationDenial } from "@/lib/estimeter-project";
import { summarizeConfirmedQuantities } from "@/lib/takeoff-summary";
import { resolveEstimeterContext } from "@/server/estimeter/context";
import { summarizeDrawingProgress } from "@/server/estimeter/drawing-repository";
import { listPriceSets } from "@/server/estimeter/price-set-repository";
import { listProjects, type ProjectSummary } from "@/server/estimeter/project-repository";
import { listRevisions } from "@/server/estimeter/revision-repository";
import { getOpenManualRun, listManualRuns, listRunItems } from "@/server/estimeter/takeoff-repository";

/**
 * หน้าแรกของ ESTIMETR — เนื้อในตามต้นแบบ `variant-b-ours-dense` ที่เจ้าของงานเลือก (IP-235)
 *
 * **หน้านี้ไม่วาดแถบบน ไม่วาดพาดหัวแอป ไม่วาดท้ายเว็บ** `AppShell` ใน `layout.tsx` ให้ครบแล้ว
 *
 * ความคืบหน้าสี่ขั้นคิดจากโครงการที่แก้ไขล่าสุดใบเดียว ไม่ใช่ทุกใบ เพราะหนึ่งใบต้องอ่านฐาน
 * สี่รอบ การคิดให้ทุกใบจึงเป็นจำนวนคำสั่งที่โตตามจำนวนโครงการ โดยที่หน้านี้แสดงการ์ดเดียวอยู่ดี
 * ถ้าวันหนึ่งต้องบอกขั้นที่ค้างของทุกใบ ทางที่ถูกคือคำสั่งรวมยอดสี่คำสั่ง ไม่ใช่วนลูปเรียกสี่คูณ N
 */
async function readProgress(organizationId: string, project: ProjectSummary): Promise<HomeProgress> {
  const drawing = await summarizeDrawingProgress(organizationId, project.id);
  const openRun = await getOpenManualRun(organizationId, project.id);
  const runs = await listManualRuns(organizationId, project.id);
  const items = openRun ? await listRunItems(organizationId, openRun.id) : [];
  const priceSets = await listPriceSets(organizationId, project.id);
  const revisions = await listRevisions(organizationId, project.id);

  return {
    drawing: {
      documentCount: drawing.documentCount,
      pageCount: drawing.pageCount,
      calibratedPages: drawing.calibratedPages,
      scaleLabel: drawing.latest ? formatScaleRatio(drawing.latest.scale) : null,
      latestPage: drawing.latest?.pageNumber ?? null
    },
    takeoff: {
      itemCount: items.length,
      // ยืนยันแล้วนับจากยอดที่สรุปได้จริง ตรงกับที่หน้าโครงการนับ ไม่ใช่ตัวนับแยกของหน้านี้
      confirmedItems: summarizeConfirmedQuantities(items).reduce((total, row) => total + row.itemCount, 0),
      closedRuns: runs.filter((run) => run.state === "succeeded").length
    },
    pricing: { priceSetCount: priceSets.length, revisionCount: revisions.length }
  };
}

export default async function EstimeterHomePage() {
  const result = await resolveEstimeterContext();
  if (!result.ok) return <EstimeterEntryBlocked reason={result.reason} />;

  const { access } = result.context;
  // A member who has not activated the trial may still own an organization with earlier work,
  // so the list is read whenever an organization exists, activated or not.
  const projects = access.organizationId ? await listProjects(access.organizationId) : [];
  // "ล่าสุด" คือแก้ไขล่าสุด ไม่ใช่สร้างล่าสุด — คนกลับมาทำงานต่อที่ใบที่เพิ่งแตะ ไม่ใช่ใบที่เพิ่งเปิด
  const newest = [...projects].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null;

  const progress = newest && access.organizationId ? await readProgress(access.organizationId, newest) : null;
  const stages = progress ? homeStages(progress) : firstRunStages();
  const resume: ResumeView | null =
    newest && progress
      ? {
          project: newest,
          stage: { id: currentStage(progress), label: stages[currentStage(progress) - 1].label },
          todo: nextActionLine(progress)
        }
      : null;

  const script = homeAssistantScript({ project: newest && progress ? { name: newest.name, progress } : null });

  return (
    <>
      {access.state === "not_activated" ? (
        <section className="eh eh--activate">
          <div className="container">
            <TrialActivation />
          </div>
        </section>
      ) : null}
      <EstimeterHomeBoard
        stages={stages}
        resume={resume}
        projects={projects}
        denial={projectCreationDenial(access)}
        access={toAccessView(access)}
      />
      <EstimeterHomeAssistant script={script} />
    </>
  );
}
