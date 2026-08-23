import type { CSSProperties } from "react";
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
            <aside className="workflow-rail" aria-label="การเริ่มใช้งาน"><h2>เริ่มใช้งาน</h2>{["เลือกแอป", "ดูรายละเอียด", "เริ่มใช้งาน", "ทำงานต่อ"].map((step, index) => <div className="workflow-step" key={step} tabIndex={0} style={{ "--step": index } as CSSProperties}><span>0{index + 1}</span><div>{step}</div></div>)}</aside>
          </div>
        </div>
      </section>

      <section className="section section--white" id="why">
        <div className="container">
          <div className="section-heading" data-reveal>
            <div>
              <div className="eyebrow" style={{ color: "var(--teal)" }}>ปัญหาที่เครื่องมือนี้แก้</div>
              <h2>ตัวเลขที่ตอบไม่ได้ว่ามาจากไหน คือตัวเลขที่ป้องกันตัวเองไม่ได้</h2>
            </div>
          </div>
          <div className="evidence-gap">
            {[
              {
                title: "ปริมาณที่ตรวจย้อนกลับไม่ได้",
                problem: "12.5 ลบ.ม. ที่ถูก กับ 1.25 ที่พิมพ์ตกหลักทศนิยม หน้าตาเหมือนกันหมดในตาราง ไม่มีอะไรบอกว่าเลขนี้มาจาก 2.50 × 2.50 × 2.00 หรือมาจากนิ้วที่พลาด",
                answer: "ปริมาณเป็นผลรวมของบรรทัดวัด จำนวน × กว้าง × ยาว × หนา ที่อ่านออกจากแบบได้ ไม่ใช่ตัวเลขที่พิมพ์เข้าไปเฉย ๆ",
              },
              {
                title: "ค่าเผื่อที่ไม่รู้ว่ามาจากเกณฑ์ข้อไหน",
                problem: "เผื่อ 7% ใส่ไว้ตั้งแต่เมื่อไหร่ ใครใส่ อ้างหลักเกณฑ์ฉบับไหน วันที่ถูกซัก ถ้าชี้เอกสารต้นทางไม่ได้ ตัวเลขนั้นก็ยืนไม่ได้",
                answer: "ค่าเผื่อที่ไม่ระบุที่มา ถูกปฏิเสธตั้งแต่ตอนบันทึกลงฐานข้อมูล ไม่ใช่แค่ข้อความเตือนบนหน้าจอที่กดข้ามได้",
              },
              {
                title: "ตัวคูณที่หยิบมาจากไฟล์เดิม",
                problem: "ตาราง Factor F ผูกกับอัตราดอกเบี้ยเงินกู้ที่ประกาศไว้ โครงการที่คิดบนอัตราหนึ่งจะใช้ค่าจากตารางอีกอัตราไม่ได้ ผลลัพธ์จะออกมาหน้าตาเป็นทางการและผิด",
                answer: "ทุกค่าที่เข้าการคำนวณต้องผูกกับเอกสารที่ระบุผู้ออก เลขที่หนังสือและวันที่ — ชั้นราคายังอยู่ระหว่างพัฒนา ยังไม่เปิดใช้งาน",
              },
            ].map((item, index) => (
              <article className="evidence-gap__item" key={item.title} data-reveal style={{ "--reveal-delay": index } as CSSProperties}>
                <span className="evidence-gap__index">0{index + 1}</span>
                <h3>{item.title}</h3>
                <p className="evidence-gap__problem">{item.problem}</p>
                <p className="evidence-gap__answer">{item.answer}</p>
              </article>
            ))}
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
