/**
 * ตัวกรองขาออก — สิ่งที่ prompt ขอไว้แล้วยังต้องบังคับซ้ำอยู่ดี
 *
 * `WORK_PLAN_SYSTEM` เขียนว่า "ห้ามใส่อีโมจิในทุกช่อง" และ "ห้ามใช้ชื่อฟิลด์ภาษาอังกฤษ"
 * มาตั้งแต่ต้น แต่ **prompt คือคำขอ ไม่ใช่การบังคับ** แบบจำลองทำตามเกือบทุกครั้ง ซึ่งแปลว่า
 * ครั้งที่ไม่ทำตามจะหลุดถึงหน้าจอเพราะไม่มีใครดักไว้ กติกาของแพลตฟอร์มข้อ "ห้ามอีโมจิทุกที่"
 * จึงต้องมีที่บังคับจริงหนึ่งจุด ไม่ใช่หวังว่าคำขอจะได้ผลทุกครั้ง
 */

/**
 * ช่วงรหัสของอีโมจิและสัญลักษณ์ภาพ
 *
 * เขียนเป็นช่วงรหัสแทนการใช้ `\p{Emoji}` เพราะ `\p{Emoji}` ครอบเลข 0-9 และเครื่องหมาย #
 * ซึ่งอยู่ในทุกข้อความที่พูดถึงเลขข้อและเลขลำดับงาน การใช้มันจะตัดเนื้อหาจริงทิ้ง
 */
const EMOJI_PATTERN =
  /[\u{1F000}-\u{1FAFF}\u{1F004}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;

/** ตัดอีโมจิและช่องว่างซ้ำที่เหลือจากการตัดออก */
export function stripEmoji(value: string): string {
  return value.replace(EMOJI_PATTERN, "").replace(/[ \t]{2,}/g, " ").trim();
}

/**
 * ชื่อฟิลด์ภาษาอังกฤษที่หลุดมาในข้อความที่ผู้ใช้อ่าน
 *
 * จับด้วยรูปทรง camelCase (`startOffsetDays`, `weightPpm`) เพราะเป็นรูปทรงที่ภาษาไทยและ
 * ชื่อเฉพาะอย่าง ESTIMETR หรือ PRICEMETR ไม่มีทางสร้างขึ้นเองได้ ต่างจากการไล่รายชื่อฟิลด์
 * ทีละตัว ซึ่งจะล้าสมัยทันทีที่ schema เพิ่มช่องใหม่
 */
const FIELD_NAME_PATTERN = /\b[a-z]+(?:[A-Z][a-zA-Z0-9]*)+\b/g;

export function findFieldNames(value: string): string[] {
  return [...new Set(value.match(FIELD_NAME_PATTERN) ?? [])];
}

/** ทำความสะอาดทุกข้อความในโครงสร้างที่จะส่งขึ้นจอ โดยคงรูปทรงเดิมไว้ทั้งหมด */
export function cleanForDisplay<T>(value: T): T {
  if (typeof value === "string") return stripEmoji(value) as T;
  if (Array.isArray(value)) return value.map((item) => cleanForDisplay(item)) as T;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, cleanForDisplay(item)]);
    return Object.fromEntries(entries) as T;
  }
  return value;
}

/** ทุกข้อความในโครงสร้าง ใช้ตรวจกฎขาออกโดยไม่ต้องรู้รูปทรงของแต่ละทักษะ */
export function collectStrings(value: unknown, found: string[] = []): string[] {
  if (typeof value === "string") found.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, found);
  else if (value && typeof value === "object") for (const item of Object.values(value)) collectStrings(item, found);
  return found;
}
