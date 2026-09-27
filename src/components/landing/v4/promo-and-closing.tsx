import { Button } from "@/components/platform/button";
import type { PromoCardView } from "@/components/landing/v3/promo-row";
import { Countdown } from "./countdown";
import { LineCta } from "./line-cta";
import { PendingChannel } from "./pending-channel";
import type { PublishedChannel } from "./site-header";

const baht = (n: number) => `฿ ${n.toLocaleString("th-TH")}`;

/**
 * บล็อกโปรโมชั่น — page เรนเดอร์บล็อกนี้เฉพาะเมื่อ `isPromoLive()` เป็นจริง
 * **บรรทัด "ราคาตัวอย่าง" ห้ามเอาออก** จนกว่าราคาจริงจะมา (หมายเหตุใน `landing-v3-data.ts`)
 */
export function V4Promo({ cards, endsAt }: { cards: readonly PromoCardView[]; endsAt: string }) {
  const endLabel = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" }).format(new Date(endsAt));
  return (
    <section className="v4-promo" id="price" aria-labelledby="v4-promo-title">
      <div className="v4-wrap v4-wrap--1024">
        <h2 id="v4-promo-title" className="v4-h2" data-reveal>โปรโมชั่นเดือนนี้.</h2>
        <p className="v4-body v4-promo__note" data-reveal>ราคาตัวอย่าง รอยืนยันจากทะเบียนแอป · ถึง {endLabel}</p>
        <div className="v4-countdown-row" data-reveal>
          <span className="v4-countdown-row__label">หมดเขตใน</span>
          <Countdown endsAt={endsAt} />
        </div>
        <div className="v4-promo__grid">
          {cards.map((c, i) => (
            <article className="v4-promo-card" key={c.slug} data-reveal data-delay={String(i * 120)}>
              {c.accessLabel ? <p className="v4-promo-card__badge">{c.accessLabel}</p> : null}
              <h3 className="v4-promo-card__name">{c.name}</h3>
              <p className="v4-promo-card__group">{c.group}</p>
              <p className="v4-promo-card__price">
                <span className="v3-hd">{baht(c.priceBaht)}</span>
                <span className="v4-promo-card__unit">{c.unit}</span>
              </p>
              {c.wasBaht !== null ? <p className="v4-promo-card__was"><s className="v3-hd">{baht(c.wasBaht)}</s></p> : <p className="v4-promo-card__was" />}
              <div className="v4-promo-card__cta"><Button tone="shopNav" size={40} href={c.detailHref}>{c.ctaLabel}</Button></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function V4Closing({ lineHref, phone }: { lineHref: string | null; phone: PublishedChannel | null }) {
  return (
    <section className="v4-closing" id="quote" aria-labelledby="v4-closing-title">
      <h2 id="v4-closing-title" className="v4-h2 v4-h2--xl" data-reveal>เริ่มจากคุยกันก่อน.</h2>
      <p className="v4-closing__lede" data-reveal>ปรึกษาฟรีทาง LINE OA ตอบภายใน 24 ชั่วโมง</p>
      <div className="v4-closing__actions" data-reveal>
        <LineCta href={lineHref} />
        {/* แสดงเสมอตามผืน (เจ้าของงานเคาะ 2026-09-28) · ยังไม่มีเบอร์ = ปุ่มที่กดได้แต่ไม่พาไปไหน */}
        {phone ? (
          <a className="v4-link v4-link--accent" href={phone.href}>โทร <span className="v3-hd">{phone.display}</span> ›</a>
        ) : (
          <PendingChannel as="plain" className="v4-link v4-link--accent" message="ยังไม่ได้ตั้งค่าเบอร์โทร">โทร · เร็ว ๆ นี้</PendingChannel>
        )}
      </div>
    </section>
  );
}
