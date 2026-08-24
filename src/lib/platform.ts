import { visualAssetUrl } from "@/lib/visual-assets";

export type AppAccess = "paid_trial" | "member_free" | "doh_staff_only" | "agent_service";

export const marketCategories = [
  {
    id: "building-cost",
    label: "หมวดประมาณราคา",
    description: "งานประมาณราคาอาคาร"
  },
  {
    id: "civil-design",
    label: "หมวดงานออกแบบวิศวกรรมโยธา",
    description: "คำนวณและตรวจทานงานออกแบบ"
  },
  {
    id: "safety-equipment",
    label: "หมวดงานอุปกรณ์อำนวยความปลอดภัย",
    description: "งานอุปกรณ์ความปลอดภัยทางถนน"
  },
  {
    id: "land-acquisition",
    label: "หมวดงานสำนักจัดกรรมสิทธิ์ที่ดิน",
    description: "ภารกิจจัดกรรมสิทธิ์ที่ดิน กรมทางหลวง"
  }
] as const;

export type MarketCategoryId = (typeof marketCategories)[number]["id"];

export type PlatformApp = {
  slug: string;
  name: string;
  eyebrow: string;
  description: string;
  iconSrc: string;
  iconAlt: string;
  /**
   * What the team intended this app's access to be when the code was written. ADR 0014: this is a
   * default for an administrator to consider and a category label on the browsing pages, never an
   * announcement. When it disagrees with the registry, the registry is right.
   */
  seededAccess: AppAccess;
  href: string;
  status: "available" | "coming_soon" | "restricted";
  categoryId: MarketCategoryId;
  marketDetail: {
    outcome: string;
    preparation: string[];
    flow: string[];
    availabilityNote: string;
  };
};

export const platformApps: PlatformApp[] = [
  {
    slug: "estimeter",
    name: "ESTIMETR",
    eyebrow: "ประมาณราคา",
    description: "ประมาณราคางานอาคาร",
    iconSrc: visualAssetUrl("estimeter"),
    iconAlt: "สัญลักษณ์ ESTIMETR สำหรับงานประมาณราคา",
    seededAccess: "paid_trial",
    href: "/apps/estimeter",
    status: "available",
    categoryId: "building-cost",
    marketDetail: {
      outcome: "ประมาณราคางานอาคารอย่างเป็นลำดับ",
      preparation: ["ข้อมูลโครงการและประเภทงาน", "แบบและรายการประกอบแบบ", "ขอบเขตงานที่ต้องตรวจสอบก่อนถอดปริมาณ"],
      flow: ["ตั้งโครงการ", "ตรวจแบบ", "ถอดปริมาณ", "ประมาณราคา"],
      // ADR 0010: every surface before entry says this one sentence. The project cap and the
      // export/print locks are still enforced and are still stated on the activation screen.
      availabilityNote: "ทดลองใช้งานฟรี 7 วัน"
    }
  },
  {
    slug: "rcopt",
    name: "Retaining Wall Cantilever",
    eyebrow: "OPTIMIZE BY BISECTION ALGORITHM",
    description: "Optimize cantilever dimensions with a bounded bisection search, then review stability checks and the calculation trail before confirmation.",
    iconSrc: visualAssetUrl("retaining_wall"),
    iconAlt: "Retaining Wall Cantilever optimization icon",
    seededAccess: "member_free",
    href: "/apps/rcopt",
    status: "coming_soon",
    categoryId: "civil-design",
    marketDetail: {
      outcome: "คำนวณและตรวจทานกำแพงกันดินแบบ cantilever",
      preparation: ["ข้อมูลดินและแรงกระทำที่ตรวจสอบแล้ว", "เงื่อนไขออกแบบและข้อจำกัดพื้นที่", "ค่าตั้งต้นที่วิศวกรรับผิดชอบการยืนยัน"],
      flow: ["ระบุเงื่อนไข", "คำนวณ", "ตรวจทาน", "ยืนยันผล"],
      availabilityNote: "สมาชิกใช้ได้ฟรีเมื่อแอปที่ปรับโครงสร้างใหม่พร้อมเปิดใช้งาน"
    }
  },
  {
    slug: "traffic-sign",
    name: "TRAFFIC SIGN",
    eyebrow: "MATERIAL CALCULATOR",
    description: "คำนวณรายการวัสดุป้ายจราจรแบบ form → list → BOQ สำหรับสมาชิก",
    iconSrc: visualAssetUrl("traffic_sign"),
    iconAlt: "สัญลักษณ์คำนวณวัสดุป้ายจราจร",
    seededAccess: "member_free",
    href: "/apps/traffic-sign",
    status: "coming_soon",
    categoryId: "safety-equipment",
    marketDetail: {
      outcome: "จัดทำรายการวัสดุป้ายจราจร",
      preparation: ["ชนิดป้ายและตำแหน่งติดตั้ง", "ขนาด/วัสดุ/อุปกรณ์ประกอบ", "ข้อกำหนดหน้างานที่เกี่ยวข้อง"],
      flow: ["ระบุลักษณะงาน", "เลือกวัสดุ", "ตรวจรายการ", "ทบทวน"],
      availabilityNote: "สมาชิกใช้ได้ฟรีเมื่อแอปที่ปรับโครงสร้างใหม่พร้อมเปิดใช้งาน"
    }
  },
  {
    slug: "land-acquisition",
    name: "LAND ACQUISITION V2",
    eyebrow: "DOH STAFF WORKSPACE",
    description: "ระบบงานจัดกรรมสิทธิ์ที่ดินสำหรับบุคลากรกรมทางหลวงตามสิทธิ์ที่ได้รับ",
    iconSrc: visualAssetUrl("land_acquisition"),
    iconAlt: "สัญลักษณ์งานจัดกรรมสิทธิ์ที่ดิน",
    seededAccess: "doh_staff_only",
    href: "/apps/land-acquisition",
    status: "restricted",
    categoryId: "land-acquisition",
    marketDetail: {
      outcome: "ระบบงานจัดกรรมสิทธิ์ที่ดิน กรมทางหลวง",
      preparation: ["บัญชีผู้ใช้ที่หน่วยงานอนุมัติ", "สิทธิ์ตามบทบาทงาน", "ข้อมูลโครงการที่อนุญาตให้เข้าถึง"],
      flow: ["ยืนยันสิทธิ์", "เลือกงาน", "ดำเนินงาน", "ทบทวน"],
      availabilityNote: "สำหรับบุคลากรกรมทางหลวง"
    }
  }
];

export const accessLabel: Record<AppAccess, string> = {
  paid_trial: "ฟรี ทดลองใช้งาน 7 วัน",
  member_free: "สมาชิกใช้ฟรี",
  doh_staff_only: "เฉพาะบุคลากรกรมทางหลวง",
  agent_service: "ผู้ช่วยทำงาน 24/7"
};

export const appStatusLabel: Record<PlatformApp["status"], string> = {
  available: "เริ่มใช้ได้",
  coming_soon: "กำลังเตรียมระบบ",
  restricted: "จำกัดสิทธิ์"
};
