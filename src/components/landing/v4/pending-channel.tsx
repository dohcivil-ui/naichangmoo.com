"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button, type ResponsiveSize, type Size } from "@/components/platform/button";

const NOTE_MS = 2000;

type Props = {
  /** ข้อความสั้นที่ขึ้นใกล้จุดที่กด เช่น "ยังไม่ได้ตั้งค่า LINE OA" */
  message: string;
  children: ReactNode;
  /** ชื่อที่โปรแกรมอ่านหน้าจออ่าน เมื่อปุ่มมีแค่ไอคอน (วงโซเชียล) */
  ariaLabel?: string;
} & (
  | {
      /** ปุ่ม LINE — ผ่าน `<Button tone="line">` ตัวเดิม หน้าตาและท่าทางเหมือนปุ่มที่มีลิงก์ทุกอย่าง */
      as: "line";
      size: Size | ResponsiveSize;
      icon: ReactNode;
    }
  | {
      /** ปุ่มธรรมดาที่ใส่คลาสของจุดนั้นเอง (`v4-social`, `v4-nav-item`, `v4-link`) */
      as: "plain";
      className: string;
    }
);

/**
 * ช่องทางติดต่อที่ผู้ดูแลยังไม่ได้ตั้งค่า — **กดได้และมีท่าทางเหมือนปุ่มปกติทุกอย่าง แต่กดแล้วไม่พาไปไหน**
 *
 * คำตัดสินเจ้าของงาน 2026-09-28 (รอบสอง แทนรอบแรกที่ให้เป็น disabled): หน้าแรก v4 ต้องแสดง
 * ช่องทางตามผืนเสมอ และต้องตอบมือเหมือนปุ่มจริง hover ยก เด้ง pop กดยุบ ครบ ·
 * กดแล้วขึ้นข้อความสั้น ๆ ใกล้จุดที่กดราว 2 วินาที ไม่เปลี่ยนหน้า และไม่มีลิงก์ตายในโค้ด
 *
 * ข้อความอยู่ใน `role="status"` ที่มีอยู่ในหน้าตลอด (ว่างเมื่อไม่แสดง) โปรแกรมอ่านหน้าจอจึงอ่าน
 * ตอนข้อความเปลี่ยน · ปุ่มชี้ไปที่มันด้วย `aria-describedby`
 *
 * **ไม่มีสถานะของตัวเองที่ต้องล้าง** วันที่ผู้ดูแลกรอกค่าที่ `/admin/channels` ที่เรียกจะได้ href
 * แล้วเรนเดอร์ลิงก์จริงแทนคอมโพเนนต์นี้เอง ไม่ต้องแก้โค้ด
 */
export function PendingChannel(props: Props) {
  const noteId = useId();
  const [shown, setShown] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const show = () => {
    window.clearTimeout(timer.current);
    setShown(true);
    timer.current = window.setTimeout(() => setShown(false), NOTE_MS);
  };

  const trigger = props.as === "line" ? (
    <Button tone="line" size={props.size} icon={props.icon} onClick={show} aria-describedby={noteId} aria-label={props.ariaLabel}>
      {props.children}
    </Button>
  ) : (
    <button type="button" className={`v4-pending__trigger ${props.className}`} onClick={show} aria-describedby={noteId} aria-label={props.ariaLabel}>
      {props.children}
    </button>
  );

  return (
    <span className="v4-pending">
      {trigger}
      <span id={noteId} role="status" className="v4-pending__note" data-shown={shown ? "true" : "false"}>
        {shown ? props.message : ""}
      </span>
    </span>
  );
}
