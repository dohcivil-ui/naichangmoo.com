import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "@/app/globals.css";

const ibmPlexThai = IBM_Plex_Sans_Thai({
  variable: "--font-ibm-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "นายช่างหมู | CIVIL APPS ASSISTANT",
  description: "เครื่องมือวิศวกรรมที่ทำงานเป็นลำดับ ตรวจสอบได้ และช่วยงานโยธาไทยให้ชัดเจนขึ้น"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body className={ibmPlexThai.variable}>
    {/* Everything carrying data-reveal starts at opacity 0 and is revealed by script. Without
        this, a visitor with no JavaScript gets a hero that never arrives. */}
    <noscript><style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style></noscript>
    {children}
  </body></html>;
}
