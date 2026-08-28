import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai, Prompt } from "next/font/google";
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

/**
 * IP-203: ฟอนต์ของคอลัมน์ตัวเลขในตาราง — ไม่ใช่ฟอนต์ของทั้งเว็บ
 *
 * Prompt เปิดฟีเจอร์ให้แค่ `kern`, `liga`, `locl` — ไม่มี `tnum` ฉะนั้น
 * `font-variant-numeric: tabular-nums` ที่ globals.css สั่งไว้ 44 จุดจึงไม่มีอะไรให้สลับไปใช้
 * และเลข 0-9 ของ Prompt กว้างไม่เท่ากันจริง (672, 363, 581, 574, 601, 570, 609, 545, 602, 609
 * ต่างสุด 30.9%) ตัวเลข ปร.4/5/6 กับตารางราคาจึงเลิกตรงหลักโดยที่ CSS ยังอ่านว่าสั่งครบ
 * รีวิวโค้ดไม่มีทางจับได้ มีแต่การวัดหรือเปิดดูของจริงเท่านั้น
 *
 * IBM Plex Sans Thai เลขกว้าง 600 เท่ากันทั้งสิบตัว จึงเอามาใช้เฉพาะช่องที่เป็นตัวเลข
 * ส่วน UI ที่เหลือคง Prompt ไว้ตามที่เจ้าของงานสั่ง 2026-08-28 — ห้ามเปลี่ยนฟอนต์ทั้งระบบ
 * เพราะเรื่อง `tnum` อย่างเดียว
 *
 * โหลดถึงน้ำหนัก 700 เพราะ IBM Plex Sans Thai มีแค่นั้น สองจุดที่ขอ 800
 * (`gl-slab__price`, `gl-labour__rate`) เบราว์เซอร์จะหนาให้เอง ซึ่งไม่ทำให้หลักเลื่อน
 * เพราะทุกตัวเลขในคอลัมน์เดียวกันโดนเหมือนกันหมด — วัดของจริง 2026-08-28 ได้ 0.00% ตามคาด
 *
 * โหลดสามน้ำหนักเพราะคอลัมน์ตัวเลขขอมาแค่สาม เปิดของจริงนับดูแล้ว 2026-08-28:
 * 400 ที่ `gl-num`, 600 ที่ตารางหลังบ้าน, 700 ที่ตาราง work-plan และที่เบราว์เซอร์หยิบไปทำ 800
 * เคยโหลด 500 ไว้ด้วย แต่ไม่มีช่องไหนขอเลย จึงตัดทิ้ง — ฟอนต์ที่โหลดทิ้งคือเว็บหนักฟรี
 */
const plexNumeric = IBM_Plex_Sans_Thai({
  variable: "--font-numeric",
  subsets: ["thai", "latin"],
  weight: ["400", "600", "700"],
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
  return <html lang="th"><body className={`${prompt.variable} ${plexNumeric.variable}`}>
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
