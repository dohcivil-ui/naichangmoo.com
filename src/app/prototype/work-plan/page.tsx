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
      <WorkPlanWorkspace />
      <section className="section work-plan__afterword">
        <div className="container">
          <p className="eyebrow" style={{ color: "var(--teal)" }}>ขอบเขตของต้นแบบนี้</p>
          <h2>อะไรจริง อะไรยังไม่ทำ</h2>
          <div className="work-plan__afterword-grid">
            <div>
              <h3>จริงแล้ว</h3>
              <ul>
                <li>น้ำหนักงาน การกระจายลงช่วงครึ่งเดือน และเส้นสะสม ตามกฎในหนังสือหลักสูตร วสท.</li>
                <li>สายเงินของทุกงวด ตั้งแต่ยอดสะสมจนถึงเงินรับจริง คิดเป็นสตางค์แบบจำนวนเต็ม</li>
                <li>แก้ค่าช่องเดียวแล้วคำนวณใหม่ทั้งสายทุกแท็บ</li>
              </ul>
            </div>
            <div>
              <h3>ยังไม่ทำ</h3>
              <ul>
                <li>ไม่บันทึกลงฐานข้อมูล รีโหลดแล้วข้อมูลหาย</li>
                <li>ผู้ช่วยยังร่างจากแม่แบบในโค้ด ยังไม่ได้ต่อกับแบบจำลองภาษา</li>
                <li>มีแม่แบบเดียวคืออาคารทั่วไป ประเภทอื่นรอถอดสัดส่วนจากเอกสารงวดงานของแบบมาตรฐาน</li>
                <li>ยังไม่มีการบันทึกความคืบหน้าหน้างาน เส้นผลงานจริงจึงยังไม่มี</li>
              </ul>
            </div>
          </div>
          <p className="form-note">
            อ้างอิง <code>docs/research/s-curve-rules-2026-08-25.md</code> และ{" "}
            <code>docs/research/changkid-easy-planning-2026-08-25.md</code>
          </p>
        </div>
      </section>
    </AppShell>
  );
}
