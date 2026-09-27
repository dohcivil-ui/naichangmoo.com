"use client";

import { useEffect, useRef } from "react";

/**
 * ตัวเลขที่นับขึ้นจาก 0 ใน .9s (ease-out cubic) ครั้งเดียวเมื่อเลื่อนมาถึง
 * เซิร์ฟเวอร์เรนเดอร์ค่าจริงไว้ก่อน — ไม่มี JS ก็ยังเห็นเลขถูก · reduced motion = ไม่นับ
 */
export function LiveCount({ value }: { value: number }) {
  const el = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = el.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (node.getBoundingClientRect().top < window.innerHeight) return;
    node.textContent = "0";
    let frame = 0;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / 900);
        node.textContent = String(Math.round(value * (1 - Math.pow(1 - p, 3))));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { rootMargin: "0px 0px -60px 0px" });
    io.observe(node);
    return () => { io.disconnect(); cancelAnimationFrame(frame); node.textContent = String(value); };
  }, [value]);

  return <span ref={el} className="v4-apps__num v3-hd">{value}</span>;
}
