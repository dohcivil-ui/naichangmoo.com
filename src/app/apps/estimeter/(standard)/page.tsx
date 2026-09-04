import { EntitlementStatus } from "@/components/estimeter/entitlement-status";
import { EstimeterEntryBlocked } from "@/components/estimeter/entry-blocked";
import { ProjectList } from "@/components/estimeter/project-list";
import { TrialActivation } from "@/components/estimeter/trial-activation";
import { toAccessView } from "@/lib/estimeter-access-view";
import { projectCreationDenial } from "@/lib/estimeter-project";
import { resolveEstimeterContext } from "@/server/estimeter/context";
import { listProjects } from "@/server/estimeter/project-repository";

export default async function EstimeterHomePage() {
  const result = await resolveEstimeterContext();
  if (!result.ok) return <EstimeterEntryBlocked reason={result.reason} />;

  const { access } = result.context;
  // A member who has not activated the trial may still own an organization with earlier work,
  // so the list is read whenever an organization exists, activated or not.
  const projects = access.organizationId ? await listProjects(access.organizationId) : [];
  const quotaLabel =
    access.projectLimit === null
      ? `${projects.length} โครงการ`
      : `ใช้ไปแล้ว ${projects.length} จาก ${access.projectLimit} โครงการ`;

  if (access.state === "not_activated") {
    return (
      <section className="estimation-workspace">
        <div className="container">
          <header className="estimation-workspace__head">
            <div>
              <p className="eyebrow">ESTIMETR · ประมาณราคางานอาคาร</p>
              <h1>ยินดีต้อนรับ เริ่มทดลองใช้เมื่อพร้อม</h1>
              <p className="estimation-workspace__lead">
                ESTIMETR ทำงานตามลำดับเดียวกันทุกโครงการ ตรวจแบบ ถอดปริมาณพร้อมหลักฐาน ประมาณราคาจาก price set ที่อนุมัติ แล้วจึงสรุป BOQ
              </p>
            </div>
          </header>
          <TrialActivation />
          {projects.length > 0 ? (
            <ProjectList projects={projects} denial={projectCreationDenial(access)} quotaLabel={quotaLabel} />
          ) : null}
        </div>
      </section>
    );
  }

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
      {/*
       * พื้นที่สาธิต `EstimationWorkspace` ถูกถอดออกจากหน้าแรกเมื่อ 2026-09-04
       *
       * มันวางลำดับงาน 01 ถึง 04 ของตัวเองไว้ใต้รายการโครงการจริง พร้อมผู้ช่วยของตัวเอง
       * และใช้ชื่อขั้นคนละชุดกับหน้าโครงการ คนเปิดแอปครั้งแรกจึงเห็นลำดับงานสองชุด
       * และแยกไม่ออกว่าอันไหนของจริง · เจ้าของงานสั่งเอาออก
       *
       * ตัวคอมโพเนนต์ยังอยู่ ยังไม่ลบ เผื่อทำเป็นหน้า "ดูตัวอย่างการทำงาน" แยกทีหลัง
       */}
    </>
  );
}
