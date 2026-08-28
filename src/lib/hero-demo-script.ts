/**
 * บทเดินเรื่องของฉากสาธิตสดใน hero (IP-197) — จังหวะเวลาเป็นฟังก์ชันบริสุทธิ์
 *
 * ฉากวนสี่จังหวะ: แผนงานพิมพ์ตัวเอง → ผู้ช่วยทัก → คนกดรับ เส้นเกลี่ยใหม่ → ถาม-ตอบที่มา
 * ตัวเลขทุกตัวในฉากตรวจย้อนได้กับ docs/research/s-curve-rules-2026-08-25.md:
 * งานผิวทาง 52% กินเวลา 4 ช่องเวลา → เกลี่ยเท่ากันได้ช่องละ 13% (กฎที่ 2)
 * รายช่องของช่องเวลาที่ 3 ก่อนแก้ = 8+7+52 = 67 · หลังแก้ = 8+7+13 = 28
 *
 * ไฟล์นี้อยู่ใน src/lib จึงห้ามรู้จัก React/DOM/ฐานข้อมูล (architecture-fence คุม) —
 * คอมโพเนนต์เป็นผู้ถือนาฬิกา แล้วถามไฟล์นี้ว่า ณ มิลลิวินาทีที่เท่าไรฉากอยู่จังหวะไหน
 */

/** ความยาวหนึ่งรอบของลูป (ms) — ตาม mockup ที่เจ้าของงานเคาะ 2026-08-28 */
export const HERO_DEMO_CYCLE_MS = 15500;

/** เวลาไหลของแต่ละหมุด นับจากต้นรอบ (ms) */
export const HERO_DEMO_TIMES = {
  /** จังหวะ 1: แถวงานพิมพ์ตัวเอง + เส้นสะสมของแผนผิดเริ่มวาด */
  rowsIn: 400,
  /** จังหวะ 2: ผู้ช่วยทัก + เคอร์เซอร์จำลองโผล่ */
  assistIn: 4200,
  /** เคอร์เซอร์เริ่มเลื่อนไปหาปุ่มรับข้อเสนอ (คอมโพเนนต์ใช้วัดตำแหน่งปุ่มสด) */
  cursorToButton: 5200,
  /** นิ้วกดลง (วงกดกระเพื่อม) */
  clickDown: 6500,
  /** จังหวะ 3: รับข้อเสนอ — ผู้ช่วยจางออก เส้นถูกวาด ป้ายเริ่มนับลง */
  accept: 7100,
  /** ระยะเวลานับของป้ายเปอร์เซ็นต์ */
  badgeCountMs: 900,
  /** จังหวะ 4: ถาม-ตอบที่มา + ตราตรวจย้อนได้ */
  qaIn: 9400
} as const;

/** รายช่องเวลาที่ 3 ของแผนก่อนแก้: ดินถม 8 + ท่อ 7 + ผิวทางทั้งก้อน 52 */
export const HERO_DEMO_BADGE_FROM = 67;
/** รายช่องเวลาที่ 3 หลังเกลี่ยผิวทางเป็นช่องละ 13: 8 + 7 + 13 */
export const HERO_DEMO_BADGE_TO = 28;

export type HeroDemoPhase = 0 | 1 | 2 | 3 | 4;

export type HeroDemoBeat = {
  phase: HeroDemoPhase;
  /** จริงเฉพาะช่วงนิ้วกดค้าง [clickDown, accept) */
  clicking: boolean;
  /** ตัวเลขบนป้ายรายช่อง: 67 ก่อนรับ → นับลงถึง 28 (จำนวนเต็มเสมอ) */
  badgePercent: number;
};

/** เวลารวมที่เดินมาแล้ว → ตำแหน่งในรอบปัจจุบัน ค่าพิการ (ติดลบ/NaN) ถือเป็นต้นรอบ */
export function heroDemoElapsedInCycle(totalElapsedMs: number): number {
  if (!Number.isFinite(totalElapsedMs) || totalElapsedMs < 0) return 0;
  return totalElapsedMs % HERO_DEMO_CYCLE_MS;
}

export function heroDemoBeatAt(elapsedInCycleMs: number): HeroDemoBeat {
  const t = heroDemoElapsedInCycle(elapsedInCycleMs);
  const { rowsIn, assistIn, clickDown, accept, badgeCountMs, qaIn } = HERO_DEMO_TIMES;

  const phase: HeroDemoPhase = t < rowsIn ? 0 : t < assistIn ? 1 : t < accept ? 2 : t < qaIn ? 3 : 4;
  const clicking = t >= clickDown && t < accept;

  let badgePercent = HERO_DEMO_BADGE_FROM;
  if (t >= accept) {
    // นับลงแบบ easeOutCubic ให้ช่วงแรกไหลเร็วแล้วเข้าเป้านิ่ง — จบที่ 28 เสมอ
    const k = Math.min(1, (t - accept) / badgeCountMs);
    const eased = 1 - Math.pow(1 - k, 3);
    badgePercent = Math.round(HERO_DEMO_BADGE_FROM + (HERO_DEMO_BADGE_TO - HERO_DEMO_BADGE_FROM) * eased);
  }

  return { phase, clicking, badgePercent };
}

/**
 * เฟรมสุดท้ายของรอบ — ภาพนิ่งที่ผู้ปิดการเคลื่อนไหว (prefers-reduced-motion) และบอทเห็น:
 * ถาม-ตอบที่มา + เส้นที่เกลี่ยแล้ว + ตราตรวจย้อนได้ เพราะนี่คือข้อความหลักของแบรนด์
 */
export function heroDemoFinalBeat(): HeroDemoBeat {
  return heroDemoBeatAt(HERO_DEMO_CYCLE_MS - 1);
}

/**
 * แปลงจังหวะเป็นชุดคลาสสะสมของกรอบสาธิต — จังหวะหลังทับจังหวะก่อน ยกเว้นผู้ช่วย (phase2)
 * ที่จางออกเมื่อคนกดรับแล้ว ตามฉากของ mockup
 */
export function heroDemoPhaseClasses(beat: HeroDemoBeat): string[] {
  const classes: string[] = [];
  if (beat.phase >= 1) classes.push("is-phase1");
  if (beat.phase === 2) classes.push("is-phase2");
  if (beat.phase >= 3) classes.push("is-phase3");
  if (beat.phase >= 4) classes.push("is-phase4");
  if (beat.clicking) classes.push("is-clicking");
  return classes;
}
