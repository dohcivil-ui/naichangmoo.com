import { describe, expect, it } from "vitest";
import type { Capability } from "@/lib/entitlement";
import { PROJECT_NAME_MAX, SITE_LOCATION_MAX, parseProjectForm, projectCreationDenial } from "@/lib/estimeter-project";

function form(name: unknown, path: string | null = "government"): FormData {
  const data = new FormData();
  if (typeof name === "string") data.set("name", name);
  if (path !== null) data.set("path", path);
  return data;
}

const allowAll: Record<Capability, boolean> = {
  read: true,
  create_project: true,
  edit: true,
  run_ai: true,
  export: false,
  print: false
};

describe("project form parsing", () => {
  it("trims the name and accepts it", () => {
    const parsed = parseProjectForm(form("  อาคารสำนักงาน 3 ชั้น  "));

    expect(parsed).toEqual({ ok: true, value: { name: "อาคารสำนักงาน 3 ชั้น", path: "government", siteLocation: null, agencyName: null } });
  });

  it("requires the costing path, because it decides how the project is priced", () => {
    const missing = parseProjectForm(form("อาคารสำนักงาน 3 ชั้น", null));
    const unknown = parseProjectForm(form("อาคารสำนักงาน 3 ชั้น", "ราชการ"));

    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.errors.path).toBeTruthy();
    expect(unknown.ok).toBe(false);
  });

  it("takes the two header fields the official form prints, and trims them", () => {
    const data = form("อาคารฟอกไต ปุญโญภาส");
    data.set("siteLocation", "  โรงพยาบาลกุสุมาลย์  ");
    data.set("agencyName", "โรงพยาบาลกุสุมาลย์");

    const parsed = parseProjectForm(data);

    expect(parsed).toEqual({
      ok: true,
      value: {
        name: "อาคารฟอกไต ปุญโญภาส",
        path: "government",
        siteLocation: "โรงพยาบาลกุสุมาลย์",
        agencyName: "โรงพยาบาลกุสุมาลย์"
      }
    });
  });

  it("does not block a project over paperwork that is not settled yet", () => {
    const parsed = parseProjectForm(form("อาคารที่ยังไม่รู้สถานที่"));

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.siteLocation).toBeNull();
      expect(parsed.value.agencyName).toBeNull();
    }
  });

  it("refuses a header field the column cannot hold or that spans lines", () => {
    const tooLong = form("อาคารทดสอบ");
    tooLong.set("siteLocation", "ก".repeat(SITE_LOCATION_MAX + 1));
    const multiline = form("อาคารทดสอบ");
    multiline.set("agencyName", "โรงพยาบาล\nกุสุมาลย์");

    const first = parseProjectForm(tooLong);
    const second = parseProjectForm(multiline);

    expect(first.ok).toBe(false);
    if (!first.ok) expect(first.errors.siteLocation).toBeTruthy();
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.errors.agencyName).toBeTruthy();
  });

  it("accepts the private path as well as the government one", () => {
    const parsed = parseProjectForm(form("บ้านพักอาศัย 2 ชั้น", "private"));

    expect(parsed).toEqual({ ok: true, value: { name: "บ้านพักอาศัย 2 ชั้น", path: "private", siteLocation: null, agencyName: null } });
  });

  it("rejects a missing, blank or too-short name with a field message", () => {
    for (const value of [undefined, "", "   ", "ab"]) {
      const parsed = parseProjectForm(form(value));
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.errors.name).toBeTruthy();
    }
  });

  it("rejects a name longer than the column allows", () => {
    const parsed = parseProjectForm(form("ก".repeat(PROJECT_NAME_MAX + 1)));

    expect(parsed.ok).toBe(false);
  });

  it("rejects control characters because the name is printed in BOQ headers", () => {
    const parsed = parseProjectForm(form("อาคาร\nสำนักงาน"));

    expect(parsed.ok).toBe(false);
  });
});

describe("project creation denial", () => {
  it("allows creation while a trial still has a free slot", () => {
    expect(
      projectCreationDenial({ state: "trial", capabilities: allowAll, projectCount: 0, projectLimit: 1 })
    ).toBeNull();
  });

  it("explains the cap once the trial slot is used", () => {
    const denial = projectCreationDenial({ state: "trial", capabilities: allowAll, projectCount: 1, projectLimit: 1 });

    expect(denial).toContain("1 โครงการ");
  });

  it("explains read-only retention rather than a generic error after expiry", () => {
    const denial = projectCreationDenial({
      state: "expired_read_only",
      capabilities: { ...allowAll, create_project: false, edit: false, run_ai: false },
      projectCount: 1,
      projectLimit: 0
    });

    expect(denial).toContain("หมดอายุ");
  });

  it("blocks suspended and not-yet-started entitlements", () => {
    const suspended = projectCreationDenial({
      state: "suspended",
      capabilities: { ...allowAll, read: false, create_project: false },
      projectCount: 0,
      projectLimit: 0
    });
    const notStarted = projectCreationDenial({
      state: "not_started",
      capabilities: { ...allowAll, create_project: false, edit: false },
      projectCount: 0,
      projectLimit: 0
    });

    expect(suspended).toBeTruthy();
    expect(notStarted).toBeTruthy();
  });

  it("tells a member who has not activated the trial to start it first", () => {
    const denial = projectCreationDenial({
      state: "not_activated",
      capabilities: { ...allowAll, create_project: false, edit: false, run_ai: false },
      projectCount: 0,
      projectLimit: 0
    });

    expect(denial).toContain("เริ่มทดลองใช้");
  });

  it("allows an unlimited entitlement regardless of how many projects exist", () => {
    expect(
      projectCreationDenial({ state: "active", capabilities: allowAll, projectCount: 42, projectLimit: null })
    ).toBeNull();
  });
});
