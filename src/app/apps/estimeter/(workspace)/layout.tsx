import { notFound } from "next/navigation";
import { AppShell } from "@/components/platform/app-shell";
import { ESTIMETR_APP_SLUG } from "@/lib/estimeter-trial";
import { platformApps } from "@/lib/platform";

/**
 * เปลือกของหน้าที่เป็นพื้นที่ทำงานเต็มจอ
 *
 * **ทำไมต้องแยก route group** layout ของ Next.js ซ้อนกันเสมอ ลูกถอด layout ของแม่ไม่ได้
 * หน้าวัดปริมาณบนแบบจึงต้องอยู่นอกกลุ่ม `(standard)` ที่ให้เปลือกแบบมีหัวเว็บและท้ายเว็บ
 * ไม่ใช่เพราะมันเป็นแอปคนละตัว แต่เพราะคนที่กำลังวัดแบบต้องการพื้นที่วาดทั้งจอ
 * ไม่ใช่พื้นที่วาดที่เหลือจากหัวเว็บ หัวแอป เส้นทาง และท้ายเว็บ
 *
 * เจ้าของงานทักเมื่อ 2026-09-02 ว่างานจริงไม่เหมือนต้นแบบที่เขาวางไว้ที่
 * `.design/estimeter-viewer/viewer-controls-prototype.html` ซึ่งเป็นผืนเดียวสูงเต็มจอ
 * ไม่มีท้ายเว็บ และแถบบนเป็นแถบของแอปเอง ไม่ใช่แถบของหน้าแรก
 *
 * การตรวจสิทธิ์ยังอยู่ที่หน้าเหมือนเดิม layout ไม่ใช่ด่านความปลอดภัย เพราะ Next.js
 * ยังรันหน้าที่ layout ห่อไว้เสมอ
 */
export default function EstimeterWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const app = platformApps.find((item) => item.slug === ESTIMETR_APP_SLUG);
  if (!app) notFound();

  return (
    <AppShell app={app} mode="workspace">
      {children}
    </AppShell>
  );
}
