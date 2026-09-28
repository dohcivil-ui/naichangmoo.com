import { hermesFeatures, hermesStats, hermesStoryCopy, storyCaptions, type FeatureIcon } from "@/lib/landing-v4-data";
import { LineCta } from "./line-cta";
import { StoryScroller } from "./story-scroller";

/** ไอคอนเส้น 1.5 วาดด้วย currentColor — สีมาจาก `.v4-feature__icon` */
function FeatureGlyph({ name }: { name: FeatureIcon }) {
  const paths: Record<FeatureIcon, string[]> = {
    chat: ["M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"],
    calendar: ["M3 5h18v16H3z", "M3 10h18", "M8 3v4", "M16 3v4"],
    chart: ["M4 20h16", "M6 16V9", "M11 16V4", "M16 16v-6", "M21 16v-3"],
    link: ["M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1", "M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"]
  };
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

export function V4HermesStory({ lineHref, storyImageUrl }: { lineHref: string | null; storyImageUrl: string }) {
  const c = hermesStoryCopy;
  return (
    <section className="v4-hermes" id="hermes">
      <div className="v4-hermes__head" data-reveal>
        <p className="v4-kicker">{c.kicker}</p>
        <h2 className="v4-h2">{c.titleTop}<br />{c.titleBottom}</h2>
        <p className="v4-body v4-hermes__body">
          {c.bodyBefore}<span className="v4-nowrap">{c.bodyTeam}</span>{c.bodyAfter}
        </p>
        <div className="v4-hermes__cta"><LineCta href={lineHref} /></div>
      </div>
      <StoryScroller imageUrl={storyImageUrl} alt="ตัวอย่าง Mini App ที่ออกแบบตาม use case" captions={storyCaptions} />
    </section>
  );
}

export function V4HermesStats() {
  return (
    <section className="v4-stats" aria-labelledby="v4-stats-title">
      <div className="v4-wrap v4-wrap--900">
        <h2 id="v4-stats-title" className="v4-h2" data-reveal>ตอบทุกข้อความ<br />ก่อนคุณตื่น.</h2>
        <p className="v4-body v4-stats__lede" data-reveal>Hermes ทำงานบนเซิร์ฟเวอร์ของเรา ไม่ต้องเปิดคอมทิ้งไว้ และส่งสรุปให้คุณทุกเช้า</p>
        <div className="v4-stats__grid">
          {hermesStats.map((s, i) => (
            <div key={s.label} data-reveal data-delay={String(i * 120)}>
              <p className={`v4-stat${s.accent ? " v4-stat--accent" : ""}`}>
                <span className="v3-hd">{s.value}</span>
                {s.unit ? <span className="v4-stat__unit">{s.unit}</span> : null}
              </p>
              <p className="v4-stat__label">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function V4HermesFeatures() {
  return (
    <section className="v4-features" id="features" aria-labelledby="v4-features-title">
      <div className="v4-wrap v4-wrap--1024">
        <h2 id="v4-features-title" className="v4-h2 v4-h2--md" data-reveal>ทำอะไรได้บ้าง.</h2>
        <div className="v4-features__grid">
          {hermesFeatures.map((f, i) => (
            <article className="v4-feature v4-tile" key={f.title} data-reveal data-delay={String(i * 100)}>
              <span className="v4-feature__icon"><FeatureGlyph name={f.icon} /></span>
              <h3 className="v4-feature__title">{f.title}</h3>
              <p className="v4-feature__desc">{f.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
