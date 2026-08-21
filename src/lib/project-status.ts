export type RoadmapItem = { id: string; title: string; status: "done" | "planned" | "in_progress"; phase: string };

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
