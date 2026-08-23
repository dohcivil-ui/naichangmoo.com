import { describe, expect, it } from "vitest";
import { readProjectStatus } from "@/server/project-status";

describe("readProjectStatus", () => {
  it("reads the versioned roadmap and handoff sources from disk", async () => {
    const status = await readProjectStatus();

    expect(typeof status.roadmap.version).toBe("string");
    expect(status.roadmap.items.length).toBeGreaterThan(0);
    expect(status.handoffs.length).toBeGreaterThan(0);
    expect(Number.isNaN(Date.parse(status.generatedAt))).toBe(false);
  });

  it("guarantees every listed handoff points at an existing file", async () => {
    // readProjectStatus throws if any handoff path is missing, so a successful
    // read is the assertion. This locks the index.json <-> files invariant.
    await expect(readProjectStatus()).resolves.toBeTruthy();
  });
});
