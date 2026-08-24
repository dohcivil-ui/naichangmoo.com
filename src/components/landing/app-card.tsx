"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";
import type { PlatformApp } from "@/lib/platform";
import { accessLabel, appStatusLabel } from "@/lib/platform";
import { getAppInteractionContract } from "@/lib/landing-interactions";

type AppCardProps = {
  app: PlatformApp;
};

export function AppCard({ app }: AppCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const interaction = getAppInteractionContract(app);
  const cta = app.status === "available" ? "ดูรายละเอียดและเริ่มใช้" : "ดูรายละเอียดแอป";
  const className = ["app-card", `app-card--${app.slug}`, app.status === "available" ? "app-card--available" : ""].filter(Boolean).join(" ");

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
      data-reveal
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse") return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const relativeX = event.clientX - bounds.left;
        const relativeY = event.clientY - bounds.top;
        event.currentTarget.style.setProperty("--pointer-x", `${relativeX}px`);
        event.currentTarget.style.setProperty("--pointer-y", `${relativeY}px`);
        event.currentTarget.style.setProperty("--tilt-x", `${((relativeY / bounds.height) - 0.5) * -3}deg`);
        event.currentTarget.style.setProperty("--tilt-y", `${((relativeX / bounds.width) - 0.5) * 3}deg`);
      }}
      onPointerLeave={(event) => {
        ["--pointer-x", "--pointer-y", "--tilt-x", "--tilt-y"].forEach((property) => event.currentTarget.style.removeProperty(property));
      }}
    >
      <div className="app-card__icon-wrap"><Image className="app-card__icon" src={app.iconSrc} alt={app.iconAlt} width={65} height={65} /></div>
      <div className="app-card__body">
        <div className="app-card__topline">
          <span>{app.eyebrow}</span>
          <span className={`access access--${app.seededAccess}`}>{accessLabel[app.seededAccess]}</span>
        </div>
        <h3>{app.name}</h3>
        <p>{app.description}</p>
      </div>
      <div className="app-card__actions">
        <span className={`app-status app-status--${app.status}`}>{appStatusLabel[app.status]}</span>
        <Link className="text-link" href={interaction.detailHref}>{cta}<span aria-hidden="true">→</span></Link>
      </div>
    </article>
  );
}
