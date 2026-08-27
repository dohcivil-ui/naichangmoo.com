import { describe, expect, it } from "vitest";
import type { RoadmapItem } from "@/lib/project-status";
import { ROADMAP_GROUPS, groupRoadmapItems } from "@/lib/roadmap-groups";

const item = (id: string, app: string | undefined, status: RoadmapItem["status"] = "planned"): RoadmapItem => ({
  id,
  title: id,
  status,
  phase: "product",
  ...(app ? { app } : {})
});

describe("the roadmap console groups by app without losing anything", () => {
  it("keeps every item: unknown and missing app values land in the platform group", () => {
    const items = [item("IP-001", "estimeter"), item("IP-002", undefined), item("IP-003", "no-such-app")];

    const groups = groupRoadmapItems(items);
    const total = groups.reduce((sum, group) => sum + group.items.length, 0);

    expect(total).toBe(items.length);
    expect(groups.find((group) => group.key === "platform")?.items.map((i) => i.id)).toEqual(["IP-002", "IP-003"]);
  });

  it("counts done per group and follows the fixed group order, omitting empty groups", () => {
    const items = [
      item("IP-010", "work-plan", "done"),
      item("IP-011", "work-plan"),
      item("IP-012", "landing", "done")
    ];

    const groups = groupRoadmapItems(items);

    expect(groups.map((group) => group.key)).toEqual(["landing", "work-plan"]);
    expect(groups.find((group) => group.key === "work-plan")?.done).toBe(1);
    expect(groups.find((group) => group.key === "landing")?.done).toBe(1);
  });

  it("has a label for every group key, so no header ever renders a bare slug", () => {
    for (const group of ROADMAP_GROUPS) expect(group.label.trim().length).toBeGreaterThan(0);
  });
});
