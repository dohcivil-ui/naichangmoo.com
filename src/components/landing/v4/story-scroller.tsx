"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

/**
 * Scroll story ของ Hermes — กล่องสูง 280vh กรอบข้างในติดจอ
 *
 * p = ความคืบหน้าของการเลื่อนผ่านกล่อง (0–1)
 * ภาพ: scale(1.15 - p*.15) translateY((.5 - p)*40px)
 * คำบรรยายชุดที่ i ได้ช่วง 1/n ของ p เรียก q:
 *   0–.45 เลื่อนขึ้นจาก 120px + fade in · .45–.8 ค้าง · .8–1.05 จาง + เลื่อน -60px (ชุดสุดท้ายค้าง)
 * เขียน style ผ่าน ref ใน rAF ห้าม setState ทุกเฟรม
 * reduced motion: CSS วางภาพนิ่งกับคำบรรยายทุกชุดเรียงกัน และโค้ดนี้ไม่ผูก listener
 */
export function StoryScroller({ imageUrl, alt, captions }: { imageUrl: string; alt: string; captions: readonly { kicker: string; text: string }[] }) {
  const section = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLDivElement>(null);
  const caps = useRef<(HTMLDivElement | null)[]>([]);
  const dots = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const n = captions.length;
    let frame = 0;
    const paint = () => {
      const sec = section.current;
      const img = image.current;
      if (!sec || !img) return;
      const rect = sec.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
      img.style.transform = `scale(${1.15 - p * 0.15}) translateY(${(0.5 - p) * 40}px)`;
      const seg = 1 / n;
      for (let i = 0; i < n; i++) {
        const el = caps.current[i];
        const dot = dots.current[i];
        if (!el) continue;
        const q = (p - i * seg) / seg;
        const last = i === n - 1;
        let op = 0;
        let ty = 120;
        if (q >= 0 && q < 0.45) { const k = q / 0.45; op = k; ty = 120 * (1 - k); }
        else if (q >= 0.45 && q < 0.8) { op = 1; ty = 0; }
        else if (q >= 0.8 && q <= 1.05) { const k = Math.min(1, (q - 0.8) / 0.25); op = last ? 1 : 1 - k; ty = last ? 0 : -60 * k; }
        else if (q > 1.05 && last) { op = 1; ty = 0; }
        el.style.opacity = String(op);
        el.style.transform = `translateY(${ty}px)`;
        if (dot) dot.dataset.active = q >= 0 && (q < 1 || last) ? "true" : "false";
      }
    };
    const onScroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(paint); };
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [captions.length]);

  return (
    <div className="v4-story" ref={section}>
      <div className="v4-story__stage">
        <div className="v4-story__frame">
          <div className="v4-story__img" ref={image}>
            <Image src={imageUrl} alt={alt} fill sizes="(max-width: 1200px) 100vw, 1200px" />
          </div>
          <div className="v4-story__shade" aria-hidden="true" />
          <div className="v4-story__caps">
            {captions.map((c, i) => (
              <div className="v4-story__cap" key={c.kicker} ref={(el) => { caps.current[i] = el; }}>
                <p className="v4-story__kicker">{c.kicker}</p>
                <p className="v4-story__text">{c.text}</p>
              </div>
            ))}
          </div>
          <div className="v4-story__dots" aria-hidden="true">
            {captions.map((c, i) => (
              <span key={c.kicker} className="v4-story__dot" data-active="false" ref={(el) => { dots.current[i] = el; }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
