import { AUTHORITY_LABEL, COSTING_METHOD_LABEL, type CostingMethod } from "@/lib/price-authority";
import { formatPrice } from "@/lib/price-catalogue";
import { formatThaiDateTime } from "@/lib/thai-format";
import type { EstimateRevisionView } from "@/server/estimeter/revision-repository";

/**
 * ฉบับคำนวณของโครงการ (IP-216)
 *
 * **แสดงทั้งสองวิธีคู่กันเสมอ แม้วิธีหนึ่งยังไม่มีฉบับเลย** ตาม ADR 0008 ข้อ 4 ที่บอกว่า
 * โครงการไม่มี "ฉบับปัจจุบัน" เดี่ยว ๆ การแสดงเฉพาะวิธีที่มีของ จะทำให้คนอ่านเข้าใจว่า
 * เลขที่เห็นคือเลขเดียวของโครงการ ทั้งที่อีกวิธีให้เลขคนละตัวบนปริมาณชุดเดียวกัน
 *
 * เลขฉบับของสองวิธีเทียบกันไม่ได้ ฉบับที่ 2 ของ Factor F ไม่ได้ใหม่กว่าฉบับที่ 3 ของอีกวิธี
 * หน้าจอจึงเขียนวิธีกำกับเลขทุกครั้ง ไม่มีที่ไหนที่เลขฉบับยืนอยู่ลำพัง
 */

const METHODS: CostingMethod[] = ["factor_f", "contractor_cost"];

export function RevisionPanel({ revisions }: { revisions: EstimateRevisionView[] }) {
  const byMethod = new Map<CostingMethod, EstimateRevisionView[]>(
    METHODS.map((method) => [method, revisions.filter((revision) => revision.costingMethod === method)])
  );

  return (
    <div className="workspace-panel">
      <div className="workspace-panel__title">
        <div>
          <p className="eyebrow">ESTIMATE REVISION</p>
          <h2>ฉบับคำนวณของโครงการนี้</h2>
        </div>
        <span className={revisions.length > 0 ? "status-chip status-chip--ready" : "status-chip status-chip--attention"}>
          {revisions.length > 0 ? `ออกแล้ว ${revisions.length} ฉบับ` : "ยังไม่มีฉบับคำนวณ"}
        </span>
      </div>

      <p className="workspace-notice">
        <strong>เลขฉบับนับแยกตามวิธีคิดราคา</strong> โครงการเดียวจึงมีฉบับทั้งสองแบบบนปริมาณชุดเดียวกันได้
        และเลขฉบับของคนละวิธีเทียบกันไม่ได้ · ฉบับเกิดจากชุดราคาที่รับมาแล้วเสมอ ออกได้ที่แผงชุดราคาด้านบน
      </p>

      <div className="revision-columns">
        {METHODS.map((method) => {
          const rows = byMethod.get(method) ?? [];
          return (
            <section key={method} className="revision-column">
              <header>
                <h3>{COSTING_METHOD_LABEL[method]}</h3>
                <span>{rows.length > 0 ? `ล่าสุดคือฉบับที่ ${rows[0].revisionNumber}` : "ยังไม่มีฉบับของวิธีนี้"}</span>
              </header>

              {rows.length === 0 ? (
                <p className="form-note">
                  {method === "factor_f"
                    ? "ออกได้เมื่อมีชุดราคาที่ทุกบรรทัดมาจากบัญชีที่หน่วยงานรัฐประกาศ"
                    : "ออกได้จากชุดราคาที่รับมาแล้วทุกชุด"}
                </p>
              ) : (
                <ol className="revision-list">
                  {rows.map((revision) => (
                    <li key={revision.id}>
                      <div className="revision-list__head">
                        <strong>ฉบับที่ {revision.revisionNumber}</strong>
                        <span>{formatPrice(revision.totalSatang)} บาท</span>
                      </div>
                      <small>
                        {revision.priceSetName} · {revision.lineCount} บรรทัด ·{" "}
                        {AUTHORITY_LABEL[revision.priceSetAuthority]}
                      </small>
                      <small>ออกเมื่อ {formatThaiDateTime(revision.createdAt)}</small>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          );
        })}
      </div>

      <p className="form-note">
        ยอดที่แสดงคือค่างานต้นทุนรวมของชุดราคาที่ฉบับนั้นอ้าง <strong>ยังไม่ได้คูณตัวคูณของวิธีคิด</strong>
        {" "}การคูณ Factor F และการขึ้นแบบ ปร.4 ถึง ปร.6 เป็นงานขั้นถัดไปที่ยังไม่เปิด
      </p>
    </div>
  );
}
