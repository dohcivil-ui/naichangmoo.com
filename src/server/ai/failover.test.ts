import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const askForJson = vi.fn();

vi.mock("@/server/ai/provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/ai/provider")>();
  return { ...actual, askForJson };
});

const { askWithFallback } = await import("@/server/ai/failover");

/**
 * ตัวสำรองมีไว้กันเจ็ดแอปดับพร้อมกัน ไม่ได้มีไว้ให้คำตอบดีขึ้น
 *
 * เส้นแบ่งที่เทสต์ชุดนี้ยืนเฝ้าคือ **อะไรคือความล้ม และอะไรคือคำตอบ** การยิงซ้ำอีกค่าย
 * เมื่อแบบจำลองปฏิเสธหรือตอบผิดรูป จะได้ผลเหมือนเดิมเป็นส่วนใหญ่แต่จ่ายเงินสองรอบทุกครั้ง
 */
const input = { system: "s", user: "u", schema: z.object({ ok: z.boolean() }), schemaName: "t" };

const ok = { ok: true, data: { ok: true }, usage: { inputTokens: 10, outputTokens: 20 }, costBaht: 0.22, elapsedMs: 900 };

describe("การสลับไปค่ายสำรอง", () => {
  beforeEach(() => askForJson.mockReset());

  it("ไม่เรียกตัวสำรองเลยเมื่อค่ายหลักตอบได้", async () => {
    askForJson.mockResolvedValueOnce(ok);
    const result = await askWithFallback("gpt-5.4-mini", "deepseek-v4-flash", input);
    expect(result.ok).toBe(true);
    expect(result.usedFallback).toBe(false);
    expect(askForJson).toHaveBeenCalledTimes(1);
  });

  it("สลับไปตัวสำรองเมื่อค่ายหลักติดต่อไม่ได้", async () => {
    askForJson.mockResolvedValueOnce({ ok: false, reason: "failed", message: "503" }).mockResolvedValueOnce(ok);
    const result = await askWithFallback("gpt-5.4-mini", "deepseek-v4-flash", input);
    expect(result.ok).toBe(true);
    expect(result.usedFallback).toBe(true);
    expect(result.modelUsed).toBe("deepseek-v4-flash");
  });

  it("สลับเมื่อค่ายหลักไม่มีกุญแจ เพราะอีกค่ายอาจมี", async () => {
    askForJson.mockResolvedValueOnce({ ok: false, reason: "no_api_key", message: "ไม่มีกุญแจ" }).mockResolvedValueOnce(ok);
    const result = await askWithFallback("gpt-5.4-mini", "deepseek-v4-flash", input);
    expect(result.ok).toBe(true);
    expect(askForJson).toHaveBeenCalledTimes(2);
  });

  it("ไม่สลับเมื่อแบบจำลองปฏิเสธ เพราะการปฏิเสธคือคำตอบ ไม่ใช่ความล้ม", async () => {
    askForJson.mockResolvedValueOnce({ ok: false, reason: "refused", message: "ปฏิเสธ" });
    const result = await askWithFallback("gpt-5.4-mini", "deepseek-v4-flash", input);
    expect(result.ok).toBe(false);
    expect(askForJson).toHaveBeenCalledTimes(1);
  });

  it("ไม่สลับเมื่อคำตอบผิดรูป เพราะยิงซ้ำก็มักได้แบบเดิมแต่จ่ายสองรอบ", async () => {
    askForJson.mockResolvedValueOnce({ ok: false, reason: "unparsable", message: "ไม่ใช่ JSON" });
    const result = await askWithFallback("gpt-5.4-mini", "deepseek-v4-flash", input);
    expect(result.ok).toBe(false);
    expect(askForJson).toHaveBeenCalledTimes(1);
  });

  it("ไม่มีตัวสำรองก็คืนความล้มของค่ายหลักตรง ๆ", async () => {
    askForJson.mockResolvedValueOnce({ ok: false, reason: "failed", message: "503" });
    const result = await askWithFallback("gpt-5.4-mini", null, input);
    expect(result.ok).toBe(false);
    expect(askForJson).toHaveBeenCalledTimes(1);
  });

  it("ส่งเพดานเวลาที่เหลือให้ตัวสำรอง ไม่ใช่เริ่มนับใหม่", async () => {
    askForJson.mockResolvedValueOnce({ ok: false, reason: "failed", message: "ช้า" }).mockResolvedValueOnce(ok);
    const startedMs = Date.now() - 40_000;
    await askWithFallback("gpt-5.4-mini", "deepseek-v4-flash", input, startedMs, 60_000);

    const secondCall = askForJson.mock.calls[1]!;
    expect(secondCall[1].timeoutMs).toBeLessThanOrEqual(20_000);
    expect(secondCall[1].timeoutMs).toBeGreaterThan(0);
  });

  it("หมดเวลาแล้วไม่ลองตัวสำรองเลย ผู้ใช้ที่ควรรอหนึ่งนาทีต้องไม่กลายเป็นรอสองนาที", async () => {
    askForJson.mockResolvedValueOnce({ ok: false, reason: "failed", message: "ช้า" });
    const result = await askWithFallback("gpt-5.4-mini", "deepseek-v4-flash", input, Date.now() - 90_000, 60_000);
    expect(result.ok).toBe(false);
    expect(askForJson).toHaveBeenCalledTimes(1);
    if (!result.ok) expect(result.message).toContain("หมดเวลา");
  });

  it("รายงานอาการของค่ายหลักด้วยเมื่อทั้งสองค่ายล้ม เพราะตัวที่ต้องไปตามแก้คือค่ายหลัก", async () => {
    askForJson
      .mockResolvedValueOnce({ ok: false, reason: "failed", message: "OpenAI ล่ม" })
      .mockResolvedValueOnce({ ok: false, reason: "failed", message: "DeepSeek ล่ม" });
    const result = await askWithFallback("gpt-5.4-mini", "deepseek-v4-flash", input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("OpenAI ล่ม");
  });
});
