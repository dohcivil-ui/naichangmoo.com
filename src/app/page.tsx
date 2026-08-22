import { AppCard } from "@/components/landing/app-card";
import { EnterpriseQuoteForm } from "@/components/landing/enterprise-quote-form";
import { LandingMotion } from "@/components/landing/landing-motion";
import { SignInButton } from "@/components/landing/sign-in-button";
import { TrialPolicyPreview } from "@/components/landing/trial-policy-preview";
import { QuoteIcon } from "@/components/icons/platform-icons";
import Image from "next/image";
import { PlatformFooter } from "@/components/platform/platform-footer";
import { PlatformNav } from "@/components/platform/platform-nav";
import { platformApps } from "@/lib/platform";
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
            <div className="eyebrow">ENGINEERING TOOLS, NOT NOISY SOFTWARE</div>
            <h1>เครื่องมือโยธาที่พางานไปทีละขั้น และอธิบายผลได้</h1>
            <p>นายช่างหมูรวมเครื่องมือที่จำเป็นสำหรับงานวิศวกรรมไว้ภายใต้บัญชีเดียว โดยเริ่มจาก ESTIMETR สำหรับประมาณราคางานอาคารที่ตรวจย้อนกลับจากแบบ ปริมาณ ราคา และเอกสารได้</p>
          <div className="hero__actions"><SignInButton /><a className="button button--orange micro-button" href="#apps">ดูแอปและสิทธิ์ใช้งาน</a></div>
            <p className="hero__note">สมาชิกใหม่ใช้ ESTIMETR ได้ 5 วัน ไม่เกิน 1 โครงการ โดยข้อมูลยังเปิดดูได้เมื่อสิทธิ์ทดลองหมดอายุ</p>
          </div>
          <aside className="workflow-rail" aria-label="ลำดับงาน ESTIMETR" data-reveal data-reveal-delay="1"><h2>ESTIMETR WORKFLOW</h2>{["ตั้งโครงการและแบบ", "กำหนดสเกลและตรวจหลักฐาน", "ถอดปริมาณและทบทวน", "ผูกราคาและจัดทำเอกสาร"].map((step, index) => <div className="workflow-step" key={step} tabIndex={0}><span>0{index + 1}</span><div>{step}</div></div>)}</aside>
        </div>
      </section>

      <section className="section" id="apps">
        <div className="container">
          <div className="section-heading" data-reveal><div><div className="eyebrow" style={{ color: "var(--teal)" }}>APP REGISTRY</div><h2>แต่ละแอปมีหน้าที่และสิทธิ์ที่ชัดเจน</h2></div><p>ไม่รวมเมนูที่ไม่เกี่ยวกับงานไว้ในที่เดียว ผู้ใช้เลือกเครื่องมือจากงานที่ต้องทำ และระบบตรวจสิทธิ์จากสมาชิก platform หลังเข้าสู่ระบบ</p></div>
          <div className="app-grid">{platformApps.map((app) => <AppCard key={app.slug} app={app} />)}</div>
          <TrialPolicyPreview />
        </div>
      </section>

      <section className="section section--white" id="hermes">
        <div className="container">
          <div className="hermes-panel" data-reveal><div className="hermes-panel__icon"><Image src={visualAssetUrl("hermes")} alt="Hermes AI Agentic assistant" width={74} height={74} /></div><div><div className="eyebrow" style={{ color: "var(--teal)" }}>HERMES AI AGENTIC · 24/7</div><h2>ผู้ช่วยทบทวนหลักฐาน ไม่ใช่ผู้ตัดสินแทนวิศวกร</h2><p>Hermes ถูกออกแบบให้ทำงานเบื้องหลังตลอดเวลาเพื่อรับงานตรวจหลักฐาน AI Takeoff และสรุปประเด็นที่ควรทบทวนก่อนผู้ใช้ยืนยันผล</p><p className="hermes-guardrail">Pilot policy: ไม่มีสิทธิ์แก้ราคา ปล่อยเอกสาร ส่งข้อความ หรือเปลี่ยนข้อมูลโครงการเอง</p></div><span className="access access--member_free">ADVISORY PILOT</span></div>
        </div>
      </section>

      <section className="section" id="enterprise">
        <div className="container quote-grid">
          <div className="quote-intro" data-reveal><QuoteIcon title="ขอใบเสนอราคาสำหรับองค์กร" /><div className="eyebrow" style={{ color: "var(--teal)" }}>ORGANIZATION / AGENCY</div><h2>ขอใบเสนอราคาสำหรับองค์กรหรือหน่วยงาน</h2><p>แจ้งจำนวนผู้ใช้ แอปที่สนใจ และข้อกำหนดจัดซื้อ เพื่อให้ทีมงานจัดทำข้อเสนอที่ตรงกับบริบทการใช้งานของคุณ</p><p>แบบฟอร์มนี้เป็นเพียงการรับ requirement ยังไม่ถือเป็นใบเสนอราคา สัญญา หรือการชำระเงิน</p></div>
          <EnterpriseQuoteForm />
        </div>
      </section>

      <PlatformFooter />
    </main>
  );
}
