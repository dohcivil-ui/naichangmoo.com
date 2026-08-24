import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "@/app/globals.css";

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

export const metadata: Metadata = {
  title: "นายช่างหมู | CIVIL APPS ASSISTANT",
  description: "เครื่องมือวิศวกรรมที่ทำงานเป็นลำดับ ตรวจสอบได้ และช่วยงานโยธาไทยให้ชัดเจนขึ้น"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body className={prompt.variable}>
    {/* Everything carrying data-reveal starts at opacity 0 and is revealed by script. Without
        this, a visitor with no JavaScript gets a hero that never arrives. */}
    <noscript><style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style></noscript>
    {children}
  </body></html>;
}
