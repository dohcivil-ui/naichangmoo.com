"use client";

import { useState } from "react";
import {
  canOpenWorkflowStage,
  getWorkflowBlocker,
  resolveGuidedWorkflowStage,
  type EstimationStage,
  type ProjectPath,
} from "@/lib/estimation-workflow";
import type { EstimeterAccessView } from "@/lib/estimeter-access-view";

const stages = [
  { id: 1 as EstimationStage, label: "ตั้งโครงการและตรวจแบบ", english: "Project & drawing review", note: "สายงาน แบบ revision และสเกล" },
  { id: 2 as EstimationStage, label: "ถอดปริมาณ", english: "Quantity take-off", note: "หน่วย สูตร และหลักฐาน" },
  { id: 3 as EstimationStage, label: "ประมาณราคา", english: "Approved price set", note: "วัสดุ ค่าแรง และแหล่งราคา" },
  { id: 4 as EstimationStage, label: "สรุป BOQ และเอกสาร", english: "BOQ & documents", note: "review, baseline และ approval" },
];

const takeoffRows = [
  { code: "ST-01", item: "คอนกรีตฐานราก", unit: "ลบ.ม.", quantity: "18.40", evidence: "S-101 / Grid A–D" },
  { code: "ST-02", item: "เหล็กเสริมฐานราก", unit: "กก.", quantity: "1,420", evidence: "S-102 / Detail F1" },
  { code: "AR-01", item: "ผนังก่ออิฐฉาบปูน", unit: "ตร.ม.", quantity: "286.75", evidence: "A-201 / Wall Schedule" },
];

type GuideMode = "beginner" | "fast";

const guidanceByStage: Record<EstimationStage, { title: string; beginner: string; fast: string; checks: string[] }> = {
  1: {
    title: "เริ่มต้นจากข้อมูลที่เชื่อถือได้",
    beginner: "เลือกสายงานก่อน เพราะเอกชนและราชการใช้กติกาการสรุปเอกสารคนละชุด จากนั้นยืนยัน revision แบบและตั้งสเกลจากระยะที่ทราบจริง 1 จุดก่อนวัดสิ่งใด",
    fast: "เลือกสายงาน · ยืนยัน revision · ยืนยัน Scale",
    checks: ["เลือกเอกชนหรือราชการ", "ยืนยันแบบ/สเปก revision เดียวกัน", "ยืนยัน scale พร้อมจุดอ้างอิง"],
  },
  2: {
    title: "ถอดแบบพร้อมหลักฐาน ไม่ใช่แค่ตัวเลข",
    beginner: "แต่ละรายการต้องบอกได้ว่าวัดจากหน้าไหน ใช้หน่วยอะไร และคำนวณด้วยสูตรใด หาก AI เสนอรายการ ให้ตรวจหลักฐานก่อนยืนยันเสมอ",
    fast: "หน่วย · สูตร · page/geometry evidence · review",
    checks: ["ใช้หน่วยตรงกับรายการ", "ผูกสูตรและตำแหน่งอ้างอิง", "ยืนยันหรือระบุเหตุผลที่ไม่รับรายการ"],
  },
  3: {
    title: "ราคาอ้างอิงต้องมีที่มาและ revision",
    beginner: "อย่าใช้ราคาในความจำ เลือก source, จังหวัด และเดือน แล้วแยกค่าวัสดุ/ค่าแรงให้ตรวจได้ Price set ที่อนุมัติแล้วจึงผูกกับ revision นี้ได้",
    fast: "source · province/month · material/labor · VAT/transport · approve set",
    checks: ["เลือก price source และเดือนราคา", "ตรวจ treatment ของ VAT/ขนส่ง", "ล็อก price set ที่ผ่าน review"],
  },
  4: {
    title: "เอกสารคือผลลัพธ์ของ BOQ ที่ตรวจแล้ว",
    beginner: "ปร.4/ปร.5/ปร.6 หรือเอกสารเอกชนต้องดึงจาก BOQ revision เดียวกันเท่านั้น หาก baseline แบบฟอร์ม, Factor F, rounding หรือ approval ยังไม่ครบ ระบบต้องห้ามส่งออก",
    fast: "BOQ revision · baseline · Factor F/rules · approval · export checksum",
    checks: ["ทบทวน BOQ revision", "ตรวจ baseline และกติกาเอกสาร", "รอ approval ก่อน Excel/PDF"],
  },
};

export function EstimationWorkspace({ access }: { access: EstimeterAccessView }) {
  const [activeStage, setActiveStage] = useState<EstimationStage>(1);
  const [projectPath, setProjectPath] = useState<ProjectPath | null>(null);
  const [scaleConfirmed, setScaleConfirmed] = useState(false);
  const [drawingReviewed, setDrawingReviewed] = useState(false);
  const [takeoffReviewed, setTakeoffReviewed] = useState(false);
  const [priceSetApproved, setPriceSetApproved] = useState(false);
  const [costReviewed, setCostReviewed] = useState(false);
  const [guideMode, setGuideMode] = useState<GuideMode>("beginner");
  const [guideOpen, setGuideOpen] = useState(true);

  const workflowState = { projectPath, scaleConfirmed, drawingReviewed, takeoffReviewed, priceSetApproved, costReviewed };
  const progress = resolveGuidedWorkflowStage(workflowState);
  const blocker = getWorkflowBlocker(workflowState);
  const guide = guidanceByStage[activeStage];

  // The server decides this; the disabled controls below only make the decision visible.
  const canEdit = access.capabilities.edit;
  const lockReason =
    access.state === "expired_read_only"
      ? "สิทธิ์ทดลองใช้หมดอายุแล้ว เปิดดูข้อมูลเดิมได้ แต่เปลี่ยนแปลงไม่ได้"
      : access.state === "suspended"
        ? "สิทธิ์ถูกระงับ จึงเปลี่ยนแปลงข้อมูลไม่ได้"
        : "บัญชีนี้ยังไม่มีสิทธิ์แก้ไขข้อมูลใน ESTIMETR";

  function selectStage(id: EstimationStage) {
    if (canOpenWorkflowStage(id, progress)) setActiveStage(id);
  }

  function completeDrawingReview() {
    if (!canEdit || !projectPath || !scaleConfirmed) return;
    setDrawingReviewed(true);
    setActiveStage(2);
  }

  function completeTakeoff() {
    if (!canEdit) return;
    setTakeoffReviewed(true);
    setActiveStage(3);
  }

  function approvePriceSet() {
    if (!canEdit) return;
    setPriceSetApproved(true);
  }

  function completeCostReview() {
    if (!canEdit || !priceSetApproved) return;
    setCostReviewed(true);
    setActiveStage(4);
  }

  return (
    <section className="estimation-workspace">
      <div className="container">
        <header className="estimation-workspace__head">
          <div>
            <p className="eyebrow">ESTIMETR · GUIDED COST WORKSPACE</p>
            <h2>ลำดับงานประมาณราคา และ gate ที่ห้ามข้าม</h2>
            <p className="estimation-workspace__lead">
              ผู้เริ่มต้นเรียนรู้ทีละขั้น ผู้มีประสบการณ์ข้ามคำอธิบายได้ แต่ทุกคนต้องผ่าน gate เดียวกันก่อนเปลี่ยน BOQ revision หรือเตรียมเอกสาร
            </p>
          </div>
          <div className="estimation-workspace__progress" aria-label={`ความคืบหน้า ${progress} จาก 4 ขั้นตอน`}>
            <span>WORKFLOW</span><strong>{progress} / 4</strong><small>{stages[progress - 1].label}</small>
          </div>
        </header>

        <p className="workspace-notice">
          {canEdit
            ? <><strong>พื้นที่สาธิต:</strong> ตรวจขั้นตอนการทำงานได้จากหน้านี้ ข้อมูลในตารางเป็นตัวอย่างและยังไม่บันทึกลงโครงการจริง</>
            : <><strong>อ่านอย่างเดียว:</strong> {lockReason}</>}
        </p>

        <nav className="estimation-steps" aria-label="ขั้นตอนประมาณราคา">
          {stages.map((stage) => {
            const isComplete = stage.id < progress;
            const isActive = stage.id === activeStage;
            const isLocked = stage.id > progress;
            return <button className={`estimation-step ${isActive ? "is-active" : ""} ${isComplete ? "is-complete" : ""}`} disabled={isLocked} key={stage.id} onClick={() => selectStage(stage.id)} type="button"><span className="estimation-step__number">{isComplete ? "✓" : `0${stage.id}`}</span><span><strong>{stage.label}</strong><small>{stage.english}</small></span><em>{stage.note}</em></button>;
          })}
        </nav>

        <div className="estimation-board estimation-board--guided">
          <section className="estimation-main" aria-live="polite">
            {activeStage === 1 && (
              <div className="workspace-panel">
                <div className="workspace-panel__title"><div><p className="eyebrow">01 · PROJECT PATH, DRAWING & SCALE</p><h2>ตั้งโครงการ ตรวจแบบ และยืนยันสเกล</h2></div><span className={drawingReviewed ? "status-chip status-chip--ready" : "status-chip"}>{drawingReviewed ? "ผ่าน gate แล้ว" : "ต้องยืนยัน 3 จุด"}</span></div>
                <div className="project-path-control" role="group" aria-label="เลือกสายงานโครงการ"><span>สายงานของโครงการ</span><div><button className={projectPath === "private" ? "is-selected" : ""} disabled={!canEdit} onClick={() => setProjectPath("private")} type="button">เอกชน<small>OH&P · กำไร · VAT</small></button><button className={projectPath === "government" ? "is-selected" : ""} disabled={!canEdit} onClick={() => setProjectPath("government")} type="button">ราชการ<small>Baseline · Factor F · เอกสาร</small></button></div></div>
                <div className="preflight-grid">
                  <article><span className="review-grid__icon">R</span><div><h3>Drawing revision</h3><p>ยืนยันว่าแบบและ specification เป็นชุดเดียวกันก่อนเริ่มงาน</p><small>{drawingReviewed ? "ยืนยันแล้ว" : "รอการยืนยัน"}</small></div></article>
                  <article><span className="review-grid__icon">S</span><div><h3>Scale reference</h3><p>ตั้ง scale จากระยะจริงที่ตรวจสอบได้ ไม่อนุญาตให้เดา scale</p><button className={`calibration-check ${scaleConfirmed ? "is-confirmed" : ""}`} disabled={!canEdit} onClick={() => setScaleConfirmed((value) => !value)} type="button">{scaleConfirmed ? "ยืนยันจุดอ้างอิงแล้ว" : "ยืนยันจุดอ้างอิงสเกล"}</button></div></article>
                  <article><span className="review-grid__icon">Q</span><div><h3>Open issues</h3><p>บันทึกข้อขัดแย้งก่อนถอดปริมาณ เพื่อไม่ให้ตัวเลขปิดบังความไม่แน่นอน</p><small>ไม่มีการปิด issue อัตโนมัติ</small></div></article>
                </div>
                <div className="workspace-callout"><div><strong>QA gate: ปลดล็อกการถอดปริมาณ</strong><p>{canEdit ? blocker : lockReason}</p></div><button className="button button--orange micro-button" disabled={!canEdit || !projectPath || !scaleConfirmed} onClick={completeDrawingReview} type="button">ยืนยัน project, แบบ และสเกล <span>→</span></button></div>
              </div>
            )}

            {activeStage === 2 && (
              <div className="workspace-panel">
                <div className="workspace-panel__title"><div><p className="eyebrow">02 · AI TAKE-OFF WITH HUMAN EVIDENCE REVIEW</p><h2>ถอดปริมาณงานพร้อมหลักฐาน</h2></div><span className={takeoffReviewed ? "status-chip status-chip--ready" : "status-chip"}>{takeoffReviewed ? "ปริมาณตรวจแล้ว" : "รอ review รายการ"}</span></div>
                <div className="takeoff-table-wrap"><table className="takeoff-table"><thead><tr><th>รหัส</th><th>รายการงาน</th><th>หน่วย</th><th>ปริมาณ</th><th>หลักฐานจากแบบ</th></tr></thead><tbody>{takeoffRows.map((row) => <tr key={row.code}><td><code>{row.code}</code></td><td>{row.item}</td><td>{row.unit}</td><td className="number-cell">{row.quantity}</td><td><span className="evidence-link">{row.evidence}</span></td></tr>)}</tbody></table></div>
                <div className="prelim-boq-note"><strong>Prelim BOQ ยังไม่ใช่เอกสารปล่อยออก</strong><p>AI อาจเสนอรายการได้ แต่ผู้ใช้ต้องยืนยันหน่วย สูตร และ evidence ก่อนสร้าง estimate revision</p></div>
                <div className="workspace-split"><div><strong>QA gate: ก่อนเลือก Price Set</strong><p>{canEdit ? blocker : lockReason}</p></div><button className="button button--orange micro-button" disabled={!canEdit} onClick={completeTakeoff} type="button">ยืนยันปริมาณและหลักฐาน <span>→</span></button></div>
              </div>
            )}

            {activeStage === 3 && (
              <div className="workspace-panel">
                <div className="workspace-panel__title"><div><p className="eyebrow">03 · PROVENANCE-BOUND UNIT COST</p><h2>ประมาณราคาจาก Price Set ที่อนุมัติ</h2></div><span className={costReviewed ? "status-chip status-chip--ready" : "status-chip status-chip--attention"}>{costReviewed ? "ตรวจราคาแล้ว" : "ยังไม่พร้อมคำนวณ"}</span></div>
                <div className="cost-source-card"><div><span className="cost-source-card__signal">REFERENCE PRICE POLICY</span><h3>{priceSetApproved ? "Price set สาธิตถูกล็อกแล้ว" : "ยังไม่มี price set ที่อนุมัติ"}</h3><p>Production จะต้องระบุ source, จังหวัด, เดือน, revision, price excluding VAT, treatment ค่าขนส่ง และ raw payload hash ก่อนผูกราคากับ BOQ</p></div><div className="cost-source-card__meta"><span>สายงาน</span><strong>{projectPath === "government" ? "ราชการ" : "เอกชน"}</strong><span>Baseline</span><strong>{projectPath === "government" ? "versioned / รอยืนยัน" : "policy รออนุมัติ"}</strong></div></div>
                <div className="cost-breakdown"><article><span>วัสดุ</span><strong>ห้ามใช้ราคาไม่มีที่มา</strong><small>source + province/month + revision</small></article><article><span>ค่าแรง</span><strong>แยกจากค่าวัสดุ</strong><small>ทุกแถวต้อง review ได้</small></article><article><span>VAT / ขนส่ง</span><strong>ห้ามเดาสถานะ</strong><small>ต้องระบุ policy ใน price set</small></article></div>
                <div className="price-set-gate"><div><strong>Gate A: price set revision</strong><p>คลิกเพื่อจำลองการอนุมัติ price set เท่านั้น ไม่ได้ดึงหรือสร้างราคาจริง</p></div><button className={`button ${priceSetApproved ? "button--primary" : "button--orange"} micro-button`} disabled={!canEdit} onClick={approvePriceSet} type="button">{priceSetApproved ? "Price set สาธิตถูกล็อกแล้ว" : "ยืนยัน price set สาธิต"}</button></div>
                <div className="workspace-callout"><div><strong>QA gate: ก่อนสรุป BOQ</strong><p>{canEdit ? blocker : lockReason}</p></div><button className="button button--orange micro-button" disabled={!canEdit || !priceSetApproved} onClick={completeCostReview} type="button">ยืนยันการประมาณราคา <span>→</span></button></div>
              </div>
            )}

            {activeStage === 4 && (
              <div className="workspace-panel">
                <div className="workspace-panel__title"><div><p className="eyebrow">04 · BOQ REVISION & DOCUMENT READINESS</p><h2>สรุป BOQ โดยยังล็อกเอกสารไว้</h2></div><span className="status-chip status-chip--attention">ห้ามส่งออก</span></div>
                <div className="boq-summary-grid"><article><span>ต้นทุนตรง</span><strong>ต้องมาจาก BOQ revision เดียวกัน</strong><small>ปริมาณ × ราคาที่อนุมัติ</small></article><article><span>{projectPath === "government" ? "Government path" : "Private path"}</span><strong>{projectPath === "government" ? "Baseline · Factor F · rounding" : "OH&P · กำไร · VAT"}</strong><small>กติกาเป็น versioned policy</small></article><article><span>เอกสาร</span><strong>สร้างจาก mapping ที่ผ่าน test เท่านั้น</strong><small>ไม่แก้ยอดในเอกสารปลายทาง</small></article></div>
                <div className="document-readiness document-readiness--locked"><div><p className="eyebrow">DOCUMENT RELEASE GATE</p><h3>{projectPath === "government" ? "ปิดล็อก ปร.4 / ปร.5 / ปร.6 และ PDF" : "ปิดล็อก Excel / PDF ใบเสนอราคา"}</h3><p>หน้านี้ยังไม่มี document baseline ที่อนุมัติ, calculation fixture, Factor F/rounding validation, user approval หรือ export artifact checksum จึงห้ามสร้างไฟล์หรือกล่าวอ้างความถูกต้องตามมาตรฐาน</p></div><div className="readiness-list"><span>✓ Drawing review</span><span>✓ Take-off evidence</span><span>✓ Price-set review</span><span>○ Baseline validation</span><span>○ Release approval</span></div></div>
              </div>
            )}
          </section>

          <aside className={`guidance-assistant ${guideOpen ? "" : "guidance-assistant--collapsed"}`} aria-label="ผู้ช่วยการใช้งาน ESTIMETR">
            <div className="guidance-assistant__head"><div><p className="eyebrow">GUIDED AI ASSISTANT</p><h2>{guideOpen ? "ทำตามทีละขั้น" : "ผู้ช่วย"}</h2></div><button aria-expanded={guideOpen} className="assistant-toggle" onClick={() => setGuideOpen((value) => !value)} type="button">{guideOpen ? "ย่อ" : "เปิด"}</button></div>
            {guideOpen && <><div className="assistant-mode" role="group" aria-label="โหมดคำแนะนำ"><button className={guideMode === "beginner" ? "is-active" : ""} onClick={() => setGuideMode("beginner")} type="button">โหมดเริ่มต้น</button><button className={guideMode === "fast" ? "is-active" : ""} onClick={() => setGuideMode("fast")} type="button">ทำงานเร็ว</button></div><section className="assistant-next"><span>ขั้นตอนปัจจุบัน 0{activeStage}</span><h3>{guide.title}</h3><p>{guideMode === "beginner" ? guide.beginner : guide.fast}</p></section><ol className="assistant-checks">{guide.checks.map((check, index) => <li key={check}><span>0{index + 1}</span>{check}</li>)}</ol><div className="assistant-boundary"><strong>ขอบเขตผู้ช่วย</strong><p>สอนการใช้ระบบและชี้ข้อมูลที่ขาดได้ แต่ไม่สร้างราคา ยืนยัน scale อนุมัติ BOQ หรือส่งออกเอกสารแทนผู้ใช้</p></div></>}
          </aside>
        </div>
      </div>
    </section>
  );
}
