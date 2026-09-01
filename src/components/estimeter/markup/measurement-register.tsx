"use client";

import {
  formatMetres,
  measurementKindLabel,
  type MeasurementSummary
} from "@/lib/drawing-measurement";

/**
 * ตารางรายการวัดที่จัดกลุ่มตามหน้าแบบ พร้อมสรุปรวมตามชนิด (IP-228)
 *
 * **แถวสรุปของแต่ละหน้าไม่รวมรายการที่ยังรอสเกล** และรายการเหล่านั้นขึ้นคำว่ารอสเกลไว้ตรงตัว
 * การนับค่าที่ยังไม่มีสเกลเป็นศูนย์แล้วบวกเข้ายอดรวมคือการทำให้ยอดรวมโกหกโดยไม่มีใครเห็น
 *
 * คอมโพเนนต์นี้ไม่คำนวณอะไรเลย ตัวเลขทุกตัวมาจาก `summarise` ใน `src/lib/drawing-measurement.ts`
 * ซึ่งมีเทสต์เดินตรวจอยู่ ที่นี่เหลือแต่การจัดวาง
 */

type Props = {
  summary: MeasurementSummary;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  currentPage: number;
  onGoToPage: (page: number) => void;
};

export function MeasurementRegister({
  summary,
  selectedId,
  onSelect,
  onRename,
  onRemove,
  currentPage,
  onGoToPage
}: Props) {
  if (summary.pages.length === 0) {
    return (
      <p className="markup-register__empty">
        ยังไม่มีรายการวัด เลือกเครื่องมือด้านบนแล้วคลิกบนแบบเพื่อเริ่ม
      </p>
    );
  }

  return (
    <div className="markup-register">
      {summary.hasBlockedRows ? (
        <p className="markup-register__warning" role="status">
          มีรายการที่ยังไม่มีสเกลของหน้านั้น ค่าจึงยังคำนวณไม่ได้และไม่ถูกนับเข้ายอดรวม
        </p>
      ) : null}

      {summary.pages.map((group) => (
        <section key={group.page} className="markup-register__page">
          <h3>
            <button
              type="button"
              onClick={() => onGoToPage(group.page)}
              aria-current={group.page === currentPage ? "page" : undefined}
            >
              หน้า {group.page}
            </button>
            <span>{group.rows.length} รายการ</span>
          </h3>

          <table>
            <thead>
              <tr>
                <th scope="col">ชื่อ</th>
                <th scope="col">ชนิด</th>
                <th scope="col">ความยาว (ม.)</th>
                <th scope="col">พื้นที่ (ตร.ม.)</th>
                <th scope="col">
                  <span className="sr-only">ลบ</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map(({ measurement, value }) => (
                <tr
                  key={measurement.id}
                  onClick={() => onSelect(measurement.id)}
                  aria-selected={measurement.id === selectedId}
                >
                  <td>
                    <span
                      className="markup-register__swatch"
                      style={{ background: measurement.colour }}
                      aria-hidden="true"
                    />
                    <input
                      value={measurement.name}
                      placeholder="ตั้งชื่อรายการ"
                      onChange={(event) => onRename(measurement.id, event.target.value)}
                      aria-label={`ชื่อของรายการที่ ${measurement.id}`}
                    />
                  </td>
                  <td>{measurementKindLabel[measurement.kind]}</td>
                  <td>
                    {value.blockedByScale
                      ? "รอสเกล"
                      : value.lengthMetres !== null
                        ? formatMetres(value.lengthMetres)
                        : value.perimeterMetres !== null
                          ? `รอบรูป ${formatMetres(value.perimeterMetres)}`
                          : value.count !== null
                            ? `${value.count} จุด`
                            : "—"}
                  </td>
                  <td>
                    {value.areaSquareMetres !== null ? formatMetres(value.areaSquareMetres) : "—"}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemove(measurement.id);
                      }}
                      aria-label={`ลบรายการ ${measurement.name || measurementKindLabel[measurement.kind]}`}
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={2}>
                  รวมหน้า {group.page}
                </th>
                <td>{formatMetres(group.totalLengthMetres)}</td>
                <td>{formatMetres(group.totalAreaSquareMetres)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </section>
      ))}

      <section className="markup-register__total">
        <h3>สรุปรวมทุกหน้า</h3>
        <table>
          <thead>
            <tr>
              <th scope="col">ชนิด</th>
              <th scope="col">จำนวน</th>
              <th scope="col">ความยาว (ม.)</th>
              <th scope="col">พื้นที่ (ตร.ม.)</th>
            </tr>
          </thead>
          <tbody>
            {summary.kinds.map((total) => (
              <tr key={total.kind}>
                <th scope="row">{measurementKindLabel[total.kind]}</th>
                <td>{total.kind === "count" ? total.count : total.items}</td>
                <td>{total.lengthMetres > 0 ? formatMetres(total.lengthMetres) : "—"}</td>
                <td>{total.areaSquareMetres > 0 ? formatMetres(total.areaSquareMetres) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
