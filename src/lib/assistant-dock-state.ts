/**
 * สถานะย่อ/กางของ Assistant Dock (แผงผู้ช่วยกลาง) — IP-185
 *
 * จำค่าเดียวทั้งแพลตฟอร์ม (Global preference) ตามคำวินิจฉัยเจ้าของงาน 2026-08-28:
 * คนที่ชอบย่อก็ชอบย่อทุกแอป · ค่าเริ่มต้นคือ "กาง" (Default State: Expanded — คำชี้ขาด
 * 2026-08-28) เพื่อให้คนเปิดครั้งแรกเห็นทันทีว่าระบบมีผู้ช่วยอะไรให้ใช้ แล้วค่อยย่อเอง
 *
 * ฟังก์ชันบริสุทธิ์ทั้งไฟล์ ไม่แตะ localStorage เอง — ผู้เรียก (assistant-dock.tsx) เป็นคน
 * อ่าน/เขียนพร้อม try/catch เพราะหน้าต่างส่วนตัวโยน error จริง (บทเรียนเดียวกับ
 * cookie-disclosure.ts และ work-plan-storage.ts)
 */

export const ASSISTANT_DOCK_STORAGE_KEY = "naichangmoo.assistant-dock.v1";

export type AssistantDockState = "open" | "collapsed";

/** ค่าที่อ่านมาจากที่เก็บ → สถานะที่ใช้ได้เสมอ ค่าขยะ/หาย/อ่านไม่ได้ = ค่าเริ่มต้น "กาง" */
export function parseDockState(stored: string | null | undefined): AssistantDockState {
  return stored === "collapsed" ? "collapsed" : "open";
}

export function toggleDockState(current: AssistantDockState): AssistantDockState {
  return current === "open" ? "collapsed" : "open";
}
