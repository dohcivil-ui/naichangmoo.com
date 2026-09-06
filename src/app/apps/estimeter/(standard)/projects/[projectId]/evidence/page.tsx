import { notFound } from "next/navigation";
import { EstimeterEntryBlocked } from "@/components/estimeter/entry-blocked";
import { PrintButton } from "@/components/estimeter/print-button";
import { calibrationMethodKind } from "@/lib/drawing-calibration-method";
import { formatMetres } from "@/lib/drawing-measurement";
import { POINTS_PER_METRE } from "@/lib/drawing-scale";
import {
  buildProjectEvidence,
  pagesAwaitingScale,
  type EvidenceSourceDocument
} from "@/lib/project-evidence";
import { formatThaiDateTime } from "@/lib/thai-format";
import { resolveEstimeterContext } from "@/server/estimeter/context";
import { loadProjectEvidence } from "@/server/estimeter/drawing-repository";
import { getProject } from "@/server/estimeter/project-repository";
import { Button } from "@/components/platform/button";

/**
 * หน้าเต็มของหลักฐานการคำนวณทั้งโครงการ ที่พิมพ์ออกไปวางบนโต๊ะประชุมได้ (IP-243)
 *
 * **ทำไมต้องมีทั้งสองที่** แผงกางต่อหนึ่งแถวในหน้าแบบตอบคนที่กำลังทำงานอยู่ตรงนั้น
 * ฉบับนี้ตอบคนที่ไม่ได้นั่งอยู่หน้าจอ · เจ้าของงานเคาะเมื่อ 2026-09-05 ว่าเอาทั้งสองที่
 *
 * **ไม่มีรูปจากแบบติดไปด้วย และนั่นเป็นข้อจำกัดจริง ไม่ใช่ทางเลือก** ไฟล์ PDF ไม่เคยขึ้นมา
 * อยู่บนเซิร์ฟเวอร์ — `registerDrawingDocument` เก็บที่อยู่ไฟล์เป็นคำว่า `unstored:<checksum>`
 * เพราะไบต์ยังอยู่บนเครื่องของคนที่เปิด · หน้านี้จึงเป็นตัวหนังสือล้วน
 * (เจ้าของงานเคาะเมื่อ 2026-09-06 ว่าเอาตัวหนังสือก่อน เรื่องรูปค่อยว่ากัน)
 *
 * **เป็น Server Component เต็มตัว** เปิดจากเครื่องไหนก็ได้โดยไม่ต้องเปิดไฟล์แบบก่อน
 * ซึ่งเป็นเหตุผลทั้งหมดที่มันคุ้มที่จะมีแยกจากแผงในหน้าแบบ
 *
 * **หัวเรื่องบนจอเป็น h2 ไม่ใช่ h1** เพราะ `AppShell` ใส่ h1 ของแอปให้แล้ว
 * หัวเรื่องซ้อนสองชั้นอ่านเหมือนความผิดพลาดของการจัดหน้า ไม่ใช่ลำดับชั้น
 */
export default async function EstimeterEvidencePage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const result = await resolveEstimeterContext();
  if (!result.ok) return <EstimeterEntryBlocked reason={result.reason} />;

  const { projectId } = await params;
  const organizationId = result.context.access.organizationId;
  // ไม่มีองค์กรก็ไม่มีโครงการของตัวเอง และ id นั้นถือว่าไม่พบ ไม่ใช่ถูกงัดต่อ
  // การจำกัดด้วยองค์กรยังทำให้ id ขององค์กรอื่นแยกไม่ออกจาก id ที่ไม่มีอยู่จริง
  if (!organizationId) notFound();

  const project = await getProject(organizationId, projectId);
  if (!project) notFound();

  const stored = await loadProjectEvidence(organizationId, project.id);

  /**
   * แปลงสิ่งที่ฐานเก็บให้เป็นรูปทรงที่ตัวรวมหลักฐานรับ
   *
   * สเกลเก็บเป็นเมตรต่อจุดอย่างเดียว ส่วนตัวหารของสเกลคิดกลับที่นี่ด้วยตัวเดียวกับที่
   * `summarizeDrawingProgress` ใช้ · หน้าที่ยังไม่ยืนยันสเกลไม่มีแถวใน `drawing_calibrations`
   * เลย จึงต้องไล่จากเลขหน้าที่มีรอยวัดด้วย ไม่ใช่ไล่จากหน้าที่มีสเกลอย่างเดียว
   * มิฉะนั้นหน้าที่วัดไว้แล้วแต่ยังไม่ตั้งสเกลจะหายไปจากเอกสารเงียบ ๆ
   */
  const documents: EvidenceSourceDocument[] = stored.map((document) => {
    const byPage = new Map<number, EvidenceSourceDocument["pages"][number]>();

    for (const calibration of document.calibrations) {
      byPage.set(calibration.pageNumber, {
        pageNumber: calibration.pageNumber,
        scale: {
          metresPerPoint: calibration.metresPerPoint,
          ratio: calibration.metresPerPoint * POINTS_PER_METRE
        },
        method: calibration.method,
        confirmedAt: calibration.confirmedAt,
        dimensions: calibration.dimensions,
        marks: []
      });
    }

    for (const [pageNumber, marks] of Object.entries(document.marks)) {
      const page = Number(pageNumber);
      const existing = byPage.get(page);
      if (existing) {
        byPage.set(page, { ...existing, marks });
        continue;
      }
      byPage.set(page, {
        pageNumber: page,
        scale: null,
        method: null,
        confirmedAt: null,
        dimensions: [],
        marks
      });
    }

    return { documentId: document.documentId, checksum: document.checksum, pages: [...byPage.values()] };
  });

  const evidence = buildProjectEvidence(documents);
  const awaiting = pagesAwaitingScale(evidence);
  const issuedAt = formatThaiDateTime(new Date());

  return (
    <div className="container">
      <section className="evidence-screen">
        <h2>หลักฐานการคำนวณ</h2>
        <p>
          ทุกตัวเลขในเอกสารนี้เป็นตัวเดียวกับที่หน้าแบบคำนวณ ไม่ได้คิดใหม่
          กดพิมพ์แล้วได้กระดาษ A4 ที่เอาไปวางบนโต๊ะประชุมได้
        </p>
        <p className="evidence-screen__actions">
          <PrintButton />
          <Button href={`/apps/estimeter/projects/${project.id}`} tone="quiet">
            กลับไปหน้าโครงการ
          </Button>
        </p>
      </section>

      <article className="evidence-doc">
        <header className="evidence-doc__masthead">
          <div>
            <h2>{project.name}</h2>
            {project.agencyName ? <p>{project.agencyName}</p> : null}
            {project.siteLocation ? <p>{project.siteLocation}</p> : null}
          </div>
          <div>
            <p>หลักฐานการคำนวณปริมาณ</p>
            {issuedAt ? <p>ออกเอกสาร {issuedAt}</p> : null}
          </div>
        </header>

        <table className="evidence-doc__totals">
          <tbody>
            <tr>
              <th scope="row">รายการที่วัดแล้วทั้งโครงการ</th>
              <td>{evidence.rowCount} รายการ</td>
            </tr>
            {/* ยอดที่เป็นศูนย์ไม่ขึ้น เพราะ "ความยาวรวม 0.00 ม." อ่านเหมือนวัดแล้วได้ศูนย์
                ซึ่งไม่ใช่ความจริง ความจริงคือโครงการนี้ยังไม่มีการวัดความยาวเลย */}
            {evidence.totalAreaSquareMetres > 0 ? (
              <tr>
                <th scope="row">พื้นที่รวม</th>
                <td>{formatMetres(evidence.totalAreaSquareMetres)} ตร.ม.</td>
              </tr>
            ) : null}
            {evidence.totalLengthMetres > 0 ? (
              <tr>
                <th scope="row">ความยาวรวม</th>
                <td>{formatMetres(evidence.totalLengthMetres)} ม.</td>
              </tr>
            ) : null}
            {evidence.totalCount > 0 ? (
              <tr>
                <th scope="row">จำนวนที่นับได้รวม</th>
                <td>{evidence.totalCount} จุด</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        {evidence.openQuestions.length > 0 || awaiting.length > 0 ? (
          <section className="evidence-doc__open">
            <h3>สิ่งที่เอกสารนี้ยังตอบไม่ได้</h3>
            <ul>
              {awaiting.length > 0 ? (
                <li>
                  หน้า {awaiting.join(" ")} มีรอยวัดแล้วแต่ยังไม่ยืนยันสเกล
                  ปริมาณของหน้าเหล่านั้นจึงยังไม่ถูกนับเข้ายอดรวมข้างบน
                </li>
              ) : null}
              {evidence.openQuestions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {evidence.documents.length === 0 ? (
          <p className="evidence-doc__empty">
            โครงการนี้ยังไม่มีรอยวัดหรือสเกลที่ยืนยันแล้ว จึงยังไม่มีอะไรให้เป็นหลักฐาน
            เปิดแบบแล้ววัดบนหน้าแบบก่อน
          </p>
        ) : null}

        {evidence.documents.map((document) => (
          <div key={document.documentId}>
            {evidence.documents.length > 1 ? (
              <p className="evidence-doc__scale">แบบฉบับลายนิ้วมือ {document.checksum.slice(0, 12)}</p>
            ) : null}

            {document.pages.map((page) => (
              <section className="evidence-doc__page" key={`${document.documentId}-${page.pageNumber}`}>
                <h2>หน้า {page.pageNumber}</h2>
                <p className="evidence-doc__scale">
                  {page.scale ? (
                    <>
                      สเกล 1:{page.scale.ratio.toFixed(2)}
                      {page.method ? ` ตั้งจาก${calibrationMethodKind(page.method).label}` : ""}
                      {page.confirmedAt ? ` เมื่อ ${formatThaiDateTime(page.confirmedAt)}` : ""}
                      {" · "}
                      {page.worstGap
                        ? `เทียบกับระยะที่แบบเขียนไว้ ${page.dimensionCount} เส้น คลาดมากที่สุด ${
                            page.worstGap.percent >= 0 ? "+" : ""
                          }${page.worstGap.percent.toFixed(2)}%`
                        : "หน้านี้ไม่มีระยะที่แบบเขียนให้เทียบ จึงยังบอกไม่ได้ว่าสเกลคลาดกี่เปอร์เซ็นต์"}
                    </>
                  ) : (
                    "หน้านี้ยังไม่ยืนยันสเกล จุดบนกระดาษจึงยังแปลงเป็นเมตรไม่ได้"
                  )}
                </p>

                {page.rows.map((row) => (
                  <article className="evidence-doc__row" key={row.id}>
                    <h3>
                      {row.name || row.kindLabel}
                      {" · "}
                      {row.value.areaSquareMetres !== null
                        ? `${formatMetres(row.value.areaSquareMetres)} ตร.ม.`
                        : row.value.lengthMetres !== null
                          ? `${formatMetres(row.value.lengthMetres)} ม.`
                          : row.value.count !== null
                            ? `${row.value.count} จุด`
                            : "ยังคำนวณไม่ได้"}
                    </h3>
                    {row.evidence ? (
                      <dl>
                        {row.evidence.steps.map((step) => (
                          <div key={step.question}>
                            <dt>{step.question}</dt>
                            <dd>
                              {step.answer}
                              {step.working ? (
                                <span className="evidence-doc__working">{step.working}</span>
                              ) : null}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </article>
                ))}

                {page.rows.length === 0 ? (
                  <p>หน้านี้ยืนยันสเกลไว้แล้วแต่ยังไม่มีรายการวัด</p>
                ) : (
                  <table className="evidence-doc__totals">
                    <tbody>
                      <tr>
                        <th scope="row">รวมหน้า {page.pageNumber}</th>
                        <td>
                          {page.totalAreaSquareMetres > 0
                            ? `${formatMetres(page.totalAreaSquareMetres)} ตร.ม.`
                            : ""}
                          {page.totalAreaSquareMetres > 0 && page.totalLengthMetres > 0 ? " · " : ""}
                          {page.totalLengthMetres > 0 ? `${formatMetres(page.totalLengthMetres)} ม.` : ""}
                          {page.totalCount > 0 ? ` · ${page.totalCount} จุด` : ""}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </section>
            ))}
          </div>
        ))}
      </article>
    </div>
  );
}
