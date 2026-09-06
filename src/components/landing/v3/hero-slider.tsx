"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRightIcon } from "@/components/icons/platform-icons";
import { Button } from "@/components/platform/button";

/**
 * แบนเนอร์สไลด์ของหน้าร้าน — ผืนออกแบบรุ่นสาม ส่วนที่ 3 ข้อ 3a
 *
 * **ตัวนี้เป็นฝั่ง client จึงห้ามอ่านทะเบียนแอปเอง** ถ้า import `@/server/app-registry`
 * เข้ามา `architecture-fence` จะไม่แดง เพราะด่านนั้นห้ามแค่ `@/db` `drizzle-orm` และ
 * `@/server/project-status` — **แต่ build จะพัง** เพราะโค้ดฝั่งเซิร์ฟเวอร์ถูกลากเข้ามัดของ
 * เบราว์เซอร์ · หน้า `page.tsx` ฝั่ง server จึงเป็นคนอ่านทะเบียนแล้วส่งผลลงมาเป็น prop
 * เจ้าของงานเคาะทางนี้ 2026-09-06
 *
 * **ป้ายมุมบน ถ้อยคำปุ่ม และปุ่มทางเข้า เป็นคำแถลงทั้งสามอย่าง ไม่ใช่ของตกแต่ง**
 * ป้ายบอกเรื่องสิทธิ์ ถ้อยคำปุ่มบอกว่ากดแล้วได้อะไร ปุ่มรองบอกว่ามีทางเข้า ทั้งหมดมาจาก
 * ทะเบียนผ่าน prop และหายไปเงียบ ๆ เมื่อทะเบียนยังไม่ได้ประกาศ (ADR 0015 — เงียบ ไม่ใช่หาย)
 * สไลด์ยังอยู่ครบ แค่ไม่มีป้ายและไม่มีปุ่มรอง
 */

export type HeroSlideView = {
  slug: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  body: string;
  /** ป้ายมุมบน คำแถลงเรื่องสิทธิ์จากทะเบียน — null คือทะเบียนยังไม่ประกาศแอปนี้ */
  tagLabel: string | null;
  /** หน้ารายละเอียดแอป ไปได้ทุกสถานะ จึงไม่เคยเป็น null */
  detailHref: string;
  /**
   * ถ้อยคำปุ่มหลัก **มาจากทะเบียน ไม่ได้พิมพ์ที่นี่**
   *
   * ผืนออกแบบเขียนว่า `Shop now!` ซึ่งใช้ไม่ได้สองชั้น — `copy-th.md` หมวดสามสั่งว่า
   * ปุ่มบนหน้าขายเป็นคำสั่งสั้นภาษาไทย และหนักกว่านั้นคือคำนั้นสัญญาว่าซื้อได้ทันที
   * ทั้งที่ปุ่มพาไปหน้ารายละเอียด ซึ่งเป็นคำโกหกแบบเดียวกับเส้นทางที่ไม่มีปลายทางจริง
   *
   * `describeCardClaims().cta` ตอบเรื่องนี้อยู่แล้วทั้งเว็บ และตอบตามสถานะจริงในทะเบียน
   * จึงไม่ต้องประดิษฐ์คำใหม่ ซึ่ง `copy-th.md` หมวดหนึ่งห้ามไว้อยู่แล้ว
   */
  primaryLabel: string;
  /** ทางเข้าแอปจริง — null เมื่อทะเบียนยังไม่เปิด ปุ่มรองจึงไม่ขึ้น */
  entryHref: string | null;
  entryLabel: string;
};

/** ผืนออกแบบสั่งไว้ 5000ms — เปลี่ยนที่นี่ที่เดียว ทั้งตัวหมุนและตัวรีเซ็ตใช้ค่าเดียวกัน */
const SLIDE_MS = 5000;

export function HeroSlider({ slides }: { slides: readonly HeroSlideView[] }) {
  const [index, setIndex] = useState(0);
  /**
   * สลับชุด keyframe ไปมาทุกครั้งที่เปลี่ยนสไลด์
   *
   * สไลด์เปลี่ยนภาพโดยไม่เปลี่ยนอิลิเมนต์ เบราว์เซอร์จึงไม่เล่น animation ซ้ำถ้าชื่อเดิม
   * `v3-fadeA` กับ `v3-fadeB` มีเนื้อในเหมือนกันเป๊ะ ต่างกันแค่ชื่อ เพื่อให้การสลับ
   * เป็นการเริ่มใหม่จริง ผืนออกแบบใช้ `state.flip ^ 1` ด้วยเหตุผลเดียวกัน
   */
  const [flip, setFlip] = useState(false);
  /**
   * หยุดหมุนเมื่อคนกำลังดูหรือกำลังใช้ปุ่มในแบนเนอร์
   *
   * WCAG 2.2.2 บังคับว่าของที่ขยับเองนานเกินห้าวินาทีต้องหยุดได้ · การเลื่อนหนีตอนคนกำลัง
   * อ่านหรือกำลังจะกดปุ่มคือการแย่งของไปจากมือเขา `focus-within` จึงสำคัญเท่า `hover`
   * เพราะคนที่ใช้คีย์บอร์ดไม่มีเมาส์ให้วางไว้บนแบนเนอร์
   */
  const [held, setHeld] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const show = useCallback((next: number) => {
    setIndex(((next % slides.length) + slides.length) % slides.length);
    setFlip((current) => !current);
  }, [slides.length]);

  useEffect(() => {
    /**
     * **คนที่ตั้งเครื่องให้ลดการเคลื่อนไหวต้องไม่ได้สไลด์ที่หมุนเอง**
     *
     * กฎ CSS ที่ท้าย `globals.css` สั่งได้แค่ animation ส่วนตัวหมุนเป็น JavaScript
     * ซึ่ง CSS แตะไม่ถึงเลย · ต้องอ่านค่าเดียวกันนั้นที่นี่แล้วไม่ตั้งตัวจับเวลาตั้งแต่แรก
     * ไม่ใช่ตั้งแล้วค่อยหยุด · สไลด์ยังเปลี่ยนได้ด้วยลูกศรกับขีดตามปกติ
     */
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (still.matches || held) return;

    /* **เริ่มหมุนใน effect ไม่ใช่ตอน render** ฝั่ง server ต้องได้สไลด์แรกเสมอ
       ไม่งั้นสิ่งที่ server เขียนกับสิ่งที่ browser วาดจะไม่ตรงกันตั้งแต่วินาทีแรก */
    timer.current = setInterval(() => show(index + 1), SLIDE_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [index, show, held]);

  const slide = slides[index];
  if (!slide) return null;

  return (
    <div
      className="v3-banner"
      data-flip={flip ? "b" : "a"}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
    >
      <Image
        className="v3-banner__img"
        src={slide.imageUrl}
        alt=""
        width={1280}
        height={400}
        priority={index === 0}
        sizes="(max-width: 1100px) 100vw, 900px"
      />
      <span className="v3-banner__scrim v3-banner__scrim--x" aria-hidden="true" />
      <span className="v3-banner__scrim v3-banner__scrim--y" aria-hidden="true" />

      {/* คนที่ใช้โปรแกรมอ่านหน้าจอไม่ได้เห็นภาพเปลี่ยน จึงต้องบอกว่าบริเวณนี้เปลี่ยนเองได้
          `aria-live="off"` เพราะการอ่านทับทุกห้าวินาทีรบกวนกว่าการไม่บอก คนที่ต้องการ
          อ่านทั้งสามใบใช้ปุ่มเลื่อนได้ ซึ่งเป็นปุ่มจริงที่แท็บถึงและหยุดการหมุนเมื่อโฟกัส */}
      <div className="v3-banner__text" aria-live="off" aria-atomic="true">
        {slide.tagLabel ? <span className="v3-tag">{slide.tagLabel}</span> : null}
        <h2 className="v3-banner__title">
          <span>{slide.title}</span>
          <span>{slide.subtitle}</span>
        </h2>
        <p className="v3-banner__body">{slide.body}</p>
        <div className="v3-banner__actions">
          <Button tone="shop" size={44} href={slide.detailHref}>{slide.primaryLabel}</Button>
          {slide.entryHref ? <Button tone="quiet" size={44} href={slide.entryHref}>{slide.entryLabel}</Button> : null}
        </div>
      </div>

      <div className="v3-banner__dots">
        {slides.map((item, dot) => (
          <Button
            key={item.slug}
            tone="slideDot"
            aria-current={dot === index}
            aria-label={`สไลด์ที่ ${dot + 1} ${item.title}`}
            onClick={() => show(dot)}
          >
            <span className="visually-hidden">{item.title}</span>
          </Button>
        ))}
      </div>

      <div className="v3-banner__nav v3-banner__nav--prev">
        <Button tone="slideNav" size={36} aria-label="สไลด์ก่อนหน้า" onClick={() => show(index - 1)}>
          <ChevronRightIcon strokeWidth={4.4} />
        </Button>
      </div>
      <div className="v3-banner__nav v3-banner__nav--next">
        <Button tone="slideNav" size={36} aria-label="สไลด์ถัดไป" onClick={() => show(index + 1)}>
          <ChevronRightIcon strokeWidth={4.4} />
        </Button>
      </div>
    </div>
  );
}
