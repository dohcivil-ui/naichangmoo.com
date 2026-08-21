import Link from "next/link";
import type { ComponentType } from "react";
import type { PlatformApp } from "@/lib/platform";
import { accessLabel } from "@/lib/platform";

type AppCardProps = {
  app: PlatformApp;
  Icon: ComponentType<{ className?: string; title?: string }>;
};

export function AppCard({ app, Icon }: AppCardProps) {
  const cta = app.status === "available" ? "ดู workflow" : app.status === "restricted" ? "ขอสิทธิ์ใช้งาน" : "กำลังเตรียมระบบ";
  const className = app.status === "available" ? "app-card app-card--available" : "app-card";

  return (
    <article className={className}>
      <div className="app-card__topline">
        <span>{app.eyebrow}</span>
        <span className={`access access--${app.access}`}>{accessLabel[app.access]}</span>
      </div>
      <Icon className="app-card__icon" title={app.name} />
      <h3>{app.name}</h3>
      <p>{app.description}</p>
      {app.status === "available" ? <Link className="text-link" href={app.href}>{cta}<span aria-hidden="true">→</span></Link> : <span className="text-link text-link--muted">{cta}</span>}
    </article>
  );
}
