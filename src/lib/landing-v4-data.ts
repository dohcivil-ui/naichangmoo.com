import type { VisualAssetKey } from "@/lib/visual-assets";

/**
 * ข้อมูลของหน้าแรกรุ่นสี่ — **ถ้อยคำและการจัดวางเท่านั้น ไม่มีคำแถลง**
 *
 * ราคา สิทธิ์ สถานะเปิดใช้ และถ้อยคำปุ่ม ไม่อยู่ในไฟล์นี้ (ADR 0015) · ของพวกนั้น
 * `page.tsx` ถามทะเบียนด้วย slug ผ่าน `describeCardClaims` / `getAppInteractionContract`
 * ถ้าทะเบียนยังไม่ประกาศ ช่องนั้นต้องเงียบ ไม่ใช่หยิบคำจากผืนออกแบบมาใส่แทน
 *
 * ที่มา: `design_handoff_home_v4/Home Redesign v4 Apple.dc.html` เจ้าของงานเคาะ 2026-09-24
 */

export const heroCopy = {
  kicker: "HERMES 24/7",
  title: "ผู้ช่วยที่ไม่เคยหลับ.",
  lede: "ผู้ช่วยอัตโนมัติที่ออกแบบตาม use case ของคุณ ตอบลูกค้า จัดคิว สรุปงาน ตลอด 24 ชั่วโมง",
  learnMore: "เรียนรู้เพิ่มเติม ›"
} as const;

export type ShelfEntry =
  | {
      kind: "app";
      /** slug ตามทะเบียนแอป */
      slug: string;
      /** ชื่อบนการ์ดตามที่เจ้าของงานกำหนด อาจต่างจาก `platformApps[].name` โดยตั้งใจ */
      displayName: string;
      blurb: string;
      imageKey: VisualAssetKey;
      /** ป้าย UPDATE REAL TIME! — เจ้าของงานกำหนดให้ PRICEMETR ใบเดียว */
      realtime?: boolean;
    }
  | {
      /**
       * งานบริการที่รับตาม Order ไม่ใช่แอปในทะเบียน — เจ้าของงานเคาะ 2026-09-24
       * ว่า Lekza WORKS สร้างด้วย Hermes แบบ case by case จึงไม่เข้า `platformApps`
       * และไม่ถูกนับใน "มีแอปทั้งหมดตอนนี้ N แอป"
       */
      kind: "service";
      id: string;
      displayName: string;
      blurb: string;
      imageKey: VisualAssetKey;
      statusLabel: string;
    };

export type Shelf = { id: string; title: string; note?: string; entries: readonly ShelfEntry[] };

/**
 * เชลฟ์ห้าหมวดของหน้าแรก — **คนละชุดกับ `marketCategories` โดยตั้งใจ**
 * หมวดกรมทางหลวงรวมสองหมวดของทะเบียนเข้าด้วยกัน และมีหมวด Hermes ที่ทะเบียนไม่มี
 * ห้ามแก้ `marketCategories` ให้ตรงกับไฟล์นี้ หน้าอื่นทั้งเว็บยังใช้ชุดนั้น
 */
export const landingShelves: readonly Shelf[] = [
  {
    id: "estimate",
    title: "หมวดงานถอดแบบ ประมาณราคาค่าวัสดุและค่าแรง",
    entries: [
      { kind: "app", slug: "estimeter", displayName: "ESTIMETR", blurb: "ถอดแบบ · BOQ · ปร.4–6", imageKey: "estimeter" },
      { kind: "app", slug: "pricemetr", displayName: "PRICEMETR", blurb: "ราคาวัสดุและค่าแรงอ้างอิง", imageKey: "pricemetr", realtime: true }
    ]
  },
  {
    id: "manage",
    title: "หมวดบริหารจัดการงานก่อสร้าง",
    entries: [
      { kind: "app", slug: "work-plan", displayName: "WORK PLAN", blurb: "แผนงานและความคืบหน้าโครงการ", imageKey: "work_plan" },
      { kind: "app", slug: "escalation-k", displayName: "ESCALATION K", blurb: "ค่า K ปรับราคาสัญญาทุกงวด", imageKey: "escalation_k" }
    ]
  },
  {
    id: "doh",
    title: "หมวดงานกรมทางหลวง",
    note: "ฟรี",
    entries: [
      { kind: "app", slug: "traffic-sign", displayName: "TRAFFIC SIGN", blurb: "คำนวณวัสดุป้ายจราจร", imageKey: "traffic_sign" },
      { kind: "app", slug: "land-acquisition", displayName: "LAND ACQUISITION V2", blurb: "จัดกรรมสิทธิ์ที่ดิน", imageKey: "land_acquisition" }
    ]
  },
  {
    id: "civil",
    title: "หมวดงานวิศวกรรมโยธา",
    entries: [
      { kind: "app", slug: "rcopt", displayName: "RETAINING WALL OPTIMIZE DESIGN", blurb: "หาหน้าตัดกำแพงกันดินที่ประหยัดที่สุด", imageKey: "retaining_wall" }
    ]
  },
  {
    id: "hermes",
    title: "หมวด HERMES 24/7",
    entries: [
      { kind: "service", id: "lekza-works", displayName: "Lekza WORKS", blurb: "จัดการสลิปและงานรับเหมา บน Telegram", imageKey: "lekza_mockups", statusLabel: "บริการ" }
    ]
  }
];

/** สไลด์ "อัพเดทวันนี้" — งานที่ใกล้ปล่อย ชื่อ ภาพ และปุ่มมาจากทะเบียนด้วย slug */
export type UpdateSlide = { slug: string; imageKey: VisualAssetKey; kicker: string; title: string; desc: string };

export const updateSlides: readonly UpdateSlide[] = [
  { slug: "pricemetr", imageKey: "pricemetr", kicker: "ใกล้ปล่อย", title: "PRICEMETR", desc: "ราคาวัสดุและค่าแรงอ้างอิง อัปเดตตามประกาศล่าสุด ส่งเข้า BOQ ของ ESTIMETR ได้ตรง ๆ" },
  { slug: "escalation-k", imageKey: "escalation_k", kicker: "กำลังทดสอบ", title: "ESCALATION K", desc: "คำนวณค่า K ปรับราคาสัญญาทุกงวด พร้อมตารางสรุปที่ยื่นได้ทันที" },
  { slug: "work-plan", imageKey: "work_plan", kicker: "ปล่อยเร็ว ๆ นี้", title: "WORK PLAN", desc: "แผนงานและความคืบหน้าโครงการ ดูสถานะงานย่อยรายวันได้จากมือถือ" }
];

export const hermesStoryCopy = {
  kicker: "ออกแบบตาม USE CASE",
  titleTop: "เพียงกระซิบมา.",
  titleBottom: "เราออกแบบให้.",
  bodyBefore: "เล่าขั้นตอนงานที่ทำซ้ำทุกวันมาทาง LINE OA ",
  /** ห้ามตัดบรรทัด — เจ้าของงานสั่ง */
  bodyTeam: "ทีมงานนายช่างหมู",
  bodyAfter: "แปลงเป็นผู้ช่วยอัตโนมัติที่เชื่อม Telegram, Google Sheet และระบบที่คุณใช้อยู่แล้ว"
} as const;

export const storyCaptions: readonly { kicker: string; text: string }[] = [
  { kicker: "DASHBOARD", text: "งานจริง ตัวเลขจริง ไปไกลกว่าเดิม." },
  { kicker: "TRANSACTIONS", text: "ส่งสลิปมา ระบบอ่านให้ บันทึกให้." },
  { kicker: "TELEGRAM MINI APP", text: "จัดการงาน จัดการเงิน ได้ทุกที่ บน Telegram." }
];

/** เจ้าของงานยืนยัน 2026-09-24 ว่าทั้งสามข้อทำได้จริง รวมถึงใบเสนอราคาภายใน 24 ชม. */
export const hermesStats: readonly { value: string; unit?: string; label: string; accent?: boolean }[] = [
  { value: "24/7", label: "ทำงานตลอดเวลา", accent: true },
  { value: "0", unit: "วันหยุด", label: "ไม่มีวันลา ไม่มีวันปิดร้าน" },
  { value: "24", unit: "ชม.", label: "ได้ใบเสนอราคาหลังส่ง use case" }
];

export type FeatureIcon = "chat" | "calendar" | "chart" | "link";

export const hermesFeatures: readonly { icon: FeatureIcon; title: string; desc: string }[] = [
  { icon: "chat", title: "ตอบแชทลูกค้า", desc: "ตอบคำถามซ้ำ ๆ ราคา สต็อก เวลาเปิด จากข้อมูลที่คุณให้ไว้ พร้อมส่งต่อคนจริงเมื่อจำเป็น" },
  { icon: "calendar", title: "จัดคิวและนัดหมาย", desc: "รับนัด เตือนล่วงหน้า ลงตารางใน Google Calendar หรือ Sheet อัตโนมัติ" },
  { icon: "chart", title: "สรุปรายงานทุกเช้า", desc: "ยอดขาย งานค้าง ข้อความที่ยังไม่ตอบ ส่งเป็นสรุปเข้ากลุ่ม Telegram ของทีม" },
  { icon: "link", title: "เชื่อมระบบที่ใช้อยู่", desc: "Telegram Bot, Google Workspace, ระบบบัญชี และแอปของนายช่างหมูทั้งหมด" }
];
