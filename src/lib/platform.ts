import { visualAssetUrl } from "@/lib/visual-assets";

export type AppAccess = "paid_trial" | "member_free" | "doh_staff_only" | "agent_service";

export const marketCategories = [
  {
    id: "building-cost",
    label: "ประมาณราคางานอาคาร",
    description: "ตั้งต้นจากแบบ ปริมาณ ราคา และเอกสารอย่างเป็นลำดับ"
  },
  {
    id: "civil-design",
    label: "หมวดงานออกแบบวิศวกรรมโยธา",
    description: "คำนวณ ตรวจทาน และทบทวนร่องรอยการออกแบบ"
  },
  {
    id: "safety-equipment",
    label: "หมวดงานอุปกรณ์อำนวยความปลอดภัย",
    description: "คำนวณรายการและวัสดุประกอบงานความปลอดภัยทางถนน"
  },
  {
    id: "land-acquisition",
    label: "หมวดงานสำนักจัดกรรมสิทธิ์ที่ดิน",
    description: "พื้นที่ทำงานตามสิทธิ์สำหรับภารกิจจัดกรรมสิทธิ์ที่ดิน"
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
  access: AppAccess;
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
    eyebrow: "COST WORKSPACE",
    description: "ประมาณราคางานอาคารแบบมีหลักฐาน ตั้งโครงการ → ถอดแบบ → ประมาณราคา → ตรวจเอกสาร",
    iconSrc: visualAssetUrl("estimeter"),
    iconAlt: "สัญลักษณ์ ESTIMETR สำหรับงานประมาณราคา",
    access: "paid_trial",
    href: "/apps/estimeter",
    status: "available",
    categoryId: "building-cost",
    marketDetail: {
      outcome: "จัดลำดับการประมาณราคางานอาคารจากการตรวจแบบ ถอดปริมาณ ประมาณราคา และทบทวนความพร้อมของ BOQ",
      preparation: ["ข้อมูลโครงการและประเภทงาน", "แบบและรายการประกอบแบบ", "ขอบเขตงานที่ต้องตรวจสอบก่อนถอดปริมาณ"],
      flow: ["ตั้งโครงการและเลือกสายงาน", "ตรวจแบบ/กำหนดสเกล/เก็บหลักฐาน", "ถอดปริมาณและทบทวน", "ใช้ price set ที่อนุมัติแล้วก่อนจัดทำเอกสาร"],
      availabilityNote: "เริ่มทดลองใช้งานฟรี 5 วันได้จาก workspace ปัจจุบัน การใช้ราคาอ้างอิงจริงและการปล่อยเอกสารยังต้องผ่าน data และ approval gates ของโครงการ"
    }
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
    status: "coming_soon",
    categoryId: "civil-design",
    marketDetail: {
      outcome: "ช่วยทบทวนทางเลือกมิติกำแพงกันดินแบบ cantilever ด้วย bounded bisection search และร่องรอยการคำนวณ",
      preparation: ["ข้อมูลดินและแรงกระทำที่ตรวจสอบแล้ว", "เงื่อนไขออกแบบและข้อจำกัดพื้นที่", "ค่าตั้งต้นที่วิศวกรรับผิดชอบการยืนยัน"],
      flow: ["ระบุเงื่อนไขออกแบบ", "คำนวณตัวเลือกภายใต้ขอบเขต", "ทบทวน stability checks", "ยืนยันผลโดยวิศวกร"],
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
    access: "member_free",
    href: "/apps/traffic-sign",
    status: "coming_soon",
    categoryId: "safety-equipment",
    marketDetail: {
      outcome: "สร้างรายการวัสดุป้ายจราจรจากแบบฟอร์มงานไปยังรายการคำนวณที่ตรวจทานได้",
      preparation: ["ชนิดป้ายและตำแหน่งติดตั้ง", "ขนาด/วัสดุ/อุปกรณ์ประกอบ", "ข้อกำหนดหน้างานที่เกี่ยวข้อง"],
      flow: ["กรอกลักษณะงาน", "เลือกวัสดุและขนาด", "ตรวจรายการคำนวณ", "จัดรายการเพื่อทบทวน"],
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
    access: "doh_staff_only",
    href: "/apps/land-acquisition",
    status: "restricted",
    categoryId: "land-acquisition",
    marketDetail: {
      outcome: "รองรับพื้นที่ทำงานจัดกรรมสิทธิ์ที่ดินตามบทบาทและสิทธิ์ของบุคลากรที่ได้รับอนุญาต",
      preparation: ["บัญชีผู้ใช้ที่หน่วยงานอนุมัติ", "สิทธิ์ตามบทบาทงาน", "ข้อมูลโครงการที่อนุญาตให้เข้าถึง"],
      flow: ["ยืนยันสิทธิ์บุคลากร", "เลือกงานที่ได้รับมอบหมาย", "ทำงานภายในขอบเขตสิทธิ์", "เก็บร่องรอยการดำเนินงาน"],
      availabilityNote: "สงวนสิทธิ์สำหรับบุคลากรกรมทางหลวงที่ได้รับอนุญาต และยังไม่มีแผนย้ายข้อมูลเดิมใน marketplace release นี้"
    }
  }
];

export const accessLabel: Record<AppAccess, string> = {
  paid_trial: "ทดลองใช้ 5 วัน · 1 โครงการ",
  member_free: "สมาชิกใช้ฟรี",
  doh_staff_only: "เฉพาะบุคลากรกรมทางหลวง",
  agent_service: "ผู้ช่วยทำงาน 24/7"
};

export const appStatusLabel: Record<PlatformApp["status"], string> = {
  available: "เริ่มใช้ได้",
  coming_soon: "กำลังเตรียมระบบ",
  restricted: "จำกัดสิทธิ์"
};
