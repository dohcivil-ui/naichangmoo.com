import { beforeEach, describe, expect, it, vi } from "vitest";
import { thaiMonthStart, thaiNextMonthStart } from "@/lib/thai-time";

/**
 * ลำดับของด่านในประตูผู้ช่วย
 *
 * เทสต์ชุดนี้ไม่ได้ตรวจว่าโค้ดทำงานได้ แต่ตรวจว่ามัน **ทำสิ่งที่ต้องทำก่อน ก่อนสิ่งที่เสียของ**
 * ลำดับที่ผิดในไฟล์นี้ไม่ทำให้อะไรพัง มันแค่ทำให้คนที่ไม่มีสิทธิ์เสียโควตา คนที่ระบบเราล่ม
 * ใส่เสียโควตา และเงินออกไปโดยไม่มีร่องรอย ซึ่งเป็นความผิดพลาดที่เงียบทั้งสามข้อ
 */

const askForJson = vi.fn();
const decideAppCapability = vi.fn();
const consumeRateLimit = vi.fn();
const readRateLimit = vi.fn();
const reserveProposal = vi.fn();
const completeProposal = vi.fn();
const failProposal = vi.fn();
const spendRows = { total: "0" };

vi.mock("@/server/ai/provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/ai/provider")>();
  return { ...actual, askForJson };
});

vi.mock("@/server/app-access", () => ({ decideAppCapability }));

vi.mock("@/server/rate-limit", () => ({ consumeRateLimit, readRateLimit }));

vi.mock("@/server/ai/assistant-audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/ai/assistant-audit")>();
  return { ...actual, reserveProposal, completeProposal, failProposal };
});

// เบรกมือรวมอ่านยอดใช้จ่ายจากฐานข้อมูลตรง ๆ จึงต้องมีของปลอมให้มันอ่าน
vi.mock("@/db", () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => Promise.resolve([spendRows]) }) })
  })
}));

const { runAssistant } = await import("@/server/ai/assistant");

const ACTOR = { id: "user_1" };

const REQUEST = {
  app: "work-plan",
  verb: "critique" as const,
  subject: "project:demo",
  input: {
    projectName: "อาคารเรียน 4 ชั้น",
    contractBaht: "18,500,000",
    durationDays: 300,
    milestones: [{ title: "งวดที่ 1", percentOfContract: "35.00", activityTitles: ["งานฐานราก"] }]
  },
  facts: ["งวดที่หนักที่สุดคิดเป็น 35 เปอร์เซ็นต์ของมูลค่าสัญญา"]
};

const modelAnswer = {
  ok: true,
  data: { findings: [{ severity: "high", title: "งวดแรกหนักเกินไป", detail: "กรรมการมักไม่ตรวจรับก้อนใหญ่" }] },
  usage: { inputTokens: 900, outputTokens: 300 },
  costBaht: 0.22,
  elapsedMs: 8_900
};

const allow = () => {
  decideAppCapability.mockResolvedValue({ allowed: true, organizationId: "org_1", state: "active", viaAdministrator: false });
  consumeRateLimit.mockResolvedValue({ allowed: true, count: 1, remaining: 4, resetAt: new Date() });
  readRateLimit.mockResolvedValue({ allowed: true, count: 3, remaining: 297, resetAt: new Date() });
  askForJson.mockResolvedValue(modelAnswer);
  reserveProposal.mockResolvedValue(undefined);
  completeProposal.mockResolvedValue(undefined);
};

describe("ประตูผู้ช่วย", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spendRows.total = "0";
    allow();
  });

  it("ปฏิเสธคนที่ยังไม่เข้าสู่ระบบโดยไม่แตะอะไรเลย", async () => {
    const result = await runAssistant(null, REQUEST);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_signed_in");
    expect(decideAppCapability).not.toHaveBeenCalled();
    expect(askForJson).not.toHaveBeenCalled();
  });

  it("ปฏิเสธจังหวะที่แอปนั้นยังไม่มีผู้ช่วย", async () => {
    const result = await runAssistant(ACTOR, { ...REQUEST, verb: "compose" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unavailable");
    expect(askForJson).not.toHaveBeenCalled();
  });

  /** G9 — สิทธิ์มาก่อนโควตา คนที่ถูกปฏิเสธต้องไม่เสียโควตาจากการถูกปฏิเสธ */
  it("สิทธิ์หมดอายุได้คำปฏิเสธ และตัวนับไม่ขยับแม้แต่ครั้งเดียว", async () => {
    decideAppCapability.mockResolvedValue({
      allowed: false,
      reason: "not_entitled",
      organizationId: "org_1",
      state: "expired_read_only"
    });

    const result = await runAssistant(ACTOR, REQUEST);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_entitled");
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(readRateLimit).not.toHaveBeenCalled();
    expect(askForJson).not.toHaveBeenCalled();
  });

  it("แอปที่ยังไม่เปิดใช้งานบอกเหตุผลตรง ๆ ว่าแอปยังไม่เปิด", async () => {
    decideAppCapability.mockResolvedValue({
      allowed: false,
      reason: "app_not_open",
      organizationId: null,
      state: "not_activated"
    });
    const result = await runAssistant(ACTOR, REQUEST);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("ยังไม่เปิดใช้งาน");
  });

  it("อินพุตไม่ครบถูกปฏิเสธก่อนถึงตัวนับและก่อนเสียเงิน", async () => {
    const result = await runAssistant(ACTOR, { ...REQUEST, input: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("input_incomplete");
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(askForJson).not.toHaveBeenCalled();
  });

  /** G10 — ถังเดือนเป็นถังรวมข้ามแอป และหน้าต่างคือเดือนปฏิทินไทย ไม่ใช่เจ็ดโมงเช้า */
  it("นับโควตาเดือนเป็นถังเดียวข้ามทุกแอป ด้วยขอบเขตเดือนไทย", async () => {
    const now = new Date(Date.UTC(2026, 7, 27, 3, 0, 0));
    await runAssistant(ACTOR, REQUEST, now);

    const [scope, identifier, , , window] = readRateLimit.mock.calls[0]!;
    expect(scope).toBe("ai:month");
    expect(identifier).toBe("user_1");
    expect(window.windowStart.toISOString()).toBe(thaiMonthStart(now).toISOString());
    expect(window.resetAt.toISOString()).toBe(thaiNextMonthStart(now).toISOString());
    expect(scope).not.toContain("work-plan");
  });

  /**
   * บั๊กที่การยิงจริงครั้งแรกจับได้ ไม่ใช่เทสต์
   *
   * ผู้ดูแลผ่านด่านสิทธิ์มาได้โดยไม่มีแถว entitlement สถานะที่ได้จึงเป็น not_activated
   * ซึ่งเพดานเป็นศูนย์ตามนิยาม ผลคือถูกปฏิเสธทันทีทั้งที่เพิ่งอนุญาตให้ผ่านมาหนึ่งบรรทัดก่อนหน้า
   */
  it("ผู้ดูแลแพลตฟอร์มที่ทดสอบแอปยังไม่เปิด มีโควตาของตัวเอง ไม่ใช่ศูนย์", async () => {
    decideAppCapability.mockResolvedValue({
      allowed: true,
      organizationId: "org_1",
      state: "not_activated",
      viaAdministrator: true
    });

    const result = await runAssistant(ACTOR, REQUEST);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.proposal.quota.limit).toBe(100);
    expect(readRateLimit.mock.calls[0]![2].limit).toBe(100);
  });

  it("เพดานเดือนเต็มแล้วปฏิเสธก่อนเรียกแบบจำลอง", async () => {
    readRateLimit.mockResolvedValue({ allowed: false, count: 300, remaining: 0, resetAt: new Date() });
    const result = await runAssistant(ACTOR, REQUEST);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("over_monthly_cap");
      expect(result.quota?.used).toBe(300);
    }
    expect(askForJson).not.toHaveBeenCalled();
  });

  it("กดรัวเกินเพดานต่อนาทีถูกปฏิเสธ และการกดนั้นถูกนับ", async () => {
    consumeRateLimit.mockResolvedValue({ allowed: false, count: 6, remaining: 0, resetAt: new Date() });
    const result = await runAssistant(ACTOR, REQUEST);
    expect(result.ok).toBe(false);
    expect(consumeRateLimit).toHaveBeenCalledTimes(1);
    expect(consumeRateLimit.mock.calls[0]![0]).toBe("ai:minute");
    expect(askForJson).not.toHaveBeenCalled();
  });

  it("เบรกมือค่าใช้จ่ายรวมต่อวันหยุดผู้ช่วยทั้งระบบพร้อมบอกเหตุผล", async () => {
    // 300 บาทที่อัตรา 35 บาทต่อดอลลาร์ คือราว 8.57 ล้าน micro USD
    spendRows.total = "9000000";
    const result = await runAssistant(ACTOR, REQUEST);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("over_monthly_cap");
      expect(result.message).toContain("ทั้งระบบ");
    }
    expect(askForJson).not.toHaveBeenCalled();
  });

  /** G11 — เงินออกไปแล้วต้องมีร่องรอยเสมอ แถวจึงต้องเกิดก่อนการเรียก */
  it("จองแถวประวัติก่อนเรียกแบบจำลอง", async () => {
    const order: string[] = [];
    reserveProposal.mockImplementation(async () => void order.push("reserve"));
    askForJson.mockImplementation(async () => {
      order.push("model");
      return modelAnswer;
    });

    await runAssistant(ACTOR, REQUEST);
    expect(order).toEqual(["reserve", "model"]);
  });

  it("จดประวัติไม่ได้ก็ไม่เรียกแบบจำลองเลย", async () => {
    reserveProposal.mockRejectedValue(new Error("ฐานข้อมูลล่ม"));
    const result = await runAssistant(ACTOR, REQUEST);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unavailable");
    expect(askForJson).not.toHaveBeenCalled();
  });

  it("แบบจำลองล่มแล้วยังบันทึกว่าแถวนี้ล้มเพราะอะไร และไม่นับโควตาเดือน", async () => {
    askForJson.mockResolvedValue({ ok: false, reason: "failed", message: "503" });
    const result = await runAssistant(ACTOR, REQUEST);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unavailable");
    expect(failProposal).toHaveBeenCalledTimes(1);
    const monthConsumes = consumeRateLimit.mock.calls.filter((call) => call[0] === "ai:month");
    expect(monthConsumes).toHaveLength(0);
  });

  it("นับโควตาเดือนเมื่อแบบจำลองตอบสำเร็จเท่านั้น", async () => {
    await runAssistant(ACTOR, REQUEST);
    const monthConsumes = consumeRateLimit.mock.calls.filter((call) => call[0] === "ai:month");
    expect(monthConsumes).toHaveLength(1);
  });

  it("คืนข้อเสนอที่มีรหัสอ้างอิง ที่มา ค่าใช้จ่ายเป็น micro USD และโควตาที่เหลือ", async () => {
    const result = await runAssistant(ACTOR, REQUEST);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.proposal.proposalId).toMatch(/^prop_/);
    expect(result.proposal.app).toBe("work-plan");
    expect(result.proposal.usage.costMicroUsd).toBe(Math.round((0.22 / 35) * 1_000_000));
    expect(result.proposal.promptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.proposal.quota.limit).toBe(300);
    expect(completeProposal).toHaveBeenCalledTimes(1);
  });

  it("ตัดอีโมจิที่แบบจำลองแอบใส่มาก่อนคืนให้หน้าจอ", async () => {
    askForJson.mockResolvedValue({
      ...modelAnswer,
      data: { findings: [{ severity: "high", title: "งวดแรกหนักเกินไป 🚨", detail: "ระวังด้วย 😬" }] }
    });

    const result = await runAssistant(ACTOR, REQUEST);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(result.proposal.draft)).not.toMatch(/[\u{1F000}-\u{1FAFF}]/u);
  });

  it("บอกผู้ใช้เมื่อแบบจำลองเผลอใช้ชื่อฟิลด์ภาษาอังกฤษ แทนที่จะทิ้งคำตอบที่จ่ายเงินไปแล้ว", async () => {
    askForJson.mockResolvedValue({
      ...modelAnswer,
      data: { findings: [{ severity: "low", title: "ตรวจ startOffsetDays", detail: "ค่าไม่ตรง" }] }
    });

    const result = await runAssistant(ACTOR, REQUEST);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.warnings.some((warning) => /ศัพท์ทางเทคนิค/.test(warning))).toBe(true);
  });

  it("ส่งข้อเท็จจริงที่ระบบคำนวณแล้วไปกับโจทย์ ไม่ใช่ให้แบบจำลองหาเอง", async () => {
    await runAssistant(ACTOR, REQUEST);
    const [, input] = askForJson.mock.calls[0]!;
    expect(input.user).toContain("35 เปอร์เซ็นต์ของมูลค่าสัญญา");
  });
});
