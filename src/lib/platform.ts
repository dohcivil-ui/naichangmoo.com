import { visualAssetUrl } from "@/lib/visual-assets";

export type AppAccess = "paid_trial" | "member_free" | "doh_staff_only" | "agent_service";

export type PlatformApp = {
  slug: string;
  name: string;
  eyebrow: string;
  description: string;
  iconSrc: string;
  iconAlt: string;
  access: AppAccess;
  href: string;
  status: "available" | "coming_soon" | "restricted";
};

export const platformApps: PlatformApp[] = [
  {
    slug: "estimeter",
    name: "ESTIMETR",
    eyebrow: "COST WORKSPACE",
    description: "ประมาณราคางานอาคารแบบมีหลักฐาน ตั้งโครงการ → ถอดแบบ → ประมาณราคา → ตรวจเอกสาร",
    iconSrc: visualAssetUrl("estimeter"),
    iconAlt: "สัญลักษณ์ ESTIMETR สำหรับงานประมาณราคา",
    access: "paid_trial",
    href: "/apps/estimeter",
    status: "available"
  },
  {
    slug: "rcopt",
    name: "Retaining Wall Cantilever",
    eyebrow: "OPTIMIZE BY BISECTION ALGORITHM",
    description: "Optimize cantilever dimensions with a bounded bisection search, then review stability checks and the calculation trail before confirmation.",
    iconSrc: visualAssetUrl("retaining_wall"),
    iconAlt: "Retaining Wall Cantilever optimization icon",
    access: "member_free",
    href: "/apps/rcopt",
    status: "coming_soon"
  },
  {
    slug: "traffic-sign",
    name: "TRAFFIC SIGN",
    eyebrow: "MATERIAL CALCULATOR",
    description: "คำนวณรายการวัสดุป้ายจราจรแบบ form → list → BOQ สำหรับสมาชิก",
    iconSrc: visualAssetUrl("traffic_sign"),
    iconAlt: "สัญลักษณ์คำนวณวัสดุป้ายจราจร",
    access: "member_free",
    href: "/apps/traffic-sign",
    status: "coming_soon"
  },
  {
    slug: "land-acquisition",
    name: "LAND ACQUISITION V2",
    eyebrow: "DOH STAFF WORKSPACE",
    description: "ระบบงานจัดกรรมสิทธิ์ที่ดินสำหรับบุคลากรกรมทางหลวงตามสิทธิ์ที่ได้รับ",
    iconSrc: visualAssetUrl("land_acquisition"),
    iconAlt: "สัญลักษณ์งานจัดกรรมสิทธิ์ที่ดิน",
    access: "doh_staff_only",
    href: "/apps/land-acquisition",
    status: "restricted"
  }
];

export const accessLabel: Record<AppAccess, string> = {
  paid_trial: "ทดลองใช้ 5 วัน · 1 โครงการ",
  member_free: "สมาชิกใช้ฟรี",
  doh_staff_only: "เฉพาะบุคลากรกรมทางหลวง",
  agent_service: "ผู้ช่วยทำงาน 24/7"
};
