"use client";

import { useState } from "react";

type Mode = "trial" | "read_only";

const policy = {
  trial: {
    label: "สมาชิกใหม่ · Trial วันที 1–5",
    detail: "ใช้งาน ESTIMETR ได้ 1 โครงการ และตรวจ workflow ได้ครบตามสิทธิ์ทดลอง",
    capabilities: [["สร้างโครงการ", true], ["AI Takeoff และตรวจหลักฐาน", true], ["แก้ไข BOQ", true], ["Export / Print", false]]
  },
  read_only: {
    label: "หลังหมดอายุ · Read-only retention",
    detail: "ข้อมูลเดิมยังเปิดดูได้เพื่อไม่ให้เสียงาน แต่การเปลี่ยนแปลงและ output ถูก lock",
    capabilities: [["เปิดดูโครงการเดิม", true], ["สร้างหรือแก้ไขข้อมูล", false], ["AI Takeoff", false], ["Export / Print", false]]
  }
} as const;

export function TrialPolicyPreview() {
  const [mode, setMode] = useState<Mode>("trial");
  const current = policy[mode];

  return (
    <section className="policy-preview" aria-live="polite">
      <div><div className="eyebrow" style={{ color: "var(--teal)" }}>INTERACTION PREVIEW</div><h3>สิทธิ์ใช้งานต้องอธิบายได้ก่อนเริ่มงาน</h3><p>{current.detail}</p></div>
      <div className="policy-preview__panel">
        <div className="segment-control"><button type="button" className={mode === "trial" ? "is-active" : ""} onClick={(event) => { event.preventDefault(); setMode("trial"); }}>ช่วงทดลอง</button><button type="button" className={mode === "read_only" ? "is-active" : ""} onClick={(event) => { event.preventDefault(); setMode("read_only"); }}>หลังหมดอายุ</button></div>
        <strong>{current.label}</strong>
        <ul>{current.capabilities.map(([name, enabled]) => <li key={name}><span className={enabled ? "capability capability--on" : "capability capability--off"}>{enabled ? "อนุญาต" : "ล็อก"}</span>{name}</li>)}</ul>
      </div>
    </section>
  );
}
