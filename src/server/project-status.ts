import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { HandoffStatus, ProjectStatus, RoadmapStatus } from "@/lib/project-status";

export async function readProjectStatus(): Promise<ProjectStatus> {
  const root = process.cwd();
  const roadmap = JSON.parse(await readFile(path.join(root, "docs/roadmap/roadmap.json"), "utf8")) as RoadmapStatus;
  const handoffs = JSON.parse(await readFile(path.join(root, "docs/handoff/index.json"), "utf8")) as HandoffStatus[];
  const names = new Set(await readdir(path.join(root, "docs/handoff")));

  handoffs.forEach((handoff) => {
    if (!names.has(path.basename(handoff.path))) throw new Error(`Missing handoff file: ${handoff.path}`);
  });

  return { roadmap, handoffs, generatedAt: new Date().toISOString() };
}
