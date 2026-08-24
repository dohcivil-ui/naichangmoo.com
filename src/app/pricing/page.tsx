import type { CSSProperties } from "react";
import { LandingMotion } from "@/components/landing/landing-motion";
import { PlatformFooter } from "@/components/platform/platform-footer";
import { SiteHeader } from "@/components/platform/site-header";
import { AccessStatePanel } from "@/components/pricing/access-state-panel";
import { AccessTiers } from "@/components/pricing/access-tiers";
import {
  capabilityOrder,
  pricingCapabilityRows,
  pricingTiers,
  restrictedAccessNote,
  vipPriceNow,
  yearlySaving
} from "@/lib/pricing";
import { readAnnouncedApps } from "@/server/app-registry";

export const metadata = {
  title: "การเข้าใช้งานและราคา | นายช่างหมู",
  description: "ทดลองใช้งานฟรี 7 วัน สมาชิก VIP ใช้ได้ทุกแอป และช่องทางขอใบเสนอราคาสำหรับองค์กรและหน่วยงาน"
};

/**
 * ADR 0014. Nothing on this page names an app unless an administrator announced it, and when the
 * registry cannot be read the page names none at all — the card falls back to one sentence and the
 * restricted-app footnote disappears entirely rather than becoming a vaguer version of itself.
 */
export default async function PricingPage() {
  const rows = pricingCapabilityRows();
  const registry = await readAnnouncedApps();
  const announced = registry.ok ? registry.apps : null;
  const memberFreeApps = announced?.filter((app) => app.access === "member_free") ?? null;
  const restrictedNote = restrictedAccessNote(
    announced?.filter((app) => app.access === "doh_staff_only").map((app) => app.name) ?? []
  );
  // Resolved here rather than in the client component so a promotion window cannot open between
  // the server render and hydration and leave two different prices on the same screen.
  const vip = { monthly: vipPriceNow("monthly"), yearly: vipPriceNow("yearly") };

  return (
    <main className="site-shell">
      <LandingMotion />
      <SiteHeader />

      <section className="section section--white" id="access">
        <div className="container">
          <div className="section-heading" data-reveal style={{ "--fy": "-12px" } as CSSProperties}>
            <div>
              <div className="eyebrow" style={{ color: "var(--teal)" }}>การเข้าใช้งาน</div>
              <h1>เลือกตามสิทธิ์ที่ตรงกับงานของคุณ</h1>
              <p className="access-intro">
                เริ่มจากทดลองใช้ฟรีก่อนได้ ถ้าใช้ทำงานจริงทุกวันก็ข้ามไปสมาชิก VIP ที่ใช้ได้ทุกแอป
                ส่วนงานขององค์กรและหน่วยงานตอบด้วยข้อเสนอที่จัดทำให้เป็นรายกรณี เพราะจำนวนผู้ใช้
                ขอบเขตงานและข้อกำหนดจัดซื้อของแต่ละหน่วยงานไม่เหมือนกัน
              </p>
            </div>
          </div>

          <div className="access-layout">
            <div className="access-main">
              <AccessTiers tiers={pricingTiers} vip={vip} saving={yearlySaving()} memberFreeApps={memberFreeApps} />
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

          {restrictedNote ? (
            <p className="access-footnote" data-reveal>
              {restrictedNote}
            </p>
          ) : null}
        </div>
      </section>

      <PlatformFooter />
    </main>
  );
}
