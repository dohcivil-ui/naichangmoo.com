import type { ReactNode } from "react";
import Link from "next/link";
import type { PlatformApp } from "@/lib/platform";
import { describeCardClaims } from "@/lib/catalogue-card";
import { landingActionContract } from "@/lib/landing-interactions";
import { PlatformFooter } from "@/components/platform/platform-footer";
import { SiteHeader } from "@/components/platform/site-header";
import { readCatalogueClaims } from "@/server/app-registry";

export async function AppShell({ app, children }: { app: PlatformApp; children: ReactNode }) {
  /**
   * The access badge on the context bar used to read `app.seededAccess` — the fourth place in the
   * product stating terms nobody announced, and the one ADR 0014's closing note missed because it
   * named only the landing page and /market/[slug]. ADR 0015 governs it like the rest: an app the
   * registry has not spoken for shows no badge here either.
   */
  const claims = await readCatalogueClaims();
  const says = describeCardClaims(claims[app.slug]);

  return (
    <main className="site-shell app-shell">
      <SiteHeader workspace={app.name} />
      <section className="app-shell__context"><div className="container"><Link href={landingActionContract.allAppsHref}>← {landingActionContract.allAppsLabel}</Link><span>/</span><strong>{app.name}</strong>{says.access ? <span className={`access access--${says.access.modifier}`}>{says.access.label}</span> : null}</div></section>
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
