import Image from "next/image";
import Link from "next/link";
import { businessOperator, describeTrustRow } from "@/lib/business-identity";
import { footerNavigationContract } from "@/lib/footer-navigation";
import { visualAssetUrl } from "@/lib/visual-assets";
import { readPublishedChannels } from "@/server/platform-channels";

/**
 * ท้ายเว็บโครงใหม่ (IP-200) ตามที่เจ้าของงานร่าง 2026-08-28: คอลัมน์ตรา+ผู้ประกอบการ+ช่องทาง
 * ติดต่อ · บริการของเรา · ข้อมูลบริษัท · ศูนย์ช่วยเหลือ · นโยบายและการรับรอง —
 * เลิกไล่ชื่อแอปทุกตัว (จึงเลิกอ่านทะเบียนแอปตั้งแต่รุ่นนี้) ให้ "แอปทั้งหมด" พาไปหน้ารวมแทน
 * เพื่อรองรับวันที่แอปเยอะขึ้นโดยท้ายเว็บไม่ยาวเป็นหางว่าว
 *
 * กติกาที่คุมทุกช่อง: **ของที่ยังไม่มีจริง ไม่ขึ้น** — เมนูลิงก์คุมด้วย flag `exists` ใน
 * footerNavigationContract ที่มีด่านตรวจอัตโนมัติ (footer-navigation.test.ts) พิสูจน์กับดิสก์จริง
 * สองทิศทาง · ช่องทางติดต่อมาจากตารางที่ผู้ดูแลกรอก (ช่องว่างถูกซ่อน) · ตรารับรองขึ้นเมื่อ
 * ผู้ออกมอบเลขจริง (ADR 0016) — ลิงก์ไปหน้าที่ไม่มีคือคำโกหกแบบเดียวกับตราที่ไม่มีใครมอบ
 */
export async function PlatformFooter() {
  const channels = await readPublishedChannels();
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

          {footerNavigationContract.map((column) => {
            /* กติกา v0.81.0: ลิงก์โผล่เฉพาะหน้าที่มีจริง คอลัมน์ที่ว่างทั้งคอลัมน์ไม่ขึ้น —
               เจ้าของงานเคาะ 2026-08-28 ว่าคอลัมน์ที่วันนี้เหลือลิงก์เดียวยังขึ้น
               เพื่อให้โครงคงที่ตั้งแต่วันแรกแล้วค่อย ๆ เต็มเองเมื่อหน้าใหม่เสร็จ */
            const links = column.links.filter((link) => link.exists);
            if (links.length === 0) return null;
            return (
              <div className="footer__col" key={column.id}>
                <h3>{column.heading}</h3>
                <ul>
                  {links.map((link) => (
                    <li key={link.href}><Link href={link.href}>{link.label}</Link></li>
                  ))}
                </ul>
                {column.id === "policy" && trust.visible ? (
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
            );
          })}
        </div>

        <div className="footer__base">
          {/* ลิงก์ "Roadmap & Handoff" ถอดออก 2026-08-28 — เอกสารภายในไม่โชว์ลูกค้า */}
          <span>© {buddhistYear} {businessOperator.publish ? businessOperator.legalName : "นายช่างหมู — CIVIL APPS ASSISTANT"}</span>
        </div>
      </div>
    </footer>
  );
}
