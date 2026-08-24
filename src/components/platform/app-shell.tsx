import type { ReactNode } from "react";
import Link from "next/link";
import type { PlatformApp } from "@/lib/platform";
import { accessLabel } from "@/lib/platform";
import { PlatformFooter } from "@/components/platform/platform-footer";
import { SiteHeader } from "@/components/platform/site-header";

export function AppShell({ app, children }: { app: PlatformApp; children: ReactNode }) {
  return (
    <main className="site-shell app-shell">
      <SiteHeader workspace={app.name} />
      <section className="app-shell__context"><div className="container"><Link href="/#apps">← แอปทั้งหมด</Link><span>/</span><strong>{app.name}</strong><span className={`access access--${app.seededAccess}`}>{accessLabel[app.seededAccess]}</span></div></section>
      {/*
        Every app says what it is in the same place, so arriving from a link never leaves someone
        guessing what they opened. Deliberately compact: some app pages carry their own heading, and
        two large headings stacked read as a layout mistake rather than as a hierarchy.
      */}
      <section className="app-identity">
        <div className="container">
          <h1>{app.programName}</h1>
          <p>{app.purpose}</p>
        </div>
      </section>
      {children}
      <PlatformFooter />
    </main>
  );
}
