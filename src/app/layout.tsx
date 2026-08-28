import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata, Viewport } from "next";
import { Prompt } from "next/font/google";
import "@/app/globals.css";
import "@/app/document-print.css";
import { CookieNotice } from "@/components/platform/cookie-notice";
import { extractKitchenColour } from "@/lib/kitchen-colours";

/**
 * Loaded through next/font, which downloads the files at build time and serves them from this
 * origin — no request leaves the visitor's browser for a font host, and there is no swap flash.
 *
 * The weight list is not padding. globals.css asks for 800 in twenty-three places and 900 in
 * eleven, and the previous face shipped only 400 to 700, so every heavier declaration was being
 * faked by the browser. Faux bold is what made the headings look smeared. These six weights are
 * the ones the stylesheet actually uses; 650, 750 and 850 land on the nearest real neighbour.
 */
const prompt = Prompt({
  variable: "--font-prompt",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap"
});

/*
 * ฟอนต์ของเอกสารที่พิมพ์ไม่ได้อยู่ที่นี่แล้ว
 *
 * เคยโหลด Sarabun ของ Google ผ่าน next/font แล้วให้กระดาษใช้ตัวนั้น แต่วัดข้อความชุดเดียวกัน
 * ที่ 16 พอยต์เท่ากันแล้ว Sarabun ของ Google กว้างกว่า Browallia New ของไฟล์ต้นแบบ 46%
 * ส่วน TH Sarabun New ตัวจริงแคบกว่า 4% เอกสารจึงเคยดูใหญ่เกินต้นแบบทั้งที่เลขพอยต์ถูกอยู่แล้ว
 *
 * ตอนนี้ประกาศ @font-face ของ TH Sarabun New ตัวจริงไว้ใน `document-print.css`
 * และเสิร์ฟไฟล์จาก `public/fonts/` ของโดเมนนี้เอง
 */

export const metadata: Metadata = {
  title: "นายช่างหมู | CIVIL APPS ASSISTANT",
  description: "เครื่องมือวิศวกรรมที่ทำงานเป็นลำดับ ตรวจสอบได้ และช่วยงานโยธาไทยให้ชัดเจนขึ้น"
};

/**
 * IP-196: theme color (สีแถบเบราว์เซอร์) ต้องอยู่ใน viewport export — ใส่ใน metadata
 * Next จะเตือนว่าย้ายมาที่นี่ · ค่าเป็น teal ตามที่เจ้าของงานเคาะ 2026-08-28 และไม่ประกาศ
 * เลขสีซ้ำ — อ่านจากแหล่งอ้างอิงหลัก (globals.css) ตอน build ตาม ADR 0021
 */
export function generateViewport(): Viewport {
  const kitchen = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  return { themeColor: extractKitchenColour(kitchen, "teal") };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body className={prompt.variable}>
    {/* Everything carrying data-reveal starts at opacity 0 and is revealed by script. Without
        this, a visitor with no JavaScript gets a hero that never arrives. */}
    <noscript><style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style></noscript>
    {children}
    {/*
      Mounted here rather than in SiteHeader because /admin and /apps carry their own chrome and
      never render it — exactly the pages a notice would otherwise silently skip. One mount point
      also means a page added later cannot forget it.
    */}
    <CookieNotice />
  </body></html>;
}
