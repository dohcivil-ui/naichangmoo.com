"use client";

import { useId, useState } from "react";
import { bahtText, formatBaht } from "@/lib/thai-baht";
import { formatThaiDate } from "@/lib/thai-format";
import { formatPercent } from "@/lib/work-plan";
import type { MilestoneSchedule } from "@/lib/payment-milestone";
import {
  acceptLogo,
  logoVisible,
  signatureName,
  signaturePosition,
  type DocumentSignatory,
  type WorkPlanDocumentMeta
} from "@/lib/work-plan-document-meta";

/**
 * เอกสารบัญชีงวดงาน–งวดเงิน สำหรับพิมพ์แนบสัญญาจ้าง
 *
 * งานจบที่กระดาษที่ยื่นได้จริง ไม่ใช่จบที่หน้าจอ เอกสารนี้จึงถูกจัดตามค่ามาตรฐานของ
 * หนังสือราชการไทย ไม่ใช่ตามที่หน้าจอสวย: กระดาษ A4 ขอบซ้าย 3 ซม. ขอบขวา 2 ซม.
 * ขอบบน 2.5 ซม. ขอบล่าง 2 ซม. และตัวอักษร TH Sarabun 16 พอยต์ ระยะบรรทัดเดี่ยว
 * (ค่าเหล่านี้อยู่ในบล็อก print ของ globals.css ซึ่งเป็นที่เดียวที่ควบคุมหน้ากระดาษได้จริง)
 *
 * สามอย่างที่แยกเอกสารนี้ออกจากรายงานทั่วไป:
 *
 * หนึ่ง — **หัวกระดาษมีโลโก้ที่เปลี่ยนได้และปิดได้** เพราะผู้รับเหมาแต่ละรายยื่นในนามบริษัทตัวเอง
 * เอกสารที่บังคับโลโก้ของผู้ทำเครื่องมือ คือเอกสารที่เอาไปยื่นไม่ได้
 *
 * สอง — **ช่องลงนามมีวงเล็บเสมอ** แม้ยังไม่ได้กรอกชื่อ เพราะผู้ใช้จำนวนมากพิมพ์ออกมาแล้ว
 * เขียนชื่อด้วยปากกา ถ้าซ่อนวงเล็บตอนยังไม่มีชื่อ ก็เท่ากับบังคับให้กรอกในระบบก่อนถึงจะใช้กระดาษได้
 *
 * สาม — **ยอดทุกช่องมาจาก buildMilestoneSchedule** ซึ่งคิดด้วย BigInt satang ตรวจย้อนได้ทุกบาท
 * และยอดรวมทุกงวดเท่ามูลค่าสัญญาเป๊ะ ท้ายเอกสารพิมพ์ยอดเป็นตัวอักษรตามแบบราชการ
 */
export function WorkPlanDocument({
  projectName,
  schedule,
  activityTitlesByMilestone,
  meta,
  onMeta,
  onClose
}: {
  projectName: string;
  schedule: MilestoneSchedule;
  /** ชื่อกิจกรรมที่ต้องแล้วเสร็จในแต่ละงวด key คือ milestoneId */
  activityTitlesByMilestone: Record<string, string[]>;
  meta: WorkPlanDocumentMeta;
  onMeta: (next: WorkPlanDocumentMeta) => void;
  onClose: () => void;
}) {
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileId = useId();

  const patch = (next: Partial<WorkPlanDocumentMeta>) => onMeta({ ...meta, ...next });
  const patchSigner = (key: "contractor" | "employer", next: Partial<DocumentSignatory>) =>
    onMeta({ ...meta, [key]: { ...meta[key], ...next } });

  /**
   * อ่านไฟล์ที่ผู้ใช้เลือกเป็น data URI แล้วให้ acceptLogo ตัดสิน
   *
   * ตรวจหลังอ่านเสร็จ ไม่ใช่ตรวจจาก `file.size` ก่อน เพราะสิ่งที่กินที่เก็บของเบราว์เซอร์จริง
   * คือข้อความฐาน 64 ซึ่งใหญ่กว่าไฟล์ต้นทางราวหนึ่งในสาม การตรวจขนาดไฟล์ดิบจึงปล่อยรูป
   * ที่เกินเพดานจริงผ่านเข้ามาได้
   */
  const chooseLogo = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => setLogoError("อ่านไฟล์ไม่สำเร็จ ลองเลือกใหม่อีกครั้ง");
    reader.onload = () => {
      const result = acceptLogo(String(reader.result ?? ""));
      if (!result.ok) {
        setLogoError(result.reason);
        return;
      }
      setLogoError(null);
      patch({ logoDataUri: result.dataUri, showLogo: true });
    };
    reader.readAsDataURL(file);
  };

  const assignedPpm = 1_000_000n - schedule.unassignedWeightPpm;

  return (
    <div className="work-plan__doc-overlay" role="dialog" aria-label="เอกสารบัญชีงวดงาน">
      <div className="work-plan__doc-toolbar">
        <p className="eyebrow">เอกสารพร้อมพิมพ์ · กระดาษ A4 ตามระเบียบงานสารบรรณ</p>
        <div className="work-plan__doc-toolbar-actions">
          <button type="button" className="button button--orange micro-button" onClick={() => window.print()}>
            พิมพ์ หรือบันทึกเป็น PDF
          </button>
          <button type="button" className="button button--ghost micro-button" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>

      {/* แผงตั้งค่าไม่ติดไปกับกระดาษ บล็อก print ซ่อนไว้ */}
      <div className="work-plan__doc-settings">
        <div className="work-plan__doc-field">
          <span>โลโก้บนหัวกระดาษ</span>
          <div className="work-plan__doc-logo-actions">
            <label className="button button--ghost micro-button" htmlFor={fileId}>
              {meta.logoDataUri === "" ? "ใส่โลโก้" : "เปลี่ยนโลโก้"}
            </label>
            <input
              id={fileId}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="work-plan__doc-file"
              onChange={(event) => chooseLogo(event.target.files?.[0])}
            />
            {meta.logoDataUri === "" ? null : (
              <>
                <button
                  type="button"
                  className="button button--ghost micro-button"
                  aria-pressed={meta.showLogo}
                  onClick={() => patch({ showLogo: !meta.showLogo })}
                >
                  {meta.showLogo ? "ไม่แสดงโลโก้" : "แสดงโลโก้"}
                </button>
                <button
                  type="button"
                  className="button button--ghost micro-button"
                  onClick={() => {
                    setLogoError(null);
                    patch({ logoDataUri: "", showLogo: true });
                  }}
                >
                  เอาโลโก้ออก
                </button>
              </>
            )}
          </div>
          {logoError ? (
            <p className="form-error" role="alert">
              {logoError}
            </p>
          ) : (
            <p className="form-note">รับ PNG JPG WEBP ไม่เกิน 200 กิโลไบต์ · พิมพ์ในกรอบ 28 มิลลิเมตร</p>
          )}
        </div>

        <label>
          ผู้ว่าจ้าง
          <input
            className="work-plan__cell"
            value={meta.employerName}
            placeholder="เช่น เทศบาลตำบลหนองแสง"
            onChange={(event) => patch({ employerName: event.target.value })}
          />
        </label>
        <label>
          เลขที่สัญญา
          <input
            className="work-plan__cell"
            value={meta.contractNumber}
            placeholder="เช่น จ.12/2569"
            onChange={(event) => patch({ contractNumber: event.target.value })}
          />
        </label>
        <label>
          สถานที่ก่อสร้าง
          <input
            className="work-plan__cell"
            value={meta.siteName}
            placeholder="เช่น ต.ในเมือง อ.เมือง จ.นครราชสีมา"
            onChange={(event) => patch({ siteName: event.target.value })}
          />
        </label>
        <label>
          วันที่บนเอกสาร
          <input
            type="date"
            className="work-plan__cell"
            value={meta.documentDate}
            onChange={(event) => patch({ documentDate: event.target.value })}
          />
        </label>

        {(
          [
            ["contractor", "ผู้รับจ้าง"],
            ["employer", "ผู้ว่าจ้าง"]
          ] as const
        ).map(([key, label]) => (
          <div className="work-plan__doc-field" key={key}>
            <span>ผู้ลงนามฝ่าย{label}</span>
            <div className="work-plan__doc-signer">
              <input
                className="work-plan__cell"
                value={meta[key].name}
                placeholder="ชื่อ-นามสกุล"
                aria-label={`ชื่อผู้ลงนามฝ่าย${label}`}
                onChange={(event) => patchSigner(key, { name: event.target.value })}
              />
              <input
                className="work-plan__cell"
                value={meta[key].position}
                placeholder="ตำแหน่ง"
                aria-label={`ตำแหน่งผู้ลงนามฝ่าย${label}`}
                onChange={(event) => patchSigner(key, { position: event.target.value })}
              />
            </div>
            <p className="form-note">เว้นว่างไว้ได้ วงเล็บบนกระดาษยังอยู่ให้เขียนด้วยปากกา</p>
          </div>
        ))}
      </div>

      <div className="work-plan__doc-scroll">
        <div className="work-plan__paper">
          <table className="work-plan__paper-head-table">
            <tbody>
              <tr>
                {logoVisible(meta) ? (
                  <td className="work-plan__paper-logo" rowSpan={3}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- รูปเป็น data URI ของผู้ใช้เอง ไม่ผ่านตัวปรับขนาดของ Next */}
                    <img src={meta.logoDataUri} alt="" />
                  </td>
                ) : null}
                <th scope="row">โครงการ</th>
                <td>{projectName || <span className="work-plan__paper-blank" />}</td>
                <th scope="row">เลขที่สัญญา</th>
                <td>{meta.contractNumber || <span className="work-plan__paper-blank" />}</td>
              </tr>
              <tr>
                <th scope="row">ผู้ว่าจ้าง</th>
                <td>{meta.employerName || <span className="work-plan__paper-blank" />}</td>
                <th scope="row">วันที่</th>
                <td>{formatThaiDate(meta.documentDate) ?? <span className="work-plan__paper-blank" />}</td>
              </tr>
              <tr>
                <th scope="row">สถานที่ก่อสร้าง</th>
                <td colSpan={3}>{meta.siteName || <span className="work-plan__paper-blank" />}</td>
              </tr>
            </tbody>
          </table>

          <header className="work-plan__paper-head">
            <h1>บัญชีแสดงงวดงานและงวดเงิน</h1>
            <p>แนบท้ายสัญญาจ้าง</p>
          </header>

          <table className="work-plan__paper-table">
            <thead>
              <tr>
                <th>งวดที่</th>
                <th>งานที่ต้องแล้วเสร็จ</th>
                <th className="work-plan__paper-num">ร้อยละ</th>
                <th className="work-plan__paper-num">จำนวนเงิน (บาท)</th>
              </tr>
            </thead>
            <tbody>
              {schedule.rows.map((row) => (
                <tr key={row.milestoneId}>
                  <td className="work-plan__paper-num">{row.ordinal}</td>
                  <td>
                    <strong>{row.title}</strong>
                    <span className="work-plan__paper-works">
                      {(activityTitlesByMilestone[row.milestoneId] ?? []).join(" · ") || "ยังไม่ได้ผูกงาน"}
                    </span>
                  </td>
                  <td className="work-plan__paper-num">{formatPercent(row.weightPpm)}</td>
                  <td className="work-plan__paper-num">{formatBaht(row.periodWorkSatang)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>รวมทั้งสิ้น</td>
                <td className="work-plan__paper-num">{formatPercent(assignedPpm)}</td>
                <td className="work-plan__paper-num">{formatBaht(schedule.totalWorkSatang)}</td>
              </tr>
            </tfoot>
          </table>

          <p className="work-plan__paper-words">
            รวมเป็นเงินทั้งสิ้น <strong>{bahtText(schedule.totalWorkSatang)}</strong>
          </p>

          <p className="work-plan__paper-note">
            หมายเหตุ ฐานการหักเงินประกันผลงาน คืนเงินล่วงหน้า ภาษีมูลค่าเพิ่ม และภาษีหัก ณ ที่จ่าย
            เป็นไปตามเงื่อนไขในสัญญาแต่ละฉบับ ให้ตรวจกับสัญญาจริงก่อนใช้ยื่นเบิก
          </p>

          <div className="work-plan__paper-signs">
            {(
              [
                ["contractor", "ผู้รับจ้าง"],
                ["employer", "ผู้ว่าจ้าง"]
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <p className="work-plan__paper-sign-line">
                  ลงชื่อ <span className="work-plan__paper-line" />
                </p>
                <p className="work-plan__paper-sign-name">({signatureName(meta[key])})</p>
                {signaturePosition(meta[key]) === "" ? null : (
                  <p className="work-plan__paper-sign-position">{signaturePosition(meta[key])}</p>
                )}
                <p className="work-plan__paper-sign-role">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
