"use client";

import { useState } from "react";
import { canOpenWorkflowStage, resolveDemoWorkflowStage, type EstimationStage } from "@/lib/estimation-workflow";

const stages = [
  {
    id: 1 as EstimationStage,
    label: "ตรวจแบบ",
    english: "Review drawings",
    note: "แบบ สเปก และข้อขัดแย้ง",
  },
  {
    id: 2 as EstimationStage,
    label: "ถอดปริมาณ",
    english: "Quantity take-off",
    note: "หน่วย สูตร และหลักฐาน",
  },
  {
    id: 3 as EstimationStage,
    label: "ประมาณราคา",
    english: "Unit cost estimation",
    note: "วัสดุ ค่าแรง และแหล่งราคา",
  },
  {
    id: 4 as EstimationStage,
    label: "สรุป BOQ",
    english: "BOQ compilation",
    note: "ต้นทุน เอกสาร และ readiness",
  },
];

const takeoffRows = [
  { code: "ST-01", item: "คอนกรีตฐานราก", unit: "ลบ.ม.", quantity: "18.40", evidence: "S-101 / Grid A–D" },
  { code: "ST-02", item: "เหล็กเสริมฐานราก", unit: "กก.", quantity: "1,420", evidence: "S-102 / Detail F1" },
  { code: "AR-01", item: "ผนังก่ออิฐฉาบปูน", unit: "ตร.ม.", quantity: "286.75", evidence: "A-201 / Wall Schedule" },
];

export function EstimationWorkspace() {
  const [completed, setCompleted] = useState<EstimationStage>(1);
  const [activeStage, setActiveStage] = useState<EstimationStage>(1);
  const [reviewed, setReviewed] = useState(false);
  const [takeoffReviewed, setTakeoffReviewed] = useState(false);
  const [costReviewed, setCostReviewed] = useState(false);

  const progress = resolveDemoWorkflowStage({ reviewed, takeoffReviewed, costReviewed });

  function selectStage(id: EstimationStage) {
    if (canOpenWorkflowStage(id, completed)) setActiveStage(id);
  }

  function completeReview() {
    setReviewed(true);
    setCompleted(2);
    setActiveStage(2);
  }

  function completeTakeoff() {
    setTakeoffReviewed(true);
    setCompleted(3);
    setActiveStage(3);
  }

  function completeCostReview() {
    setCostReviewed(true);
    setCompleted(4);
    setActiveStage(4);
  }

  return (
    <section className="estimation-workspace">
      <div className="container">
        <header className="estimation-workspace__head">
          <div>
            <p className="eyebrow">ESTIMETR · COST WORKSPACE</p>
            <h1>ประมาณราคาที่ตรวจย้อนกลับได้</h1>
            <p className="estimation-workspace__lead">
              เปลี่ยนแบบก่อสร้างเป็นปริมาณงานและ BOQ โดยแยกหลักฐาน ปริมาณ วัสดุ ค่าแรง และสถานะการตรวจให้เห็นในลำดับเดียวกัน
            </p>
          </div>
          <div className="estimation-workspace__progress" aria-label={`ความคืบหน้า ${progress} จาก 4 ขั้นตอน`}>
            <span>WORKFLOW</span>
            <strong>{progress} / 4</strong>
            <small>{stages[progress - 1].label}</small>
          </div>
        </header>

        <p className="workspace-notice"><strong>พื้นที่สาธิต:</strong> ตัวเลขและรายการด้านล่างใช้สำหรับแสดงโครงสร้างการทำงานเท่านั้น ยังไม่ใช่ราคาอ้างอิงหรือเอกสารพร้อมส่งออก</p>

        <nav className="estimation-steps" aria-label="ขั้นตอนประมาณราคา">
          {stages.map((stage) => {
            const isComplete = stage.id < progress;
            const isActive = stage.id === activeStage;
            const isLocked = stage.id > completed;
            return (
              <button
                className={`estimation-step ${isActive ? "is-active" : ""} ${isComplete ? "is-complete" : ""}`}
                disabled={isLocked}
                key={stage.id}
                onClick={() => selectStage(stage.id)}
                type="button"
              >
                <span className="estimation-step__number">{isComplete ? "✓" : `0${stage.id}`}</span>
                <span><strong>{stage.label}</strong><small>{stage.english}</small></span>
                <em>{stage.note}</em>
              </button>
            );
          })}
        </nav>

        <div className="estimation-board">
          <section className="estimation-main" aria-live="polite">
            {activeStage === 1 && (
              <div className="workspace-panel">
                <div className="workspace-panel__title"><div><p className="eyebrow">01 · REVIEW & STUDY DRAWINGS</p><h2>ศึกษาและตรวจสอบแบบ</h2></div><span className={reviewed ? "status-chip status-chip--ready" : "status-chip"}>{reviewed ? "ตรวจแล้ว" : "รอการตรวจ"}</span></div>
                <div className="review-grid">
                  <article><span className="review-grid__icon">A</span><div><h3>แบบสถาปัตยกรรม</h3><p>ตรวจผัง, ระดับ, ผนัง, ช่องเปิด และตารางวัสดุ</p><small>A-101 ถึง A-301 · 6 แผ่น</small></div></article>
                  <article><span className="review-grid__icon">S</span><div><h3>แบบโครงสร้าง</h3><p>ตรวจฐานราก, เสา, คาน, เหล็กเสริม และรายละเอียดประกอบ</p><small>S-101 ถึง S-205 · 5 แผ่น</small></div></article>
                  <article><span className="review-grid__icon">M</span><div><h3>สเปกและข้อสังเกต</h3><p>ระบุวัสดุ, method statement และความขัดแย้งที่ต้องปิดก่อนถอดปริมาณ</p><small>2 ประเด็นต้องทบทวน</small></div></article>
                </div>
                <div className="workspace-callout"><div><strong>QA gate: ก่อนเริ่มถอดปริมาณ</strong><p>ยืนยันว่าแบบและสเปกที่ใช้เป็น revision เดียวกัน พร้อมบันทึกข้อสังเกตที่ยังเปิดอยู่</p></div><button className="button button--orange micro-button" onClick={completeReview} type="button">ยืนยันการตรวจแบบ <span>→</span></button></div>
              </div>
            )}

            {activeStage === 2 && (
              <div className="workspace-panel">
                <div className="workspace-panel__title"><div><p className="eyebrow">02 · QUANTITY TAKE-OFF</p><h2>ถอดปริมาณงานพร้อมหลักฐาน</h2></div><span className={takeoffReviewed ? "status-chip status-chip--ready" : "status-chip"}>{takeoffReviewed ? "ปริมาณตรวจแล้ว" : "3 รายการสาธิต"}</span></div>
                <div className="takeoff-table-wrap"><table className="takeoff-table"><thead><tr><th>รหัส</th><th>รายการงาน</th><th>หน่วย</th><th>ปริมาณ</th><th>หลักฐานจากแบบ</th></tr></thead><tbody>{takeoffRows.map((row) => <tr key={row.code}><td><code>{row.code}</code></td><td>{row.item}</td><td>{row.unit}</td><td className="number-cell">{row.quantity}</td><td><span className="evidence-link">{row.evidence}</span></td></tr>)}</tbody></table></div>
                <div className="workspace-split"><div><strong>หลักการวัดที่ต้องระบุ</strong><p>ระบุหน่วยที่สัมพันธ์กับรายการ เช่น นับหน่วย, ความยาว, พื้นที่, น้ำหนัก หรือปริมาตร และเก็บสูตร/จุดอ้างอิงไว้กับรายการ</p></div><button className="button button--orange micro-button" onClick={completeTakeoff} type="button">ยืนยันปริมาณงาน <span>→</span></button></div>
              </div>
            )}

            {activeStage === 3 && (
              <div className="workspace-panel">
                <div className="workspace-panel__title"><div><p className="eyebrow">03 · UNIT COST ESTIMATION</p><h2>ประมาณราคาต่อหน่วย</h2></div><span className={costReviewed ? "status-chip status-chip--ready" : "status-chip status-chip--attention"}>{costReviewed ? "ตรวจราคาแล้ว" : "ต้องเลือกแหล่งราคา"}</span></div>
                <div className="cost-source-card"><div><span className="cost-source-card__signal">PRICE SOURCE</span><h3>ราคาอ้างอิงยังไม่ถูกเลือก</h3><p>เลือกจังหวัดและเดือนราคา หรือใช้ price set ที่ผ่านการทบทวนก่อนนำไปคำนวณต้นทุน วัสดุและค่าแรงต้องแยกให้ตรวจได้</p></div><div className="cost-source-card__meta"><span>จังหวัด</span><strong>รอเลือก</strong><span>เดือนราคา</span><strong>รอเลือก</strong></div></div>
                <div className="cost-breakdown"><article><span>วัสดุ</span><strong>รอราคาอ้างอิง</strong><small>ผูกกับแหล่งราคาและ revision</small></article><article><span>ค่าแรง</span><strong>รอระบุอัตรา</strong><small>แยกจากค่าวัสดุทุก BOQ row</small></article><article><span>ต้นทุนต่อรายการ</span><strong>รอคำนวณ</strong><small>ปริมาณ × (วัสดุ + ค่าแรง)</small></article></div>
                <div className="workspace-callout"><div><strong>QA gate: ก่อนสรุป BOQ</strong><p>ยืนยันแหล่งราคา, จังหวัด/เดือน, วิธีจัดการ VAT และรายการที่ต้องทบทวน เพื่อป้องกันการส่งออกตัวเลขที่ยังไม่มีที่มา</p></div><button className="button button--orange micro-button" onClick={completeCostReview} type="button">ยืนยันการประมาณราคา <span>→</span></button></div>
              </div>
            )}

            {activeStage === 4 && (
              <div className="workspace-panel">
                <div className="workspace-panel__title"><div><p className="eyebrow">04 · BOQ COMPILATION</p><h2>สรุป BOQ และความพร้อมเอกสาร</h2></div><span className="status-chip status-chip--ready">พร้อมทบทวน</span></div>
                <div className="boq-summary-grid"><article><span>ต้นทุนตรง</span><strong>รวมจากรายการที่ตรวจแล้ว</strong><small>วัสดุ + ค่าแรง แยกตามหมวดงาน</small></article><article><span>OH&P / กำไร</span><strong>กำหนดตามโหมดโครงการ</strong><small>เอกชน: ต้นทุน/กำไร · ราชการ: workflow เอกสารที่เกี่ยวข้อง</small></article><article><span>VAT / ค่าใช้จ่ายพิเศษ</span><strong>ทบทวนก่อนออกเอกสาร</strong><small>ไม่คาดเดาสถานะ VAT จากข้อมูลที่ไม่ครบ</small></article></div>
                <div className="document-readiness"><div><p className="eyebrow">DOCUMENT READINESS</p><h3>BOQ พร้อมสำหรับ review รอบถัดไป</h3><p>ก่อน export หรือ print ต้องยืนยันรายการปริมาณ แหล่งราคา และ rule ตามโหมดโครงการอีกครั้ง</p></div><div className="readiness-list"><span>✓ Drawing review</span><span>✓ Quantity evidence</span><span>✓ Unit cost review</span><span>○ Export approval</span></div></div>
              </div>
            )}
          </section>

          <aside className="estimation-evidence">
            <p className="eyebrow">EVIDENCE LEDGER</p>
            <h2>หลักฐานที่ต้องเห็นก่อนสรุป</h2>
            <ol>
              <li><span>01</span><div><strong>Drawing revision</strong><p>แบบและ specification ชุดเดียวกัน</p></div></li>
              <li><span>02</span><div><strong>Take-off formula</strong><p>หน่วย ปริมาณ และจุดอ้างอิง</p></div></li>
              <li><span>03</span><div><strong>Price source</strong><p>จังหวัด เดือน และ revision ราคา</p></div></li>
              <li><span>04</span><div><strong>Approval gate</strong><p>ทบทวนก่อน BOQ / Excel / print</p></div></li>
            </ol>
            <div className="estimation-evidence__note"><strong>หลักการทำงาน</strong><p>AI ช่วยอ่านแบบและเสนอหลักฐาน แต่ผู้ใช้เป็นผู้ยืนยันปริมาณและราคาอ้างอิงเสมอ</p></div>
          </aside>
        </div>
      </div>
    </section>
  );
}
