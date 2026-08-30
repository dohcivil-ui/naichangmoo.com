import { formatPrice } from "@/lib/price-catalogue";
import { TAKEOFF_CATEGORIES, categoryLabel, unitLabel } from "@/lib/takeoff-units";
import type { BoqLineView } from "@/server/estimeter/boq-repository";

/**
 * บรรทัด BOQ ของฉบับคำนวณล่าสุด (IP-217)
 *
 * ทุกบรรทัดตอบได้สามอย่างพร้อมกัน — ปริมาณมาจากรายการถอดแบบไหน ราคามาจากบรรทัดไหน
 * ในชุดราคา และใครเป็นคนจับคู่ ผู้ช่วยหรือคน สามอย่างนี้คือสิ่งที่ทำให้ยอดนี้ตรวจย้อนได้
 *
 * **ยอดคำนวณที่ฐานข้อมูลจากราคาที่เก็บไว้ ไม่ได้เก็บยอดซ้ำ** ตาราง `boq_items` ไม่มีช่องเงิน
 * เลยสักช่อง ยอดที่เห็นจึงไม่มีทางขัดกับราคาต้นทางได้
 */

const SOURCE_LABEL: Record<string, string> = {
  tpso: "สนค. กระทรวงพาณิชย์",
  obec: "บัญชีราคา สพฐ. 2569",
  cgd: "กรมบัญชีกลาง ว809"
};

/**
 * จัดกลุ่มตามลำดับหมวดของ `TAKEOFF_CATEGORIES` ไม่ใช่ลำดับที่ข้อมูลบังเอิญมา
 *
 * ลำดับหมวดคือลำดับที่ใบ ปร.4 เดิน งานดินมาก่อนงานโครงสร้าง ไม่ใช่เรียงตามตัวอักษรหรือ
 * ตามว่าใครกดรับก่อน หมวดที่ไม่มีรายการจะไม่ขึ้น เพราะใบเปล่าไม่ได้บอกอะไรนอกจากกินที่
 */
type CategoryGroup = { code: string; label: string; lines: BoqLineView[] };

function groupByCategory(lines: BoqLineView[]): CategoryGroup[] {
  return TAKEOFF_CATEGORIES.map<CategoryGroup>((category) => ({
    code: category.code,
    label: category.label,
    lines: lines.filter((line) => line.category === category.code)
  }))
    .concat(
      // หมวดที่ไม่รู้จัก เช่น รหัสเก่าที่ถูกถอดออกจากรายการแล้ว ต้องยังมองเห็นได้ ไม่ใช่หายเงียบ
      [...new Set(lines.map((line) => line.category))]
        .filter((code) => !TAKEOFF_CATEGORIES.some((category) => category.code === code))
        .map((code) => ({ code, label: categoryLabel(code), lines: lines.filter((line) => line.category === code) }))
    )
    .filter((group) => group.lines.length > 0);
}

export function BoqPanel({ lines, revisionLabel }: { lines: BoqLineView[]; revisionLabel: string | null }) {
  const total = lines.reduce((sum, line) => sum + line.amountSatang, 0n);
  const groups = groupByCategory(lines);

  return (
    <div className="workspace-panel">
      <div className="workspace-panel__title">
        <div>
          <p className="eyebrow">BOQ</p>
          <h2>รายการ BOQ ของฉบับล่าสุด</h2>
        </div>
        <span className={lines.length > 0 ? "status-chip status-chip--ready" : "status-chip status-chip--attention"}>
          {lines.length > 0 ? `รับแล้ว ${lines.length} บรรทัด` : "ยังไม่มีบรรทัด"}
        </span>
      </div>

      {lines.length === 0 ? (
        <p className="workspace-notice">
          ยังไม่มีบรรทัดที่รับเข้า{revisionLabel ? ` ${revisionLabel}` : "ฉบับคำนวณ"} ·
          เปิดผู้ช่วยจัดทำ BOQ ที่แผงผู้ช่วย แล้วให้มันจับคู่ปริมาณที่ยืนยันแล้วกับชุดราคาที่รับมา
          จากนั้นติ๊กรับทีละคู่
        </p>
      ) : (
        <>
          <p className="workspace-notice">
            บรรทัดของ <strong>{revisionLabel}</strong> · แยกตามหมวดงานเหมือนที่ใบ ปร.4 แยก ·
            ปริมาณเป็นสำเนา ณ วินาทีที่รับคู่ แก้รายการถอดปริมาณทีหลังแล้วบรรทัดนี้ไม่ขยับตาม
          </p>

          <div className="boq-category-summary">
            {groups.map((group) => (
              <article key={group.code}>
                <span>{group.label}</span>
                <strong>{formatPrice(group.lines.reduce((sum, line) => sum + line.amountSatang, 0n))}</strong>
                <small>{group.lines.length} บรรทัด</small>
              </article>
            ))}
          </div>

          <div className="takeoff-table-wrap">
            {/* คลาส boq-table มีไว้ให้ small เป็น block เหมือนที่แผงชุดราคาทำ ไม่งั้นชื่อรายการ
                กับบรรทัดที่มาจะต่อกันเป็นประโยคเดียว แบบเดียวกับบั๊ก PRICEMETRการนำไป ใน v0.94.0 */}
            <table className="takeoff-table boq-table">
              <thead>
                <tr>
                  <th>รายการและที่มาของราคา</th>
                  <th className="number-cell">ราคาต่อหน่วย</th>
                  <th className="number-cell">ปริมาณ</th>
                  <th className="number-cell">เป็นเงิน</th>
                </tr>
              </thead>
              {groups.map((group) => (
                <tbody key={group.code}>
                  <tr className="boq-table__heading">
                    <th colSpan={3} scope="colgroup">
                      {group.label}
                    </th>
                    <td className="number-cell">
                      {formatPrice(group.lines.reduce((sum, line) => sum + line.amountSatang, 0n))}
                    </td>
                  </tr>
                  {group.lines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      <strong>{line.description}</strong>
                      <small>
                        {line.priceName} · {SOURCE_LABEL[line.sourceKey] ?? line.sourceKey}
                        {line.effectiveMonth ? ` · เดือน ${line.effectiveMonth}` : ""}
                      </small>
                      <small>
                        {line.matchedBy === "assistant"
                          ? `ผู้ช่วยเสนอและมีคนรับ · ความมั่นใจ ${line.matchConfidence ?? "ไม่ระบุ"}`
                          : "คนจับคู่เอง"}
                      </small>
                    </td>
                    <td className="number-cell">
                      {formatPrice(line.unitSatang)}
                      {/* หน่วยของชั้นถอดปริมาณเก็บเป็นรหัส ต้องแปลงเป็นคำไทยก่อนขึ้นจอเสมอ */}
                      <small> บาท/{unitLabel(line.unit)}</small>
                    </td>
                    <td className="number-cell">{line.quantity.toLocaleString("th-TH")}</td>
                    <td className="number-cell">{formatPrice(line.amountSatang)}</td>
                  </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          <div className="workspace-callout">
            <div>
              <strong>ค่างานต้นทุนรวมของฉบับนี้</strong>
              <p>ยังไม่ได้คูณตัวคูณของวิธีคิด การคูณ Factor F และการขึ้นแบบ ปร.4 เป็นขั้นถัดไป</p>
            </div>
            <div className="price-set__total">
              <strong>{formatPrice(total)}</strong>
              <small>&nbsp;บาท</small>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
