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
 * **เรื่องความสูง — คำสั่งเปลี่ยนแล้ว 2026-09-07 อ่านให้จบก่อนไปดัน 48 กลับมา**
 *
 * คำสั่งเดิมคือ "สูง 48px ทั้งเว็บ ไม่มีข้อยกเว้น" · เจ้าของงานเคาะใหม่เมื่อ 2026-09-07 ว่า
 * **ขนาดและทรงทุกค่ายึดผืนออกแบบรุ่นสาม กฎ 48 ไม่ชนะผืนอีกต่อไป** คำสั่งใหม่ทับคำสั่งเดิม
 * ถ้าไฟล์นี้ยังเขียนว่า 48 ไม่มีข้อยกเว้น คนถัดไปจะอ่านแล้วไปดัน 48 กลับมาอีกรอบ
 *
 * ที่ยังไม่เปลี่ยนคือ **ที่อยู่ของเลข** ความสูงยังต้องมาจากครัวกลาง ไม่ใช่จากหน้าที่เอื้อมมือ
 * มาเขียนทับด้วย selector ลูกหลาน — วิธีนั้น `button-fence` มองไม่เห็น และเป็นทางที่ปุ่ม
 * ทั้งเว็บเคยเพี้ยนมาแล้ว · เลขมาจากผืน ที่อยู่ของเลขยังเป็นระบบปุ่ม
 *
 * **ผืนไม่ผูกความสูงกับระดับปุ่ม** นับในผืนแล้ว `.btn` ไม่ประกาศ `height` เลยสักบรรทัด
 * ความสูงเป็น inline style ต่อจุด และมีห้าค่า 32 36 40 44 กับ 44 แบบเต็มกว้าง ·
 * ระดับเดียวกันสูงไม่เท่ากันตามที่มันนั่งอยู่ — `btn-primary` เป็นทั้ง 40 และ 44
 * ส่วน `btn-shop` เป็น 44 40 36 และ 32 · ความสูงจึงผูกกับ tone ไม่ได้ ต้องเป็นมิติที่สอง
 *
 * `size` คือมิติที่สองนั้น **tone บอกหน้าที่ size บอกขนาด** ทั้งคู่แปลงเป็นคลาสที่ครัวกลาง
 * **ไม่ส่ง `size` = 48 เหมือนเดิม** ทั้งเว็บนอกหน้าร้านจึงไม่ขยับแม้แต่ปุ่มเดียว
 * คำตัดสิน 2026-09-07 เป็นเรื่องของผืนรุ่นสาม ไม่ใช่การยกเลิกความสูงมาตรฐานของแพลตฟอร์ม
 */

/**
 * ระดับของปุ่ม บอกหน้าที่ ไม่ได้บอกสี
 *
 * ชื่อคลาส CSS ที่มันแปลงไปเป็นตั้งมาตั้งแต่ก่อนมีไฟล์นี้ และเรียกชื่อสวนทางกับหน้าที่ —
 * `button--primary` เป็นสีหมึก ส่วนปุ่มหลักจริง ๆ คือ `button--orange` · ไม่เปลี่ยนชื่อคลาส
 * เพราะมันแตะทุกที่ที่เขียนสไตล์ทับไว้ **ที่นี่คือที่เดียวที่ต้องรู้เรื่องนี้** ข้างนอกเห็นแค่หน้าที่
 *
 * **สามระดับล่างเป็นของหน้าร้าน ธีมขาว–แดง** เจ้าของงานเคาะ 2026-09-06 ว่าให้ขยายปุ่มตัวนี้
 * รับทรงใหม่ แทนการสร้างปุ่มอีกชุดของหน้าแรก · ความสูงของแต่ละจุดมาจากผืนผ่าน `size`
 * ตามคำตัดสิน 2026-09-07 ที่หัวไฟล์ ไม่ได้รับความสูงเดียวจาก `.button` เหมือนสี่ระดับบน
 *
 * ที่แยกเป็นสองระดับไม่ใช่เพราะสวยคนละแบบ แต่เพราะ**หน้าที่ต่างกัน** — นับในผืนออกแบบแล้ว
 * ขอบขาวซ้อนขึ้นเฉพาะปุ่มลงมือห้าจุด (เริ่มใช้ สมัคร ซื้อ) ส่วนปุ่มพาไปหน้าอื่นสี่จุดเป็นแดงเรียบ
 * · `shop` คือปุ่มลงมือ `shopNav` คือปุ่มพาไป
 *
 * ระดับ `.btn-secondary` ของผืนออกแบบ **ไม่ยกข้ามมา** เพราะนับแล้วไม่มีใครใช้เลยสักจุด
 * เป็นบทเรียนเดียวกับ `micro-button` ที่เคยติดอยู่ 71 จุดโดยไม่มีกฎ CSS สักบรรทัด
 *
 * **`line` เป็นระดับเดียวที่สีไม่ได้มาจากธีมของเรา** เขียวคู่นั้นเป็นสีของเจ้าของช่องทาง
 * เหมือนน้ำเงินของ Facebook · เจ้าของงานเคาะ 2026-09-06 ให้มันเข้าระบบปุ่มแทนที่จะเป็น
 * ลิงก์แบรนด์ลอย ๆ เพราะมันทำหน้าที่เป็นปุ่มเต็มตัว คือเป็นทางเดียวที่ลูกค้าเริ่มคุยกับเรา
 * · ตราวงกลมขาวส่งเข้ามาทาง `icon` ตามปกติ ไม่ต้องมีโครงพิเศษ
 *
 * **ระดับนี้ใช้ทั้งสองจุดที่มีปุ่ม LINE** ผืนออกแบบวาดไว้สองแบบ — แคปซูลเขียวในแถบ Hermes
 * และแคปซูลแดงในการ์ด Hermes บนพื้นน้ำเงินเข้ม · เจ้าของงานเคาะให้ใช้เขียวตัวเดียวทั้งคู่
 * ปุ่มที่พาไปที่เดียวกันไม่ควรมีสองสีให้คนต้องเรียนรู้สองรอบ และสีเขียวคือสิ่งที่คนจำได้ว่าคือ LINE
 * ส่วนแดงเป็นสีของเราเอง ซึ่งบนปุ่มนี้ไม่ได้บอกอะไรเพิ่ม
 *
 * **`slideNav` เป็นระดับที่แปด สำหรับปุ่มเลื่อนสไลด์บนแบนเนอร์** เป็นวงกลม ขนาดมาจาก
 * `size` เหมือนระดับอื่น · ที่ต้องเป็นระดับใหม่แทนการเขียน `className` ทับ เพราะปุ่มปกติได้
 * `padding: 0 22px` กับ `border-radius: 10px` ติดมาด้วย ซึ่งทำให้ปุ่มที่มีแค่ไอคอนตัวเดียว
 * ยืดเป็นแคปซูลแทนที่จะเป็นวงกลม · การเขียนทับด้วยคลาสข้างนอกจะกลายเป็นปุ่มชุดที่สอง
 * ที่ `button-fence` มองไม่เห็น
 *
 * **`slideDot` เป็นระดับที่เก้า สำหรับขีดบอกตำแหน่งสไลด์** ผืนวาดไว้ 22×3 ซึ่งเป็นทรง
 * ไม่ใช่แค่ความสูง จึงต้องเป็นระดับของตัวเอง ไม่ใช่ `plain` ที่หน้าเอื้อมมือมาบีบให้เล็ก ·
 * เขตกดของมันขยายเกินขีดที่ตาเห็นด้วย `::after` ที่ไม่กินพื้นที่ layout — ภาพเหมือนผืน
 * ทุกพิกเซล แต่ขนาดเป้ากดผ่านเกณฑ์ ซึ่งเป็นคนละเรื่องกับขนาดที่มองเห็น
 */
export type Tone =
  | "primary" | "ink" | "quiet" | "plain"
  | "shop" | "shopNav" | "line" | "slideNav" | "slideDot";

/**
 * ความสูงของปุ่มหนึ่งตัว — **ชุดปิด ไม่ใช่ตัวเลขอิสระ**
 *
 * ค่าทั้งสามมาจากผืนออกแบบรุ่นสาม ไม่ได้เลือกเอง · 32 ที่ผืนใช้ในการ์ดโปรโมชั่นยังไม่มีในชุดนี้
 * เพราะบล็อกนั้นเป็นงานขั้นที่ 3 ที่ยังไม่ลง ให้เติมตอนที่มีคนเรียกมันจริง ไม่ใช่เติมดักไว้
 *
 * `"fit"` ไม่ใช่ความสูง แต่คือ **ไม่มีความสูงบังคับ** สำหรับปุ่มที่เป็นบรรทัดข้อความในช่อง
 * หรือเป็นขีดบอกตำแหน่ง ซึ่งผืนไม่ได้ให้ความสูงมาเพราะมันไม่ใช่กล่องที่คนเล็ง
 *
 * **ไม่ส่งเลย = 48px** ความสูงมาตรฐานของแพลตฟอร์ม ซึ่งปุ่มทุกตัวนอกหน้าร้านยังใช้อยู่
 */
export type Size = 36 | 40 | 44 | "fit";

const sizeClass: Record<Size, string> = {
  36: "button--h36",
  40: "button--h40",
  44: "button--h44",
  fit: "button--hfit"
};

/**
 * ความสูงที่ใช้เมื่อจอกว้างพอ — คลาสชุดที่สองของมิติเดียวกัน ไม่ใช่มิติที่สาม
 *
 * กฎจริงอยู่ใน `globals.css` ใต้ `@media (min-width: 760.02px)` ที่นี่แค่แปลงค่าเป็นชื่อคลาส
 */
const wideSizeClass: Record<Size, string> = {
  36: "button--wide-h36",
  40: "button--wide-h40",
  44: "button--wide-h44",
  fit: "button--wide-hfit"
};

/**
 * **ปุ่มจุดเดียวกันสูงไม่เท่ากันได้ในสองอาร์ตบอร์ด และนั่นคือสิ่งที่ผืนสั่ง**
 *
 * ปุ่มบนการ์ดโปรโมชั่นเป็น 40 ที่ 1280 และ 36 ที่ 390 · เดิม `size` รับค่าเดียว
 * เปลี่ยนตามความกว้างไม่ได้เลย ทางที่เหลือคือให้หน้าเขียน CSS ทับด้วย selector ลูกหลาน
 * ซึ่ง `button-fence` มองไม่เห็น และเป็นทางที่ปุ่มทั้งเว็บเคยเพี้ยนมาแล้ว ·
 * **เลขทั้งสองค่าจึงต้องอยู่ในระบบปุ่ม** ไม่ใช่กระจายไปอยู่ที่หน้าที่เรียก
 *
 * เจ้าของงานเคาะ 2026-09-07 หลังวัดแล้วพบว่าสองจุดที่เหลือในกองต่างโดยไม่มีใครรู้ที่ 390
 * มาจากสาเหตุนี้ทั้งคู่ และผืนมือถือใช้ความสูงปุ่มสามค่า คือ 44 36 และ 32
 *
 * **ชื่อบอกความกว้างของจอ ไม่ได้บอกลำดับ** `narrow` คือค่าตั้งต้นที่ใช้กับทุกความกว้าง
 * ส่วน `wide` ทับเฉพาะเมื่อจอกว้างพอ · เขียนแบบนี้เพราะจอแคบคือกรณีที่ต้องถูกก่อน
 */
export type ResponsiveSize = { narrow: Size; wide: Size };

/** `size` เขียนเป็นค่าเดียวเมื่อทั้งสองความกว้างเท่ากัน หรือเป็นคู่เมื่อไม่เท่า */
function sizeClasses(size: Size | ResponsiveSize | undefined): string {
  if (size === undefined) return "";
  if (typeof size === "number" || size === "fit") return sizeClass[size];
  return `${sizeClass[size.narrow]} ${wideSizeClass[size.wide]}`;
}

const toneClass: Record<Tone, string> = {
  primary: "button button--orange",
  ink: "button button--primary",
  quiet: "button button--ghost",
  plain: "button button--text",
  shop: "button button--shop",
  shopNav: "button button--shop-nav",
  line: "button button--line",
  slideNav: "button button--slide-nav",
  slideDot: "button button--slide-dot"
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

/**
 * วงหมุนของสถานะกำลังทำงาน — ต้องต่างจากปุ่มที่กดไม่ได้ ไม่ใช่หน้าตาเดียวกัน
 *
 * ก่อนหน้านี้ `pending` เปลี่ยนแค่คำกับปิดปุ่ม ซึ่งวัดแล้วได้หน้าตาเหมือน `disabled`
 * ทุกประการ · คนจึงแยกไม่ออกว่า "กดไม่ได้เพราะยังทำอะไรไม่ครบ" กับ "กดไปแล้วกำลังส่ง"
 * ซึ่งเป็นคนละเรื่องกันโดยสิ้นเชิง (ข้อสองของเกณฑ์ที่เจ้าของงานวางไว้ 2026-09-05)
 */
function Spinner() {
  return (
    <svg viewBox="0 0 20 20" className="button__spin" aria-hidden="true">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 3a7 7 0 0 1 7 7" />
    </svg>
  );
}

type Shared = {
  tone?: Tone;
  /** ความสูงตามผืนออกแบบ — ไม่ส่ง = 48px ความสูงมาตรฐานของแพลตฟอร์ม */
  size?: Size | ResponsiveSize;
  /**
   * ไอคอนหน้าคำ ที่สื่อความเดียวกับคำบนปุ่ม
   *
   * ต่างจาก `arrow` ตรงที่ลูกศรบอกว่า "กดแล้วไปที่อื่น" ส่วนไอคอนบอกว่า "กดแล้วเกิดอะไร"
   * · เกณฑ์ข้อห้าของเจ้าของงาน — ไอคอนต้องสื่อความเดียวกับข้อความ ไม่กำกวม
   * ส่งเป็น `<svg>` ที่ใช้ `currentColor` เพื่อให้เปลี่ยนสีตามระดับของปุ่มเอง
   */
  icon?: ReactNode;
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

function classesFor(tone: Tone, size: Size | ResponsiveSize | undefined, block: boolean, extra?: string): string {
  return [toneClass[tone], sizeClasses(size), block ? "button--block" : "", extra ?? ""]
    .filter(Boolean)
    .join(" ");
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
  const { tone, size, icon, arrow, block, className, children, pending, pendingLabel, ...rest } = props;
  return {
    tone: tone ?? "primary",
    size,
    icon,
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
  const { tone, size, icon, arrow, block, className: extra, children, pending, pendingLabel, rest } = split(
    props as Internal
  );
  const className = classesFor(tone, size, block, extra);
  const body = (
    <>
      {icon ? <span className="button__icon">{icon}</span> : null}
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
      /* `aria-busy` บอกโปรแกรมอ่านหน้าจอว่ากำลังทำงานอยู่ ส่วน `data-pending` ให้ CSS
         แยกหน้าตาออกจากปุ่มที่กดไม่ได้ ซึ่งเป็นคนละสถานะกัน */
      aria-busy={pending || undefined}
      data-pending={pending ? "true" : undefined}
    >
      {pending ? <Spinner /> : icon ? <span className="button__icon">{icon}</span> : null}
      {pending && pendingLabel ? pendingLabel : children}
      {arrow && !pending ? <Arrow /> : null}
    </button>
  );
}
