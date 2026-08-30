import { RevisionForm } from "@/components/estimeter/revision-form";
import { AUTHORITY_LABEL } from "@/lib/price-authority";
import { formatPrice } from "@/lib/price-catalogue";
import { formatThaiDateTime } from "@/lib/thai-format";
import type { PriceSetLineView, PriceSetSummary } from "@/server/estimeter/price-set-repository";

/**
 * ชุดราคาที่รับมาจาก PRICEMETR — ฝั่งรับของ IP-163
 *
 * แสดงหลักฐานรายบรรทัดครบ ไม่ใช่แค่ชื่อกับราคา เพราะเหตุผลทั้งหมดที่ช่องหลักฐานถูกเก็บ
 * ตั้งแต่ตอนหยิบคือเพื่อให้บรรทัดนี้ตอบได้ว่ามาจากประกาศฉบับไหน เดือนไหน หน้าไหน
 * การเก็บมาแล้วไม่แสดงคือการเก็บเปล่า
 *
 * ไม่มีปุ่มแก้อะไรทั้งนั้น ชุดราคาที่โครงการถืออยู่ต้องนิ่งตาม ADR 0008 แก้ตะกร้าที่ PRICEMETR
 * แล้วส่งเข้ามาใหม่เป็นชุดถัดไป ไม่ใช่แก้ของที่ส่งมาแล้ว
 */

const SOURCE_LABEL: Record<string, string> = {
  tpso: "สนค. กระทรวงพาณิชย์",
  obec: "บัญชีราคา สพฐ. 2569",
  cgd: "กรมบัญชีกลาง ว809"
};

function evidenceOf(line: PriceSetLineView): string {
  const parts = [SOURCE_LABEL[line.sourceKey] ?? line.sourceKey];
  if (line.effectiveMonth) parts.push(`เดือน ${line.effectiveMonth}`);
  if (line.documentPage) parts.push(`หน้า ${line.documentPage}`);
  if (line.rateCondition) parts.push(line.rateCondition);
  parts.push(`รหัส ${line.catalogCode}`);
  return parts.join(" · ");
}

export function PriceSetPanel({
  priceSets,
  linesBySet,
  projectId,
  projectName,
  canEdit,
  lockReason
}: {
  priceSets: PriceSetSummary[];
  linesBySet: Record<string, PriceSetLineView[]>;
  projectId: string;
  projectName: string;
  canEdit: boolean;
  lockReason: string | null;
}) {
  if (priceSets.length === 0) {
    return (
      <div className="workspace-panel">
        <div className="workspace-panel__title">
          <div>
            <p className="eyebrow">PRICE SET</p>
            <h2>ชุดราคาของโครงการนี้</h2>
          </div>
          <span className="status-chip status-chip--attention">ยังไม่มีชุดราคา</span>
        </div>
        <div className="prelim-boq-note">
          <div>
            <strong>ยังไม่มีชุดราคาที่ส่งเข้ามาในโครงการนี้</strong>
            <p>
              หยิบราคาที่แอปราคาวัสดุและค่าแรง แล้วกดส่งเข้าโครงการนี้ ทุกบรรทัดจะพาแหล่ง
              เดือนประกาศ และเลขหน้าเอกสารมาด้วย จึงตรวจย้อนได้ว่าตัวเลขมาจากประกาศฉบับไหน
            </p>
          </div>
          <a className="button button--orange micro-button" href="/prototype/price-check">
            ไปหน้าราคาวัสดุและค่าแรง <span>→</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-panel">
      <div className="workspace-panel__title">
        <div>
          <p className="eyebrow">PRICE SET</p>
          <h2>ชุดราคาของโครงการนี้</h2>
        </div>
        <span className="status-chip status-chip--ready">รับมาแล้ว {priceSets.length} ชุด</span>
      </div>

      <p className="workspace-notice">
        ชุดราคาที่รับมาแล้ว<strong>แก้ที่นี่ไม่ได้</strong> เพราะเอกสารที่อ้างอิงชุดนี้ต้องตรวจย้อนกลับได้เสมอ
        ถ้าราคาเปลี่ยน ให้แก้ที่รายการซึ่งหยิบไว้แล้วส่งเข้ามาเป็นชุดถัดไป
      </p>

      {priceSets.map((set) => (
        <section key={set.id} className="price-set">
          <header className="price-set__head">
            <div>
              <h3>{set.name}</h3>
              <p>
                {set.lineCount} บรรทัด · จังหวัด {set.provinceCode} · เดือน {set.effectiveMonth} ·
                รับเข้า {formatThaiDateTime(set.createdAt)} · {AUTHORITY_LABEL[set.authoritySource]}
              </p>
            </div>
            <div className="price-set__total">
              <span>ค่างานต้นทุนรวม</span>
              <strong>{formatPrice(set.totalSatang)}</strong>
              <small>&nbsp;บาท</small>
            </div>
          </header>

          <div className="takeoff-table-wrap">
            <table className="takeoff-table">
              <thead>
                <tr>
                  <th>รายการและที่มา</th>
                  <th className="number-cell">ราคาต่อหน่วย</th>
                  <th className="number-cell">ปริมาณ</th>
                  <th className="number-cell">เป็นเงิน</th>
                </tr>
              </thead>
              <tbody>
                {(linesBySet[set.id] ?? []).map((line) => (
                  <tr key={line.id}>
                    <td>
                      <strong>{line.name}</strong>
                      <small>{evidenceOf(line)}</small>
                    </td>
                    <td className="number-cell">
                      {formatPrice(line.unitSatang)}
                      <small> บาท/{line.unit}</small>
                    </td>
                    <td className="number-cell">{line.quantity.toLocaleString("th-TH")}</td>
                    <td className="number-cell">
                      {formatPrice(BigInt(Math.round(Number(line.unitSatang) * line.quantity)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="form-note">
            ลายนิ้วมือของชุดนี้ <code>{set.payloadHash.slice(0, 16)}</code> · คิดจากบรรทัดที่คัดลอกมาจริง
            ณ วินาทีที่รับเข้า ไม่ใช่จากรายการต้นทางในวันนั้น
          </p>

          <RevisionForm
            projectId={projectId}
            priceSetId={set.id}
            authority={set.authoritySource}
            canEdit={canEdit}
            lockReason={lockReason}
          />
        </section>
      ))}

      {/* คั่นด้วย · แบบชัดเจน เพราะ JSX เชื่อมชื่อโครงการกับประโยคถัดไปติดกันจนอ่านผิด */}
      <p className="form-note">
        ราคาในชุดนี้เป็นราคาสืบของผู้ประกาศแต่ละราย ไม่ใช่ราคากลางของโครงการ {projectName} · การนำไปขึ้นแบบ
        ปร.4 ต้องผ่านการทบทวนก่อนเสมอ
      </p>
    </div>
  );
}
