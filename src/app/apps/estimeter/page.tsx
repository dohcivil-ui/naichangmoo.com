import { EntitlementStatus } from "@/components/estimeter/entitlement-status";
import { EstimeterEntryBlocked } from "@/components/estimeter/entry-blocked";
import { EstimationWorkspace } from "@/components/estimeter/estimation-workspace";
import { ProjectList } from "@/components/estimeter/project-list";
import { toAccessView } from "@/lib/estimeter-access-view";
import { projectCreationDenial } from "@/lib/estimeter-project";
import { resolveEstimeterContext } from "@/server/estimeter/context";
import { listProjects } from "@/server/estimeter/project-repository";

export default async function EstimeterHomePage() {
  const result = await resolveEstimeterContext();
  if (!result.ok) return <EstimeterEntryBlocked reason={result.reason} />;

  const { access } = result.context;
  const projects = await listProjects(access.organizationId);
  const quotaLabel =
    access.projectLimit === null
      ? `${projects.length} โครงการ`
      : `ใช้ไปแล้ว ${projects.length} จาก ${access.projectLimit} โครงการ`;

  return (
    <>
      <section className="estimation-workspace">
        <div className="container">
          <header className="estimation-workspace__head">
            <div>
              <p className="eyebrow">ESTIMETR · ประมาณราคางานอาคาร</p>
              <h1>เลือกโครงการ หรือเริ่มโครงการใหม่</h1>
              <p className="estimation-workspace__lead">
                ทุกโครงการเดินตามลำดับเดียวกัน ตรวจแบบ ถอดปริมาณพร้อมหลักฐาน ประมาณราคาจาก price set ที่อนุมัติ แล้วจึงสรุป BOQ
              </p>
            </div>
          </header>
          <EntitlementStatus access={toAccessView(access)} />
          <ProjectList projects={projects} denial={projectCreationDenial(access)} quotaLabel={quotaLabel} />
        </div>
      </section>
      <EstimationWorkspace access={toAccessView(access)} />
    </>
  );
}
