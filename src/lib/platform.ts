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
  /**
   * What the app is called in Thai, and what it is for in one line. These two are what a person
   * sees at the top of the app itself, in the same place in every app, so someone who arrives from
   * a link knows what they opened. `name` is the brand and `description` is a browsing blurb;
   * neither answers "what does this program do" on its own.
   *
   * Both are required. A new app without them ships an anonymous header, and the contract test
   * fails rather than letting that reach a page.
   */
  programName: string;
  purpose: string;
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
    programName: "แอปประมาณราคางานอาคาร",
    purpose: "สำหรับถอดปริมาณและประมาณราคางานอาคารอย่างเป็นลำดับ",
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
    programName: "แอปออกแบบกำแพงกันดินแบบ cantilever",
    purpose: "สำหรับคำนวณและตรวจทานกำแพงกันดินแบบ cantilever",
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
    programName: "แอปคำนวณวัสดุป้ายจราจร",
    purpose: "สำหรับจัดทำรายการวัสดุป้ายจราจรจนถึง BOQ",
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
    programName: "แอปงานจัดกรรมสิทธิ์ที่ดิน",
    purpose: "สำหรับงานจัดกรรมสิทธิ์ที่ดิน กรมทางหลวง ตามสิทธิ์ที่ได้รับ",
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
  },
  {
    slug: "escalation-k",
    name: "ESCALATION K",
    eyebrow: "ปรับราคาสัญญา",
    description: "คำนวณค่า K และเงินชดเชยตามสัญญาแบบปรับราคาได้",
    programName: "แอปคำนวณค่า K งานก่อสร้าง",
    purpose:
      "สำหรับคำนวณเงินชดเชยค่างานก่อสร้างตามสัญญาแบบปรับราคาได้ (Escalation Factor) ตามมติคณะรัฐมนตรี ว 109",
    // PLACEHOLDER: this app has no badge of its own yet, so it borrows the platform mark. Replace
    // it with a real asset before the app is announced — a card wearing the platform logo where
    // every other card wears its own reads as a mistake, not as a stand-in.
    iconSrc: visualAssetUrl("brand_mark"),
    iconAlt: "สัญลักษณ์ชั่วคราวสำหรับแอปคำนวณค่า K",
    seededAccess: "paid_trial",
    href: "/apps/escalation-k",
    status: "coming_soon",
    categoryId: "building-cost",
    marketDetail: {
      outcome: "คำนวณค่า K และเงินชดเชยตามสัญญาแบบปรับราคาได้",
      preparation: ["ข้อมูลสัญญาและวงเงิน", "เดือนฐานและเดือนที่ส่งมอบแต่ละงวด", "สูตร K ที่ตรงกับประเภทงาน"],
      flow: ["กรอกข้อมูลสัญญา", "เลือกสูตร K", "ใส่ดัชนีราคา", "คำนวณเงินชดเชย"],
      availabilityNote: "กำลังพัฒนา ยังไม่เปิดใช้งาน"
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
