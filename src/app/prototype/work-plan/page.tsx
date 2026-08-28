import type { Metadata } from "next";
import { AppShell } from "@/components/platform/app-shell";
import { WorkPlanWorkspace } from "@/components/prototype/work-plan-workspace";
import { platformApps } from "@/lib/platform";

/**
 * ต้นแบบของแอปผู้ช่วยสร้างแผนงานและ S-Curve
 *
 * อยู่นอก /apps โดยตั้งใจ เพราะยังไม่มีสิทธิ์ ไม่มีทะเบียนแอป และไม่มีตารางในฐานข้อมูล
 * การวางไว้ใน /apps จะทำให้มันดูเหมือนแอปที่ประกาศแล้ว ซึ่ง ADR 0014 ห้ามไว้ชัดว่า
 * ประกาศเป็นสิ่งที่ผู้ดูแลกด ไม่ใช่สิ่งที่โผล่มาเพราะมีคนเขียนโค้ดหน้าหนึ่ง
 *
 * ลบทั้งโฟลเดอร์ได้ทันทีเมื่อของจริงเกิด ส่วนที่เก็บไว้ใช้ต่อคือ src/lib/work-plan.ts,
 * src/lib/payment-milestone.ts และ src/lib/work-plan-template.ts ซึ่งมี test ของตัวเอง
 */

export const metadata: Metadata = {
  title: "ต้นแบบ แอปผู้ช่วยสร้างแผนงานและ S-Curve",
  robots: { index: false, follow: false }
};

export default function WorkPlanPrototypePage() {
  // เปลือกกลางโหมดต้นแบบ (IP-156): ชื่อแอปมาจาก platformApps ไม่พิมพ์มือ และไม่มีคำแถลงจากทะเบียน
  const app = platformApps.find((entry) => entry.slug === "work-plan");
  if (!app) throw new Error("platformApps ไม่มีรายการ work-plan แล้ว — เปลือกของต้นแบบนี้พึ่งรายการนั้น");

  return (
    <AppShell app={app} mode="prototype">
      {/* ก้อน "ขอบเขตของต้นแบบนี้ / อะไรจริง อะไรยังไม่ทำ" ถูกถอดออก 2026-08-28 —
          เป็นโน้ตของ dev/admin (รวม path ไฟล์ภายใน docs/research) ไม่ใช่ของโชว์ชาวบ้าน
          คำสั่งเจ้าของงาน: ความลับของเว็บห้ามออกหน้าสาธารณะเด็ดขาด */}
      <WorkPlanWorkspace />
    </AppShell>
  );
}
