"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/platform/button";

/**
 * แถวโปรโมชั่นของหน้าร้าน — ผืนออกแบบรุ่นสาม ส่วนที่ 5 ข้อ 4
 *
 * **ฝั่ง client เพราะนาฬิกาเดินเวลาจริง** ทะเบียนแอปอ่านที่ `page.tsx` ฝั่ง server
 * แล้วส่งลงมาเป็น prop เหมือนแบนเนอร์สไลด์ ตัวนี้จึงไม่ import อะไรจาก `@/server` เลย
 *
 * **หมายเหตุราคาตัวอย่างเป็นสิ่งเดียวที่กันไม่ให้ราคาสมมติถูกอ่านเป็นราคาจริง**
 * `landing-v3-data.ts` เขียนกำกับตัวเองไว้ว่าห้ามเอาออกก่อนราคาจริงมาถึง ·
 * ถ้าผืนออกแบบไม่มีที่ให้วางหมายเหตุ นั่นเป็นเหตุให้หยุดถาม ไม่ใช่เหตุให้ตัดหมายเหตุทิ้ง
 */

export type PromoCardView = {
  slug: string;
  imageUrl: string;
  group: string;
  name: string;
  priceBaht: number;
  wasBaht: number | null;
  unit: string;
  /** ป้ายมุมซ้ายบน คำแถลงเรื่องสิทธิ์จากทะเบียน — null คือทะเบียนยังไม่ประกาศแอปนี้ */
  accessLabel: string | null;
  /** ถ้อยคำปุ่ม มาจากทะเบียน ไม่ได้พิมพ์ในไฟล์ข้อมูล */
  ctaLabel: string;
  detailHref: string;
};

const baht = new Intl.NumberFormat("th-TH");

/** ช่องนาฬิกาสี่ช่อง วัน ชั่วโมง นาที วินาที */
function Clock({ endsAt }: { endsAt: string }) {
  /**
   * **ค่าตั้งต้นเป็น null ไม่ใช่เวลาที่คำนวณตอน render**
   *
   * ฝั่ง server กับฝั่งเบราว์เซอร์คำนวณคนละวินาที ถ้าคำนวณตั้งแต่ render แรก
   * สิ่งที่ server เขียนกับสิ่งที่เบราว์เซอร์วาดจะไม่ตรงกันทันที · นาฬิกาจึงว่างไว้ก่อน
   * แล้วเริ่มเดินใน effect ซึ่งทำให้ไม่มีเลขกะพริบเปลี่ยนตอนหน้าโหลดเสร็จด้วย
   */
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const end = new Date(endsAt).getTime();
    const tick = () => setLeft(Math.max(0, end - Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);

  if (left === null) return null;

  const seconds = Math.floor(left / 1000);
  const parts = [
    { key: "day", value: Math.floor(seconds / 86400), label: "วัน" },
    { key: "hour", value: Math.floor(seconds / 3600) % 24, label: "ชั่วโมง" },
    { key: "minute", value: Math.floor(seconds / 60) % 60, label: "นาที" },
    { key: "second", value: seconds % 60, label: "วินาที" }
  ];

  return (
    <div className="v3-promo__clock">
      <span className="v3-promo__clock-caption">หมดเขตใน</span>
      {parts.map((part, index) => (
        <span key={part.key} className="v3-promo__clock-group">
          <span className="v3-promo__clock-cell v3-hd">
            <span className="visually-hidden">{part.label} </span>
            {String(part.value).padStart(2, "0")}
          </span>
          {index < parts.length - 1 ? <span className="v3-promo__tick" aria-hidden="true">:</span> : null}
        </span>
      ))}
    </div>
  );
}

export function PromoRow({ cards, endsAt }: { cards: readonly PromoCardView[]; endsAt: string }) {
  return (
    <section className="v3-promo" id="promo">
      <div className="v3-promo__head">
        <div className="v3-promo__heading">
          <h2 className="v3-promo__title">โปรโมชั่นเดือนนี้</h2>
          {/* ห้ามเอาบรรทัดนี้ออกก่อนราคาจริงมาถึง — `landing-v3-data.ts` อธิบายไว้ว่าทำไม */}
          <p className="v3-promo__note">ราคาตัวอย่าง · รอยืนยันจากทะเบียนแอป</p>
        </div>
        <Clock endsAt={endsAt} />
      </div>

      <div className="v3-promo__grid">
        {cards.map((card) => (
          <article className="v3-card v3-promo__card" key={card.slug}>
            {/* ป้ายวิ่งด้วย keyframe ที่มีเฟรม opacity ศูนย์ จึงต้องติด `data-v3-decor`
                ไม่งั้นคนที่ตั้งเครื่องลดการเคลื่อนไหวจะเห็นป้ายค้างที่เฟรมที่มันจางหาย */}
            {card.accessLabel ? (
              <span className="v3-promo__badge" data-v3-decor>
                <span className="v3-promo__shine" data-v3-decor aria-hidden="true" />
                {card.accessLabel}
              </span>
            ) : null}

            {/* ภาพอยู่ในกล่องที่ถือขอบกับมุมโค้ง ไม่ใช่ตัวภาพถือเอง — ผืนวางไว้แบบนี้
                กล่องกว้าง 120 ขอบ 1px ภาพข้างในจึงเหลือ 118 พอดี ถ้าให้ภาพถือขอบเอง
                ตัวภาพจะกว้าง 120 รวมขอบ ซึ่งใหญ่กว่าผืนสองพิกเซล */}
            <span className="v3-promo__frame">
              <Image className="v3-promo__image" src={card.imageUrl} alt="" width={240} height={240} sizes="120px" />
            </span>

            <div className="v3-promo__body">
              <p className="v3-promo__group">{card.group}</p>
              <h3 className="v3-promo__name">
                <Link className="v3-promo__link" href={card.detailHref}>{card.name}</Link>
              </h3>
              <p className="v3-promo__price v3-hd">
                ฿ {baht.format(card.priceBaht)}
                {card.wasBaht === null ? null : <s className="v3-promo__was v3-hd"> ฿ {baht.format(card.wasBaht)}</s>}
                <small className="v3-promo__unit">{card.unit}</small>
              </p>
              <div className="v3-promo__action">
                <Button tone="shop" size={40} href={card.detailHref}>{card.ctaLabel}</Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
