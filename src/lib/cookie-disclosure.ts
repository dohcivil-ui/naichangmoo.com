/**
 * What this site stores in a visitor's browser, and what it deliberately does not.
 *
 * Every row below was read off a real response or the real database, not from better-auth's
 * documentation and not from an earlier handoff's summary. A disclosure page that is wrong is worse
 * than no page, because it is a confident wrong answer rather than an absent one.
 *
 * The table is data rather than JSX so the page renders it and the tests can hold it, and so the
 * day a cookie is added there is one place that has to change.
 */

export type StoredItemKind = "cookie" | "local_storage";

export type StoredItem = {
  id: string;
  /** The name as it appears in the browser. */
  name: string;
  kind: StoredItemKind;
  /** When it appears, in the visitor's terms rather than ours. */
  setWhen: string;
  lifetime: string;
  purpose: string;
  /** Flags a visitor can verify in their own browser's inspector. */
  attributes: string;
};

export const storedItems: StoredItem[] = [
  {
    id: "auth-state",
    name: "better-auth.state",
    kind: "cookie",
    setWhen: "เมื่อกดเข้าสู่ระบบ และเริ่มขั้นตอนยืนยันตัวตนกับผู้ให้บริการ",
    // Observed: `Max-Age=300` on the response that begins a social sign-in.
    lifetime: "5 นาที",
    purpose: "ป้องกันการปลอมคำขอข้ามเว็บไซต์ (CSRF) ระหว่างที่ยังไม่กลับมาจากผู้ให้บริการ หมดอายุเองแม้ล็อกอินไม่สำเร็จ",
    attributes: "HttpOnly · SameSite=Lax · Path=/"
  },
  {
    id: "session-token",
    name: "better-auth.session_token",
    kind: "cookie",
    setWhen: "หลังเข้าสู่ระบบสำเร็จ",
    // Verified against the real `sessions` table: expires_at - created_at is 7 days.
    lifetime: "7 วัน",
    purpose: "ทำให้ยังอยู่ในระบบเมื่อเปลี่ยนหน้า ถ้าไม่มีตัวนี้ต้องล็อกอินใหม่ทุกครั้งที่กด",
    attributes: "HttpOnly · SameSite=Lax · Path=/"
  },
  {
    id: "cookie-notice",
    name: "naichangmoo.cookie-notice.v1",
    kind: "local_storage",
    setWhen: "เมื่อกดรับทราบที่แถบแจ้งเรื่องคุกกี้",
    lifetime: "จนกว่าจะล้างข้อมูลเว็บไซต์ในเบราว์เซอร์",
    purpose: "จำว่าปิดแถบนั้นไปแล้ว จะได้ไม่ต้องเห็นซ้ำทุกครั้ง เก็บแค่วันเวลาที่กด ไม่มีข้อมูลที่ระบุตัวบุคคล",
    attributes: "เก็บในเครื่องของผู้ใช้ ไม่เคยถูกส่งมาที่เซิร์ฟเวอร์"
  }
];

/**
 * Names a reader may notice in their browser and wonder about — better-auth clears them on sign-out
 * whether or not it ever set them. Listing why they are absent is cheaper than being asked.
 */
export const notSetByThisSite = [
  {
    name: "better-auth.session_data",
    why: "เป็นแคชข้อมูล session ฝั่งเบราว์เซอร์ ซึ่งเปิดใช้เมื่อตั้งค่า cookieCache เท่านั้น เว็บนี้ไม่ได้ตั้ง"
  },
  {
    name: "better-auth.dont_remember",
    why: "ตั้งเมื่อผู้ใช้เลือกไม่ให้จำการเข้าสู่ระบบ เว็บนี้ไม่มีตัวเลือกนั้น จึงไม่เคยถูกตั้ง"
  }
];

/** What the site does not do. Each line was checked, not assumed. */
export const doesNotDo = [
  "ไม่มีคุกกี้เพื่อการวิเคราะห์ การโฆษณา หรือการติดตามพฤติกรรม",
  "ไม่มี Google Analytics, Tag Manager, Facebook Pixel หรือสคริปต์ของบุคคลที่สามใด ๆ",
  "เปิดดูหน้าเว็บเฉย ๆ โดยไม่เข้าสู่ระบบ จะไม่มีคุกกี้ถูกตั้งเลยแม้แต่ตัวเดียว",
  "รูปโปรไฟล์จากผู้ให้บริการถูกดึงผ่านเซิร์ฟเวอร์ของเรา เบราว์เซอร์ของคุณจึงไม่ติดต่อผู้ให้บริการนั้นโดยตรง",
  "ฟอนต์ถูกดาวน์โหลดตั้งแต่ตอนสร้างเว็บและเสิร์ฟจากเซิร์ฟเวอร์ของเรา ไม่มีการเรียกไปยังผู้ให้บริการฟอนต์"
];

/**
 * On HTTPS better-auth prefixes its cookie names. Worth stating, because a visitor checking their
 * own browser on the live site will see a name that does not match this table otherwise.
 */
export const secureCookiePrefixNote =
  "เมื่อใช้งานผ่าน HTTPS ชื่อคุกกี้ทั้งสองจะมีคำนำหน้า __Secure- ซึ่งเป็นกลไกของเบราว์เซอร์ที่บังคับว่าคุกกี้นั้นส่งได้เฉพาะบนการเชื่อมต่อที่เข้ารหัส";

export const COOKIE_NOTICE_STORAGE_KEY = "naichangmoo.cookie-notice.v1";

/**
 * The result of trying to read the acknowledgement. `readable: false` is a real case, not an edge
 * one: localStorage throws in private windows and wherever site data is blocked.
 */
export type StoredAcknowledgement = { readable: true; value: string | null } | { readable: false };

/**
 * Fails toward showing. Telling someone twice is a small annoyance; never telling them is the thing
 * the notice exists to prevent.
 */
export function shouldShowNotice(stored: StoredAcknowledgement): boolean {
  if (!stored.readable) return true;
  return !stored.value;
}
