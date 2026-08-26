import type { SVGProps } from "react";

/**
 * สัญลักษณ์ประจำหมวดวัสดุก่อสร้างของ สนค. ยี่สิบเอ็ดหมวด
 *
 * วาดเป็นเส้นทั้งหมดและรับสีจากบริบทผ่าน `currentColor` ตามกฎของแพลตฟอร์มที่ว่าไอคอนใน UI
 * ต้องเป็น SVG ไม่ใช่ภาพ เพราะการ์ดหมวดแต่ละใบใช้สีประจำหมวดของตัวเอง ถ้าเป็น PNG สีจะตายตัว
 * และต้องทำใหม่ยี่สิบเอ็ดไฟล์ทุกครั้งที่ธีมขยับ
 *
 * ทุกตัวเขียนบนตาราง 48x48 อยู่ในกรอบ 5..43 เป็นเส้นล้วนไม่มีพื้น และมีไม่เกินหกชิ้น
 * เพื่อให้ย่อเหลือ 20px แล้วยังอ่านออก รูปทรงเป็นสัญลักษณ์แบบแบบก่อสร้าง ไม่ใช่ภาพการ์ตูน
 *
 * บรรทัด Subject ที่ใช้สั่งวาดใหม่แต่ละตัวอยู่ใน docs/design-system/icon-prompts.md
 */

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function BaseIcon({ title, children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** 01 วัสดุเทหล่อกับที่ — แบบหล่อที่กำลังเทคอนกรีตลงไป */
export function CastInPlaceIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M11 21h26v17a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3z" />
      <path d="M11 29h26" />
      <path d="M19 7h10l-3 10h-4z" />
    </BaseIcon>
  );
}

/** 02 วัสดุก่อ — อิฐบล็อกเรียงสลับแนว */
export function MasonryIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="7" y="13" width="14" height="9" rx="1.5" />
      <rect x="25" y="13" width="16" height="9" rx="1.5" />
      <rect x="7" y="26" width="16" height="9" rx="1.5" />
      <rect x="27" y="26" width="14" height="9" rx="1.5" />
    </BaseIcon>
  );
}

/** 03 ชิ้นส่วนโครงสร้างสำเร็จรูป — แผ่นพื้นสำเร็จวางซ้อนพร้อมหูยก */
export function PrecastIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="8" y="15" width="32" height="7" rx="2" />
      <rect x="8" y="25" width="32" height="7" rx="2" />
      <rect x="8" y="35" width="32" height="6" rx="2" />
      <path d="M18 15v-5M30 15v-5" />
    </BaseIcon>
  );
}

/** 04 วัสดุชิ้นส่วนหน้าตัดรูปต่างๆ — หน้าตัดเหล็กรูปพรรณคู่กับเหล็กข้ออ้อย */
export function SectionIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M11 9h7v12h8V9h7v30h-7V27h-8v12h-7z" />
      <path d="M39 11v26" />
      <path d="M36 16h6M36 24h6M36 32h6" />
    </BaseIcon>
  );
}

/** 05 วัสดุท่อ — ท่อกลมเห็นปลายตัด */
export function PipeIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <ellipse cx="14" cy="24" rx="5" ry="11" />
      <path d="M14 13h20M14 35h20" />
      <path d="M34 13a5 11 0 0 1 0 22" />
    </BaseIcon>
  );
}

/** 06 วัสดุลวดตาข่าย — ตะแกรงลวดสี่เหลี่ยม */
export function MeshIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="9" y="9" width="30" height="30" rx="2" />
      <path d="M19 9v30M29 9v30M9 19h30M9 29h30" />
    </BaseIcon>
  );
}

/** 07 วัสดุฉนวน — แผ่นฉนวนที่มีชั้นคลื่นอยู่ข้างใน */
export function InsulationIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M11 13h26v22H11z" />
      <path d="M11 24c4.5-6 9 6 13 0s8.5-6 13 0" />
      <path d="M11 18c4.5-6 9 6 13 0s8.5-6 13 0" />
    </BaseIcon>
  );
}

/** 08 วัสดุแผ่นซ้อนทับ — แผ่นมุงหลังคาซ้อนเกยกัน */
export function SheetIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M7 30 17 15h12L19 30z" />
      <path d="M19 30 29 15h12L31 30z" />
      <path d="M7 37h34" />
    </BaseIcon>
  );
}

/** 09 วัสดุแผ่นแข็ง — แผ่นเรียบที่เห็นความหนา */
export function BoardIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M9 17h25v20H9z" />
      <path d="M9 17l5-6h25l-5 6" />
      <path d="M34 37l5-6V11" />
    </BaseIcon>
  );
}

/** 10 วัสดุตกแต่งผิว — กระเบื้องปูผิวและแผ่นวางทแยง */
export function FinishIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="9" y="26" width="13" height="13" rx="1.5" />
      <rect x="26" y="26" width="13" height="13" rx="1.5" />
      <rect x="9" y="10" width="13" height="13" rx="1.5" />
      <path d="m26 17 6.5-7 6.5 7-6.5 7z" />
    </BaseIcon>
  );
}

/** 11 วัสดุไม้ — ไม้แผ่นที่เห็นลายเสี้ยน */
export function TimberIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="8" y="14" width="32" height="20" rx="2.5" />
      <path d="M14 20c6 2.5 14 2.5 20 0M14 28c6-2.5 14-2.5 20 0" />
    </BaseIcon>
  );
}

/** 12 วัสดุฉาบผิว — ลูกกลิ้งทาสีพร้อมด้าม */
export function CoatingIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="9" y="9" width="23" height="9" rx="2.5" />
      <path d="M32 13.5h5v8H24v6" />
      <rect x="20" y="27" width="8" height="13" rx="2.5" />
    </BaseIcon>
  );
}

/** 13 วัสดุขัดผิว — กระดาษทรายที่เห็นเม็ดขัด */
export function AbrasiveIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M11 9h26v30H11z" />
      <path d="M18 17h.01M25 14h.01M32 19h.01M19 25h.01M27 26h.01M22 33h.01M32 32h.01" />
    </BaseIcon>
  );
}

/** 14 วัสดุชิ้นส่วนสำเร็จรูป — บานประตูสำเร็จรูป */
export function DoorIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="12" y="7" width="24" height="34" rx="2.5" />
      <path d="M17 13h14v13H17z" />
      <path d="M30 33h.01" />
    </BaseIcon>
  );
}

/** 15 วัสดุผลิตภัณฑ์ — ถุงปูนซีเมนต์ */
export function BagIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M13 16h22l2 22a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3z" />
      <path d="M17 16V8h14v8" />
      <path d="M18 28h12" />
    </BaseIcon>
  );
}

/** 16 วัสดุผสมคอนกรีต — กองหินทรายผสมคอนกรีต */
export function AggregateIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M8 39h32" />
      <path d="M10 39 24 14l14 25z" />
      <path d="M24 30h.01M18 35h.01M30 35h.01" />
    </BaseIcon>
  );
}

/** 17 วัสดุถม/รองพื้น — ชั้นดินถมบดอัดเป็นชั้น */
export function FillIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="8" y="12" width="32" height="28" rx="2.5" />
      <path d="M8 21h32M8 30h32" />
      <path d="M14 35h.01M22 35h.01M30 35h.01" />
    </BaseIcon>
  );
}

/** 18 วัสดุและอุปกรณ์งานประปา — วาล์วน้ำพร้อมพวงมาลัย */
export function PlumbingIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="24" cy="24" r="8" />
      <path d="M24 9v7M24 32v7M9 24h7M32 24h7" />
    </BaseIcon>
  );
}

/** 19 วัสดุและอุปกรณ์งานสุขาภิบาล — ท่อดักกลิ่นรูปตัวพี */
export function SanitationIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M13 9v17a8 8 0 0 0 16 0v-3a6 6 0 0 1 12 0v16" />
      <path d="M8 9h10" />
    </BaseIcon>
  );
}

/** 20 วัสดุและอุปกรณ์งานไฟฟ้า — เต้ารับพร้อมสายเดินท่อ */
export function ElectricIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="9" y="11" width="21" height="25" rx="4" />
      <path d="M17 20v7M23 20v7" />
      <path d="M30 23h4a5 5 0 0 1 5 5v11" />
    </BaseIcon>
  );
}

/** 21 เครื่องสุขภัณฑ์ — อ่างล้างหน้าพร้อมก๊อก */
export function SanitarywareIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M9 22h30l-3 12a6 6 0 0 1-6 5H18a6 6 0 0 1-6-5z" />
      <path d="M24 22v-7a5 5 0 0 1 10 0v3" />
      <path d="M22 29h4" />
    </BaseIcon>
  );
}

const BY_CATEGORY: Record<string, (props: IconProps) => React.ReactElement> = {
  "01": CastInPlaceIcon,
  "02": MasonryIcon,
  "03": PrecastIcon,
  "04": SectionIcon,
  "05": PipeIcon,
  "06": MeshIcon,
  "07": InsulationIcon,
  "08": SheetIcon,
  "09": BoardIcon,
  "10": FinishIcon,
  "11": TimberIcon,
  "12": CoatingIcon,
  "13": AbrasiveIcon,
  "14": DoorIcon,
  "15": BagIcon,
  "16": AggregateIcon,
  "17": FillIcon,
  "18": PlumbingIcon,
  "19": SanitationIcon,
  "20": ElectricIcon,
  "21": SanitarywareIcon
};

/**
 * หมวดที่ยังไม่มีสัญลักษณ์ของตัวเองได้กรอบเปล่า ไม่ใช่รูปมั่ว ๆ
 *
 * กรอบเปล่าบอกตรง ๆ ว่ายังไม่ได้วาด ส่วนรูปที่หยิบของหมวดอื่นมาใส่แทนจะกลายเป็นคำโกหกเงียบ ๆ
 * ที่คนใช้เชื่อไปแล้วว่าหมายถึงหมวดนี้
 */
export function MaterialCategoryIcon({ cat, ...props }: IconProps & { cat: string }) {
  const Icon = BY_CATEGORY[cat];
  if (!Icon) return <BaseIcon {...props} />;
  return <Icon {...props} />;
}
