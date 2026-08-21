"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProjectStatus } from "@/lib/project-status";

type Tab = "roadmap" | "handoff";

export function StatusConsole({ initial }: { initial: ProjectStatus }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<Tab>("roadmap");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/project-status", { cache: "no-store" });
      if (response.ok) setData(await response.json() as ProjectStatus);
    } finally { setIsRefreshing(false); }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const activeHandoff = data.handoffs[0];
  return (
    <section className="status-console" aria-live="polite">
      <header><div><div className="eyebrow" style={{ color: "var(--teal)" }}>LIVE PROJECT SOURCE</div><h2>Roadmap และ Handoff ที่อ่านจาก version source</h2><p>หน้าจอนี้ refresh ทุก 15 วินาที และอ่าน roadmap/handoff ที่ version ไว้ใน repository เดียวกัน</p></div><button className="button button--primary" onClick={() => void refresh()} disabled={isRefreshing}>{isRefreshing ? "กำลัง refresh" : "Refresh สถานะ"}</button></header>
      <div className="status-tabs"><button className={tab === "roadmap" ? "is-active" : ""} onClick={() => setTab("roadmap")}>Roadmap v{data.roadmap.version}</button><button className={tab === "handoff" ? "is-active" : ""} onClick={() => setTab("handoff")}>Handoff ล่าสุด</button></div>
      {tab === "roadmap" ? <div className="status-body"><div className="status-metadata"><span>VERSION v{data.roadmap.version}</span><span>{data.roadmap.status}</span><span>UPDATED {new Date(data.roadmap.updatedAt).toLocaleString("th-TH")}</span></div><h3>{data.roadmap.title}</h3><p>{data.roadmap.description}</p><div className="status-scope"><strong>Scope ของ version นี้</strong><ul>{data.roadmap.scope.map((item) => <li key={item}>{item}</li>)}</ul></div><div className="roadmap-list">{data.roadmap.items.map((item) => <div className="roadmap-item" key={item.id}><span className={`roadmap-state roadmap-state--${item.status}`}>{item.status === "done" ? "เสร็จแล้ว" : item.status === "in_progress" ? "กำลังทำ" : "วางแผน"}</span><div><strong>{item.id}</strong><p>{item.title}</p></div><small>{item.phase}</small></div>)}</div></div> : <div className="status-body"><div className="status-metadata"><span>HANDOFF v{activeHandoff.version}</span><span>{activeHandoff.path}</span></div><h3>{activeHandoff.title}</h3><p>{activeHandoff.description}</p><div className="status-scope"><strong>Changed scope</strong><ul>{activeHandoff.scope.map((item) => <li key={item}>{item}</li>)}</ul></div><div className="status-two-column"><div><strong>Verification</strong><ul>{activeHandoff.verification.map((item) => <li key={item}>{item}</li>)}</ul></div><div><strong>Rollback</strong><p>{activeHandoff.rollback}</p></div></div></div>}
      <footer>Last runtime refresh: {new Date(data.generatedAt).toLocaleTimeString("th-TH")}</footer>
    </section>
  );
}
