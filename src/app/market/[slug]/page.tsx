import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformFooter } from "@/components/platform/platform-footer";
import { PlatformNav } from "@/components/platform/platform-nav";
import { accessLabel, appStatusLabel, marketCategories, platformApps } from "@/lib/platform";

export default async function MarketAppDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = platformApps.find((item) => item.slug === slug);
  if (!app) notFound();

  const category = marketCategories.find((item) => item.id === app.categoryId);
  const canEnter = app.status === "available";

  return (
    <main className="site-shell market-detail">
      <PlatformNav />
      <section className="market-detail__hero">
        <div className="container">
          <Link className="market-detail__back" href="/#apps">← กลับไปดูทุกแอป</Link>
          <div className="market-detail__lead">
            <div>
              <div className="eyebrow">{category?.label ?? "CIVIL APPS MARKET"}</div>
              <h1>{app.name}</h1>
              <p>{app.marketDetail.outcome}</p>
              <div className="market-detail__badges">
                <span className={`access access--${app.access}`}>{accessLabel[app.access]}</span>
                <span className={`app-status app-status--${app.status}`}>{appStatusLabel[app.status]}</span>
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
          <section className="market-entry-panel">
            <div><div className="eyebrow">ACCESS STATUS</div><h2>{canEnter ? "เริ่มจาก workspace แบบมีขั้นตอนได้" : "สถานะการเปิดใช้ต้องชัดเจนก่อนเริ่มงาน"}</h2><p>{app.marketDetail.availabilityNote}</p></div>
            {canEnter ? <Link className="button button--orange micro-button" href={app.href}>เริ่มทดลองใช้ฟรี 5 วัน</Link> : <div className="market-entry-panel__locked"><strong>{appStatusLabel[app.status]}</strong><span>อ่านรายละเอียดนี้ได้ก่อน ระบบจะไม่พาเข้า workspace ที่ยังไม่พร้อม</span></div>}
          </section>
        </div>
      </section>
      <PlatformFooter />
    </main>
  );
}
