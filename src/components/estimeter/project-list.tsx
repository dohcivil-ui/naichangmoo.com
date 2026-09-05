import Link from "next/link";
import { formatThaiDateTime } from "@/lib/thai-format";
import type { ProjectSummary } from "@/server/estimeter/project-repository";
import { Button } from "@/components/platform/button";

const projectStateLabel: Record<string, string> = {
  draft: "ร่าง",
  active: "กำลังทำงาน",
  locked: "ล็อกแล้ว",
  archived: "เก็บถาวร"
};

export function ProjectList({
  projects,
  denial,
  quotaLabel
}: {
  projects: ProjectSummary[];
  denial: string | null;
  quotaLabel: string;
}) {
  return (
    <div className="workspace-panel">
      <div className="workspace-panel__title">
        <div>
          <p className="eyebrow">PROJECTS · โครงการของบัญชีนี้</p>
          <h2>โครงการประมาณราคา</h2>
        </div>
        <span className="status-chip">{quotaLabel}</span>
      </div>

      {projects.length === 0 ? (
        <p className="hero__note">ยังไม่มีโครงการในบัญชีนี้ เริ่มจากตั้งชื่อโครงการก่อน แล้วจึงตรวจแบบและถอดปริมาณตามลำดับ</p>
      ) : (
        <div className="takeoff-table-wrap">
          <table className="takeoff-table">
            <thead>
              <tr>
                <th>ชื่อโครงการ</th>
                <th>สถานะ</th>
                <th>สร้างเมื่อ</th>
                <th>เปิดโครงการ</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td>{project.name}</td>
                  <td>{projectStateLabel[project.state] ?? project.state}</td>
                  <td>{formatThaiDateTime(project.createdAt)}</td>
                  <td>
                    <Link className="evidence-link" href={`/apps/estimeter/projects/${project.id}`}>เปิด</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="workspace-callout">
        <div>
          <strong>{denial ? "สร้างโครงการใหม่ไม่ได้" : "เริ่มโครงการใหม่"}</strong>
          <p>{denial ?? "ตั้งชื่อโครงการเพื่อเริ่มงาน แล้วระบบจะพาไปตามลำดับ ตรวจแบบ ถอดปริมาณ ประมาณราคา และสรุป BOQ"}</p>
        </div>
        {denial ? (
          <Button tone="primary" href="/enterprise">ขอใบเสนอราคาสำหรับองค์กร</Button>
        ) : (
          <Button tone="primary" href="/apps/estimeter/projects/new" arrow>สร้างโครงการ</Button>
        )}
      </div>
    </div>
  );
}
