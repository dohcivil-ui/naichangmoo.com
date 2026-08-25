import Image from "next/image";
import Link from "next/link";
import { describeTrustRow } from "@/lib/business-identity";
import { landingActionContract } from "@/lib/landing-interactions";

export function PlatformFooter() {
  /**
   * ADR 0016. The row is built and stays out of the DOM entirely until an issuer has granted a mark
   * — an empty bordered strip would be worse than no strip, and a mark rendered early would be a
   * claim of a registration nobody holds.
   */
  const trust = describeTrustRow();

  return <footer className="footer"><div className="container">
    <div className="footer__inner"><div><strong>นายช่างหมู</strong> — CIVIL APPS ASSISTANT</div><p><Link href={landingActionContract.roadmapHref}>Roadmap &amp; Handoff</Link> · <Link href={landingActionContract.cookiesHref}>{landingActionContract.cookiesLabel}</Link> · เครื่องมือวิศวกรรมที่เรียบง่าย ตรวจสอบได้ และออกแบบมาเพื่อให้งานเดินหน้า</p></div>
    {trust.visible ? <div className="footer__trust">{trust.marks.map((mark) => {
      const badge = <Image src={mark.imageSrc} alt={`${mark.label} · ${mark.issuer}`} width={110} height={40} />;
      return <div className="footer__mark" key={mark.id}>
        {mark.verifyUrl ? <a href={mark.verifyUrl} target="_blank" rel="noreferrer noopener">{badge}</a> : badge}
        <span>{mark.label} · เลขทะเบียน {mark.registrationNumber}</span>
      </div>;
    })}</div> : null}
  </div></footer>;
}
