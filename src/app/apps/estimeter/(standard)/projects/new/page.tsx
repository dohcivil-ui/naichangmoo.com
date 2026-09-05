import { EstimeterEntryBlocked } from "@/components/estimeter/entry-blocked";
import { ProjectForm } from "@/components/estimeter/project-form";
import { projectCreationDenial } from "@/lib/estimeter-project";
import { resolveEstimeterContext } from "@/server/estimeter/context";
import { Button } from "@/components/platform/button";

export default async function NewEstimeterProjectPage() {
  const result = await resolveEstimeterContext();
  if (!result.ok) return <EstimeterEntryBlocked reason={result.reason} />;

  // Checked here as well as in the action: reaching this page must not imply permission.
  const denial = projectCreationDenial(result.context.access);

  return (
    <section className="estimation-workspace">
      <div className="container">
        <div className="workspace-panel">
          <div className="workspace-panel__title">
            <div>
              <p className="eyebrow">01 · NEW PROJECT</p>
              <h2>ตั้งค่าโครงการประมาณราคา</h2>
            </div>
            <span className={denial ? "status-chip status-chip--attention" : "status-chip"}>
              {denial ? "สร้างไม่ได้" : "กรอกชื่อโครงการ"}
            </span>
          </div>

          {denial ? (
            <>
              <p className="hero__note">{denial}</p>
              <div className="hero__actions">
                <Button tone="primary" href="/apps/estimeter">กลับหน้าโครงการ</Button>
                <Button tone="ink" href="/enterprise">ขอใบเสนอราคาสำหรับองค์กร</Button>
              </div>
            </>
          ) : (
            <ProjectForm />
          )}
        </div>
      </div>
    </section>
  );
}
