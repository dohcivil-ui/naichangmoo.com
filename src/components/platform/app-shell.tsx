import type { ReactNode } from "react";
import Link from "next/link";
import type { PlatformApp } from "@/lib/platform";
import { accessLabel } from "@/lib/platform";
import { PlatformFooter } from "@/components/platform/platform-footer";
import { PlatformNav } from "@/components/platform/platform-nav";

export function AppShell({ app, children }: { app: PlatformApp; children: ReactNode }) {
  return (
    <main className="site-shell app-shell">
      <PlatformNav workspace={app.name} />
      <section className="app-shell__context"><div className="container"><Link href="/#apps">← แอปทั้งหมด</Link><span>/</span><strong>{app.name}</strong><span className={`access access--${app.access}`}>{accessLabel[app.access]}</span></div></section>
      {children}
      <PlatformFooter />
    </main>
  );
}
