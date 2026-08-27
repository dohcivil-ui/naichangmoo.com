import { describe, expect, it } from "vitest";
import { thaiDayStart, thaiMonthStart, thaiNextMonthStart } from "@/lib/thai-time";

/**
 * The bug this file exists to prevent: a month window that resets at 07:00 Bangkok time, in the
 * middle of a working day, because the counter divided epoch milliseconds instead of asking what
 * month it is in Thailand.
 */
describe("Thai calendar boundaries", () => {
  it("puts the month boundary at 17:00 UTC on the last day of the previous month", () => {
    // 2026-08-27 03:00 UTC is 10:00 in Bangkok on the same day.
    const start = thaiMonthStart(Date.UTC(2026, 7, 27, 3, 0, 0));
    expect(start.toISOString()).toBe("2026-07-31T17:00:00.000Z");
  });

  it("keeps 07:00 Bangkok inside the same month window, not at its edge", () => {
    // Midnight UTC on the first of the month is 07:00 Bangkok — the old reset point.
    const sevenAm = Date.UTC(2026, 8, 1, 0, 0, 0);
    expect(thaiMonthStart(sevenAm).toISOString()).toBe("2026-08-31T17:00:00.000Z");
  });

  it("crosses into the next month exactly at midnight Bangkok", () => {
    const lastMoment = Date.UTC(2026, 7, 31, 16, 59, 59, 999);
    const firstMoment = Date.UTC(2026, 7, 31, 17, 0, 0);
    expect(thaiMonthStart(lastMoment).toISOString()).toBe("2026-07-31T17:00:00.000Z");
    expect(thaiMonthStart(firstMoment).toISOString()).toBe("2026-08-31T17:00:00.000Z");
  });

  it("rolls a December month start into the following January", () => {
    expect(thaiNextMonthStart(Date.UTC(2026, 11, 15, 0, 0, 0)).toISOString()).toBe("2026-12-31T17:00:00.000Z");
  });

  it("starts the day at midnight Bangkok, seven hours before midnight UTC", () => {
    const start = thaiDayStart(Date.UTC(2026, 7, 27, 3, 0, 0));
    expect(start.toISOString()).toBe("2026-08-26T17:00:00.000Z");
  });

  it("treats a moment just before Bangkok midnight as the previous day", () => {
    expect(thaiDayStart(Date.UTC(2026, 7, 26, 16, 59, 59)).toISOString()).toBe("2026-08-25T17:00:00.000Z");
  });
});
