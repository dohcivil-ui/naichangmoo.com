/**
 * บล็อกข้อเท็จจริงที่คั่นด้วยหัวและท้ายคงที่
 *
 * นี่คือ **ทางเดียวที่ตัวเลขเงินเข้า prompt ได้** และเป็นเหตุผลว่าทำไมกฎ "อย่าให้ AI คิดเงิน"
 * ที่นี่จึงเป็นโครงสร้าง ไม่ใช่วินัย
 *
 * เพราะหัวและท้ายคงที่ เทสต์กฎ G3 จึงตัดบล็อกนี้ออกจากโจทย์ที่ประกอบเสร็จแล้ว แล้วยืนยันว่า
 * ส่วนที่เหลือไม่มีจำนวนเงินหลงเหลืออยู่เลย ถ้าวันหนึ่งมีใครเผลอเอาตัวเลขบาทไปแปะไว้ในโจทย์
 * ตรง ๆ เทสต์จะตกทันที ต่างจากการเขียนคำเตือนไว้ใน prompt ซึ่งไม่มีอะไรมาตรวจให้
 *
 * ทุกทักษะในทะเบียนต้องประกอบโจทย์ผ่านฟังก์ชันนี้ ไม่มีข้อยกเว้น
 */

export const FACTS_HEADING = "ข้อมูลที่ระบบคำนวณแล้ว (ใช้อ้างได้ ห้ามคิดใหม่เอง)";
export const FACTS_END = "จบข้อมูลที่ระบบคำนวณแล้ว";

export function factsBlock(facts: readonly string[]): string {
  if (facts.length === 0) return `${FACTS_HEADING}\n- ไม่มี\n${FACTS_END}`;
  return [FACTS_HEADING, ...facts.map((fact) => `- ${fact}`), FACTS_END].join("\n");
}

/** ตัดบล็อกข้อเท็จจริงออกจากโจทย์ ใช้โดยเทสต์กฎ G3 และโดยตัวตรวจก่อนส่งจริง */
export function stripFactsBlock(task: string): string {
  const pattern = new RegExp(`${escapeRegExp(FACTS_HEADING)}[\\s\\S]*?${escapeRegExp(FACTS_END)}`, "g");
  return task.replace(pattern, "");
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
