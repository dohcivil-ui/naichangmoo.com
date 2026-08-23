"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SignInButton } from "@/components/landing/sign-in-button";
import { BrandLogo } from "@/components/platform/brand-logo";
import { landingActionContract, landingNavigationContract } from "@/lib/landing-interactions";

export function PlatformNav({ workspace }: { workspace?: string }) {
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
          const isActive = item.id === "apps"
            ? (pathname === "/" ? activeSection === item.id : pathname.startsWith("/market"))
            : ["roadmap", "enterprise"].includes(item.id) ? pathname === item.href : pathname === "/" && activeSection === item.id;
            const className = ["nav-pill", item.id === "enterprise" ? "nav-pill--primary" : "", isActive ? "is-active" : ""].filter(Boolean).join(" ");
            return <Link key={item.id} className={className} href={item.href} aria-current={isActive ? "location" : undefined} onClick={() => setActiveSection(item.id)}>{item.label}</Link>;
          })}
        </div>
        <div className="site-nav__account"><SignInButton /></div>
      </div>
    </nav>
  );
}
