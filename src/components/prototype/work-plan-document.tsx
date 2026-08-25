"use client";

import { useRef } from "react";
import { bahtText, formatBaht } from "@/lib/thai-baht";
import { formatPercent } from "@/lib/work-plan";
import type { MilestoneSchedule } from "@/lib/payment-milestone";

/**
 * เอกสารบัญชีงวดงาน–งวดเงิน สำหรับพิมพ์แนบสัญญาจ้างราชการ
 *
 * นี่คือฟีเจอร์ที่คู่แข่งไม่มี และเป็นเหตุผลที่ผู้ใช้ยอมกรอกข้อมูลเข้าแอปเรา เพราะงานจบที่กระดาษ
 * ที่ใช้ยื่นได้จริง ไม่ใช่จบที่หน้าจอ คู่แข่งออกรายงานสถานะทั่วไป แต่ไม่มีใครออกภาคผนวกงวดงาน
 * ตามรูปแบบที่กรรมการตรวจการจ้างคุ้นตา
 *
 * ยอดทุกช่องมาจาก buildMilestoneSchedule ซึ่งคิดด้วย BigInt satang ตรวจย้อนได้ทุกบาท
 * และยอดรวมทุกงวดเท่ามูลค่าสัญญาเป๊ะ — จุดที่คู่แข่งเคยแสดง 305,000 เป็น 305,000,000,000
 * ท้ายเอกสารพิมพ์ยอดเป็นตัวอักษรตามแบบราชการ ด้วย bahtText ที่มีอยู่แล้ว
 */
export function WorkPlanDocument({
  projectName,
  siteName,
  agencyName,
  schedule,
  activityTitlesByMilestone,
  onClose
}: {
  projectName: string;
  siteName: string;
  agencyName: string;
  schedule: MilestoneSchedule;
  /** ชื่อกิจกรรมที่ต้องแล้วเสร็จในแต่ละงวด key คือ milestoneId */
  activityTitlesByMilestone: Record<string, string[]>;
  onClose: () => void;
}) {
  const paperRef = useRef<HTMLDivElement>(null);

  return (
    <div className="work-plan__doc-overlay" role="dialog" aria-label="เอกสารบัญชีงวดงาน">
      <div className="work-plan__doc-toolbar">
        <p className="eyebrow">เอกสารพร้อมพิมพ์</p>
        <div className="work-plan__doc-toolbar-actions">
          <button type="button" className="button button--orange micro-button" onClick={() => window.print()}>
            พิมพ์ หรือบันทึกเป็น PDF
          </button>
          <button type="button" className="button button--ghost micro-button" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>

      <div className="work-plan__doc-scroll">
        <div className="work-plan__paper" ref={paperRef}>
          <header className="work-plan__paper-head">
            <h1>บัญชีแสดงงวดงานและงวดเงิน</h1>
            <p>แนบท้ายสัญญาจ้าง</p>
          </header>

          <dl className="work-plan__paper-meta">
            <div>
              <dt>ชื่องาน</dt>
              <dd>{projectName || "—"}</dd>
            </div>
            <div>
              <dt>สถานที่ก่อสร้าง</dt>
              <dd>{siteName || "—"}</dd>
            </div>
            <div>
              <dt>หน่วยงาน</dt>
              <dd>{agencyName || "—"}</dd>
            </div>
          </dl>

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
                <td className="work-plan__paper-num">{formatPercent(1_000_000n - schedule.unassignedWeightPpm)}</td>
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
            <div>
              <span className="work-plan__paper-line" />
              <p>ผู้รับจ้าง</p>
            </div>
            <div>
              <span className="work-plan__paper-line" />
              <p>ผู้ว่าจ้าง</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
