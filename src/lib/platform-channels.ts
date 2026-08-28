/**
 * ชนิดของช่องทางติดต่อที่แพลตฟอร์มรู้จัก และกติกาตรวจค่าก่อนรับ (IP-106)
 *
 * ไฟล์นี้เป็นเนื้อหาให้แสดงกับกติกาตรวจ — ค่าจริงอยู่ในตาราง platform_channels ซึ่งผู้ดูแล
 * กรอกจากหลังบ้าน ช่องที่ยังไม่กรอกจะไม่ขึ้นหน้าเว็บเลย ตามคำวินิจฉัยเจ้าของงาน 2026-08-28:
 * ซ่อนจนกว่าจะกรอกจริง ไม่โชว์ค่าปลอมให้ลูกค้าเห็นแม้แต่วินาทีเดียว
 *
 * การตรวจโฮสต์ของลิงก์เข้มไว้ก่อน — ลิงก์ผิดตัวเดียวขึ้นทุกหน้าของเว็บพร้อมกัน
 */

export type ChannelKey = "line_oa" | "facebook" | "email";

export type ChannelKind = {
  key: ChannelKey;
  /** ป้ายบนหน้าเว็บและหลังบ้าน */
  label: string;
  /** คำอธิบายช่องกรอกในหลังบ้าน พร้อมตัวอย่างค่า */
  hint: string;
  /** แปลงค่าที่เก็บเป็นลิงก์ที่กดได้ */
  toHref: (value: string) => string;
};

const LINE_HOSTS = new Set(["line.me", "lin.ee", "page.line.me"]);
const FACEBOOK_HOSTS = new Set(["facebook.com", "www.facebook.com", "web.facebook.com", "fb.com", "m.facebook.com"]);

function hostOf(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export const channelKinds: readonly ChannelKind[] = [
  {
    key: "line_oa",
    label: "LINE Official Account",
    hint: "ลิงก์เพิ่มเพื่อนของบัญชี เช่น https://lin.ee/xxxxxxx หรือ https://page.line.me/xxxxx",
    toHref: (value) => value
  },
  {
    key: "facebook",
    label: "เพจ Facebook",
    hint: "ลิงก์เพจ เช่น https://www.facebook.com/naichangmoo",
    toHref: (value) => value
  },
  {
    key: "email",
    label: "อีเมล",
    hint: "อีเมลสำหรับลูกค้าโดยเฉพาะ เช่น contact@naichangmoo.com",
    toHref: (value) => `mailto:${value}`
  }
] as const;

export function isChannelKey(value: string): value is ChannelKey {
  return channelKinds.some((kind) => kind.key === value);
}

export type ChannelValidation = { ok: true; value: string } | { ok: false; message: string };

/** ค่าว่างไม่เข้าฟังก์ชันนี้ — การล้างค่าเป็นการกระทำแยกต่างหากที่ฝั่ง server จัดการ */
export function validateChannelValue(key: ChannelKey, raw: string): ChannelValidation {
  const value = raw.trim();
  if (value === "") return { ok: false, message: "ค่าว่างใช้ปุ่มล้างค่าแทน" };

  if (key === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      return { ok: false, message: "รูปแบบอีเมลไม่ถูกต้อง เช่น contact@naichangmoo.com" };
    }
    return { ok: true, value };
  }

  const host = hostOf(value);
  if (!host) return { ok: false, message: "ต้องเป็นลิงก์ https เต็มรูปแบบ" };

  if (key === "line_oa") {
    const known = LINE_HOSTS.has(host) || host.endsWith(".line.me");
    if (!known) return { ok: false, message: "ลิงก์ LINE ต้องอยู่บนโดเมน line.me หรือ lin.ee" };
    return { ok: true, value };
  }

  const known = FACEBOOK_HOSTS.has(host);
  if (!known) return { ok: false, message: "ลิงก์เพจต้องอยู่บนโดเมน facebook.com" };
  return { ok: true, value };
}
