"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { heroCopy } from "@/lib/landing-v4-data";
import { LineCta } from "./line-cta";

/**
 * Hero — ตัวหนังสือเข้าเป็นลำดับด้วย CSS (`v4-hero-in`) ส่วนภาพขยับตามการเลื่อน:
 * translateY(-scrollY*.12) · scale(1 - p*.04) · opacity(1 - p*.5) โดย p = min(1, scrollY/700)
 * ปิดทั้งหมดเมื่อ prefers-reduced-motion
 */
export function V4Hero({ lineHref, imageUrl }: { lineHref: string | null; imageUrl: string }) {
  const media = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = media.current;
        if (!el) return;
        const y = window.scrollY;
        const p = Math.min(1, y / 700);
        el.style.transform = `translateY(${-y * 0.12}px) scale(${1 - p * 0.04})`;
        el.style.opacity = String(1 - p * 0.5);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
  }, []);

  return (
    <section className="v4-hero" id="top">
      <p className="v4-hero__kicker">{heroCopy.kicker}</p>
      <h1 className="v4-hero__title">{heroCopy.title}</h1>
      <p className="v4-hero__lede">{heroCopy.lede}</p>
      <div className="v4-hero__actions">
        <LineCta href={lineHref} />
        <a className="v4-link" href="#hermes">{heroCopy.learnMore}</a>
      </div>
      <div className="v4-hero__media" ref={media}>
        <div className="v4-hero__shot">
          <Image src={imageUrl} alt="Hermes 24/7" fill sizes="(max-width: 1180px) 100vw, 1180px" priority />
        </div>
      </div>
    </section>
  );
}
