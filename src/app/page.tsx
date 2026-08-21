import { AppCard } from "@/components/landing/app-card";
import { EnterpriseQuoteForm } from "@/components/landing/enterprise-quote-form";
import { SignInButton } from "@/components/landing/sign-in-button";
import { TrialPolicyPreview } from "@/components/landing/trial-policy-preview";
import { EstimateIcon, HermesIcon, LandIcon, NaiChangMooMark, QuoteIcon, SignIcon, WallIcon } from "@/components/icons/platform-icons";
import { platformApps } from "@/lib/platform";

const appIcons = { estimeter: EstimateIcon, rcopt: WallIcon, "traffic-sign": SignIcon, "land-acquisition": LandIcon };

export default function LandingPage() {
  return (
    <main className="site-shell">
      <nav className="site-nav" aria-label="เมนูหลัก">
        <div className="container site-nav__inner">
          <a className="brand" href="#top"><NaiChangMooMark /><span>นายช่างหมู<small>CIVIL APPS ASSISTANT</small></span></a>
          <div className="nav-links"><a href="#apps">แอปของเรา</a><a href="#hermes">Hermes 24/7</a><a href="#enterprise">องค์กร/หน่วยงาน</a></div>
          <SignInButton />
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="container hero__grid">
          <div>
            <div className="eyebrow">ENGINEERING TOOLS, NOT NOISY SOFTWARE</div>
            <h1>เครื่องมือโยธาที่พางานไปทีละขั้น และอธิบายผลได้</h1>
            <p>นายช่างหมูรวมเครื่องมือที่จำเป็นสำหรับงานวิศวกรรมไว้ภายใต้บัญชีเดียว โดยเริ่มจาก ESTIMETR สำหรับประมาณราคางานอาคารที่ตรวจย้อนกลับจากแบบ ปริมาณ ราคา และเอกสารได้</p>
            <div className="hero__actions"><SignInButton /><a className="button button--orange" href="#apps">ดูแอปและสิทธิ์ใช้งาน</a></div>
            <p className="hero__note">สมาชิกใหม่ใช้ ESTIMETR ได้ 5 วัน ไม่เกิน 1 โครงการ โดยข้อมูลยังเปิดดูได้เมื่อสิทธิ์ทดลองหมดอายุ</p>
          </div>
          <aside className="workflow-rail" aria-label="ลำดับงาน ESTIMETR"><h2>ESTIMETR WORKFLOW</h2>{["ตั้งโครงการและแบบ", "กำหนดสเกลและตรวจหลักฐาน", "ถอดปริมาณและทบทวน", "ผูกราคาและจัดทำเอกสาร"].map((step, index) => <div className="workflow-step" key={step}><span>0{index + 1}</span><div>{step}</div></div>)}</aside>
        </div>
      </section>

      <section className="section" id="apps">
        <div className="container">
          <div className="section-heading"><div><div className="eyebrow" style={{ color: "var(--teal)" }}>APP REGISTRY</div><h2>แต่ละแอปมีหน้าที่และสิทธิ์ที่ชัดเจน</h2></div><p>ไม่รวมเมนูที่ไม่เกี่ยวกับงานไว้ในที่เดียว ผู้ใช้เลือกเครื่องมือจากงานที่ต้องทำ และระบบตรวจสิทธิ์จากสมาชิก platform หลังเข้าสู่ระบบ</p></div>
          <div className="app-grid">{platformApps.map((app) => <AppCard key={app.slug} app={app} Icon={appIcons[app.slug as keyof typeof appIcons]} />)}</div>
          <TrialPolicyPreview />
        </div>
      </section>

      <section className="section section--white" id="hermes">
        <div className="container">
          <div className="hermes-panel"><HermesIcon title="Hermes AI Agentic" /><div><div className="eyebrow" style={{ color: "var(--teal)" }}>HERMES AI AGENTIC · 24/7</div><h2>ผู้ช่วยทบทวนหลักฐาน ไม่ใช่ผู้ตัดสินแทนวิศวกร</h2><p>Hermes ถูกออกแบบให้ทำงานเบื้องหลังตลอดเวลาเพื่อรับงานตรวจหลักฐาน AI Takeoff และสรุปประเด็นที่ควรทบทวนก่อนผู้ใช้ยืนยันผล</p><p className="hermes-guardrail">Pilot policy: ไม่มีสิทธิ์แก้ราคา ปล่อยเอกสาร ส่งข้อความ หรือเปลี่ยนข้อมูลโครงการเอง</p></div><span className="access access--member_free">ADVISORY PILOT</span></div>
        </div>
      </section>

      <section className="section" id="enterprise">
        <div className="container quote-grid">
          <div className="quote-intro"><QuoteIcon title="ขอใบเสนอราคาสำหรับองค์กร" /><div className="eyebrow" style={{ color: "var(--teal)" }}>ORGANIZATION / AGENCY</div><h2>ขอใบเสนอราคาสำหรับองค์กรหรือหน่วยงาน</h2><p>แจ้งจำนวนผู้ใช้ แอปที่สนใจ และข้อกำหนดจัดซื้อ เพื่อให้ทีมงานจัดทำข้อเสนอที่ตรงกับบริบทการใช้งานของคุณ</p><p>แบบฟอร์มนี้เป็นเพียงการรับ requirement ยังไม่ถือเป็นใบเสนอราคา สัญญา หรือการชำระเงิน</p></div>
          <EnterpriseQuoteForm />
        </div>
      </section>

      <footer className="footer"><div className="container footer__inner"><div><strong>นายช่างหมู</strong> — CIVIL APPS ASSISTANT</div><p><a href="/roadmap">Roadmap &amp; Handoff</a> · เครื่องมือวิศวกรรมที่เรียบง่าย ตรวจสอบได้ และออกแบบมาเพื่อให้งานเดินหน้า</p></div></footer>
    </main>
  );
}
