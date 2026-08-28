"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountMenu } from "@/components/platform/account-menu";
import { BrandLogo } from "@/components/platform/brand-logo";
import {
  landingActionContract,
  landingNavigationContract,
  type AccountAppAccess,
  type AccountViewer
} from "@/lib/landing-interactions";

/**
 * The nav is a client component because the active-section highlight watches the viewport. Who is
 * looking is not something it can work out from the browser, so it is handed down: `SiteHeader`
 * reads the session on the server and passes the result through.
 */
export function PlatformNav({
  workspace,
  user = null,
  isPlatformAdmin = false,
  apps = []
}: {
  workspace?: string;
  user?: AccountViewer | null;
  isPlatformAdmin?: boolean;
  apps?: AccountAppAccess[];
}) {
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    if (pathname !== "/") return;

    const sections = ["apps", "hermes"]
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));
    if (!sections.length || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver((entries) => {
      const current = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (current?.target.id) setActiveSection(current.target.id);
    }, { rootMargin: "-27% 0px -58%", threshold: [0.1, 0.3, 0.55] });

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <nav className="site-nav" aria-label="เมนูหลัก">
      <div className="container site-nav__inner">
        <Link className="brand" href={landingActionContract.homeHref} aria-label="นายช่างหมู — CIVIL APPS ASSISTANT"><BrandLogo />{workspace ? <span className="brand__workspace">{workspace}</span> : null}</Link>
        <div className="nav-links" aria-label="ทางลัด platform">
          {landingNavigationContract.map((item) => {
          // `home` is the top of the landing page rather than a section of it, so it lights when we
          // are on `/` and no section has been scrolled into, and hands over to `แอปของเรา` the
          // moment one has. Clicking it therefore has to CLEAR the section: setting it to "home"
          // like the others would switch the pill off on its own click.
          const isActive = item.id === "home"
            ? pathname === "/" && !activeSection
            : item.id === "apps"
            ? (pathname === "/" ? activeSection === item.id : pathname.startsWith("/market"))
            : ["pricing", "enterprise"].includes(item.id) ? pathname === item.href : pathname === "/" && activeSection === item.id;
            const className = ["nav-pill", item.id === "enterprise" ? "nav-pill--primary" : "", isActive ? "is-active" : ""].filter(Boolean).join(" ");
            return <Link key={item.id} className={className} href={item.href} aria-current={isActive ? "location" : undefined} onClick={() => setActiveSection(item.id === "home" ? null : item.id)}>{item.label}</Link>;
          })}
        </div>
        <div className="site-nav__account"><AccountMenu user={user} isPlatformAdmin={isPlatformAdmin} apps={apps} /></div>
      </div>
    </nav>
  );
}
