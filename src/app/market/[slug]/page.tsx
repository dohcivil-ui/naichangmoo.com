import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MethodClaimsPanel } from "@/components/platform/method-claims-panel";
import { PlatformFooter } from "@/components/platform/platform-footer";
import { SiteHeader } from "@/components/platform/site-header";
import { accessLabel, appReadinessLabel, marketCategories, platformApps } from "@/lib/platform";
import { getAppInteractionContract, landingActionContract } from "@/lib/landing-interactions";
import { readCatalogueClaims } from "@/server/app-registry";

export default async function MarketAppDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = platformApps.find((item) => item.slug === slug);
  if (!app) notFound();

  const category = marketCategories.find((item) => item.id === app.categoryId);
  // ADR 0014 named this page beside the landing page as the place still claiming from source, and
  // ADR 0015 is what closes it: the badges and the entry offer below come from the registry.
  const claim = (await readCatalogueClaims())[app.slug];
  const interaction = getAppInteractionContract(app, claim.open);

  return (
    <main className="site-shell market-detail">
      <SiteHeader />
      <section className="market-detail__hero">
        <div className="container">
          <Link className="market-detail__back" href={landingActionContract.allAppsHref}>← {landingActionContract.allAppsLabel}</Link>
          <div className="market-detail__lead">
            <div>
              <div className="eyebrow">{category?.label ?? "แอปงานโยธา"}</div>
              <h1>{app.name}</h1>
              <p>{app.marketDetail.outcome}</p>
              <div className="market-detail__badges">
                {claim.access ? <span className={`access access--${claim.access}`}>{accessLabel[claim.access]}</span> : null}
                {claim.announced ? <span className={`app-status app-status--${claim.open ? "available" : "coming_soon"}`}>{appReadinessLabel[claim.open ? "open" : "preparing"]}</span> : null}
              </div>
            </div>
            <div className={`market-detail__art market-detail__art--${app.slug}`}><Image src={app.iconSrc} alt={app.iconAlt} width={180} height={180} priority /></div>
          </div>
        </div>
      </section>

      <section className="section section--white market-detail__body">
        <div className="container">
          <div className="market-detail__grid">
            <article className="market-detail__card"><div className="eyebrow">WHAT TO PREPARE</div><h2>เริ่มจากสิ่งที่ต้องเตรียม</h2><ul>{app.marketDetail.preparation.map((item, index) => <li key={item}><span>0{index + 1}</span>{item}</li>)}</ul></article>
            <article className="market-detail__card"><div className="eyebrow">GUIDED FLOW</div><h2>ลำดับการทำงาน</h2><ol>{app.marketDetail.flow.map((item) => <li key={item}>{item}</li>)}</ol></article>
          </div>

          {/* คำแนะนำเรื่องกลไก ไม่ใช่คำแถลงเรื่องสิทธิ์หรือความพร้อม จึงมาจาก source ได้
              ตาม ADR 0015 ข้อ 2 · เนื้อความอยู่ที่ method-claims.ts ที่เดียว ไม่คัดลอกมาไว้ที่นี่ */}
          <MethodClaimsPanel appSlug={app.slug} />
          <section className="market-entry-panel">
            {/* ADR 0018: the availability sentence is a registry claim. An app nobody announced keeps the
                 heading (there is factually no way in) and gets no sentence at all, which is what stopped
                 the registry heading and a source-typed free-trial line contradicting each other here. */}
            <div><div className="eyebrow">การเข้าใช้งาน</div><h2>{interaction.canEnter ? "เริ่มใช้งาน" : "ยังไม่เปิดให้เข้าใช้"}</h2>{claim.availabilityNote ? <p>{claim.availabilityNote}</p> : null}</div>
            {interaction.canEnter && interaction.entryHref ? <Link className="button button--orange micro-button" href={interaction.entryHref}>{claim.access ? accessLabel[claim.access] : "เริ่มใช้งาน"}</Link> : <div className="market-entry-panel__locked">{claim.announced ? <strong>{appReadinessLabel.preparing}</strong> : null}<span>ดูรายละเอียดแอปได้</span></div>}
          </section>
        </div>
      </section>
      <PlatformFooter />
    </main>
  );
}
