import Link from "next/link";
import type { EstimeterAccessView } from "@/lib/estimeter-access-view";
import type { HomeStage } from "@/lib/estimeter-home-status";
import { formatThaiDateTime } from "@/lib/thai-format";
import type { ProjectSummary } from "@/server/estimeter/project-repository";
import { EntitlementStrip } from "@/components/estimeter/entitlement-status";

/**
 * เนื้อในของหน้าแรก ESTIMETR (IP-235)
 *
 * **ไม่มีแถบบน ไม่มีพาดหัวแอป ไม่มีท้ายเว็บในไฟล์นี้โดยตั้งใจ** — `AppShell` ใน `layout.tsx`
 * วางให้แล้วทั้งสามอย่าง การวาดพาดหัวซ้ำตรงนี้จะได้หัวเรื่องสองชั้นซ้อนกัน ซึ่งคอมเมนต์ใน
 * `app-shell.tsx` เตือนไว้ว่าคนอ่านจะอ่านเป็นความผิดพลาดของเลย์เอาต์ ไม่ใช่เป็นลำดับชั้น
 *
 * **ผู้ช่วยไม่ได้อยู่ในไฟล์นี้** มันเสียบเข้าแผงผู้ช่วยกลางผ่าน `EstimeterHomeAssistant`
 * ต้นแบบวาดผู้ช่วยเป็นคอลัมน์ขวาในหน้า แต่แพลตฟอร์มมีช่องผู้ช่วยช่องเดียวตาม IP-185
 *
 * **ทุกตัวเลขบนหน้านี้อ่านมาจากฐาน** ป้ายสถานะสี่ขั้นและบรรทัดสีส้มคำนวณใน
 * `estimeter-home-status.ts` ซึ่งมีเทสต์กำกับทุกกรณี ไม่มีเลขไหนพิมพ์ไว้ตายในไฟล์นี้
 */

const projectStateLabel: Record<string, string> = {
  draft: "ร่าง",
  active: "กำลังทำงาน",
  locked: "ล็อกแล้ว",
  archived: "เก็บถาวร"
};

function Steps({ stages }: { stages: HomeStage[] }) {
  const here = stages.find((stage) => stage.tone === "now")?.id ?? 0;
  return (
    <div className="eh__steps">
      {stages.map((stage) => (
        <article key={stage.id} data-here={String(here === stage.id)}>
          <span className="eh__n">{stage.id}</span>
          <h3>{stage.label}</h3>
          <p>{stage.note}</p>
          <span className={`eh__badge eh__badge--${stage.tone}`}>{stage.badge}</span>
        </article>
      ))}
    </div>
  );
}

export type ResumeView = {
  project: ProjectSummary;
  /** ขั้นที่ค้างอยู่ พร้อมชื่อขั้น — มาจาก currentStage ไม่ใช่จากสถานะของแถวโครงการ */
  stage: { id: number; label: string };
  /** บรรทัดสีส้ม บอกสิ่งถัดไปที่ต้องทำ */
  todo: string;
};

export function EstimeterHomeBoard({
  stages,
  resume,
  projects,
  denial,
  access
}: {
  stages: HomeStage[];
  /** null = เปิดครั้งแรก ยังไม่มีโครงการ */
  resume: ResumeView | null;
  projects: ProjectSummary[];
  /** เหตุผลที่สร้างโครงการใหม่ไม่ได้ · null = สร้างได้ */
  denial: string | null;
  access: EstimeterAccessView;
}) {
  return (
    <section className="eh">
      <div className="container">
        <Steps stages={stages} />

        {resume ? (
          <section className="eh__card">
            <p className="eh__over">ทำงานต่อ</p>
            <h2>งานที่ค้างอยู่</h2>

            <div className="eh__resume">
              <h3>{resume.project.name}</h3>
              <p className="eh__where">
                ค้างที่ขั้น <span className="eh__num">{resume.stage.id}</span> จาก <span className="eh__num">4</span> ·{" "}
                {resume.stage.label} · แก้ไขล่าสุด {formatThaiDateTime(resume.project.updatedAt)}
              </p>
              <p className="eh__todo">{resume.todo}</p>
              <div className="eh__row">
                <Link className="eh__go" href={`/apps/estimeter/projects/${resume.project.id}/markup`}>
                  เปิดหน้าแบบ ทำงานต่อ
                </Link>
                <Link className="eh__line" href={`/apps/estimeter/projects/${resume.project.id}`}>
                  ดูหน้าโครงการ
                </Link>
              </div>
            </div>

            {/* คอลัมน์ "สถานะ" ในตารางนี้เป็นสถานะของแถวโครงการ ไม่ใช่ขั้นที่ค้าง — ขั้นที่ค้าง
                ต้องอ่านฐานสี่รอบต่อหนึ่งโครงการ จึงคิดให้เฉพาะใบที่ยกขึ้นมาเป็นการ์ดข้างบน */}
            <table className="eh__table">
              <thead>
                <tr>
                  <th>ชื่อโครงการ</th>
                  <th>สถานะ</th>
                  <th>แก้ไขล่าสุด</th>
                  <th>เปิดโครงการ</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id}>
                    <td><b>{project.name}</b></td>
                    <td>{projectStateLabel[project.state] ?? project.state}</td>
                    <td>{formatThaiDateTime(project.updatedAt)}</td>
                    <td>
                      <Link className="evidence-link" href={`/apps/estimeter/projects/${project.id}`}>เปิด</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="eh__row">
              {denial ? (
                <Link className="eh__line" href="/enterprise">ขอใบเสนอราคาสำหรับองค์กร</Link>
              ) : (
                <Link className="eh__line" href="/apps/estimeter/projects/new">เริ่มโครงการใหม่</Link>
              )}
            </div>
            {denial ? <p className="eh__deny">{denial}</p> : null}
          </section>
        ) : (
          <section className="eh__card">
            <p className="eh__over">เริ่มต้น</p>
            <h2>เริ่มโครงการแรก</h2>
            <p>
              ใส่ชื่อโครงการ ชื่อผู้ประมาณราคา และประเภทงาน แล้วเปิดไฟล์แบบ PDF เข้ามา
              จากนั้นระบบจะพาไปทีละขั้นจนได้ BOQ
            </p>
            <div className="eh__row">
              {denial ? (
                <Link className="eh__line" href="/enterprise">ขอใบเสนอราคาสำหรับองค์กร</Link>
              ) : (
                <Link className="eh__go" href="/apps/estimeter/projects/new">ตั้งค่าโครงการ</Link>
              )}
            </div>
            {denial ? <p className="eh__deny">{denial}</p> : null}
          </section>
        )}

        <EntitlementStrip access={access} />
      </div>
    </section>
  );
}
