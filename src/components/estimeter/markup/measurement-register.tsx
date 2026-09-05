"use client";

import { Fragment } from "react";
import {
  formatMetres,
  measurementKindLabel,
  type MeasurementRow,
  type MeasurementSummary
} from "@/lib/drawing-measurement";
import type { MeasurementEvidence } from "@/lib/measurement-evidence";

/**
 * ตารางรายการวัดที่จัดกลุ่มตามหน้าแบบ พร้อมสรุปรวมตามชนิด (IP-228)
 *
 * **แถวสรุปของแต่ละหน้าไม่รวมรายการที่ยังรอสเกล** และรายการเหล่านั้นขึ้นคำว่ารอสเกลไว้ตรงตัว
 * การนับค่าที่ยังไม่มีสเกลเป็นศูนย์แล้วบวกเข้ายอดรวมคือการทำให้ยอดรวมโกหกโดยไม่มีใครเห็น
 *
 * คอมโพเนนต์นี้ไม่คำนวณอะไรเลย ตัวเลขทุกตัวมาจาก `summarise` ใน `src/lib/drawing-measurement.ts`
 * ซึ่งมีเทสต์เดินตรวจอยู่ ที่นี่เหลือแต่การจัดวาง
 *
 * **ที่มาของตัวเลขก็ไม่ได้คิดที่นี่เหมือนกัน** ผู้เรียกส่งฟังก์ชัน `evidenceFor` มาให้
 * เพราะมันต้องรู้จักสเกลของหน้า วิธีตั้งสเกล และระยะที่แบบเขียน ซึ่งเป็นของที่หน้าแบบถืออยู่
 * ไม่ใช่ของตาราง · ตัวกางอยู่ที่ `measurement-evidence.ts` (IP-242)
 */

type Props = {
  summary: MeasurementSummary;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  /** ส่งรายการนี้เข้าถอดปริมาณ — ปุ่มขึ้นเฉพาะรายการที่ยังไม่ส่งและมีตัวเลขแล้ว (IP-234) */
  onFile: (id: string) => void;
  /** id ของรายการที่ส่งเข้าถอดปริมาณแล้ว รายการพวกนี้ล็อก ลบและแก้ชื่อไม่ได้ */
  filedIds: ReadonlySet<string>;
  currentPage: number;
  onGoToPage: (page: number) => void;
  /** ขั้นตอนที่พาไปถึงตัวเลขของแถวนั้น · คืน null เมื่อกางไม่ได้ แถวนั้นจะไม่มีที่ให้กาง */
  evidenceFor: (row: MeasurementRow) => MeasurementEvidence | null;
};

export function MeasurementRegister({
  summary,
  selectedId,
  onSelect,
  onRename,
  onRemove,
  onFile,
  filedIds,
  currentPage,
  onGoToPage,
  evidenceFor
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
                  <span className="sr-only">ส่งเข้าถอดปริมาณหรือลบ</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row) => {
                const { measurement, value } = row;
                const filed = filedIds.has(measurement.id);
                const evidence = evidenceFor(row);
                return (
                <Fragment key={measurement.id}>
                <tr
                  onClick={() => onSelect(measurement.id)}
                  aria-selected={measurement.id === selectedId}
                  data-filed={filed ? "true" : undefined}
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
                      readOnly={filed}
                      title={filed ? "รายการนี้ส่งเข้าถอดปริมาณแล้ว แก้ชื่อได้จากหน้าถอดปริมาณ" : undefined}
                    />
                    {filed ? <span className="markup-register__filed">ส่งแล้ว</span> : null}
                  </td>
                  <td>{measurementKindLabel[measurement.kind]}</td>
                  <td>
                    {value.blockedByScale
                      ? "รอสเกล"
                      : value.lengthMetres !== null
                        ? formatMetres(value.lengthMetres)
                        : value.count !== null
                          ? `${value.count} จุด`
                          : "—"}
                  </td>
                  <td>
                    {value.areaSquareMetres !== null ? formatMetres(value.areaSquareMetres) : "—"}
                  </td>
                  <td className="markup-register__actions">
                    {filed ? null : (
                      <>
                        {value.blockedByScale ? null : (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onFile(measurement.id);
                            }}
                            aria-label={`ส่งรายการ ${measurement.name || measurementKindLabel[measurement.kind]} เข้าถอดปริมาณ`}
                          >
                            ส่งเข้าถอดปริมาณ
                          </button>
                        )}
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
                      </>
                    )}
                  </td>
                </tr>
                {evidence ? (
                  <tr className="markup-register__evidence-row">
                    <td colSpan={5}>
                      <details className="markup-register__evidence">
                        <summary>ที่มาของตัวเลขนี้</summary>
                        <dl>
                          {evidence.steps.map((step) => (
                            <div key={step.question}>
                              <dt>{step.question}</dt>
                              <dd>
                                {step.answer}
                                {step.working ? (
                                  <span className="markup-register__working mk__num">{step.working}</span>
                                ) : null}
                              </dd>
                            </div>
                          ))}
                        </dl>
                        {evidence.openQuestions.length > 0 ? (
                          <ul className="markup-register__unknown">
                            {evidence.openQuestions.map((question) => (
                              <li key={question}>{question}</li>
                            ))}
                          </ul>
                        ) : null}
                      </details>
                    </td>
                  </tr>
                ) : null}
                </Fragment>
                );
              })}
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
