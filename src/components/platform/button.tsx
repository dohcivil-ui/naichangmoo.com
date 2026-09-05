import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";

/**
 * ปุ่มของทั้งเว็บ — ของชิ้นเดียว ไม่ใช่สตริงที่พิมพ์มือ (IP-235)
 *
 * **ทำไมต้องมีไฟล์นี้** ก่อนหน้านี้ปุ่มคือ `className="button button--orange micro-button"`
 * ที่คนพิมพ์เองซ้ำ ๆ ทั่วโปรเจกต์ นับได้ **เจ็ดแบบต่างกัน 76 จุด** สำหรับของที่ควรมีแบบเดียว
 * และ `micro-button` ที่ติดอยู่ 71 จุดไม่มีกฎ CSS สักบรรทัด จึงไม่เคยทำอะไรเลย
 * ตอนนั้นไม่มีใครเห็นความต่าง เพราะคลาสที่หายไปไม่มีผล — วันที่มีคนใส่สไตล์ให้มัน
 * ปุ่มเก้าตัวที่ไม่มีคลาสนั้นจะเพี้ยนพร้อมกันโดยไม่มีใครรู้
 *
 * เจ้าของงานถามเองเมื่อ 2026-09-05 ว่า "ทำไมไม่ทำปุ่มให้เท่ากันทั้งเว็บ ทุกอย่างต้องมาจาก
 * design เหมือนกัน" · คำตอบคือปุ่มต้องเป็น component สตริงที่พิมพ์มือจะเพี้ยนวันหนึ่งแน่นอน
 * ส่วน component ตัวเดียวเพี้ยนไม่ได้ · `src/button-fence.test.ts` เฝ้าไม่ให้ใครพิมพ์มืออีก
 *
 * **ขนาดเดียว สูง 48px ไม่มีข้อยกเว้น** เขาสั่งเอง · ความสูงกับทรงอยู่ใน `globals.css`
 * กฎ `.button` ที่เดียว ไฟล์นี้ตัดสินแค่ว่าปุ่มหนึ่งตัวเป็นระดับไหนและเป็น element อะไร
 */

/**
 * ระดับของปุ่ม บอกหน้าที่ ไม่ได้บอกสี
 *
 * ชื่อคลาส CSS ที่มันแปลงไปเป็นตั้งมาตั้งแต่ก่อนมีไฟล์นี้ และเรียกชื่อสวนทางกับหน้าที่ —
 * `button--primary` เป็นสีหมึก ส่วนปุ่มหลักจริง ๆ คือ `button--orange` · ไม่เปลี่ยนชื่อคลาส
 * เพราะมันแตะทุกที่ที่เขียนสไตล์ทับไว้ **ที่นี่คือที่เดียวที่ต้องรู้เรื่องนี้** ข้างนอกเห็นแค่หน้าที่
 */
export type Tone = "primary" | "ink" | "quiet";

const toneClass: Record<Tone, string> = {
  primary: "button button--orange",
  ink: "button button--primary",
  quiet: "button button--ghost"
};

/**
 * ลูกศรวาดเป็นรูป ไม่ใช่ตัวอักษร `→` ที่คนพิมพ์เอง ซึ่งเดิมพิมพ์มืออยู่แปดจุด
 *
 * ตัวอักษรลูกศรหนาบางไม่เท่ากันตามฟอนต์ที่เครื่องนั้นมี เปลี่ยนสีตามปุ่มไม่ได้
 * และวางไม่ตรงกลางตามแนวตัวหนังสือ · รูปที่วาดเองคมทุกความละเอียดจอ และรับสีจาก
 * `currentColor` จึงเปลี่ยนตามระดับของปุ่มเสมอโดยไม่ต้องสั่ง
 */
function Arrow() {
  return (
    <svg viewBox="0 0 20 20" className="button__arrow" aria-hidden="true">
      <path d="M3.5 10h12" />
      <path d="M11 5.5l4.5 4.5-4.5 4.5" />
    </svg>
  );
}

type Shared = {
  tone?: Tone;
  /** ลูกศรท้ายปุ่ม สำหรับปุ่มที่พาไปหน้าอื่น */
  arrow?: boolean;
  /** ยืดเต็มความกว้างของกล่องแม่ ใช้บนจอแคบและในฟอร์ม */
  block?: boolean;
  /**
   * ชั้นเสริม **สำหรับตำแหน่งเท่านั้น** เช่นระยะห่างจากของข้าง ๆ ในหน้าใดหน้าหนึ่ง
   *
   * ห้ามใช้เปลี่ยนหน้าตาของปุ่ม สี ขนาด ทรง หรือเงา — ถ้าต้องเปลี่ยนของพวกนั้น
   * แปลว่าระดับที่มีอยู่สามระดับยังไม่พอ ซึ่งเป็นเรื่องที่ต้องคุยกับเจ้าของงาน
   * ไม่ใช่แก้ที่จุดเรียกจุดเดียวแล้วปล่อยให้ปุ่มทั้งเว็บเริ่มเพี้ยนอีกรอบ
   * `src/button-fence.test.ts` ห้ามไม่ให้ค่านี้มีคำว่า `button--` อยู่ข้างใน
   */
  className?: string;
  children: ReactNode;
};

type AsLink = Shared & {
  href: string;
  type?: never;
  pending?: never;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children" | "href">;

type AsButton = Shared & {
  href?: never;
  /** กำลังส่งฟอร์มอยู่ — ปิดปุ่มและเปลี่ยนคำ ไม่ใช่แค่ปิดเฉย ๆ */
  pending?: boolean;
  pendingLabel?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

type AsLabel = Shared & {
  /** ปุ่มที่จริง ๆ เป็นป้ายของช่องเลือกไฟล์ ซึ่งกดแล้วเปิดหน้าต่างเลือกไฟล์ของเครื่อง */
  htmlFor: string;
  href?: never;
  type?: never;
  pending?: never;
} & Omit<LabelHTMLAttributes<HTMLLabelElement>, "className" | "children">;

function classesFor(tone: Tone, block: boolean, extra?: string): string {
  return [toneClass[tone], block ? "button--block" : "", extra ?? ""].filter(Boolean).join(" ");
}

/**
 * ลิงก์ที่ออกนอกเว็บเราต้องเป็น `<a>` ไม่ใช่ `<Link>` ของ Next
 *
 * `mailto:` กับ `http` ข้างนอกไม่ใช่เส้นทางในแอป การส่งให้ตัวจัดเส้นทางของ Next
 * ทำให้มันพยายามโหลดล่วงหน้าและจัดการเป็นหน้าในเว็บ ซึ่งไม่มีอยู่จริง
 * ตัดสินที่นี่ที่เดียว คนเรียกจึงไม่ต้องรู้เรื่องนี้
 */
function isExternal(href: string): boolean {
  return /^(https?:|mailto:|tel:)/.test(href);
}

/**
 * แยกของที่ปุ่มตัดสินเอง ออกจากของที่ส่งต่อให้ element จริง
 *
 * เขียนเป็นฟังก์ชันเพราะถ้าดึงออกมาแล้วทิ้งไว้เฉย ๆ ในตัว component ตัวตรวจจะทักว่า
 * ประกาศตัวแปรแล้วไม่ได้ใช้ ซึ่งถูกของมัน — ที่นี่ทุกตัวถูกส่งกลับออกไปจริง
 */
type Internal = Shared & {
  href?: string;
  htmlFor?: string;
  pending?: boolean;
  pendingLabel?: string;
  /** ของที่เหลือส่งต่อให้ element จริงทั้งดุ้น — แต่ละสาขาแปลงชนิดตอนกางออก */
  [key: string]: unknown;
};

function split(props: Internal) {
  const { tone, arrow, block, className, children, pending, pendingLabel, ...rest } = props;
  return {
    tone: tone ?? "primary",
    arrow: arrow ?? false,
    block: block ?? false,
    className,
    children,
    pending: pending ?? false,
    pendingLabel,
    rest
  };
}

export function Button(props: AsLink | AsButton | AsLabel) {
  const { tone, arrow, block, className: extra, children, pending, pendingLabel, rest } = split(props as Internal);
  const className = classesFor(tone, block, extra);
  const body = (
    <>
      {children}
      {arrow ? <Arrow /> : null}
    </>
  );

  if (typeof rest.href === "string") {
    const { href, ...anchorRest } = rest;
    const attrs = anchorRest as unknown as AnchorHTMLAttributes<HTMLAnchorElement>;
    if (isExternal(href)) {
      return (
        <a className={className} href={href} {...attrs}>
          {body}
        </a>
      );
    }
    return (
      <Link className={className} href={href} {...attrs}>
        {body}
      </Link>
    );
  }

  if (typeof rest.htmlFor === "string") {
    return (
      <label className={className} {...(rest as unknown as LabelHTMLAttributes<HTMLLabelElement>)}>
        {body}
      </label>
    );
  }

  const attrs = rest as unknown as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button
      {...attrs}
      className={className}
      type={attrs.type ?? "button"}
      disabled={attrs.disabled || pending}
    >
      {pending && pendingLabel ? pendingLabel : children}
      {arrow && !pending ? <Arrow /> : null}
    </button>
  );
}
