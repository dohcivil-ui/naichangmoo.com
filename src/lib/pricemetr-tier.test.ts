import { describe, expect, it } from "vitest";
import type { Entitlement, EntitlementState } from "@/lib/entitlement";
import {
  FREE_HISTORY_MONTHS,
  FREE_LINE_LIMIT,
  VIP_HISTORY_MONTHS,
  allowanceOf,
  canPickAnotherLine,
  clampHistoryMonths,
  remainingLines,
  resolvePricemetrAllowance,
  resolvePricemetrTier
} from "@/lib/pricemetr-tier";

const NOW = new Date("2026-08-29T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

const rowOf = (state: EntitlementState, offsets: { starts?: number; ends?: number | null } = {}): Entitlement => ({
  state,
  startsAt: new Date(NOW.getTime() + (offsets.starts ?? -DAY)),
  endsAt: offsets.ends === null ? null : new Date(NOW.getTime() + (offsets.ends ?? DAY)),
  limits: {}
});

describe("ระดับสิทธิ์ของ PRICEMETR", () => {
  it("ไม่ได้เข้าสู่ระบบ คือผู้มาเยือน", () => {
    expect(resolvePricemetrTier({ signedIn: false, entitlement: null }, NOW)).toBe("visitor");
  });

  it("เข้าสู่ระบบแล้วยังไม่มีแถวสิทธิ์ คือสมาชิกฟรีทันที ไม่ต้องกดอะไร — ADR 0023", () => {
    expect(resolvePricemetrTier({ signedIn: true, entitlement: null }, NOW)).toBe("member_free");
  });

  it("แถวสิทธิ์ที่ใช้งานอยู่ คือ VIP", () => {
    expect(resolvePricemetrTier({ signedIn: true, entitlement: rowOf("active") }, NOW)).toBe("vip");
  });

  it("VIP ที่หมดอายุ ตกลงมาเป็นสมาชิกฟรี ไม่ใช่ผู้มาเยือน", () => {
    const expired = rowOf("active", { starts: -10 * DAY, ends: -DAY });
    expect(resolvePricemetrTier({ signedIn: true, entitlement: expired }, NOW)).toBe("member_free");
  });

  it("บัญชีที่ถูกระงับ อ่านราคาได้เท่าผู้มาเยือน แต่หยิบเข้ารายการไม่ได้", () => {
    const tier = resolvePricemetrTier({ signedIn: true, entitlement: rowOf("suspended", { ends: null }) }, NOW);
    expect(tier).toBe("visitor");
    expect(allowanceOf(tier).canPickLines).toBe(false);
    // ราคายังอ่านได้ครบ ข้อห้ามข้อ 1 ไม่มีข้อยกเว้นให้สถานะไหนทั้งนั้น
    expect(allowanceOf(tier).historyMonths).toBe(FREE_HISTORY_MONTHS);
  });

  it("ทะเบียนปิดแอป ชนะแถวสิทธิ์ที่ยังใช้งานอยู่", () => {
    const input = { signedIn: true, entitlement: rowOf("active"), appEnabled: false };
    expect(resolvePricemetrTier(input, NOW)).toBe("visitor");
  });

  it("ครบทุกสถานะที่ resolveEntitlement คืนได้ ต้องมีระดับรองรับ ไม่มี undefined หลุด", () => {
    const states: EntitlementState[] = ["trial", "active", "expired_read_only", "suspended", "member_free", "doh_staff_only"];
    for (const state of states) {
      const tier = resolvePricemetrTier({ signedIn: true, entitlement: rowOf(state, { ends: null }) }, NOW);
      expect(["visitor", "member_free", "vip"]).toContain(tier);
    }
    // สองสถานะที่คำนวณเอาไม่เคยเก็บ: ยังไม่ถึงวันเริ่ม และไม่มีแถวเลย
    expect(resolvePricemetrTier({ signedIn: true, entitlement: rowOf("active", { starts: DAY }) }, NOW)).toBe("member_free");
    expect(resolvePricemetrTier({ signedIn: true, entitlement: null }, NOW)).toBe("member_free");
  });
});

describe("สิ่งที่แต่ละระดับได้", () => {
  it("ราคาย้อนหลัง: ผู้มาเยือนกับสมาชิกฟรีได้หกเดือน VIP ได้ถึงมกราคม 2545", () => {
    expect(allowanceOf("visitor").historyMonths).toBe(FREE_HISTORY_MONTHS);
    expect(allowanceOf("member_free").historyMonths).toBe(FREE_HISTORY_MONTHS);
    expect(allowanceOf("vip").historyMonths).toBe(VIP_HISTORY_MONTHS);
  });

  it("รายการที่หยิบไว้: ผู้มาเยือนหยิบไม่ได้ สมาชิกฟรีห้าสิบบรรทัด VIP ไม่จำกัด", () => {
    expect(allowanceOf("visitor").lineLimit).toBe(0);
    expect(allowanceOf("member_free").lineLimit).toBe(FREE_LINE_LIMIT);
    expect(allowanceOf("vip").lineLimit).toBeNull();
  });

  it("ส่งออกใบสรุปเป็นของ VIP เท่านั้น", () => {
    expect(allowanceOf("visitor").canExportSummary).toBe(false);
    expect(allowanceOf("member_free").canExportSummary).toBe(false);
    expect(allowanceOf("vip").canExportSummary).toBe(true);
  });
});

describe("หนีบจำนวนเดือน", () => {
  const free = allowanceOf("member_free");
  const vip = allowanceOf("vip");

  it("ขอ 24 ในฐานะสมาชิกฟรี ได้ 6 — ไม่ใช่ถูกปฏิเสธทั้งคำขอ", () => {
    expect(clampHistoryMonths(24, free)).toBe(FREE_HISTORY_MONTHS);
  });

  it("ขอ 24 ในฐานะ VIP ได้ 24 ตามที่ขอ", () => {
    expect(clampHistoryMonths(24, vip)).toBe(24);
  });

  it("VIP ขอเกินขอบของต้นทาง ยังถูกหนีบที่ 288 เดือน", () => {
    expect(clampHistoryMonths(9999, vip)).toBe(VIP_HISTORY_MONTHS);
  });

  it("ขอน้อยกว่าสิทธิ์ ได้เท่าที่ขอ", () => {
    expect(clampHistoryMonths(3, free)).toBe(3);
  });

  it("ค่าพัง ค่าติดลบ หรือไม่ส่งมา ตกไปที่หกเดือน ไม่ใช่ยี่สิบสี่", () => {
    expect(clampHistoryMonths(undefined, free)).toBe(FREE_HISTORY_MONTHS);
    expect(clampHistoryMonths(0, vip)).toBe(FREE_HISTORY_MONTHS);
    expect(clampHistoryMonths(-5, vip)).toBe(FREE_HISTORY_MONTHS);
    expect(clampHistoryMonths(Number.NaN, vip)).toBe(FREE_HISTORY_MONTHS);
  });

  it("เศษทศนิยมถูกปัดลง ไม่ส่งต่อไปให้ต้นทาง", () => {
    expect(clampHistoryMonths(4.9, free)).toBe(4);
  });
});

describe("เพดานบรรทัดของรายการที่หยิบไว้", () => {
  it("สมาชิกฟรีหยิบได้จนถึงห้าสิบ แล้วหยุด", () => {
    const free = allowanceOf("member_free");
    expect(remainingLines(free, 0)).toBe(FREE_LINE_LIMIT);
    expect(canPickAnotherLine(free, FREE_LINE_LIMIT - 1)).toBe(true);
    expect(canPickAnotherLine(free, FREE_LINE_LIMIT)).toBe(false);
    expect(remainingLines(free, FREE_LINE_LIMIT + 10)).toBe(0);
  });

  it("VIP ไม่มีเพดาน", () => {
    const vip = allowanceOf("vip");
    expect(remainingLines(vip, 5_000)).toBeNull();
    expect(canPickAnotherLine(vip, 5_000)).toBe(true);
  });

  it("ผู้มาเยือนหยิบไม่ได้ตั้งแต่บรรทัดแรก", () => {
    expect(canPickAnotherLine(allowanceOf("visitor"), 0)).toBe(false);
  });
});

describe("resolvePricemetrAllowance ต่อจากสถานะถึงตัวเลขในครั้งเดียว", () => {
  it("สมาชิกฟรีได้ชุดตัวเลขของสมาชิกฟรี", () => {
    expect(resolvePricemetrAllowance({ signedIn: true, entitlement: null }, NOW)).toEqual({
      tier: "member_free",
      historyMonths: FREE_HISTORY_MONTHS,
      lineLimit: FREE_LINE_LIMIT,
      canPickLines: true,
      canExportSummary: false
    });
  });
});
