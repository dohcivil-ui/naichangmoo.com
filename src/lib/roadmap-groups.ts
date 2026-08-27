import type { RoadmapItem } from "@/lib/project-status";

/**
 * Grouping for the /roadmap status console, so the page answers the question the owner actually
 * asks — "how far along is this app" — instead of scrolling one flat list of ninety items.
 *
 * Kept out of the component for the same reason as `catalogue-card.ts`: the rules live where a
 * test needs no DOM, and the component stays markup.
 *
 * The `app` field arrived in roadmap v0.66.0. Items from before it, and any value this map does
 * not know, fall into the platform group rather than vanishing — a tracker that silently drops
 * items reads as progress nobody made.
 */
export const ROADMAP_GROUPS: readonly { key: string; label: string }[] = [
  { key: "landing", label: "หน้าแรกและตลาดแอป" },
  { key: "estimeter", label: "ESTIMETR" },
  { key: "pricemetr", label: "PRICEMETR" },
  { key: "work-plan", label: "ผู้ช่วยสร้างแผนงาน" },
  { key: "escalation-k", label: "ESCALATION K" },
  { key: "rcopt", label: "Retaining Wall Cantilever" },
  { key: "traffic-sign", label: "TRAFFIC SIGN" },
  { key: "land-acquisition", label: "LAND ACQUISITION V2" },
  { key: "hermes", label: "Hermes 24/7" },
  { key: "deploy", label: "Deploy และ VPS" },
  { key: "platform", label: "แพลตฟอร์มกลาง" }
] as const;

export type RoadmapGroup = {
  key: string;
  label: string;
  items: RoadmapItem[];
  done: number;
};

const FALLBACK_KEY = "platform";

export function groupRoadmapItems(items: RoadmapItem[]): RoadmapGroup[] {
  const known = new Set(ROADMAP_GROUPS.map((group) => group.key));
  const byKey = new Map<string, RoadmapItem[]>();

  for (const item of items) {
    const key = item.app && known.has(item.app) ? item.app : FALLBACK_KEY;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(item);
    else byKey.set(key, [item]);
  }

  // Fixed order, empty groups omitted: a group with nothing to say earns no header.
  return ROADMAP_GROUPS.filter((group) => byKey.has(group.key)).map((group) => {
    const groupItems = byKey.get(group.key) ?? [];
    return {
      key: group.key,
      label: group.label,
      items: groupItems,
      done: groupItems.filter((item) => item.status === "done").length
    };
  });
}
