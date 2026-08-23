import { describe, expect, it } from "vitest";
import { summarizeConfirmedQuantities } from "@/lib/takeoff-summary";

describe("confirmed quantity summary", () => {
  it("totals only confirmed lines", () => {
    const summary = summarizeConfirmedQuantities([
      { unit: "cu_m", quantity: "1.92", reviewState: "confirmed" },
      { unit: "cu_m", quantity: "10", reviewState: "proposed" },
      { unit: "cu_m", quantity: "0.58", reviewState: "confirmed" }
    ]);

    expect(summary).toEqual([{ unit: "cu_m", dimension: "volume", total: "2.5", itemCount: 2 }]);
  });

  it("never merges different units, even within one dimension", () => {
    const summary = summarizeConfirmedQuantities([
      { unit: "ton", quantity: "2", reviewState: "confirmed" },
      { unit: "kg", quantity: "450", reviewState: "confirmed" }
    ]);

    expect(summary).toHaveLength(2);
    expect(summary.map((row) => row.unit).sort()).toEqual(["kg", "ton"]);
  });

  it("orders volume, area, length, mass then count so the reading order matches a BOQ", () => {
    const summary = summarizeConfirmedQuantities([
      { unit: "each", quantity: "4", reviewState: "confirmed" },
      { unit: "m", quantity: "18", reviewState: "confirmed" },
      { unit: "cu_m", quantity: "1", reviewState: "confirmed" },
      { unit: "sq_m", quantity: "96.5", reviewState: "confirmed" }
    ]);

    expect(summary.map((row) => row.unit)).toEqual(["cu_m", "sq_m", "m", "each"]);
  });

  it("returns nothing when no line is confirmed", () => {
    expect(
      summarizeConfirmedQuantities([{ unit: "cu_m", quantity: "5", reviewState: "proposed" }])
    ).toEqual([]);
  });
});
