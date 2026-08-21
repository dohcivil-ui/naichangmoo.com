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
  return <html lang="th"><body className={ibmPlexThai.variable}>{children}</body></html>;
}
