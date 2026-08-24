import type { CSSProperties } from "react";
import Link from "next/link";
import { LandingMotion } from "@/components/landing/landing-motion";
import { PlatformFooter } from "@/components/platform/platform-footer";
import { PlatformNav } from "@/components/platform/platform-nav";
import { AccessStatePanel } from "@/components/pricing/access-state-panel";
import { capabilityOrder, pricingCapabilityRows, pricingTiers, restrictedAccessNote } from "@/lib/pricing";

export const metadata = {
  title: "การเข้าใช้งานและราคา | นายช่างหมู",
  description: "ทดลองใช้งานฟรี 7 วัน แอปที่สมาชิกใช้ได้ฟรี และช่องทางขอใบเสนอราคาสำหรับองค์กรและหน่วยงาน"
};

export default function PricingPage() {
  const rows = pricingCapabilityRows();

  return (
    <main className="site-shell">
      <LandingMotion />
      <PlatformNav />

      <section className="section section--white" id="access">
        <div className="container">
          <div className="section-heading" data-reveal style={{ "--fy": "-12px" } as CSSProperties}>
            <div>
              <div className="eyebrow" style={{ color: "var(--teal)" }}>การเข้าใช้งาน</div>
              <h1>เลือกตามสิทธิ์ที่ตรงกับงานของคุณ</h1>
              <p className="access-intro">
                แพลตฟอร์มนี้ยังไม่ประกาศราคาเป็นตัวเลข งานขององค์กรและหน่วยงานตอบด้วยข้อเสนอที่จัดทำให้เป็นรายกรณี
                เพราะจำนวนผู้ใช้ ขอบเขตงานและข้อกำหนดจัดซื้อของแต่ละหน่วยงานไม่เหมือนกัน
              </p>
            </div>
          </div>

          <div className="access-layout">
            <div className="access-tiers">
              {pricingTiers.map((tier, index) => (
                <article
                  className={`access-tier${tier.featured ? " access-tier--featured" : ""}`}
                  key={tier.id}
                  data-reveal
                  style={{ "--reveal-delay": index } as CSSProperties}
                >
                  <header>
                    <p className="eyebrow">{tier.eyebrow}</p>
                    <h2>{tier.name}</h2>
                    <p className="access-tier__note">{tier.accessNote}</p>
                  </header>
                  <p className="access-tier__summary">{tier.summary}</p>
                  <ul className="access-tier__highlights">
                    {tier.highlights.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <Link
                    className={`button micro-button ${tier.featured ? "button--orange" : "button--ghost"}`}
                    href={tier.cta.href}
                  >
                    {tier.cta.label}
                  </Link>
                </article>
              ))}
            </div>

            <AccessStatePanel />
          </div>

          <div className="capability-table" data-reveal>
            <header>
              <div className="eyebrow" style={{ color: "var(--teal)" }}>สิ่งที่ทำได้ในแต่ละสิทธิ์</div>
              <h2>ตารางนี้อ่านจากนโยบายที่ระบบบังคับใช้จริง</h2>
              <p>
                ทุกช่องในตารางมาจากฟังก์ชันเดียวกับที่เซิร์ฟเวอร์ใช้ตัดสินว่าอนุญาตหรือไม่
                ไม่ได้พิมพ์เครื่องหมายถูกใส่มือ ถ้านโยบายเปลี่ยน ตารางนี้เปลี่ยนตามเอง
              </p>
            </header>
            <div className="capability-table__scroll">
              <table>
                <caption className="visually-hidden">เปรียบเทียบสิ่งที่ทำได้ในแต่ละสิทธิ์การเข้าใช้งาน</caption>
                <thead>
                  <tr>
                    <th scope="col">ความสามารถ</th>
                    {pricingTiers.map((tier) => (
                      <th scope="col" key={tier.id}>
                        {tier.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.capability}>
                      <th scope="row">{row.label}</th>
                      {pricingTiers.map((tier) => (
                        <td key={tier.id} data-allowed={row.allowed[tier.id] ? "true" : "false"}>
                          <span aria-hidden="true">{row.allowed[tier.id] ? "✓" : "—"}</span>
                          <span className="visually-hidden">{row.allowed[tier.id] ? "ทำได้" : "ทำไม่ได้"}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="capability-table__count">
              {capabilityOrder.length} ความสามารถ · {pricingTiers.length} สิทธิ์
            </p>
          </div>

          <p className="access-footnote" data-reveal>
            {restrictedAccessNote}
          </p>
        </div>
      </section>

      <PlatformFooter />
    </main>
  );
}
