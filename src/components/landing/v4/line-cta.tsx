import { Button } from "@/components/platform/button";
import { PendingChannel } from "./pending-channel";

/**
 * ปุ่ม "ปรึกษาฟรี คลิกเลย" — ตัวเดียวทุกจุดของหน้า (แถบบน hero Hermes การ์ดบริการ ท้ายหน้า)
 *
 * เป็นแค่ `<Button tone="line">` ที่ใส่คำกับตราไว้ให้ · หน้าตาอยู่ที่ `.button--line` ใน globals.css
 * ซึ่งเจ้าของงานเคาะใหม่ 2026-09-24 ให้เป็นแคปซูลแดง `--v4-cta` กับวงขาวตัวอักษรแดง
 * แทนเขียวของคำตัดสิน 2026-09-06
 *
 * `lg` = 44 บนจอแคบ / 46 บนจอกว้าง ตามผืน · `sm` = 40
 *
 * **ไม่มี href (ผู้ดูแลยังไม่กรอก LINE OA ที่ `/admin/channels`) → ยังแสดงปุ่มหน้าตาและท่าทางเดิมทุกอย่าง**
 * คำตัดสินเจ้าของงาน 2026-09-28 แทนที่คำตัดสิน 2026-08-28 ("ซ่อนจนกว่าจะกรอก") **เฉพาะหน้าแรก v4**:
 * ปุ่มต้องแสดงตามผืนเสมอ กดได้ hover ได้เหมือนปุ่มที่มีลิงก์ แต่กดแล้วไม่พาไปไหน
 * ขึ้นข้อความ "ยังไม่ได้ตั้งค่า LINE OA" แทน (`PendingChannel`) · ยังห้ามพิมพ์ลิงก์ตายในโค้ดเหมือนเดิม
 */
export function LineCta({ href, size = "lg" }: { href: string | null; size?: "lg" | "sm" }) {
  const height = size === "lg" ? { narrow: 44, wide: 46 } as const : 40;
  const icon = <span>LINE</span>;
  if (!href) {
    return (
      <PendingChannel as="line" size={height} icon={icon} message="ยังไม่ได้ตั้งค่า LINE OA">
        ปรึกษาฟรี คลิกเลย
      </PendingChannel>
    );
  }
  return (
    <Button tone="line" size={height} href={href} target="_blank" rel="noreferrer noopener" icon={icon}>
      ปรึกษาฟรี คลิกเลย
    </Button>
  );
}
