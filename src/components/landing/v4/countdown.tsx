"use client";

import { useEffect, useState } from "react";

const UNITS = [
  { key: "d", label: "วัน" },
  { key: "h", label: "ชม." },
  { key: "m", label: "นาที" },
  { key: "s", label: "วินาที" }
] as const;

function split(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(t / 86400), h: Math.floor(t / 3600) % 24, m: Math.floor(t / 60) % 60, s: t % 60 };
}

/**
 * นับถอยหลังถึง `promoEndsAt` — อัปเดตทุก 1 วินาที เติม 0 ให้ครบสองหลัก
 * เซิร์ฟเวอร์เรนเดอร์ "--" ก่อน (อ่านนาฬิกาตอน SSR แล้ว hydration จะไม่ตรง)
 * ถึง 0 แล้วหยุด · การซ่อนทั้งบล็อกเป็นหน้าที่ของ `isPromoLive()` ที่ page ไม่ใช่ที่นี่
 */
export function Countdown({ endsAt }: { endsAt: string }) {
  const [left, setLeft] = useState<ReturnType<typeof split> | null>(null);

  useEffect(() => {
    const end = new Date(endsAt).getTime();
    let id = 0;
    const tick = () => {
      const ms = end - Date.now();
      setLeft(split(ms));
      if (ms <= 0) window.clearInterval(id);
    };
    tick();
    id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  const label = left ? `เหลือ ${left.d} วัน ${left.h} ชั่วโมง ${left.m} นาที` : "กำลังคำนวณเวลาที่เหลือ";

  return (
    <div className="v4-countdown" role="timer" aria-label={label}>
      {UNITS.map((u) => (
        <div className="v4-countdown__unit" key={u.key}>
          <span className="v4-countdown__box v3-hd" aria-hidden="true">{left ? String(left[u.key]).padStart(2, "0") : "--"}</span>
          <span className="v4-countdown__label" aria-hidden="true">{u.label}</span>
        </div>
      ))}
    </div>
  );
}
