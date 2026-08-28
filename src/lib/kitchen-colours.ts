/**
 * Color Token Reader (ตัวอ่านค่าสีจากแหล่งค่ากลาง) — IP-196
 * แหล่งค่ากลาง (Token Source / SSOT) ของสีคือ globals.css
 *
 * manifest กับ theme color ต้องประกาศสีเป็นเลขจริงต่อระบบปฏิบัติการ แต่ ADR 0021 ให้เลขสี
 * ประกาศได้ที่ globals.css ที่เดียว — ทางออกจึงไม่ใช่การเพิ่มบัญชียกเว้น (manifest ไม่เข้าข่าย
 * สามประเภทที่ ADR อนุญาต) แต่คือการ**อ่านค่าจาก globals.css ตอน build** ให้แหล่งอ้างอิงหลัก
 * เป็นที่เดียวจริง ๆ ต่อไป
 *
 * ฟังก์ชันบริสุทธิ์ รับเนื้อ CSS เป็น string — ผู้เรียก (src/app/manifest.ts, layout.tsx)
 * เป็นคนอ่านไฟล์เอง ไฟล์นี้จึงไม่แตะ filesystem และไม่มีเลขสีดิบสักตัว
 */

/** ดึงค่าสีของ token หนึ่งตัว เช่น extractKitchenColour(css, "ink") → ค่า hex ของ --ink
 *  ไม่เจอให้ throw — build ต้องแดงทันทีถ้าใครเปลี่ยนชื่อ token ไม่ใช่ได้สีผิดเงียบ ๆ */
export function extractKitchenColour(css: string, token: string): string {
  // ต้อง match ชื่อเต็มถึงเครื่องหมาย ':' พอดี — กัน "ink" ไปคว้า "ink-deep"/"ink-body"
  const match = css.match(new RegExp(`--${token}\\s*:\\s*(#[0-9a-fA-F]{3,8})\\b`));
  if (!match) throw new Error(`ไม่พบ token --${token} ในแหล่งอ้างอิงหลักของสี (globals.css)`);
  return match[1];
}
