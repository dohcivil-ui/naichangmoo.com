import type { CSSProperties } from "react";
import { AppCard } from "@/components/landing/app-card";
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
import { StatStrip } from "@/components/landing/stat-strip";
import obecPrices from "@/data/obec/obec-2569-unit-prices.json";
import labourSchedule from "@/data/cgd/cgd-w809-labour-be2568.json";
import escalationRules from "@/data/escalation-k/cabinet-w109-be2532.json";
import { DocCompare } from "@/components/landing/doc-compare";
import { EvidencePeek } from "@/components/landing/evidence-peek";

export default async function LandingPage() {
  // ADR 0015: the cards below say what an app is from source, and what it costs or whether it is
  // open only as far as the registry has been made to say so. One read serves every category.
  const claims = await readCatalogueClaims();
  // IP-192: the stat strip counts up, so every number in it must be one the platform can stand
  // behind AND one a customer actually cares about. The owner cut the internal roadmap counts
  // (2026-08-27) - progress bookkeeping lives on /roadmap for those who go looking. What remains
  // is counted from the real datasets shipped in the repo, never typed as a literal.
  const labourRateCount = (labourSchedule as { variants: { rates: unknown[] }[] }[]).reduce(
    (total, item) => total + item.variants.reduce((sum, variant) => sum + variant.rates.length, 0),
    0
  );
  const platformStats = [
    { value: platformApps.length, label: "แอปงานโยธาในทะเบียน" },
    { value: obecPrices.length, label: "รายการบัญชีราคา สพฐ. 2569" },
    { value: labourRateCount, label: "อัตราค่าแรงราชการ ว 809" },
    { value: (escalationRules as { formulas: unknown[] }).formulas.length, label: "สูตรค่า K ตาม ว 109" }
  ];
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
            <div className="eyebrow" data-reveal style={{ "--fy": "-14px" } as CSSProperties}>นายช่างหมู · แอปงานโยธา</div>
            {/* IP-192: the headline rises a line at a time behind a clipping mask - the motion
                trick from the approved mockup. The first line wears an outline stroke so the
                second one, which names what the platform actually sells, stays the loudest
                thing on the page. The split point is chosen so each line is a whole phrase:
                Thai has no word spaces, and a line break landing mid-phrase reads as a typo. */}
            <h1 className="hero__headline" data-reveal data-delay="120" style={{ "--fy": "26px" } as CSSProperties}>
              <span className="h1-line"><span className="h1-line__text h1-line__text--outline">เสริมพลังให้แอป</span></span>
              <span className="h1-line"><span className="h1-line__text">ด้วยผู้ช่วย AI<span className="h1-dot">.</span></span></span>
            </h1>
            <p data-reveal data-delay="240" style={{ "--fy": "18px" } as CSSProperties}>ไม่ใช่แค่ทำงานเร็วขึ้น — แต่เป็นผู้ช่วยคอยตรวจสอบความผิดพลาดของงานคุณ</p>
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
        {/* IP-226: เจ้าของงานเคาะ 2026-09-01 ว่าห้าขั้นตอนทำงานของ ESTIMETR เป็นความรู้
            ของระบบ ให้เก็บไว้โชว์สมาชิกในแอป ไม่ใช่บนหน้าขาย หน้าแรกขายแอปก็พอ
            แถบเริ่มใช้งาน 01-04 จึงกลับมาเหมือนเดิม ส่วนสไตล์ .run-window ที่ทำไว้
            ยังอยู่ใน globals.css รอเอาไปใช้ในหน้าแอป */}
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
      </section>

      <section className="section section--white stat-band" aria-label="แพลตฟอร์มในตัวเลข">
        <div className="container">
          <div className="eyebrow stat-band__eyebrow" data-reveal style={{ color: "var(--teal)" } as CSSProperties}>แพลตฟอร์ม ในตัวเลข — นับจากชุดข้อมูลจริงในระบบ</div>
          <div data-reveal data-delay="120"><StatStrip stats={platformStats} /></div>
        </div>
      </section>

      <section className="section section--white" id="why">
        <div className="container">
          <div className="section-heading" data-reveal style={{ "--fy": "-12px" } as CSSProperties}>
            <div>
              <div className="eyebrow" style={{ color: "var(--teal)" }}>ปัญหาที่เครื่องมือนี้แก้</div>
              {/* IP-226: ประโยคเดิมเป็นรูปคติพจน์ที่ docs/rules/copy-th.md หมวดสี่ยกเป็นตัวอย่างข้อห้ามข้อแรก
                  เปลี่ยนเป็นการบอกสิ่งที่ระบบทำ ด้วยคำของสามการ์ดที่อยู่ใต้หัวข้อนี้ */}
              <h2>ปริมาณ ค่าเผื่อ และตัวคูณ ต้องชี้เอกสารต้นทางได้ทุกตัว</h2>
            </div>
            <p>ตัวเลขในตัวอย่างของส่วนนี้เป็นตัวอย่างประกอบเพื่อสาธิต</p>
          </div>
          <div className="evidence-gap">
            {[
              {
                title: "ปริมาณที่ตรวจย้อนกลับไม่ได้",
                proof: (
                  <div className="evidence-proof">
                    <span className="evidence-proof__line">2 × 2.50 × 2.50 × 2.00 = <b>12.50 ลบ.ม.</b> <i className="evidence-proof__tag">อ่านได้จากแบบ</i></span>
                    <s className="evidence-proof__bad">1.25 — ไม่มีบรรทัดวัด</s>
                  </div>
                ),
                problem: "12.5 ลบ.ม. ที่ถูก กับ 1.25 ที่พิมพ์ตกหลักทศนิยม หน้าตาเหมือนกันหมดในตาราง ไม่มีอะไรบอกว่าเลขนี้มาจาก 2.50 × 2.50 × 2.00 หรือมาจากนิ้วที่พลาด",
                answer: "ปริมาณเป็นผลรวมของบรรทัดวัด จำนวน × กว้าง × ยาว × หนา ที่อ่านออกจากแบบได้ ไม่ใช่ตัวเลขที่พิมพ์เข้าไปเฉย ๆ",
              },
              {
                title: "ค่าเผื่อที่ไม่รู้ว่ามาจากเกณฑ์ข้อไหน",
                proof: (
                  <div className="evidence-proof">
                    <span className="evidence-proof__line"><i className="evidence-proof__tag">หลักเกณฑ์เผื่อฯ · ข้อ 4.1</i> <b>3%</b> บันทึกได้</span>
                    <s className="evidence-proof__bad">7% ไม่ระบุที่มา — ถูกปฏิเสธ</s>
                  </div>
                ),
                problem: "เผื่อ 7% ใส่ไว้ตั้งแต่เมื่อไหร่ ใครใส่ อ้างหลักเกณฑ์ฉบับไหน วันที่ถูกซัก ถ้าชี้เอกสารต้นทางไม่ได้ ตัวเลขนั้นก็ยืนไม่ได้",
                answer: "ค่าเผื่อที่ไม่ระบุที่มา ถูกปฏิเสธตั้งแต่ตอนบันทึกลงฐานข้อมูล ไม่ใช่แค่ข้อความเตือนบนหน้าจอที่กดข้ามได้",
              },
              {
                title: "ตัวคูณที่หยิบมาจากไฟล์เดิม",
                proof: (
                  <div className="evidence-proof">
                    <span className="evidence-proof__line">งานอาคาร · ดอกเบี้ย 6% · <b>Factor F ตามแถวพิมพ์</b></span>
                    <span className="evidence-proof__ref">อ้างหนังสือ กค 0433.2/ว 481</span>
                  </div>
                ),
                problem: "ตาราง Factor F ผูกกับอัตราดอกเบี้ยเงินกู้ที่ประกาศไว้ โครงการที่คิดบนอัตราหนึ่งจะใช้ค่าจากตารางอีกอัตราไม่ได้ ผลลัพธ์จะออกมาหน้าตาเป็นทางการและผิด",
                answer: "ทุกค่าที่เข้าการคำนวณต้องผูกกับเอกสารที่ระบุผู้ออก เลขที่หนังสือและวันที่ — ชั้นราคายังอยู่ระหว่างพัฒนา ยังไม่เปิดใช้งาน",
              },
            ].map((item, index) => (
              <article className="evidence-gap__item" key={item.title} data-reveal style={{ "--reveal-delay": index } as CSSProperties}>
                <span className="evidence-gap__index">0{index + 1}</span>
                <h3>{item.title}</h3>
                <p className="evidence-gap__problem">{item.problem}</p>
                <p className="evidence-gap__answer">{item.answer}</p>
                <EvidencePeek proof={item.proof} />
              </article>
            ))}
          </div>

          {/* IP-192: the draggable before/after from the approved mockup. An illustration and
              labelled as one - it introduces the difference, and claims nothing. */}
          <div className="doc-compare-block" data-reveal>
            <div className="doc-compare-block__head">
              <h3>เอกสารเดิมของคุณ เทียบของเรา</h3>
              <p>ลากแถบตรงกลางหรือใช้ปุ่มลูกศรเทียบดู — ตัวอย่างประกอบเพื่อสาธิต</p>
            </div>
            <DocCompare />
          </div>
        </div>
      </section>

      <section className="section" id="apps">
        <div className="container">
          <div className="section-heading" data-reveal style={{ "--fy": "-12px" } as CSSProperties}><div><div className="eyebrow" style={{ color: "var(--teal)" }}>แอปงานโยธา</div><h2>เลือกแอปตามหมวดงาน</h2></div></div>
          <div className="market-category-stack">
            {marketCategories.map((category, index) => {
              const apps = platformApps.filter((app) => app.categoryId === category.id);
              return <section className="market-category" key={category.id} data-reveal>
                <header className="market-category__header">
                  <span className="market-category__index">0{index + 1}</span>
                  <div><p className="eyebrow">หมวดงาน</p><h3>{category.label}</h3><p>{category.description}</p></div>
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
          <div className="hermes-panel" data-reveal><div className="hermes-panel__icon"><Image src={visualAssetUrl("hermes")} alt="Hermes assistant" width={74} height={74} /></div><div><div className="eyebrow" style={{ color: "var(--teal)" }}>HERMES · 24/7</div><h2>ระบบผู้ช่วยอัตโนมัติ ออกแบบตามงานของคุณ</h2><p>รับออกแบบและติดตั้งระบบผู้ช่วยทำงาน 24/7 ให้องค์กร บริษัท ห้างร้าน และเจ้าของกิจการ ตาม use case ที่ส่งเข้ามา</p></div><a className="button button--primary micro-button" href={hermesRequestHref}>ส่ง use case ให้ออกแบบ</a></div>
        </div>
      </section>

      <PlatformFooter />
    </main>
  );
}
