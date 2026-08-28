import { describe, expect, it } from "vitest";
import {
  HERO_DEMO_BADGE_FROM,
  HERO_DEMO_BADGE_TO,
  HERO_DEMO_CYCLE_MS,
  heroDemoBeatAt,
  heroDemoElapsedInCycle,
  heroDemoFinalBeat,
  heroDemoPhaseClasses
} from "./hero-demo-script";

describe("จังหวะเวลาของฉากสาธิตสด (IP-197)", () => {
  it("ขอบเฟสทุกจุดตรงตามบท", () => {
    expect(heroDemoBeatAt(0).phase).toBe(0);
    expect(heroDemoBeatAt(399).phase).toBe(0);
    expect(heroDemoBeatAt(400).phase).toBe(1);
    expect(heroDemoBeatAt(4199).phase).toBe(1);
    expect(heroDemoBeatAt(4200).phase).toBe(2);
    expect(heroDemoBeatAt(7099).phase).toBe(2);
    expect(heroDemoBeatAt(7100).phase).toBe(3);
    expect(heroDemoBeatAt(9399).phase).toBe(3);
    expect(heroDemoBeatAt(9400).phase).toBe(4);
    expect(heroDemoBeatAt(15499).phase).toBe(4);
  });

  it("นิ้วกดค้างเฉพาะช่วง [6500, 7100)", () => {
    expect(heroDemoBeatAt(6499).clicking).toBe(false);
    expect(heroDemoBeatAt(6500).clicking).toBe(true);
    expect(heroDemoBeatAt(7099).clicking).toBe(true);
    expect(heroDemoBeatAt(7100).clicking).toBe(false);
  });

  it("ป้ายรายช่อง: 67 ก่อนรับ นับลงถึง 28 เป็นจำนวนเต็ม ไม่มีเด้งขึ้น", () => {
    expect(heroDemoBeatAt(7099).badgePercent).toBe(HERO_DEMO_BADGE_FROM);
    expect(heroDemoBeatAt(8000).badgePercent).toBe(HERO_DEMO_BADGE_TO);
    expect(heroDemoBeatAt(15499).badgePercent).toBe(HERO_DEMO_BADGE_TO);
    let previous = HERO_DEMO_BADGE_FROM;
    for (let t = 7100; t <= 8100; t += 50) {
      const value = heroDemoBeatAt(t).badgePercent;
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(HERO_DEMO_BADGE_TO);
      expect(value).toBeLessThanOrEqual(previous);
      previous = value;
    }
  });

  it("การวนรอบ: ครบรอบกลับไปต้นรอบ และค่าพิการถือเป็นต้นรอบ", () => {
    expect(heroDemoElapsedInCycle(HERO_DEMO_CYCLE_MS)).toBe(0);
    expect(heroDemoElapsedInCycle(HERO_DEMO_CYCLE_MS + 250)).toBe(250);
    expect(heroDemoElapsedInCycle(-5)).toBe(0);
    expect(heroDemoElapsedInCycle(Number.NaN)).toBe(0);
  });

  it("เฟรมสุดท้ายสำหรับ reduced-motion คือปลายรอบจริง และไม่มีผู้ช่วยค้างจอ", () => {
    const final = heroDemoFinalBeat();
    expect(final).toEqual(heroDemoBeatAt(HERO_DEMO_CYCLE_MS - 1));
    expect(heroDemoPhaseClasses(final)).toEqual(["is-phase1", "is-phase3", "is-phase4"]);
  });

  it("คลาสเป็นแบบสะสม และจังหวะผู้ช่วยยังคงเห็นแผนงาน (ไม่กะพริบ)", () => {
    expect(heroDemoPhaseClasses(heroDemoBeatAt(5000))).toEqual(["is-phase1", "is-phase2"]);
    expect(heroDemoPhaseClasses(heroDemoBeatAt(6600))).toEqual(["is-phase1", "is-phase2", "is-clicking"]);
    expect(heroDemoPhaseClasses(heroDemoBeatAt(8000))).toEqual(["is-phase1", "is-phase3"]);
  });
});
