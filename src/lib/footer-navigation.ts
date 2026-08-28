import { landingActionContract } from "@/lib/landing-interactions";

/**
 * โครงลิงก์ของท้ายเว็บ (IP-200) — เจ้าของงานร่างโครงเอง 2026-08-28 เพื่อรองรับวันที่แอปเยอะขึ้น:
 * เลิกไล่ชื่อแอปทุกตัว ให้ "แอปทั้งหมด" พาไปหน้ารวมแทน
 *
 * `exists` คือคำแถลงว่าหน้าปลายทางมีจริง ตามกติกา v0.81.0 "ของที่ยังไม่มีจริง ไม่ขึ้น" —
 * ลิงก์ที่ exists เป็น false ถูกกรองออกตอน render และคอลัมน์ที่ว่างทั้งคอลัมน์ไม่ขึ้น
 * flag นี้โกหกไม่ได้ทั้งสองทิศ: footer-navigation.test.ts เดินอ่านดิสก์จริง —
 * ประกาศว่ามีแต่หน้าไม่มี → แดง · หน้าถูกสร้างแล้วแต่ยังประกาศว่าไม่มี → แดงเช่นกัน
 * วันที่หน้าใหม่เสร็จ จึงแค่พลิก flag เดียว ลิงก์ขึ้นเอง
 *
 * label/href ที่มีเจ้าของใน landingActionContract ต้องยืมมา ห้ามพิมพ์ซ้ำ (บทเรียน IP-124:
 * สองสำเนาแปลว่าหนึ่งสำเนาจะผิดในอนาคต)
 */
export type FooterLink = { label: string; href: string; exists: boolean };
export type FooterColumn = { id: string; heading: string; links: readonly FooterLink[] };

export const footerNavigationContract = [
  {
    id: "services",
    heading: "บริการของเรา",
    links: [
      { label: landingActionContract.allAppsLabel, href: landingActionContract.allAppsHref, exists: true },
      /* ป้ายตามที่เจ้าของงานเคาะ 2026-08-28: ชื่อบริการ Hermes + การกระทำที่กดแล้วได้จริง
         (หน้า /enterprise คือฟอร์มส่ง use case — ยืนยันจากคอมเมนต์ในหน้าแรก) ไม่ใช้คำว่า
         "บริการติดตั้งระบบ 24/7" เดี่ยว ๆ เพราะอ่านได้ว่าทีมติดตั้งเปิด 24 ชม. ซึ่งไม่มีใครสัญญา */
      { label: "Hermes 24/7 — ส่ง use case", href: "/enterprise", exists: true },
      { label: "ราคา", href: landingActionContract.pricingHref, exists: true }
    ]
  },
  {
    id: "company",
    heading: "ข้อมูลบริษัท",
    links: [
      { label: "เกี่ยวกับเรา", href: "/about", exists: false },
      { label: "บทความ", href: "/articles", exists: false },
      { label: "ติดต่อเรา", href: "/contact", exists: false },
      { label: "สถานะโครงการ", href: landingActionContract.roadmapHref, exists: true }
    ]
  },
  {
    id: "help",
    heading: "ศูนย์ช่วยเหลือ",
    links: [
      { label: "คำถามที่พบบ่อย", href: "/faq", exists: false },
      { label: "คู่มือ", href: "/guides", exists: false },
      { label: "บัญชีของฉัน", href: "/account", exists: true }
    ]
  },
  {
    id: "policy",
    heading: "นโยบายและการรับรอง",
    links: [
      { label: landingActionContract.cookiesLabel, href: landingActionContract.cookiesHref, exists: true }
    ]
  }
] as const satisfies readonly FooterColumn[];
