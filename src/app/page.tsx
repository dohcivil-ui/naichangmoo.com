import type { CSSProperties } from "react";
import { AppCard } from "@/components/landing/app-card";
import { LandingMotion } from "@/components/landing/landing-motion";
import Image from "next/image";
import { PlatformFooter } from "@/components/platform/platform-footer";
import { CategoryBar } from "@/components/landing/v3/category-bar";
import { HeroSlider, type HeroSlideView } from "@/components/landing/v3/hero-slider";
import { HermesCard } from "@/components/landing/v3/hermes-card";
import { PromoRow, type PromoCardView } from "@/components/landing/v3/promo-row";
import { ShopHeader } from "@/components/landing/v3/shop-header";
import { heroSlides, isPromoLive, promoEndsAt, promoOffers } from "@/lib/landing-v3-data";
import { describeCardClaims } from "@/lib/catalogue-card";
import { getAppInteractionContract, landingNavigationContract } from "@/lib/landing-interactions";
import { marketCategories, platformApps } from "@/lib/platform";
import { visualAssetUrl } from "@/lib/visual-assets";
import { readCatalogueClaims } from "@/server/app-registry";
import { StatStrip } from "@/components/landing/stat-strip";
import obecPrices from "@/data/obec/obec-2569-unit-prices.json";
import labourSchedule from "@/data/cgd/cgd-w809-labour-be2568.json";
import escalationRules from "@/data/escalation-k/cabinet-w109-be2532.json";
import { DocCompare } from "@/components/landing/doc-compare";
import { EvidencePeek } from "@/components/landing/evidence-peek";
import { Button } from "@/components/platform/button";

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

  /**
   * แบนเนอร์สไลด์เป็นคอมโพเนนต์ฝั่ง client จึงอ่านทะเบียนเองไม่ได้ — ฝั่ง server อ่านให้แล้ว
   * ส่งลงไปเป็นค่าที่ตัดสินเสร็จแล้ว ทั้งป้ายสิทธิ์และทางเข้า ไม่ใช่ส่งเรคอร์ดดิบลงไปให้มันตีความ
   *
   * ADR 0015: ป้ายกับปุ่มทางเข้าเป็นคำแถลง ป้ายจึงเป็น null เมื่อทะเบียนยังไม่ประกาศ
   * และทางเข้าเป็น null เมื่อทะเบียนยังไม่เปิด · `getAppInteractionContract` เป็นคนตัดสิน
   * เรื่องทางเข้าอยู่แล้วทั้งเว็บ ตรงนี้จึงไม่ได้ตัดสินซ้ำ
   */
  const heroSlideViews: HeroSlideView[] = heroSlides.flatMap((slide) => {
    const app = platformApps.find((item) => item.slug === slide.slug);
    if (!app) return [];
    const says = describeCardClaims(claims[slide.slug]);
    const interaction = getAppInteractionContract(app, says.readiness?.modifier === "available");
    return [{
      slug: slide.slug,
      imageUrl: visualAssetUrl(slide.imageKey),
      title: slide.title,
      subtitle: slide.subtitle,
      body: slide.body,
      tagLabel: says.access?.label ?? null,
      /* ถ้อยคำปุ่มหลักมาจากทะเบียนตัวเดียวกับที่การ์ดแอปทั้งเว็บใช้ ไม่ใช่ `Shop now!`
         ของผืนออกแบบ ซึ่งเป็นคำอังกฤษที่ `copy-th.md` หมวดสามห้าม และสัญญาว่าซื้อได้ทันที
         ทั้งที่ปุ่มพาไปหน้ารายละเอียด · ทะเบียนตอบตามสถานะจริงอยู่แล้ว ไม่ต้องคิดคำใหม่ */
      primaryLabel: says.cta.label,
      detailHref: interaction.detailHref,
      entryHref: interaction.entryHref,
      entryLabel: slide.secondaryCtaLabel
    }];
  });

  /**
   * การ์ดโปรโมชั่น — ราคามาจากไฟล์ค่าตัวอย่าง ส่วนป้ายกับถ้อยคำปุ่มมาจากทะเบียน
   *
   * ADR 0015 §2: ถ้อยคำปุ่มเป็นคำแถลง แอปที่ทะเบียนยังไม่บอกว่าเปิด ปุ่มต้องไม่ชวนให้เริ่มใช้
   * `describeCardClaims().cta` ตอบตามสถานะจริงอยู่แล้ว จึงไม่มีถ้อยคำปุ่มพิมพ์ตายในไฟล์ข้อมูล
   */
  const promoCards: PromoCardView[] = promoOffers.flatMap((offer) => {
    const app = platformApps.find((item) => item.slug === offer.slug);
    if (!app) return [];
    const says = describeCardClaims(claims[offer.slug]);
    return [{
      slug: offer.slug,
      imageUrl: visualAssetUrl(offer.imageKey),
      group: offer.group,
      name: app.name,
      priceBaht: offer.priceBaht,
      wasBaht: offer.wasBaht,
      unit: offer.unit,
      accessLabel: says.access?.label ?? null,
      ctaLabel: says.cta.label,
      detailHref: getAppInteractionContract(app, says.readiness?.modifier === "available").detailHref
    }];
  });

  /**
   * **โปรโมชั่นที่หมดอายุแล้วไม่ใช่โปรโมชั่น** เลยวันสิ้นสุดแล้วทั้งบล็อกไม่ขึ้น
   * ไม่ใช่แค่นาฬิกาหายแล้วปล่อยราคาขีดฆ่าค้างไว้ ซึ่งจะเป็นการเสนอราคาที่ไม่มีอยู่จริง
   */
  const promoIsLive = isPromoLive();

  return (
    <main className="site-shell">
      <LandingMotion />
      {/* หน้าแรกรุ่นสามใช้แถบของหน้าร้านแทนแถบนำทางของแพลตฟอร์ม หน้าอื่นทั้งเว็บยังใช้
          `SiteHeader` เหมือนเดิม · ส่วนที่เหลือของหน้ายังเป็นของเดิม จะทยอยเปลี่ยนทีละบล็อก */}
      <ShopHeader />
      <CategoryBar />

      {/* แถวเปิดหน้าของรุ่นสาม — แบนเนอร์สไลด์คู่กับการ์ด Hermes
          แทน hero เดิมทั้งบล็อก ส่วนที่เหลือของหน้ายังเป็นของเดิมและจะทยอยเปลี่ยนต่อไป */}
      <section className="v3-hero" id="top">
        <HeroSlider slides={heroSlideViews} />
        <HermesCard requestHref={hermesRequestHref} />
      </section>

      {promoIsLive ? <PromoRow cards={promoCards} endsAt={promoEndsAt} /> : null}

      <section className="section section--white stat-band" aria-label="แพลตฟอร์มในตัวเลข">
        <div className="container">
          <div className="eyebrow stat-band__eyebrow" data-reveal style={{ color: "var(--teal-text)" } as CSSProperties}>แพลตฟอร์ม ในตัวเลข — นับจากชุดข้อมูลจริงในระบบ</div>
          <div data-reveal data-delay="120"><StatStrip stats={platformStats} /></div>
        </div>
      </section>

      <section className="section section--white" id="why">
        <div className="container">
          <div className="section-heading" data-reveal style={{ "--fy": "-12px" } as CSSProperties}>
            <div>
              <div className="eyebrow" style={{ color: "var(--teal-text)" }}>ปัญหาที่เครื่องมือนี้แก้</div>
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
          <div className="section-heading" data-reveal style={{ "--fy": "-12px" } as CSSProperties}><div><div className="eyebrow" style={{ color: "var(--teal-text)" }}>แอปงานโยธา</div><h2>เลือกแอปตามหมวดงาน</h2></div></div>
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
          <div className="hermes-panel" data-reveal><div className="hermes-panel__icon"><Image src={visualAssetUrl("hermes")} alt="Hermes assistant" width={74} height={74} /></div><div><div className="eyebrow" style={{ color: "var(--teal-text)" }}>HERMES · 24/7</div><h2>ระบบผู้ช่วยอัตโนมัติ ออกแบบตามงานของคุณ</h2><p>รับออกแบบและติดตั้งระบบผู้ช่วยทำงาน 24/7 ให้องค์กร บริษัท ห้างร้าน และเจ้าของกิจการ ตาม use case ที่ส่งเข้ามา</p></div><Button tone="ink" href={hermesRequestHref}>ส่ง use case ให้ออกแบบ</Button></div>
        </div>
      </section>

      <PlatformFooter />
    </main>
  );
}
