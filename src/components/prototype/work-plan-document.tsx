"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
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
  const [showSettings, setShowSettings] = useState(false);
  const [zoom, setZoom] = useState<"fit" | "full">("fit");
  const [fitScale, setFitScale] = useState(1);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileId = useId();

  /**
   * ย่อกระดาษให้พอดีความกว้างที่เหลือ เหมือนตัวอย่างก่อนพิมพ์ของโปรแกรมอ่าน PDF
   *
   * กระดาษถูกตั้งเป็นขนาด A4 จริงคือ 210 มิลลิเมตร ซึ่งเบราว์เซอร์แปลงเป็น 793.7 พิกเซล
   * ที่การย่อขยายปกติ (96 พิกเซลต่อนิ้ว) ตัวเลขนี้จึงเป็นค่าคงที่ ไม่ต้องวัดจากหน้าจอ
   * แล้วย่อด้วย transform เพื่อให้ผู้ใช้เห็นสัดส่วนหน้ากระดาษจริง ไม่ใช่กล่องที่ยืดเต็มจอ
   * ซึ่งทำให้ระยะขอบดูไม่ตรงกับที่จะพิมพ์ออกมา
   */
  const A4_WIDTH_PX = 793.7;
  const A4_HEIGHT_PX = 1122.5;

  /**
   * พอดีหน้าจอคือเห็นทั้งแผ่น ไม่ใช่พอดีความกว้าง
   *
   * รอบแรกคิดจากความกว้างอย่างเดียว ผลคือบนจอกว้างค่าที่ได้เท่ากับหนึ่งพอดี
   * ปุ่มพอดีหน้าจอกับขนาดจริงจึงให้ผลเหมือนกันเป๊ะ กดแล้วไม่มีอะไรเปลี่ยน
   * ซึ่งอ่านได้อย่างเดียวว่าปุ่มเสีย ตัวอย่างก่อนพิมพ์ของโปรแกรมอ่าน PDF คิดทั้งสองด้าน
   * เพื่อให้เห็นทั้งหน้ากระดาษในคราวเดียว
   */
  const measure = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const byWidth = (stage.clientWidth - 48) / A4_WIDTH_PX;
    const byHeight = (stage.clientHeight - 60) / A4_HEIGHT_PX;
    setFitScale(Math.max(0.2, Math.min(1, byWidth, byHeight)));
  }, []);

  useEffect(() => {
    measure();
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [measure, showSettings]);

  const scale = zoom === "fit" ? fitScale : 1;

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
          <div className="work-plan__view" role="group" aria-label="ขนาดที่แสดง">
            <button
              type="button"
              className={zoom === "fit" ? "is-on" : undefined}
              aria-pressed={zoom === "fit"}
              onClick={() => setZoom("fit")}
            >
              พอดีหน้าจอ
            </button>
            <button
              type="button"
              className={zoom === "full" ? "is-on" : undefined}
              aria-pressed={zoom === "full"}
              onClick={() => setZoom("full")}
            >
              ขนาดจริง
            </button>
          </div>
          <button
            type="button"
            className="button button--ghost micro-button"
            aria-pressed={showSettings}
            onClick={() => setShowSettings((open) => !open)}
          >
            {showSettings ? "ปิดแผงตั้งค่า" : "ตั้งค่าเอกสาร"}
          </button>
          <button type="button" className="button button--orange micro-button" onClick={() => window.print()}>
            พิมพ์ หรือบันทึกเป็น PDF
          </button>
          <button type="button" className="button button--ghost micro-button" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>

      <div className={showSettings ? "work-plan__doc-body is-open" : "work-plan__doc-body"}>
      {/*
        แผงตั้งค่าเป็นคอลัมน์ข้างกระดาษ ไม่ใช่แถบพาดขวางด้านบน
        รอบก่อนวางไว้ด้านบนแล้วมันบังหัวกระดาษพอดี ซึ่งเป็นส่วนที่ผู้ใช้กำลังตั้งค่าอยู่
        และปิดไว้เป็นค่าเริ่มต้น เพราะคนเปิดหน้านี้มาเพื่อดูกระดาษก่อน ไม่ได้มาตั้งค่า
      */}
      <aside className="work-plan__doc-settings" hidden={!showSettings}>
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
      </aside>

      <div className="work-plan__doc-stage" ref={stageRef}>
        {/*
          กระดาษถูกย่อด้วย transform ซึ่งไม่กินที่ตามจริง ตัวครอบจึงต้องหดความสูงตามอัตราส่วนเอง
          ไม่งั้นจะเหลือที่ว่างใต้กระดาษเท่ากับส่วนที่ถูกย่อไป
        */}
        <div className="work-plan__doc-fit" style={{ height: `calc(297mm * ${scale})`, width: `calc(210mm * ${scale})` }}>
          <div className="work-plan__paper" style={{ transform: `scale(${scale})` }}>
          {/*
            หัวเรื่องกลางหน้า ตามแบบรายงานราชการไทย: หน่วยงาน สถานที่ ชื่อเอกสาร ที่มา วันที่ข้อมูล
            รอบก่อนหัวกระดาษเป็นตารางกรอบที่เอาโลโก้ไปไว้ช่องซ้ายพร้อมข้อมูลห้าอย่างเบียดกัน
            ซึ่งอ่านเหมือนแบบฟอร์มกรอกข้อมูล ไม่ใช่หัวเอกสารที่บอกว่านี่คือเอกสารอะไรของใคร
          */}
          <header className="work-plan__paper-masthead">
            {logoVisible(meta) ? (
              // eslint-disable-next-line @next/next/no-img-element -- รูปเป็น data URI ของผู้ใช้เอง ไม่ผ่านตัวปรับขนาดของ Next
              <img src={meta.logoDataUri} alt="" />
            ) : null}
            <p className="work-plan__paper-org">{meta.employerName || <span className="work-plan__paper-blank" />}</p>
            {meta.siteName ? <p>{meta.siteName}</p> : null}
            <h1>บัญชีแสดงงวดงานและงวดเงิน</h1>
            <p>แนบท้ายสัญญาจ้าง{meta.contractNumber ? ` เลขที่ ${meta.contractNumber}` : ""}</p>
            <p>ข้อมูล ณ วันที่ {formatThaiDate(meta.documentDate) ?? <span className="work-plan__paper-blank" />}</p>
          </header>

          {/* เลขหัวข้ออยู่ในข้อความจริง เพราะผู้ตรวจอ้างถึงมันด้วยเสียงและด้วยปากกา */}
          <h2 className="work-plan__paper-section">1. ข้อมูลสัญญา</h2>
          <table className="work-plan__paper-facts">
            <tbody>
              <tr>
                <th scope="row">โครงการ</th>
                <td>{projectName || <span className="work-plan__paper-blank" />}</td>
              </tr>
              <tr>
                <th scope="row">เลขที่สัญญา</th>
                <td>{meta.contractNumber || <span className="work-plan__paper-blank" />}</td>
              </tr>
              <tr>
                <th scope="row">สถานที่ก่อสร้าง</th>
                <td>{meta.siteName || <span className="work-plan__paper-blank" />}</td>
              </tr>
              <tr>
                <th scope="row">จำนวนงวด</th>
                <td>{schedule.rows.length.toLocaleString("th-TH")} งวด</td>
              </tr>
              <tr>
                <th scope="row">มูลค่างานตามบัญชีนี้</th>
                <td>{formatBaht(schedule.totalWorkSatang)} บาท</td>
              </tr>
            </tbody>
          </table>

          <h2 className="work-plan__paper-section">2. บัญชีงวดงาน–งวดเงิน</h2>
          <table className="work-plan__paper-table">
            <thead>
              <tr>
                <th>งวดที่</th>
                <th>งานที่ต้องแล้วเสร็จ</th>
                <th>ร้อยละ</th>
                <th>จำนวนเงิน (บาท)</th>
              </tr>
            </thead>
            <tbody>
              {schedule.rows.map((row) => (
                <tr key={row.milestoneId}>
                  <td className="work-plan__paper-mid">{row.ordinal}</td>
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

          {/* ยอดเป็นตัวอักษรอยู่ใต้ตัวเลขที่มันสะกด ไม่ใช่ในกล่องแยกกลางหน้า
              เพราะหน้าที่ของมันคือยืนยันตัวเลขข้างบน ไม่ใช่ประกาศเรื่องใหม่ */}
          <p className="work-plan__paper-words">({bahtText(schedule.totalWorkSatang)})</p>

          <h2 className="work-plan__paper-section">3. หมายเหตุ</h2>
          <div className="work-plan__paper-box">
            <ol>
              <li>
                ฐานการหักเงินประกันผลงาน คืนเงินล่วงหน้า ภาษีมูลค่าเพิ่ม และภาษีหัก ณ ที่จ่าย
                เป็นไปตามเงื่อนไขในสัญญาแต่ละฉบับ ให้ตรวจกับสัญญาจริงก่อนใช้ยื่นเบิก
              </li>
              <li>ยอดทุกช่องคิดด้วยจำนวนเต็มสตางค์ ผลรวมทุกงวดเท่ามูลค่างานตามบัญชีนี้เสมอ</li>
            </ol>
          </div>

          <h2 className="work-plan__paper-section">4. ลงนาม</h2>
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
                {/* เอกสารแนบสัญญาต้องตอบได้ว่าลงนามวันไหน ช่องเว้นไว้ให้เขียนด้วยปากกา */}
                <p className="work-plan__paper-sign-date">
                  วันที่ <span className="work-plan__paper-line" /> / <span className="work-plan__paper-line" /> /{" "}
                  <span className="work-plan__paper-line" />
                </p>
              </div>
            ))}
          </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
