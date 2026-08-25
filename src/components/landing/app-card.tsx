"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";
import type { PlatformApp } from "@/lib/platform";
import type { AppClaim } from "@/server/app-registry";
import { describeCardClaims } from "@/lib/catalogue-card";
import { getAppInteractionContract } from "@/lib/landing-interactions";

type AppCardProps = {
  app: PlatformApp;
  /**
   * What the registry says about this app. ADR 0015 splits the card in two: the name, the icon and
   * the purpose line are an introduction and come from `app`; the badges, the date and the wording
   * of the action are claims and come from here, by way of `describeCardClaims`.
   *
   * An unannounced app — which is every app until an administrator says otherwise — renders the
   * introduction and nothing else. Silence is the correct output, not an empty card and not a
   * guess from `seededAccess`.
   */
  claim: AppClaim;
};

export function AppCard({ app, claim }: AppCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const interaction = getAppInteractionContract(app, claim.open);
  const says = describeCardClaims(claim);
  const className = ["app-card", `app-card--${app.slug}`, claim.open ? "app-card--available" : ""].filter(Boolean).join(" ");

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
        <div className="app-card__topline"><span>{app.eyebrow}</span></div>
        <h3>{app.name}</h3>
        <span className="app-card__progname">{app.programName}</span>
        <p>{app.purpose}</p>
      </div>
      <div className="app-card__actions">
        {says.readiness ? <span className={`app-status app-status--${says.readiness.modifier}`}>{says.readiness.label}</span> : null}
        {says.access ? <span className={`access access--${says.access.modifier}`}>{says.access.label}</span> : null}
        {says.announcedOn ? <span className="app-card__since">ประกาศเมื่อ {says.announcedOn}</span> : null}
        <Link className={`app-card__cta app-card__cta--${says.cta.tone}`} href={interaction.detailHref}>{says.cta.label}</Link>
      </div>
    </article>
  );
}
