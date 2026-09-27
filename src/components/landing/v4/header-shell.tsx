"use client";

import { useEffect, type ReactNode } from "react";

/**
 * ตัวห่อแถบบน — ตัดสินอย่างเดียวว่าหน้าเลื่อนเกิน 60px หรือยัง
 *
 * เขียนผลลง `html[data-v4-compact]` ค่าเดียว แล้วให้ CSS ย่อทั้งแถบบนและขยับแถบเมนูตาม
 * สองแถบจึงไม่มีทางย่อไม่พร้อมกัน · ตอนค่านี้เปลี่ยนเป็นจริง ปุ่มในแถบเด้งรับหนึ่งครั้ง (`v4-navpop`)
 */
export function HeaderShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const compact = window.scrollY > 60;
        if (compact) root.dataset.v4Compact = "true";
        else delete root.dataset.v4Compact;
      });
    };
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => {
      window.removeEventListener("scroll", sync);
      cancelAnimationFrame(frame);
      delete root.dataset.v4Compact;
    };
  }, []);

  return <header className="v4-header">{children}</header>;
}
