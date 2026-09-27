import Image from "next/image";
import { Button } from "@/components/platform/button";
import { LineCta } from "./line-cta";
import { LiveCount } from "./live-count";

export type ShelfItemView =
  | {
      kind: "app";
      key: string;
      name: string;
      blurb: string;
      imageUrl: string;
      realtime: boolean;
      /** `describeCardClaims().access?.label` — null = ทะเบียนยังไม่ประกาศ ช่องนี้เงียบ */
      statusLabel: string | null;
      statusLive: boolean;
      /** `describeCardClaims().readiness?.label` — อยู่ตรงที่ผืนวางราคา */
      readinessLabel: string | null;
      ctaLabel: string;
      href: string;
    }
  | { kind: "service"; key: string; name: string; blurb: string; imageUrl: string; statusLabel: string };

export type ShelfView = { id: string; title: string; note: string | null; items: readonly ShelfItemView[] };

function RealtimeBadge() {
  return (
    <span className="v4-live">
      <span className="v4-live__dot" aria-hidden="true" />
      UPDATE REAL TIME!
      <span className="v4-live__sheen" aria-hidden="true" />
    </span>
  );
}

/**
 * เชลฟ์แอปตามหมวด — ไม่มีหัวข้อ "เชลฟ์ของร้าน" (เจ้าของงานสั่งตัด)
 * กริดใช้ auto-fill เพื่อให้หมวดที่มีแอปตัวเดียวไม่ยืดเต็มแถว
 */
export function V4AppShelf({ shelves, appCount, lineHref }: { shelves: readonly ShelfView[]; appCount: number; lineHref: string | null }) {
  return (
    <section className="v4-apps" id="apps" aria-label="แอปทั้งหมด">
      <div className="v4-wrap">
        <div className="v4-apps__count" data-reveal>
          <span className="v4-ping" aria-hidden="true" />
          <p>มีแอปทั้งหมดตอนนี้ <LiveCount value={appCount} /> แอป</p>
        </div>

        <div className="v4-shelves">
          {shelves.map((shelf) => (
            <section className="v4-shelf" key={shelf.id} aria-labelledby={`v4-shelf-${shelf.id}`}>
              <header className="v4-shelf__head" data-reveal>
                <h3 id={`v4-shelf-${shelf.id}`}>{shelf.title}</h3>
                {shelf.note ? <span className="v4-shelf__note">{shelf.note}</span> : null}
              </header>
              <div className="v4-shelf__grid">
                {shelf.items.map((item, i) => (
                  <article className="v4-card v4-tile" key={item.key} data-reveal data-delay={String(i * 80)}>
                    <div className="v4-card__media">
                      <Image src={item.imageUrl} alt="" fill sizes="(max-width: 640px) 100vw, 400px" />
                    </div>
                    <div className="v4-card__body">
                      {item.kind === "app" && item.realtime ? <RealtimeBadge /> : null}
                      {item.statusLabel ? (
                        <p className={`v4-card__status${item.kind === "service" || item.statusLive ? " v4-card__status--live" : ""}`}>{item.statusLabel}</p>
                      ) : null}
                      <h4 className="v4-card__name">{item.name}</h4>
                      <p className="v4-card__desc">{item.blurb}</p>
                      {item.kind === "service" ? (
                        <div className="v4-card__cta"><LineCta href={lineHref} size="sm" /></div>
                      ) : (
                        <>
                          {item.readinessLabel ? <p className="v4-card__price">{item.readinessLabel}</p> : null}
                          <div className="v4-card__cta"><Button tone="shopNav" size={40} href={item.href}>{item.ctaLabel}</Button></div>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
