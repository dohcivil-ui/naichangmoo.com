import { listCapabilities, type Capability, type Entitlement, type EntitlementState } from "@/lib/entitlement";
import { ESTIMETR_TRIAL_DAYS, ESTIMETR_TRIAL_LIMITS } from "@/lib/estimeter-trial";
import { landingActionContract } from "@/lib/landing-interactions";

/**
 * Every figure the platform states about money lives here and nowhere else. ADR 0011 approved the
 * first set and required a single home for it, because the same number appears on a card, in a
 * per-day line, on a discount badge and in ad copy — four copies means one of them is stale the
 * day a price moves. Only the two prices below are written down; every other figure on the page
 * is computed from them.
 *
 * ADR 0011 also holds that this page may state prices at all, superseding the rule in
 * docs/requirements/civil-apps-market.md that forbade a numeric package price.
 */

export const VAT_PERCENT = 7;

/** Stated as VAT-inclusive, which is what a Thai buyer expects to compare. */
export const vatInclusiveNote = "ทุกรายการเป็นราคารวมภาษีมูลค่าเพิ่มแล้ว";

export type BillingPeriod = "monthly" | "yearly";

export const vipPriceBaht: Record<BillingPeriod, number> = {
  monthly: 1170,
  yearly: 10440
};

/** A day pass is a separate product, not a membership level. See ADR 0011. */
export const dayPassPriceBaht = 49;

/**
 * A month is billed as 30 days and a year as 365, so the per-day figure matches the billing cycle
 * a buyer is actually on. The yearly cycle works out at 28.60, which is the 29 baht in the ad
 * copy; the monthly cycle is 39.00. ADR 0011 forbids showing the yearly figure beside the monthly
 * price for that reason.
 */
const DAYS_IN_PERIOD: Record<BillingPeriod, number> = { monthly: 30, yearly: 365 };

export function perDayBaht(period: BillingPeriod): number {
  return vipPriceBaht[period] / DAYS_IN_PERIOD[period];
}

export function monthlyEquivalentBaht(period: BillingPeriod): number {
  return period === "monthly" ? vipPriceBaht.monthly : vipPriceBaht.yearly / 12;
}

/** Twelve monthly payments against one yearly payment. Derived, never typed in. */
export function yearlySaving(): { baht: number; percent: number } {
  const twelveMonths = vipPriceBaht.monthly * 12;
  const baht = twelveMonths - vipPriceBaht.yearly;
  return { baht, percent: (baht / twelveMonths) * 100 };
}

export function taxBaseBaht(amount: number): number {
  return amount / (1 + VAT_PERCENT / 100);
}

export function formatBaht(amount: number, fractionDigits = 0): string {
  return amount.toLocaleString("th-TH", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });
}

/* -------------------------------------------------------------------------------------------- */
/* Promotions                                                                                    */
/* -------------------------------------------------------------------------------------------- */

export type PromotionTarget = "vip_monthly" | "vip_yearly" | "day_pass";

/**
 * A promotion carries its own end date rather than overwriting the standing price. ADR 0011: a
 * promotion that is applied by editing the real price needs someone to remember to change it
 * back, and the day they forget is the day it becomes permanent. This one expires on its own.
 *
 * The list is empty because nothing owns it yet. IP-078 has to settle the administrator
 * authorization model before a back-office surface may write here; until then a promotion is a
 * commit, which is at least auditable.
 */
export type PricePromotion = {
  id: string;
  label: string;
  target: PromotionTarget;
  promoPriceBaht: number;
  startsAtIso: string;
  endsAtIso: string;
};

export const pricePromotions: readonly PricePromotion[] = [];

export function activePromotion(target: PromotionTarget, now = new Date()): PricePromotion | null {
  const at = now.getTime();
  return (
    pricePromotions.find((promotion) => {
      const starts = new Date(promotion.startsAtIso).getTime();
      const ends = new Date(promotion.endsAtIso).getTime();
      return promotion.target === target && Number.isFinite(starts) && Number.isFinite(ends) && starts <= at && at < ends;
    }) ?? null
  );
}

export function vipPriceNow(period: BillingPeriod, now = new Date()): { standard: number; promotion: PricePromotion | null; payable: number } {
  const promotion = activePromotion(period === "monthly" ? "vip_monthly" : "vip_yearly", now);
  const standard = vipPriceBaht[period];
  return { standard, promotion, payable: promotion ? promotion.promoPriceBaht : standard };
}

/* -------------------------------------------------------------------------------------------- */
/* Tiers                                                                                         */
/* -------------------------------------------------------------------------------------------- */

export type PricingTierId = "trial" | "member_free" | "vip" | "organization";

/** What sits where a price would. A tier either has one, is free, or is answered with a quote. */
export type TierPrice =
  | { kind: "free_for_days"; days: number }
  | { kind: "free" }
  | { kind: "period" }
  | { kind: "quote" };

export type PricingTier = {
  id: PricingTierId;
  eyebrow: string;
  name: string;
  summary: string;
  price: TierPrice;
  highlights: string[];
  cta: { label: string; href: string };
  /** Which enforced state this tier maps to, so the capability table can be derived. */
  state: Extract<EntitlementState, "trial" | "member_free" | "active">;
  featured: boolean;
};

export const pricingTiers: readonly PricingTier[] = [
  {
    id: "trial",
    eyebrow: "สำหรับลองก่อนตัดสินใจ",
    name: "ทดลองใช้งาน",
    summary: "เปิด ESTIMETR ทำงานกับแบบจริงของคุณ แล้วดูว่าตัวเลขที่ได้ตรวจย้อนกลับได้จริงหรือไม่",
    price: { kind: "free_for_days", days: ESTIMETR_TRIAL_DAYS },
    highlights: [
      "นาฬิกาเริ่มนับเมื่อคุณกดเริ่ม ไม่ใช่ตอนสมัคร",
      "ถอดปริมาณเป็นบรรทัดวัดที่อ่านออกจากแบบได้",
      "เมื่อครบกำหนด ข้อมูลเดิมยังเปิดดูได้"
    ],
    cta: { label: "เริ่มทดลองใช้งาน", href: "/market/estimeter" },
    state: "trial",
    featured: false
  },
  {
    id: "member_free",
    eyebrow: "สำหรับสมาชิกทั่วไป",
    name: "สมาชิกใช้ฟรี",
    summary: "แอปคำนวณและตรวจทานงานออกแบบที่สมาชิกใช้ได้โดยไม่มีค่าใช้จ่าย",
    price: { kind: "free" },
    highlights: [
      "Retaining Wall Cantilever และ TRAFFIC SIGN",
      "ส่งออกไฟล์และพิมพ์เอกสารได้",
      "กำลังเตรียมระบบ จะเปิดเมื่อแอปที่ปรับโครงสร้างใหม่พร้อม"
    ],
    cta: { label: "ดูแอปทั้งหมด", href: landingActionContract.allAppsHref },
    state: "member_free",
    featured: false
  },
  {
    id: "vip",
    eyebrow: "สำหรับคนที่ใช้ทำงานจริงทุกวัน",
    name: "สมาชิก VIP",
    summary: "ใช้ได้ทุกแอปบนแพลตฟอร์ม ไม่จำกัดจำนวนโครงการ ส่งออกและพิมพ์เอกสารได้เต็มสิทธิ์",
    price: { kind: "period" },
    highlights: [
      "ใช้ได้ทุกแอป ไม่ต้องสมัครแยก",
      "ไม่จำกัดจำนวนโครงการ",
      "ส่งออกไฟล์และพิมพ์เอกสารได้"
    ],
    cta: { label: "สนใจสมาชิก VIP", href: "/enterprise" },
    state: "active",
    featured: true
  },
  {
    id: "organization",
    eyebrow: "สำหรับองค์กรและหน่วยงาน",
    name: "องค์กรและหน่วยงาน",
    summary: "หลายผู้ใช้ในหน่วยงานเดียว พร้อมข้อกำหนดจัดซื้อและเงื่อนไขการใช้งานที่ตกลงกันเป็นลายลักษณ์อักษร",
    price: { kind: "quote" },
    highlights: [
      "แจ้งจำนวนผู้ใช้ แอปที่สนใจ และข้อกำหนดจัดซื้อ",
      "ทีมงานจัดทำข้อเสนอที่ตรงกับบริบทการใช้งาน",
      "แบบฟอร์มเป็นการรับ requirement ยังไม่ใช่ใบเสนอราคาหรือสัญญา"
    ],
    cta: { label: "ขอใบเสนอราคา", href: "/enterprise" },
    state: "active",
    featured: false
  }
] as const;

/**
 * Sold by the day and gone when the day is gone. It is not a membership level, so it is not a
 * column in the comparison and is never divided into a monthly figure to sit beside VIP — that
 * comparison is what made the original 49-baht proposal a plan nobody would ever choose.
 */
export const dayPass = {
  name: "บัตรรายวัน แยกแอป",
  summary: "มีงานด่วนชิ้นเดียว ยังไม่พร้อมผูกรายเดือน ซื้อเป็นวัน ใช้เฉพาะแอปที่เลือก",
  priceBaht: dayPassPriceBaht,
  cta: { label: "สอบถามบัตรรายวัน", href: "/enterprise" }
} as const;

/* -------------------------------------------------------------------------------------------- */
/* Capability table                                                                              */
/* -------------------------------------------------------------------------------------------- */

export const capabilityLabel: Record<Capability, string> = {
  read: "เปิดดูงานที่บันทึกไว้",
  create_project: "สร้างโครงการใหม่",
  edit: "แก้ไขงานที่ค้างอยู่",
  run_ai: "ให้ผู้ช่วยทบทวนงาน",
  export: "ส่งออกไฟล์",
  print: "พิมพ์เอกสาร"
};

export const capabilityOrder: readonly Capability[] = [
  "read",
  "create_project",
  "edit",
  "run_ai",
  "export",
  "print"
];

export type CapabilityRow = { capability: Capability; label: string; allowed: Record<PricingTierId, boolean> };

function representativeEntitlement(tier: PricingTier, now: Date): Entitlement {
  const dayMs = 24 * 60 * 60 * 1000;
  return {
    state: tier.state,
    startsAt: new Date(now.getTime() - dayMs),
    endsAt: new Date(now.getTime() + dayMs),
    limits: tier.state === "trial" ? ESTIMETR_TRIAL_LIMITS : {}
  };
}

/**
 * Derived, not authored. `listCapabilities` is the function the product enforces with, so a change
 * to the entitlement policy moves this table on its own. The project cap is deliberately absent as
 * a number: ADR 0010 holds that no surface before entry names it, and this page is one.
 */
export function pricingCapabilityRows(now = new Date()): CapabilityRow[] {
  return capabilityOrder.map((capability) => ({
    capability,
    label: capabilityLabel[capability],
    allowed: pricingTiers.reduce((acc, tier) => {
      acc[tier.id] = listCapabilities(representativeEntitlement(tier, now), 0, now)[capability];
      return acc;
    }, {} as Record<PricingTierId, boolean>)
  }));
}

/** Stated as a footnote rather than a column: it is not something a reader can choose. */
export const restrictedAccessNote =
  "LAND ACQUISITION V2 เปิดให้เฉพาะบุคลากรกรมทางหลวงตามสิทธิ์ที่หน่วยงานกำหนด ไม่ได้เปิดให้สมัครใช้งานทั่วไป";

/**
 * ADR 0011 permits stating prices; it does not open payment collection. There is no payment
 * provider in the project and no entitlement state tied to a settled invoice, so a VIP control
 * must not dress itself up as a checkout button.
 */
export const paymentNotYetOpenNote =
  "ขณะนี้ยังไม่เปิดรับชำระเงินผ่านเว็บไซต์ กดเพื่อแจ้งความสนใจ แล้วทีมงานจะติดต่อกลับเพื่อยืนยันสิทธิ์และรอบการใช้งาน";
