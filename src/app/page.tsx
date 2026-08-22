import { AppCard } from "@/components/landing/app-card";
import { LandingMotion } from "@/components/landing/landing-motion";
import { HeroEngineeringArt } from "@/components/landing/hero-engineering-art";
import { SignInButton } from "@/components/landing/sign-in-button";
import Image from "next/image";
import { PlatformFooter } from "@/components/platform/platform-footer";
import { PlatformNav } from "@/components/platform/platform-nav";
import { marketCategories, platformApps } from "@/lib/platform";
import { visualAssetUrl } from "@/lib/visual-assets";
import { landingActionContract } from "@/lib/landing-interactions";

export default function LandingPage() {
  return (
    <main className="site-shell">
      <LandingMotion />
      <PlatformNav />

      <section className="hero" id="top">
        <div className="hero__signals" aria-hidden="true"><span /><span /><span /></div>
        <div className="container hero__grid">
          <div className="hero__copy" data-reveal>
            <div className="eyebrow">นายช่างหมู · แอปงานโยธา</div>
            <h1>แอปงานโยธา ใช้งานง่าย</h1>
            <p>เลือกแอปตามหมวดงาน แล้วเริ่มใช้งานได้ทันที</p>
          <div className="hero__actions"><SignInButton /><a className="button button--orange micro-button" href={landingActionContract.allAppsHref}>ดูแอปทั้งหมด</a></div>
            <p className="hero__note">ESTIMETR · ฟรี ทดลองใช้งาน 5 วัน</p>
          </div>
          <div className="hero__side" data-reveal data-reveal-delay="1">
            <HeroEngineeringArt />
            <aside className="workflow-rail" aria-label="การเริ่มใช้งาน"><h2>เริ่มใช้งาน</h2>{["เลือกแอป", "ดูรายละเอียด", "เริ่มใช้งาน", "ทำงานต่อ"].map((step, index) => <div className="workflow-step" key={step} tabIndex={0}><span>0{index + 1}</span><div>{step}</div></div>)}</aside>
          </div>
        </div>
      </section>

      <section className="section" id="apps">
        <div className="container">
          <div className="section-heading" data-reveal><div><div className="eyebrow" style={{ color: "var(--teal)" }}>แอปงานโยธา</div><h2>เลือกแอปตามหมวดงาน</h2></div></div>
          <div className="market-category-stack">
            {marketCategories.map((category, index) => {
              const apps = platformApps.filter((app) => app.categoryId === category.id);
              return <section className="market-category" key={category.id} data-reveal>
                <header className="market-category__header">
                  <span className="market-category__index">0{index + 1}</span>
                  <div><p className="eyebrow">หมวดงาน</p><h3>{category.label}</h3><p>{category.description}</p></div>
                </header>
                <div className="market-category__apps">{apps.map((app) => <AppCard key={app.slug} app={app} />)}</div>
              </section>;
            })}
          </div>
        </div>
      </section>

      <section className="section section--white" id="hermes">
        <div className="container">
          <div className="hermes-panel" data-reveal><div className="hermes-panel__icon"><Image src={visualAssetUrl("hermes")} alt="Hermes assistant" width={74} height={74} /></div><div><div className="eyebrow" style={{ color: "var(--teal)" }}>HERMES · 24/7</div><h2>ผู้ช่วยสำหรับงานที่ต้องทบทวน</h2><p>ช่วยเตือนประเด็นที่ควรตรวจสอบก่อนยืนยันงาน</p></div></div>
        </div>
      </section>

      <PlatformFooter />
    </main>
  );
}
