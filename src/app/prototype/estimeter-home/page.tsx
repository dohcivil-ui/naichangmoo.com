import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/platform/app-shell";
import { EstimeterHomePreview } from "@/components/prototype/estimeter-home-preview";
import { ESTIMETR_APP_SLUG } from "@/lib/estimeter-trial";
import { platformApps } from "@/lib/platform";

/**
 * ต้นแบบหน้าแรกของ ESTIMETR ในเปลือกจริง (IP-235)
 *
 * **ทำไมอยู่ใต้ /prototype ไม่ใช่ /apps** ด้วยเหตุผลเดียวกับ `prototype/price-check`
 * และ `prototype/work-plan` คือของในนี้ยังไม่ใช่ของที่ประกาศแล้ว การวางไว้ใน /apps
 * จะทำให้มันดูเหมือนของจริง ซึ่ง ADR 0014 ห้ามไว้ชัด
 *
 * **จุดประสงค์เดียวของหน้านี้คือให้เจ้าของงานเห็นเนื้อในใหม่อยู่ในเปลือกจริง**
 * คือมีแถบนำทาง แถบบริบท กล่องชื่อแอป และท้ายเว็บของเราครบ ไม่ใช่แถบปลอมในไฟล์ HTML
 * `mode="prototype"` ทำให้ขึ้นป้าย "ต้นแบบ" เอง คนที่หลงเข้ามาจึงรู้ว่าไม่ใช่ของจริง
 *
 * **ลบทั้งโฟลเดอร์นี้ พร้อมคอมโพเนนต์และบล็อก .eh- ใน globals.css ได้ทันที**
 * เมื่อยกเนื้อในเข้า `apps/estimeter/(standard)/page.tsx` แล้ว
 */
export const metadata: Metadata = {
  title: "ต้นแบบหน้าแรก ESTIMETR",
  robots: { index: false, follow: false }
};

export default function EstimeterHomePrototypePage() {
  const app = platformApps.find((item) => item.slug === ESTIMETR_APP_SLUG);
  if (!app) notFound();

  return (
    <AppShell app={app} mode="prototype">
      <EstimeterHomePreview />
    </AppShell>
  );
}
