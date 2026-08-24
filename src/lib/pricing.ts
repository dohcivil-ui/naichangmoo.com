import { listCapabilities, type Capability, type Entitlement, type EntitlementState } from "@/lib/entitlement";
import { ESTIMETR_TRIAL_DAYS, ESTIMETR_TRIAL_LIMITS } from "@/lib/estimeter-trial";
import { landingActionContract } from "@/lib/landing-interactions";

/**
 * The access page compares what each access state can do. It does not compare prices, because
 * `docs/requirements/civil-apps-market.md` holds that the platform states no numeric package
 * price; an organization is answered with a quotation instead. Anything on this page that is a
 * commercial term is therefore a route to `/enterprise`, never a figure.
 *
 * The tier copy here is the editable layer: it is content, and a back-office will later own it.
 * The capability table below is not content — it is derived from `listCapabilities`, the same
 * function the product enforces with, so the page cannot claim an ability the server refuses.
 */

export type PricingTierId = "trial" | "member_free" | "organization";

export type PricingTier = {
  id: PricingTierId;
  eyebrow: string;
  name: string;
  summary: string;
  /** What replaces a price. Never a figure. */
  accessNote: string;
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
    accessNote: `ฟรี ${ESTIMETR_TRIAL_DAYS} วัน`,
    highlights: [
      "นาฬิกาเริ่มนับเมื่อคุณกดเริ่ม ไม่ใช่ตอนสมัคร",
      "ถอดปริมาณเป็นบรรทัดวัดที่อ่านออกจากแบบได้",
      "เมื่อครบกำหนด ข้อมูลเดิมยังเปิดดูได้"
    ],
    cta: { label: "เริ่มทดลองใช้งาน", href: "/market/estimeter" },
    state: "trial",
    featured: true
  },
  {
    id: "member_free",
    eyebrow: "สำหรับสมาชิกทั่วไป",
    name: "สมาชิกใช้ฟรี",
    summary: "แอปคำนวณและตรวจทานงานออกแบบที่สมาชิกใช้ได้โดยไม่มีค่าใช้จ่าย",
    accessNote: "ฟรี ไม่มีกำหนดสิ้นสุด",
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
    id: "organization",
    eyebrow: "สำหรับองค์กรและหน่วยงาน",
    name: "องค์กรและหน่วยงาน",
    summary: "หลายผู้ใช้ในหน่วยงานเดียว พร้อมข้อกำหนดจัดซื้อและเงื่อนไขการใช้งานที่ตกลงกันเป็นลายลักษณ์อักษร",
    accessNote: "ตามข้อเสนอที่จัดทำให้",
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

/** Order and wording of the capability rows. The values are never written here. */
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

/**
 * A representative entitlement for a state, as a fresh account would hold it. `endsAt` sits a day
 * ahead of `now` so the state resolves to itself rather than to `expired_read_only`, and the
 * project count is zero because this is what someone sees before they have created anything.
 */
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
 * Derived, not authored. `listCapabilities` is the function the product enforces with, so a
 * change to the entitlement policy moves this table on its own. The project cap is deliberately
 * absent as a number: ADR 0010 holds that no surface before entry names it, and this page is one.
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
