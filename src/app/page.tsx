import { AppCard } from "@/components/landing/app-card";
import { LandingMotion } from "@/components/landing/landing-motion";
import { HeroEngineeringArt } from "@/components/landing/hero-engineering-art";
import { SignInButton } from "@/components/landing/sign-in-button";
import { TrialPolicyPreview } from "@/components/landing/trial-policy-preview";
import Image from "next/image";
import { PlatformFooter } from "@/components/platform/platform-footer";
import { PlatformNav } from "@/components/platform/platform-nav";
import { marketCategories, platformApps } from "@/lib/platform";
import { visualAssetUrl } from "@/lib/visual-assets";

export default function LandingPage() {
  return (
    <main className="site-shell">
      <LandingMotion />
      <PlatformNav />

      <section className="hero" id="top">
        <div className="hero__signals" aria-hidden="true"><span /><span /><span /></div>
        <div className="container hero__grid">
          <div className="hero__copy" data-reveal>
            <div className="eyebrow">NAICHANGMOO · CIVIL APPS MARKET</div>
            <h1>เครื่องมือโยธาแยกตามงานที่ต้องทำ ใช้ง่ายตั้งแต่เริ่ม</h1>
            <p>นายช่างหมูรวมแอปงานวิศวกรรมโยธาไว้ในที่เดียว แต่ละหมวดแสดงแอปที่เกี่ยวข้องทันที เพื่อให้เริ่มจากงานที่ต้องทำ ไม่ต้องเดาชื่อเครื่องมือหรือไล่หาเมนู</p>
          <div className="hero__actions"><SignInButton /><a className="button button--orange micro-button" href="#apps">ดู Civil Apps Market</a></div>
            <p className="hero__note">ESTIMETR เริ่มทดลองใช้ฟรี 5 วัน โดยระบบจะพางานไปตามขั้นตอนที่ตรวจสอบได้</p>
          </div>
          <div className="hero__side" data-reveal data-reveal-delay="1">
            <HeroEngineeringArt />
            <aside className="workflow-rail" aria-label="เส้นทาง Civil Apps Market"><h2>MARKET FLOW</h2>{["เห็นแอปใต้หมวดงานทันที", "ดูรายละเอียดและสิ่งที่ต้องเตรียม", "เริ่มใช้ตามสถานะสิทธิ์", "กลับมาทำงานต่อภายใต้บัญชีเดียว"].map((step, index) => <div className="workflow-step" key={step} tabIndex={0}><span>0{index + 1}</span><div>{step}</div></div>)}</aside>
          </div>
        </div>
      </section>

      <section className="section" id="apps">
        <div className="container">
          <div className="section-heading" data-reveal><div><div className="eyebrow" style={{ color: "var(--teal)" }}>CIVIL APPS MARKET</div><h2>เห็นแอปที่เกี่ยวกับงานของคุณทันที</h2></div><p>ไม่มี filter และไม่มีขั้นตอนให้ค้นหาซ้ำ แต่ละหมวดแสดงแอปที่เกี่ยวข้องไว้ใต้หัวข้อทันที พร้อมสถานะและสิทธิ์ที่ตรงกับความพร้อมจริง</p></div>
          <div className="market-category-stack">
            {marketCategories.map((category, index) => {
              const apps = platformApps.filter((app) => app.categoryId === category.id);
              return <section className="market-category" key={category.id} data-reveal>
                <header className="market-category__header">
                  <span className="market-category__index">0{index + 1}</span>
                  <div><p className="eyebrow">WORK CATEGORY</p><h3>{category.label}</h3><p>{category.description}</p></div>
                </header>
                <div className="market-category__apps">{apps.map((app) => <AppCard key={app.slug} app={app} />)}</div>
              </section>;
            })}
          </div>
          <TrialPolicyPreview />
        </div>
      </section>

      <section className="section section--white" id="hermes">
        <div className="container">
          <div className="hermes-panel" data-reveal><div className="hermes-panel__icon"><Image src={visualAssetUrl("hermes")} alt="Hermes AI Agentic assistant" width={74} height={74} /></div><div><div className="eyebrow" style={{ color: "var(--teal)" }}>HERMES AI AGENTIC · 24/7</div><h2>ผู้ช่วยทบทวนหลักฐาน ไม่ใช่ผู้ตัดสินแทนวิศวกร</h2><p>Hermes ถูกออกแบบให้ทำงานเบื้องหลังตลอดเวลาเพื่อรับงานตรวจหลักฐาน AI Takeoff และสรุปประเด็นที่ควรทบทวนก่อนผู้ใช้ยืนยันผล</p><p className="hermes-guardrail">Pilot policy: ไม่มีสิทธิ์แก้ราคา ปล่อยเอกสาร ส่งข้อความ หรือเปลี่ยนข้อมูลโครงการเอง</p></div><span className="access access--member_free">ADVISORY PILOT</span></div>
        </div>
      </section>

      <PlatformFooter />
    </main>
  );
}
