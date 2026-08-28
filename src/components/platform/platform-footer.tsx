import Image from "next/image";
import Link from "next/link";
import { businessOperator, describeTrustRow } from "@/lib/business-identity";
import { landingActionContract } from "@/lib/landing-interactions";
import { visualAssetUrl } from "@/lib/visual-assets";
import { readAnnouncedApps } from "@/server/app-registry";
import { readPublishedChannels } from "@/server/platform-channels";

/**
 * ท้ายเว็บโครงเต็ม ตามที่เจ้าของงานสั่ง 2026-08-28: คอลัมน์ตรา+ผู้ประกอบการ+ช่องทางติดต่อ ·
 * แอปของเรา · แพลตฟอร์ม · นโยบายและการรับรอง — โครงตามตัวอย่างที่เขาชี้ สีจากศูนย์กลางการออกแบบ
 *
 * กติกาที่คุมทุกช่อง: **ของที่ยังไม่มีจริง ไม่ขึ้น** — ช่องทางติดต่อมาจากตารางที่ผู้ดูแลกรอก
 * (ช่องว่างถูกซ่อน) รายชื่อแอปมาจากทะเบียนเฉพาะที่ประกาศแล้ว ตรารับรองขึ้นเมื่อผู้ออกมอบเลขจริง
 * (ADR 0016) และเมนูลิงก์เฉพาะหน้าที่มีจริง — ลิงก์ไปหน้าที่ไม่มีคือคำโกหกแบบเดียวกับตราที่ไม่มีใครมอบ
 */
export async function PlatformFooter() {
  const [channels, announced] = await Promise.all([readPublishedChannels(), readAnnouncedApps()]);
  const trust = describeTrustRow();
  const buddhistYear = new Date().getFullYear() + 543;

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div className="footer__brand">
            <Image src={visualAssetUrl("brand_wordmark")} alt="นายช่างหมู — CIVIL APPS ASSISTANT" width={180} height={54} className="footer__wordmark" />
            <p className="footer__tagline">
              เครื่องมือวิศวกรรมที่เรียบง่าย ตรวจสอบได้ และออกแบบมาเพื่อให้งานเดินหน้า
            </p>
            {businessOperator.publish ? (
              <p className="footer__operator">
                {businessOperator.legalName}
                {businessOperator.addressLines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </p>
            ) : null}
            {channels.length > 0 ? (
              <div className="footer__channels">
                {channels.map((channel) => (
                  <a key={channel.key} href={channel.href} target={channel.key === "email" ? undefined : "_blank"} rel="noreferrer noopener">
                    {channel.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div className="footer__col">
            <h3>แอปของเรา</h3>
            <ul>
              <li><Link href={landingActionContract.allAppsHref}>{landingActionContract.allAppsLabel}</Link></li>
              {announced.ok
                ? announced.apps.map((app) => (
                    <li key={app.slug}><Link href={`/market/${app.slug}`}>{app.name}</Link></li>
                  ))
                : null}
            </ul>
          </div>

          <div className="footer__col">
            <h3>แพลตฟอร์ม</h3>
            <ul>
              <li><Link href={landingActionContract.pricingHref}>ราคา</Link></li>
              <li><Link href={landingActionContract.roadmapHref}>สถานะโครงการ</Link></li>
              <li><Link href="/enterprise">ขอใบเสนอราคา</Link></li>
              <li><Link href="/account">บัญชีของฉัน</Link></li>
            </ul>
          </div>

          <div className="footer__col">
            <h3>นโยบายและการรับรอง</h3>
            <ul>
              <li><Link href={landingActionContract.cookiesHref}>{landingActionContract.cookiesLabel}</Link></li>
            </ul>
            {trust.visible ? (
              <div className="footer__trust">
                {trust.marks.map((mark) => {
                  const badge = <Image src={mark.imageSrc} alt={`${mark.label} · ${mark.issuer}`} width={110} height={40} />;
                  return (
                    <div className="footer__mark" key={mark.id}>
                      {mark.verifyUrl ? <a href={mark.verifyUrl} target="_blank" rel="noreferrer noopener">{badge}</a> : badge}
                      <span>{mark.label} · เลขทะเบียน {mark.registrationNumber}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div className="footer__base">
          <span>© {buddhistYear} {businessOperator.publish ? businessOperator.legalName : "นายช่างหมู — CIVIL APPS ASSISTANT"}</span>
          <Link href={landingActionContract.roadmapHref}>Roadmap &amp; Handoff</Link>
        </div>
      </div>
    </footer>
  );
}
