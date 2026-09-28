import { LandingMotion } from "@/components/landing/landing-motion";
import { PlatformFooter } from "@/components/platform/platform-footer";
import { V4AppShelf, type ShelfItemView, type ShelfView } from "@/components/landing/v4/app-shelf";
import { V4HermesFeatures, V4HermesStats, V4HermesStory } from "@/components/landing/v4/hermes-sections";
import { V4Hero } from "@/components/landing/v4/hero";
import { V4MenuBar } from "@/components/landing/v4/menu-bar";
import { V4Closing, V4Promo } from "@/components/landing/v4/promo-and-closing";
import { V4SiteHeader } from "@/components/landing/v4/site-header";
import { V4TodayUpdates, type UpdateSlideView } from "@/components/landing/v4/today-updates";
import type { PromoCardView } from "@/components/landing/v3/promo-row";
import { describeCardClaims } from "@/lib/catalogue-card";
import { getAppInteractionContract } from "@/lib/landing-interactions";
import { isPromoLive, promoEndsAt, promoOffers } from "@/lib/landing-v3-data";
import { landingShelves, updateSlides } from "@/lib/landing-v4-data";
import { platformApps } from "@/lib/platform";
import { visualAssetUrl } from "@/lib/visual-assets";
import { readCatalogueClaims } from "@/server/app-registry";
import { readPublishedChannels } from "@/server/platform-channels";

/** โปรโมชั่นหมดอายุตามนาฬิกาจริง — เหตุผลเต็มอยู่ที่ page.tsx รุ่นสาม ห้ามถอดบรรทัดนี้ */
export const dynamic = "force-dynamic";

/**
 * หน้าแรกรุ่นสี่ — ผืน `design_handoff_home_v4/Home Redesign v4 Apple.dc.html`
 * เจ้าของงานเคาะ 2026-09-24: สีแดง v4 · ฟอนต์ตามผืน (Noto Sans Thai ผ่าน `.v3-page`)
 * ปุ่ม LINE แดงทุกจุด · Lekza WORKS เป็นงานบริการ ไม่เข้าทะเบียน · ไม่มี StatStrip
 */
export default async function LandingPage() {
  const [claims, channels] = await Promise.all([readCatalogueClaims(), readPublishedChannels()]);
  const lineHref = channels.find((c) => c.key === "line_oa")?.href ?? null;
  const phone = channels.find((c) => c.key === "phone") ?? null;
  const promoIsLive = isPromoLive();

  const shelves: ShelfView[] = landingShelves.map((shelf) => ({
    id: shelf.id,
    title: shelf.title,
    note: shelf.note ?? null,
    items: shelf.entries.flatMap((entry): ShelfItemView[] => {
      if (entry.kind === "service") {
        return [{ kind: "service" as const, key: entry.id, name: entry.displayName, blurb: entry.blurb, imageUrl: visualAssetUrl(entry.imageKey), statusLabel: entry.statusLabel }];
      }
      const app = platformApps.find((a) => a.slug === entry.slug);
      if (!app) return [];
      const says = describeCardClaims(claims[entry.slug]);
      const open = says.readiness?.modifier === "available";
      return [{
        kind: "app" as const,
        key: entry.slug,
        name: entry.displayName,
        blurb: entry.blurb,
        imageUrl: visualAssetUrl(entry.imageKey),
        realtime: entry.realtime ?? false,
        statusLabel: says.access?.label ?? null,
        statusLive: open,
        readinessLabel: says.readiness?.label ?? null,
        ctaLabel: says.cta.label,
        href: getAppInteractionContract(app, open).detailHref
      }];
    })
  }));

  /** นับเฉพาะแอปในทะเบียนที่อยู่บนเชลฟ์ — ค่าเดียวใช้ทั้งชิปเมนูและตัวนับ */
  const appCount = new Set(shelves.flatMap((s) => s.items).filter((i) => i.kind === "app").map((i) => i.key)).size;

  const slides: UpdateSlideView[] = updateSlides.flatMap((slide) => {
    const app = platformApps.find((a) => a.slug === slide.slug);
    if (!app) return [];
    const says = describeCardClaims(claims[slide.slug]);
    return [{
      slug: slide.slug,
      kicker: slide.kicker,
      title: slide.title,
      desc: slide.desc,
      imageUrl: visualAssetUrl(slide.imageKey),
      ctaLabel: says.cta.label,
      href: getAppInteractionContract(app, says.readiness?.modifier === "available").detailHref
    }];
  });

  const promoCards: PromoCardView[] = promoOffers.flatMap((offer) => {
    const app = platformApps.find((a) => a.slug === offer.slug);
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

  const dateLabel = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  return (
    <main className="site-shell v3-page v4-page">
      <LandingMotion />
      <V4SiteHeader channels={channels} lineHref={lineHref} />
      <V4Hero lineHref={lineHref} imageUrl={visualAssetUrl("lekza_hero")} />
      <V4MenuBar appCount={appCount} promoIsLive={promoIsLive} />
      <V4TodayUpdates slides={slides} dateLabel={dateLabel} />
      <V4HermesStory lineHref={lineHref} storyImageUrl={visualAssetUrl("lekza_mockups")} />
      <V4HermesStats />
      <V4HermesFeatures />
      <V4AppShelf shelves={shelves} appCount={appCount} lineHref={lineHref} />
      {promoIsLive ? <V4Promo cards={promoCards} endsAt={promoEndsAt} /> : null}
      <V4Closing lineHref={lineHref} phone={phone} />
      <PlatformFooter />
    </main>
  );
}
