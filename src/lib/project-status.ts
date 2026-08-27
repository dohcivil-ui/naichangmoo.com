export type RoadmapItem = {
  id: string;
  title: string;
  status: "done" | "planned" | "in_progress";
  phase: string;
  /**
   * Which app (or platform area) the item belongs to, so /roadmap can answer "how far along is
   * this app" the way the owner reads progress. Optional because item files older than v0.66.0
   * predate the field; an item without one is grouped under "platform".
   */
  app?: string;
};

export type RoadmapStatus = {
  version: string;
  title: string;
  description: string;
  scope: string[];
  updatedAt: string;
  status: string;
  verification: string[];
  rollback: string;
  items: RoadmapItem[];
};

export type HandoffStatus = {
  version: string;
  title: string;
  description: string;
  scope: string[];
  verification: string[];
  rollback: string;
  path: string;
};

export type ProjectStatus = { roadmap: RoadmapStatus; handoffs: HandoffStatus[]; generatedAt: string };
