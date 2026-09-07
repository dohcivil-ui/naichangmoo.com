/**
 * ชนิดของช่องทางติดต่อที่แพลตฟอร์มรู้จัก และกติกาตรวจค่าก่อนรับ (IP-106)
 *
 * ไฟล์นี้เป็นเนื้อหาให้แสดงกับกติกาตรวจ — ค่าจริงอยู่ในตาราง platform_channels ซึ่งผู้ดูแล
 * กรอกจากหลังบ้าน ช่องที่ยังไม่กรอกจะไม่ขึ้นหน้าเว็บเลย ตามคำวินิจฉัยเจ้าของงาน 2026-08-28:
 * ซ่อนจนกว่าจะกรอกจริง ไม่โชว์ค่าปลอมให้ลูกค้าเห็นแม้แต่วินาทีเดียว
 *
 * การตรวจโฮสต์ของลิงก์เข้มไว้ก่อน — ลิงก์ผิดตัวเดียวขึ้นทุกหน้าของเว็บพร้อมกัน
 */

export type ChannelKey = "phone" | "line_oa" | "facebook" | "email";

export type ChannelKind = {
  key: ChannelKey;
  /** ป้ายบนหน้าเว็บและหลังบ้าน */
  label: string;
  /** คำอธิบายช่องกรอกในหลังบ้าน พร้อมตัวอย่างค่า */
  hint: string;
  /** แปลงค่าที่เก็บเป็นลิงก์ที่กดได้ */
  toHref: (value: string) => string;
  /**
   * แปลงค่าที่เก็บเป็นรูปแบบที่อ่านบนจอ — ไม่ใส่ = แสดงค่าที่เก็บตรง ๆ
   *
   * มีเพราะเบอร์โทรเก็บเป็นตัวเลขล้วนเพื่อให้ตรวจและทำลิงก์ได้ แต่ตัวเลขสิบหลักติดกัน
   * อ่านยากและจำผิดง่าย · **ค่าที่เก็บกับค่าที่อ่านเป็นคนละรูปของสิ่งเดียวกัน ไม่ใช่สองค่า**
   * ถ้าเก็บรูปที่มีช่องไฟไว้เลย ผู้ดูแลจะต้องพิมพ์ช่องไฟให้ถูกเอง แล้ววันหนึ่งจะมีเบอร์
   * ที่เว้นวรรคไม่เหมือนเบอร์อื่น โดยไม่มีอะไรบอกว่าผิด
   */
  toDisplay?: (value: string) => string;
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

/**
 * เบอร์โทรเก็บเป็นตัวเลขล้วนขึ้นต้นด้วยศูนย์ตามที่คนไทยพิมพ์
 *
 * **ลิงก์ตัด 0 นำแล้วเติม +66** เบอร์ที่ขึ้นต้นด้วย 0 เป็นรูปในประเทศ เครื่องที่ตั้งรหัสประเทศอื่น
 * จะกดไม่ติด · ขีดคั่นก็เช่นกัน บางเครื่องอ่านเป็นการหยุด `tel:` จึงต้องเป็นตัวเลขกับ + เท่านั้น
 */
const phoneDigits = (value: string) => value.replace(/\D/g, "");

export const channelKinds: readonly ChannelKind[] = [
  {
    key: "phone",
    label: "โทรศัพท์",
    hint: "เบอร์ในประเทศขึ้นต้นด้วย 0 เช่น 0849891456 หรือ 084-989-1456 (ระบบจัดช่องไฟให้เอง)",
    toHref: (value) => `tel:+66${phoneDigits(value).slice(1)}`,
    /* ผืนออกแบบวางไว้เป็น `08 9127 6525` — สองสี่สี่ คั่นด้วยช่องว่าง
       ที่มา: `redesign/V3/Home Redesign v3.dc.html` บรรทัด 24 ช่อง `.hd` ขนาด 18px */
    toDisplay: (value) => {
      const digits = phoneDigits(value);
      if (digits.length !== 10) return digits;
      return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
    }
  },
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

  /**
   * **เบอร์เก็บเป็นตัวเลขล้วน ไม่ใช่ตามที่พิมพ์มา**
   *
   * ผู้ดูแลพิมพ์ `084-989-1456` หรือ `084 989 1456` หรือ `0849891456` ก็ได้ทั้งหมด
   * แล้วเก็บเป็นรูปเดียว · ถ้าเก็บตามที่พิมพ์ เบอร์เดียวกันจะมีได้หลายรูปในตารางเดียว
   * แล้ววันที่มีคนเทียบว่าเบอร์เปลี่ยนไหม จะเทียบไม่ได้เพราะข้อความไม่ตรงกันทั้งที่เบอร์เดิม
   *
   * รับเฉพาะสิบหลักขึ้นต้นด้วยศูนย์ ซึ่งเป็นรูปของเบอร์มือถือไทย · เบอร์บ้านเก้าหลักยังไม่รับ
   * เพราะยังไม่มีใครขอ และการรับไว้ก่อนแปลว่ารับเบอร์ที่พิมพ์ตกไปหนึ่งหลักด้วย
   */
  if (key === "phone") {
    const digits = value.replace(/\D/g, "");
    if (!/^0\d{9}$/.test(digits)) {
      return { ok: false, message: "ต้องเป็นเบอร์สิบหลักขึ้นต้นด้วย 0 เช่น 084-989-1456" };
    }
    return { ok: true, value: digits };
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
