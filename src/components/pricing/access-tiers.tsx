"use client";

import Link from "next/link";
import { useState } from "react";
import {
  dayPass,
  formatBaht,
  paymentNotYetOpenNote,
  perDayBaht,
  vatInclusiveNote,
  type BillingPeriod,
  type PricePromotion,
  type PricingTier
} from "@/lib/pricing";

export type VipPricing = { standard: number; promotion: PricePromotion | null; payable: number };

type AccessTiersProps = {
  tiers: readonly PricingTier[];
  /** Resolved on the server so a promotion cannot start mid-hydration and change the markup. */
  vip: Record<BillingPeriod, VipPricing>;
  saving: { baht: number; percent: number };
};

const PERIOD_LABEL: Record<BillingPeriod, string> = { monthly: "รายเดือน", yearly: "รายปี" };
const PERIOD_SUFFIX: Record<BillingPeriod, string> = { monthly: "/เดือน", yearly: "/ปี" };

export function AccessTiers({ tiers, vip, saving }: AccessTiersProps) {
  const [period, setPeriod] = useState<BillingPeriod>("yearly");
  const selected = vip[period];

  return (
    <>
      <div className="billing-switch" role="group" aria-label="รอบการชำระเงิน">
        {(["monthly", "yearly"] as const).map((option) => (
          <button
            key={option}
            type="button"
            className="billing-switch__option"
            aria-pressed={period === option}
            onClick={() => setPeriod(option)}
          >
            {PERIOD_LABEL[option]}
            {option === "yearly" ? (
              <span className="billing-switch__save">ประหยัด {formatBaht(saving.baht)} บาท</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="access-tiers">
        {tiers.map((tier) => (
          <article className={`access-tier${tier.featured ? " access-tier--featured" : ""}`} key={tier.id}>
            <header>
              <p className="eyebrow">{tier.eyebrow}</p>
              <h2>{tier.name}</h2>

              {tier.price.kind === "free_for_days" ? (
                <p className="access-tier__note">ฟรี {tier.price.days} วัน</p>
              ) : null}
              {tier.price.kind === "free" ? <p className="access-tier__note">ฟรี ไม่มีกำหนดสิ้นสุด</p> : null}
              {tier.price.kind === "quote" ? <p className="access-tier__note">ตามข้อเสนอที่จัดทำให้</p> : null}

              {tier.price.kind === "period" ? (
                <div className="access-tier__price">
                  {selected.promotion ? (
                    <p className="access-tier__was">
                      ปกติ <s>{formatBaht(selected.standard)}</s> บาท · {selected.promotion.label}
                    </p>
                  ) : null}
                  <p className="access-tier__amount">
                    <strong>{formatBaht(selected.payable)}</strong>
                    <span> บาท{PERIOD_SUFFIX[period]}</span>
                  </p>
                  <p className="access-tier__perday">
                    เฉลี่ยวันละ {formatBaht(perDayBaht(period), 2)} บาท
                    {period === "yearly" ? " · เท่ากับกาแฟหนึ่งแก้ว ใช้ได้ทุกแอป" : null}
                  </p>
                </div>
              ) : null}
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

      <div className="day-pass">
        <div>
          <h3>{dayPass.name}</h3>
          <p>{dayPass.summary}</p>
        </div>
        <div className="day-pass__price">
          <strong>{formatBaht(dayPass.priceBaht)}</strong>
          <span> บาท/วัน</span>
        </div>
        <Link className="button button--ghost micro-button" href={dayPass.cta.href}>
          {dayPass.cta.label}
        </Link>
      </div>

      <p className="price-note">{vatInclusiveNote}</p>
      <p className="price-note">{paymentNotYetOpenNote}</p>
    </>
  );
}
