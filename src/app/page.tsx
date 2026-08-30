import type { CSSProperties } from "react";
import { AppCard } from "@/components/landing/app-card";
import { orderByReadiness } from "@/lib/app-showcase-order";
import { LandingMotion } from "@/components/landing/landing-motion";
import { HeroLiveDemo } from "@/components/landing/hero-live-demo";
import { SignInButton } from "@/components/landing/sign-in-button";
import Image from "next/image";
import { PlatformFooter } from "@/components/platform/platform-footer";
import { SiteHeader } from "@/components/platform/site-header";
import { accessLabel, marketCategories, platformApps } from "@/lib/platform";
import { visualAssetUrl } from "@/lib/visual-assets";
import { landingActionContract, landingNavigationContract } from "@/lib/landing-interactions";
import { readCatalogueClaims } from "@/server/app-registry";

export default async function LandingPage() {
  // ADR 0015: the cards below say what an app is from source, and what it costs or whether it is
  // open only as far as the registry has been made to say so. One read serves every category.
  const claims = await readCatalogueClaims();
  // IP-225: แถบเลื่อนเรียงจากแอปที่พร้อมใช้ที่สุดลงมา ลำดับคิดจากสิ่งที่ทะเบียนพูดไว้แล้วเท่านั้น
  // ไม่ใช่เปอร์เซ็นต์ความคืบหน้า ซึ่ง ADR 0015 ปฏิเสธไว้เพราะพิสูจน์ไม่ได้
  const showcaseApps = orderByReadiness(platformApps, (app) => claims[app.slug]);
  // The quotation page is where a Hermes use case is submitted; the nav contract owns the route.
  const hermesRequestHref = landingNavigationContract.find((item) => item.id === "enterprise")?.href ?? "/enterprise";
  const estimeter = claims.estimeter;

  return (
    <main className="site-shell">
      <LandingMotion />
      <SiteHeader />

      <section className="hero" id="top">
        <div className="hero__signals" aria-hidden="true"><span /><span /><span /></div>
        <div className="container hero__grid">
          {/* The hero introduces itself a line at a time rather than as one block: the eyebrow
              settles down from above, then everything under it rises, so the eye is led to the
              headline instead of meeting the whole panel at once. */}
          <div className="hero__copy">
            <div className="eyebrow" data-reveal style={{ "--fy": "-14px" } as CSSProperties}>นายช่างหมู · แอปงานประมาณราคาก่อสร้าง</div>
            {/* IP-192: the headline rises a line at a time behind a clipping mask - the motion
                trick from the approved mockup. The first line wears an outline stroke so the
                second one, which names what the platform actually sells, stays the loudest
                thing on the page. The split point is chosen so each line is a whole phrase:
                Thai has no word spaces, and a line break landing mid-phrase reads as a typo. */}
            <h1 className="hero__headline" data-reveal data-delay="120" style={{ "--fy": "26px" } as CSSProperties}>
              <span className="h1-line"><span className="h1-line__text h1-line__text--outline">ถอดแบบ ประมาณราคา</span></span>
              <span className="h1-line"><span className="h1-line__text">สำหรับผู้รับเหมายุค AI<span className="h1-dot">.</span></span></span>
            </h1>
            <p data-reveal data-delay="240" style={{ "--fy": "18px" } as CSSProperties}>งานที่เคยถอดแบบและคิดราคาด้วยมือหลายวัน ให้ผู้ช่วย AI ร่างให้ก่อน แล้วคุณตรวจและตัดสิน เหมาะกับวิศวกร ผู้รับเหมา และห้างร้านที่ประมาณราคางานอาคาร</p>
          <div className="hero__actions" data-reveal data-delay="360" style={{ "--fy": "14px" } as CSSProperties}><SignInButton /><a className="button button--orange micro-button" href={landingActionContract.allAppsHref}>ดูแอปทั้งหมด</a></div>
            {/* IP-197: บรรทัดหลักการใต้ปุ่มถูกตัดตามคำสั่งเจ้าของงาน 2026-08-28 — ฉากสาธิต
                เล่าเรื่องเดียวกันด้วยภาพแทน (ผู้ช่วยเสนอ คนตัดสิน ระบบคำนวณ) */}
            {/* ADR 0015: naming ESTIMETR is an introduction, but its commercial terms are a
                claim, so the line renders only while the registry says the app is open and the
                access word is the registry's own. Unannounced or closed means no line at all. */}
            {estimeter.open && estimeter.access ? <p className="hero__note" data-reveal data-delay="430" style={{ "--fy": "14px" } as CSSProperties}>ESTIMETR · {accessLabel[estimeter.access]}</p> : null}
          </div>
          {/* IP-197: หน้าต่างสาธิตสดแทนภาพลายเส้นนิ่ง — ฉากผู้ช่วยสร้างแผนงานสี่จังหวะ
              ที่ตัวเลขตรวจย้อนได้จริงกับเอกสาร วสท. (docs/research/s-curve-rules-2026-08-25.md) */}
          <div className="hero__side" data-reveal data-delay="300" style={{ "--fy": "22px" } as CSSProperties}>
            <HeroLiveDemo />
          </div>
        </div>
        {/* IP-197: ราง "เริ่มใช้งาน 01-04" ย้ายจากคอลัมน์ขวามาเป็นแถบแนวนอนเต็มความกว้าง
            ใต้ hero เหนือแถบข้อความวิ่ง — ไฟเดิน 01→04 ชุดเดิมยังทำงาน */}
        <div className="container">
          <aside className="workflow-band" aria-label="การเริ่มใช้งาน" data-reveal data-delay="460" style={{ "--fy": "14px" } as CSSProperties}>
            <h2>เริ่มใช้งาน</h2>
            {["เลือกแอป", "ดูรายละเอียด", "เริ่มใช้งาน", "ทำงานต่อ"].map((step, index) => (
              <div className="workflow-band__step" key={step} tabIndex={0} style={{ "--step": index } as CSSProperties}>
                <span>0{index + 1}</span>
                <div>{step}</div>
              </div>
            ))}
          </aside>
        </div>
        {/* IP-192: a slow marquee of the platform's standing principles. Introductions, not
            claims - no price, no readiness, nothing the registry owns. Pauses on hover; the
            global reduced-motion rule freezes it entirely. */}
        <div className="principle-marquee" aria-hidden="true">
          <div className="principle-marquee__track">
            {[0, 1].map((half) => (
              <div className="principle-marquee__half" key={half}>
                {[
                  "ทุกยอดย้อนกลับไปหาแบบและบัญชีราคาที่อ้างอิงได้",
                  "AI ร่าง — คุณตัดสิน — ระบบคำนวณ",
                  "คิดเงินละเอียดถึงสตางค์ ไม่ปัดทิ้งระหว่างทาง",
                  "ค่าเผื่อเศษต้องระบุเกณฑ์ที่อ้างอิง จึงจะบันทึกได้",
                  "ราคาวัสดุและค่าแรงอ้างบัญชีที่ทางราชการประกาศ"
                ].map((line) => (
                  <span key={line}>{line}<i /></span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* IP-225: แถบเลื่อนแอป แทนแถบตัวเลขกับการ์ดปัญหาสามใบ ตามที่เจ้าของงานสั่ง 2026-08-30
          ลูกเล่นยืมมาจากแถบข้อความใต้ hero ที่มีอยู่แล้ว คือรางคู่ที่เลื่อนวนด้วย CSS อย่างเดียว
          หยุดเมื่อชี้หรือโฟกัส และหยุดสนิทใต้กฎปิดการเคลื่อนไหวรวมของไฟล์ globals
          สำเนาชุดที่สองมีไว้ให้ภาพต่อเนื่องเท่านั้น จึงถูกซ่อนจากโปรแกรมอ่านหน้าจอ */}
      <section className="section section--white" id="why">
        <div className="container">
          <div className="section-heading" data-reveal style={{ "--fy": "-12px" } as CSSProperties}>
            <div>
              <div className="eyebrow" style={{ color: "var(--teal)" }}>แอปของเรา</div>
              <h2>เรียงตามความพร้อมใช้งาน</h2>
            </div>
            <p>แอปที่เปิดให้ใช้แล้วอยู่ต้นแถว ตามด้วยแอปที่กำลังพัฒนา ชี้ค้างไว้เพื่อหยุดแถบ</p>
          </div>
        </div>
        <div className="app-rail" data-reveal data-delay="120">
          <div className="app-rail__track">
            {[0, 1].map((copy) => (
              <div className="app-rail__half" key={copy} aria-hidden={copy === 1 ? true : undefined}>
                {showcaseApps.map((app) => (
                  <AppCard key={`${copy}-${app.slug}`} app={app} claim={claims[app.slug]} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="apps">
        <div className="container">
          <div className="section-heading" data-reveal style={{ "--fy": "-12px" } as CSSProperties}><div><div className="eyebrow" style={{ color: "var(--teal)" }}>แอปงานโยธา</div><h2>เลือกแอปตามประเภทงาน</h2></div></div>
          <div className="market-category-stack">
            {marketCategories.map((category, index) => {
              const apps = platformApps.filter((app) => app.categoryId === category.id);
              return <section className="market-category" key={category.id} data-reveal>
                <header className="market-category__header">
                  <span className="market-category__index">0{index + 1}</span>
                  <div><p className="eyebrow">ประเภทงาน</p><h3>{category.label}</h3><p>{category.description}</p></div>
                </header>
                <div className="market-category__apps">{apps.map((app) => <AppCard key={app.slug} app={app} claim={claims[app.slug]} />)}</div>
              </section>;
            })}
          </div>
        </div>
      </section>

      <section className="section section--white" id="hermes">
        <div className="container">
          {/* Hermes 24/7 is a setup-on-request service (docs/requirements/hermes-24-7-use-case-1.md):
              a visitor sends a use case and the team designs that system, each job with its own
              design record. The panel introduces the service and routes the request into the
              enterprise quotation intake (ADR 0005) - it claims no price and no readiness, so it
              stays on the introduction side of ADR 0015. */}
          <div className="hermes-panel" data-reveal><div className="hermes-panel__icon"><Image src={visualAssetUrl("hermes")} alt="Hermes assistant" width={74} height={74} /></div><div><div className="eyebrow" style={{ color: "var(--teal)" }}>HERMES · 24/7</div><h2>ระบบผู้ช่วยอัตโนมัติ ออกแบบตามงานของคุณ</h2><p>รับออกแบบและติดตั้งระบบผู้ช่วยทำงาน 24/7 ให้องค์กร บริษัท ห้างร้าน และเจ้าของกิจการ ตามลักษณะงานที่ส่งเข้ามา</p></div><a className="button button--primary micro-button" href={hermesRequestHref}>ส่งรายละเอียดงานให้ออกแบบ</a></div>
        </div>
      </section>

      <PlatformFooter />
    </main>
  );
}
