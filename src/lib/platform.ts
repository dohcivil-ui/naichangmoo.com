import { visualAssetUrl } from "@/lib/visual-assets";

export type AppAccess = "paid_trial" | "member_free" | "doh_staff_only" | "agent_service";

export const marketCategories = [
  {
    id: "building-cost",
    label: "หมวดต้นทุนและประมาณราคาก่อสร้าง",
    description: "ราคาวัสดุ ค่าแรง และงานประมาณราคาก่อสร้าง"
  },
  {
    id: "construction-management",
    label: "การบริหารและจัดการงานก่อสร้าง",
    description: "วางแผนงานและบริหารการก่อสร้างให้เดินตามสัญญา"
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
    purpose: "สำหรับถอดแบบ ถอดปริมาณ และประมาณราคางานอาคาร ตั้งแต่ตั้งโครงการจนได้ BOQ",
    iconSrc: visualAssetUrl("estimeter"),
    iconAlt: "สัญลักษณ์ ESTIMETR สำหรับงานประมาณราคา",
    seededAccess: "paid_trial",
    href: "/apps/estimeter",
    categoryId: "building-cost",
    marketDetail: {
      outcome: "ถอดปริมาณและประมาณราคางานอาคาร จนได้ BOQ ที่ตรวจย้อนได้ทุกบรรทัด",
      preparation: ["ข้อมูลโครงการและประเภทงาน", "แบบและรายการประกอบแบบ", "ขอบเขตงานที่จะถอดปริมาณ"],
      flow: ["ตั้งโครงการ", "ตรวจแบบ", "ถอดปริมาณ", "ประมาณราคา"],
      // ADR 0010 fixed this sentence; ADR 0018 moved its public copy into the registry. What is
      // written here is only the suggestion an administrator sees in the back office - the public
      // pages render the registry's sentence, or nothing at all.
      availabilityNote: "ทดลองใช้ฟรี 7 วัน"
    }
  },
  {
    slug: "pricemetr",
    name: "PRICEMETR",
    eyebrow: "ราคาวัสดุและค่าแรง",
    description: "ราคาวัสดุก่อสร้างรายจังหวัดและค่าแรงตามบัญชีราชการ",
    programName: "แอปราคาวัสดุและค่าแรงงานก่อสร้าง",
    purpose: "สำหรับค้นราคาวัสดุรายจังหวัดและค่าแรงถอดแบบจากแหล่งราชการ แล้วหยิบรายการไปใช้ประมาณราคา",
    // PLACEHOLDER: borrows the platform mark until IP-166 delivers this app's own badge, the same
    // stand-in convention escalation-k uses below. Replace before the app is announced.
    iconSrc: visualAssetUrl("brand_mark"),
    iconAlt: "สัญลักษณ์ชั่วคราวสำหรับแอปราคาวัสดุและค่าแรง",
    seededAccess: "paid_trial",
    href: "/prototype/price-check",
    categoryId: "building-cost",
    marketDetail: {
      outcome: "ค้นราคาวัสดุและค่าแรงจากแหล่งราชการ พร้อมหยิบรายการเก็บไว้ใช้ต่อ",
      preparation: ["จังหวัดและเดือนของราคาที่ต้องการ", "หมวดวัสดุหรือรายการค่าแรงที่ตามหา", "ขอบเขตงานที่จะหยิบรายการไปประมาณราคา"],
      flow: ["เลือกจังหวัดและเดือน", "ค้นหมวดหรือรายการ", "เทียบราคาและเงื่อนไข", "หยิบรายการเก็บไว้ใช้"],
      availabilityNote: "กำลังพัฒนา ยังไม่เปิดใช้งาน"
    }
  },
  {
    slug: "rcopt",
    name: "Retaining Wall Cantilever",
    eyebrow: "OPTIMIZE BY BISECTION ALGORITHM",
    description: "หาขนาดหน้าตัดกำแพงกันดินที่ผ่านเกณฑ์และประหยัดที่สุด พร้อมผลตรวจเสถียรภาพและที่มาของทุกตัวเลข",
    programName: "แอปออกแบบกำแพงกันดินแบบ cantilever",
    purpose: "สำหรับคำนวณและตรวจทานกำแพงกันดินแบบ cantilever",
    iconSrc: visualAssetUrl("retaining_wall"),
    iconAlt: "Retaining Wall Cantilever optimization icon",
    seededAccess: "member_free",
    href: "/apps/rcopt",
    categoryId: "civil-design",
    marketDetail: {
      outcome: "คำนวณและตรวจทานกำแพงกันดินแบบ cantilever",
      preparation: ["ข้อมูลดินและแรงกระทำที่ตรวจสอบแล้ว", "เงื่อนไขออกแบบและข้อจำกัดพื้นที่", "ค่าตั้งต้นที่วิศวกรรับผิดชอบการยืนยัน"],
      flow: ["ระบุเงื่อนไข", "คำนวณ", "ตรวจทาน", "ยืนยันผล"],
      availabilityNote: "สมาชิกใช้ฟรี เมื่อเปิดให้ใช้งาน"
    }
  },
  {
    slug: "traffic-sign",
    name: "TRAFFIC SIGN",
    eyebrow: "MATERIAL CALCULATOR",
    description: "คำนวณรายการวัสดุป้ายจราจร ตั้งแต่ระบุลักษณะป้ายจนได้ BOQ",
    programName: "แอปคำนวณวัสดุป้ายจราจร",
    purpose: "สำหรับจัดทำรายการวัสดุป้ายจราจรจนถึง BOQ",
    iconSrc: visualAssetUrl("traffic_sign"),
    iconAlt: "สัญลักษณ์คำนวณวัสดุป้ายจราจร",
    seededAccess: "member_free",
    href: "/apps/traffic-sign",
    categoryId: "safety-equipment",
    marketDetail: {
      outcome: "จัดทำรายการวัสดุป้ายจราจร",
      preparation: ["ชนิดป้ายและตำแหน่งติดตั้ง", "ขนาด/วัสดุ/อุปกรณ์ประกอบ", "ข้อกำหนดหน้างานที่เกี่ยวข้อง"],
      flow: ["ระบุลักษณะงาน", "เลือกวัสดุ", "ตรวจรายการ", "ทบทวน"],
      availabilityNote: "สมาชิกใช้ฟรี เมื่อเปิดให้ใช้งาน"
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
    categoryId: "building-cost",
    marketDetail: {
      outcome: "คำนวณค่า K และเงินชดเชยตามสัญญาแบบปรับราคาได้",
      preparation: ["ข้อมูลสัญญาและวงเงิน", "เดือนฐานและเดือนที่ส่งมอบแต่ละงวด", "สูตร K ที่ตรงกับประเภทงาน"],
      flow: ["กรอกข้อมูลสัญญา", "เลือกสูตร K", "ใส่ดัชนีราคา", "คำนวณเงินชดเชย"],
      availabilityNote: "กำลังพัฒนา ยังไม่เปิดใช้งาน"
    }
  },
  {
    slug: "work-plan",
    name: "ผู้ช่วยสร้างแผนงาน",
    eyebrow: "แผนงานก่อสร้าง",
    description: "สร้างแผนงานก่อสร้างและเอกสารแนบสัญญาจากข้อมูลโครงการ",
    programName: "แอปผู้ช่วยสร้างแผนงานก่อสร้าง",
    purpose: "สำหรับสร้างแผนงาน งวดงาน แผนกำลังคน และกราฟ Gantt กับ S-Curve จากข้อมูลโครงการ",
    // PLACEHOLDER: borrows the platform mark until the app gets a badge of its own. Replace
    // before the app is announced.
    iconSrc: visualAssetUrl("brand_mark"),
    iconAlt: "สัญลักษณ์ชั่วคราวสำหรับแอปผู้ช่วยสร้างแผนงาน",
    seededAccess: "paid_trial",
    href: "/prototype/work-plan",
    categoryId: "construction-management",
    marketDetail: {
      outcome: "ได้แผนงานก่อสร้างพร้อมเอกสารแนบสัญญาที่พิมพ์ลงกระดาษ A4 ได้จริง",
      preparation: ["ข้อมูลโครงการ วงเงิน และระยะเวลาสัญญา", "ประเภทงานและลำดับกิจกรรมหลัก", "เงื่อนไขการนับเวลาแบบวันตามสัญญาหรือวันทำงาน"],
      flow: ["กรอกข้อมูลโครงการ", "ให้ผู้ช่วยร่างแผนงาน", "ปรับงวดงานและกิจกรรม", "ส่งออกเอกสารแนบสัญญา"],
      availabilityNote: "กำลังพัฒนา ยังไม่เปิดใช้งาน"
    }
  }
];

export const accessLabel: Record<AppAccess, string> = {
  paid_trial: "ทดลองใช้ฟรี 7 วัน",
  member_free: "สมาชิกใช้ฟรี",
  doh_staff_only: "เฉพาะบุคลากรกรมทางหลวง",
  agent_service: "ผู้ช่วยทำงาน 24/7"
};

/**
 * The standard availability sentences an administrator picks from when announcing an app
 * (ADR 0018). A fixed list keeps the public wording a pattern instead of a retyped phrase;
 * the announcement form still offers a custom escape hatch for a sentence that genuinely
 * has more to say, like rcopt's restructuring note.
 */
export const availabilityNotePresets = [
  "ทดลองใช้ฟรี 7 วัน",
  "สมาชิกใช้ฟรี",
  "เฉพาะบุคลากรกรมทางหลวง",
  "กำลังพัฒนา ยังไม่เปิดใช้งาน"
] as const;

/**
 * Readiness as the registry is able to state it. ADR 0015: this is a claim, so it has only the two
 * values an administrator has actually said something about — an app nobody announced has no
 * readiness at all, which is why there is no third member here and no "unknown".
 *
 * IP-092 retired the seeded `status` field and its label map: readiness never comes from source,
 * so a per-app status typed into this file had nothing left to say.
 */
export type AppReadiness = "open" | "preparing";

export const appReadinessLabel: Record<AppReadiness, string> = {
  open: "เริ่มใช้ได้",
  preparing: "กำลังเตรียมระบบ"
};
