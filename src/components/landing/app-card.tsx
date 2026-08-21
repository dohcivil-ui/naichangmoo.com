"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";
import type { PlatformApp } from "@/lib/platform";
import { accessLabel } from "@/lib/platform";

type AppCardProps = {
  app: PlatformApp;
};

export function AppCard({ app }: AppCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const cta = app.status === "available" ? "ดู workflow" : app.status === "restricted" ? "ขอสิทธิ์ใช้งาน" : "กำลังเตรียมระบบ";
  const className = app.status === "available" ? "app-card app-card--available" : "app-card";

  useEffect(() => {
    const card = cardRef.current;
    if (!card || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) card.dataset.revealed = "true";
    }, { threshold: 0.18 });
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  return (
    <article
      ref={cardRef}
      className={className}
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty("--pointer-x", `${event.clientX - bounds.left}px`);
        event.currentTarget.style.setProperty("--pointer-y", `${event.clientY - bounds.top}px`);
      }}
      onPointerLeave={(event) => event.currentTarget.style.removeProperty("--pointer-x")}
    >
      <div className="app-card__topline">
        <span>{app.eyebrow}</span>
        <span className={`access access--${app.access}`}>{accessLabel[app.access]}</span>
      </div>
      <div className="app-card__icon-wrap"><Image className="app-card__icon" src={app.iconSrc} alt={app.iconAlt} width={65} height={65} /></div>
      <h3>{app.name}</h3>
      <p>{app.description}</p>
      {app.status === "available" ? <Link className="text-link" href={app.href}>{cta}<span aria-hidden="true">→</span></Link> : <span className="text-link text-link--muted">{cta}</span>}
    </article>
  );
}
