/**
 * ลำดับของแอปบนแถบเลื่อนหน้าแรก — เรียงจากที่พร้อมใช้ที่สุดลงมา
 *
 * เจ้าของงานอยากให้แถบนี้ไล่ลำดับ "เอาที่ใกล้เสร็จก่อน แล้วค่อย ๆ ลดระดับ" ซึ่งวิธีที่ตรงที่สุด
 * คือแสดงเปอร์เซ็นต์ความคืบหน้า แต่ ADR 0015 ปฏิเสธเปอร์เซ็นต์ความคืบหน้าไว้เอง ด้วยเหตุผลว่า
 * มันพิสูจน์ไม่ได้และค้างที่ 90 เสมอ · เจ้าของงานเลือก (2026-08-30) ให้ใช้คำแทนตัวเลข
 *
 * ลำดับจึงคิดจาก **สิ่งที่ทะเบียนแอปพูดไว้แล้วเท่านั้น** ไม่ได้เพิ่มคำแถลงใหม่
 *
 *   0  ประกาศแล้วและเปิดใช้แล้ว   — ทะเบียนบอกว่าเข้าใช้ได้จริง
 *   1  ประกาศแล้วแต่ยังเตรียมอยู่  — ทะเบียนบอกว่ากำลังพัฒนา
 *   2  ยังไม่ประกาศ               — ทะเบียนยังไม่พูดอะไรเลย จึงอยู่ท้ายแถว และการ์ดจะเงียบ
 *
 * ภายในระดับเดียวกันลำดับเดิมของทะเบียนถูกรักษาไว้ (เรียงแบบเสถียร) เพราะการสลับที่กันเอง
 * ของแอปที่พร้อมเท่ากันไม่ได้บอกอะไรผู้อ่าน และทำให้หน้าเว็บดูไม่นิ่งโดยไม่มีเหตุผล
 */

export type ShowcaseReadiness = { announced: boolean; open: boolean };

export const SHOWCASE_RANK = { open: 0, preparing: 1, unannounced: 2 } as const;

export function readinessRank(claim: ShowcaseReadiness | undefined): number {
  if (!claim?.announced) return SHOWCASE_RANK.unannounced;
  return claim.open ? SHOWCASE_RANK.open : SHOWCASE_RANK.preparing;
}

/** เรียงแบบเสถียร ไม่แก้ไขอาร์เรย์ที่รับเข้ามา */
export function orderByReadiness<T>(apps: readonly T[], claimOf: (app: T) => ShowcaseReadiness | undefined): T[] {
  return apps
    .map((app, index) => ({ app, index, rank: readinessRank(claimOf(app)) }))
    .sort((a, b) => (a.rank === b.rank ? a.index - b.index : a.rank - b.rank))
    .map((entry) => entry.app);
}
