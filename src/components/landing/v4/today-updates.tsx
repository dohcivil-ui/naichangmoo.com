"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/platform/button";

export type UpdateSlideView = {
  slug: string;
  kicker: string;
  title: string;
  desc: string;
  imageUrl: string;
  /** จากทะเบียน (`describeCardClaims().cta.label`) ไม่ใช่คำในผืน */
  ctaLabel: string;
  href: string;
};

const INTERVAL_MS = 6000;

/**
 * "อัพเดทวันนี้" — สไลด์เปลี่ยนเองทุก 6 วินาที crossfade .9s
 *
 * **ข้อความเลื่อนขึ้นด้วย transition ที่ผูกกับ `data-active` เท่านั้น ห้ามเปลี่ยนเป็น keyframe**
 * ในต้นแบบรอบแรกใช้ keyframe แล้วข้อความค้างที่ opacity 0 หลังสไลด์แรก
 * กดลูกศรหรือจุด = เริ่มนับ 6 วินาทีใหม่ · reduced motion = ไม่เปลี่ยนเอง
 */
export function V4TodayUpdates({ slides, dateLabel }: { slides: readonly UpdateSlideView[]; dateLabel: string }) {
  const [index, setIndex] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const count = slides.length;

  const restart = useCallback(() => {
    window.clearInterval(timer.current);
    if (count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timer.current = window.setInterval(() => setIndex((i) => (i + 1) % count), INTERVAL_MS);
  }, [count]);

  useEffect(() => {
    restart();
    return () => window.clearInterval(timer.current);
  }, [restart]);

  const go = (next: number) => {
    setIndex(((next % count) + count) % count);
    restart();
  };

  if (count === 0) return null;

  return (
    <section className="v4-updates" id="updates" aria-labelledby="v4-updates-title">
      <div className="v4-wrap">
        <div className="v4-updates__head" data-reveal>
          <div className="v4-updates__title">
            <span className="v4-ping" aria-hidden="true" />
            <h2 id="v4-updates-title">อัพเดทวันนี้</h2>
          </div>
          <p className="v4-updates__date">งานที่กำลังจะปล่อย · {dateLabel}</p>
        </div>

        <div className="v4-slider" aria-roledescription="carousel" aria-label="งานที่กำลังจะปล่อย">
          {slides.map((slide, i) => (
            <article
              key={slide.slug}
              className="v4-slide"
              data-active={i === index ? "true" : "false"}
              aria-hidden={i !== index}
              aria-roledescription="slide"
              aria-label={`${i + 1} จาก ${count}`}
            >
              <div className="v4-slide__media">
                <Image src={slide.imageUrl} alt={slide.title} fill sizes="(max-width: 1200px) 100vw, 1200px" priority={i === 0} />
              </div>
              <div className="v4-slide__shade" aria-hidden="true" />
              <div className="v4-slide__copy">
                <p className="v4-slide__line v4-slide__kicker">{slide.kicker}</p>
                <h3 className="v4-slide__line v4-slide__title">{slide.title}</h3>
                <p className="v4-slide__line v4-slide__desc">{slide.desc}</p>
                <div className="v4-slide__line v4-slide__cta">
                  <Button tone="shopNav" size={40} href={slide.href} tabIndex={i === index ? 0 : -1}>{slide.ctaLabel}</Button>
                </div>
              </div>
            </article>
          ))}

          {count > 1 ? (
            <>
              <div className="v4-slider__arrow v4-slider__arrow--prev">
                <Button tone="slideNav" size="fit" aria-label="ก่อนหน้า" onClick={() => go(index - 1)}><span aria-hidden="true">‹</span></Button>
              </div>
              <div className="v4-slider__arrow v4-slider__arrow--next">
                <Button tone="slideNav" size="fit" aria-label="ถัดไป" onClick={() => go(index + 1)}><span aria-hidden="true">›</span></Button>
              </div>
              <div className="v4-slider__dots">
                {slides.map((slide, i) => (
                  <Button
                    key={slide.slug}
                    tone="slideDot"
                    size="fit"
                    aria-label={`ไปสไลด์ ${i + 1}`}
                    aria-current={i === index ? "true" : undefined}
                    onClick={() => go(i)}
                  >
                    <span className="v4-sr">{i + 1}</span>
                  </Button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
