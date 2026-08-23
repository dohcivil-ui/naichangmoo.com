import { describe, expect, it } from "vitest";
import { itemConfirmationBlocker, parseEvidenceForm, parseTakeoffItemForm } from "@/lib/takeoff-item";

function itemForm(values: Partial<Record<"category" | "description" | "unit" | "quantity", string>>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) if (value !== undefined) data.set(key, value);
  return data;
}

const validItem = {
  category: "structure",
  description: "คอนกรีตโครงสร้างคาน B1 ชั้น 2",
  unit: "cu_m",
  quantity: "1.92"
};

describe("take-off item form", () => {
  it("accepts a complete line and trims the description", () => {
    const parsed = parseTakeoffItemForm(itemForm({ ...validItem, description: "  คาน B1  " }));

    expect(parsed).toEqual({ ok: true, value: { ...validItem, description: "คาน B1" } });
  });

  it("refuses a unit or category outside the allowed set", () => {
    const badUnit = parseTakeoffItemForm(itemForm({ ...validItem, unit: "ตร.ม." }));
    const badCategory = parseTakeoffItemForm(itemForm({ ...validItem, category: "โครงสร้าง" }));

    expect(badUnit.ok).toBe(false);
    if (!badUnit.ok) expect(badUnit.errors.unit).toBeTruthy();
    expect(badCategory.ok).toBe(false);
    if (!badCategory.ok) expect(badCategory.errors.category).toBeTruthy();
  });

  it("reports every bad field at once instead of one at a time", () => {
    const parsed = parseTakeoffItemForm(itemForm({ category: "x", description: "ก", unit: "y", quantity: "-1" }));

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(Object.keys(parsed.errors).sort()).toEqual(["category", "description", "quantity", "unit"]);
    }
  });

  it("explains a rejected quantity in the operator's terms", () => {
    const tooPrecise = parseTakeoffItemForm(itemForm({ ...validItem, quantity: "1.1234567" }));

    expect(tooPrecise.ok).toBe(false);
    if (!tooPrecise.ok) expect(tooPrecise.errors.quantity).toContain("6 ตำแหน่ง");
  });
});

describe("evidence form", () => {
  it("accepts a source note with an optional page", () => {
    const data = new FormData();
    data.set("note", "แบบ S-05 ตารางคาน ช่วง A-B");
    data.set("pageNumber", "3");

    expect(parseEvidenceForm(data)).toEqual({
      ok: true,
      value: { note: "แบบ S-05 ตารางคาน ช่วง A-B", pageNumber: 3 }
    });
  });

  it("treats a blank page as not stated rather than invalid", () => {
    const data = new FormData();
    data.set("note", "วัดจากแบบขยายฐานราก F1");
    data.set("pageNumber", "");

    expect(parseEvidenceForm(data)).toEqual({ ok: true, value: { note: "วัดจากแบบขยายฐานราก F1", pageNumber: null } });
  });

  it("refuses an empty source and an impossible page", () => {
    const empty = new FormData();
    empty.set("note", "  ");
    const badPage = new FormData();
    badPage.set("note", "แบบ A-02 ผังพื้นชั้น 2");
    badPage.set("pageNumber", "0");

    expect(parseEvidenceForm(empty).ok).toBe(false);
    expect(parseEvidenceForm(badPage).ok).toBe(false);
  });
});

describe("confirmation gate", () => {
  it("blocks a quantity that has no stated source", () => {
    expect(itemConfirmationBlocker({ reviewState: "proposed", evidenceCount: 0 })).toContain("หลักฐาน");
  });

  it("allows confirmation once at least one evidence reference exists", () => {
    expect(itemConfirmationBlocker({ reviewState: "proposed", evidenceCount: 1 })).toBeNull();
  });

  it("does not re-confirm or silently accept a rejected line", () => {
    expect(itemConfirmationBlocker({ reviewState: "confirmed", evidenceCount: 3 })).toBeTruthy();
    expect(itemConfirmationBlocker({ reviewState: "rejected", evidenceCount: 3 })).toBeTruthy();
  });
});
