import { existsSync, readFileSync } from "node:fs";

const pointer = "docs/roadmap/roadmap.json";

if (!existsSync(pointer)) {
  console.error(`Missing ${pointer}. Update roadmap before committing.`);
  process.exit(1);
}

const roadmap = JSON.parse(readFileSync(pointer, "utf8"));
if (!roadmap.version || !roadmap.updatedAt || !Array.isArray(roadmap.items)) {
  console.error("Roadmap must contain version, updatedAt and items.");
  process.exit(1);
}

console.log(`Roadmap ${roadmap.version} is valid (${roadmap.items.length} item(s)).`);
