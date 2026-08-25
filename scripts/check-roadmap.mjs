import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Accepts a root so the behaviour can be tested against fixtures instead of only
// against the repository it happens to run in.
const root = process.argv[2] ?? process.cwd();
const pointerPath = path.join(root, "docs/roadmap/roadmap.json");

if (!existsSync(pointerPath)) {
  console.error(`Missing ${pointerPath}. Update roadmap before committing.`);
  process.exit(1);
}

const pointerText = readFileSync(pointerPath, "utf8");
let roadmap;
try {
  roadmap = JSON.parse(pointerText);
} catch (error) {
  console.error(`docs/roadmap/roadmap.json is not valid JSON: ${error.message}`);
  process.exit(1);
}

if (!roadmap.version || !roadmap.updatedAt || !Array.isArray(roadmap.items)) {
  console.error("Roadmap must contain version, updatedAt and items.");
  process.exit(1);
}

// The pointer is a copy of the versioned file, and docs/roadmap/README.md forbids
// editing a versioned file once it is committed. Both rules were broken in fae066b
// without anything noticing, because the checker never compared the two.
const versionedName = `roadmap.v${roadmap.version}.json`;
const versionedPath = path.join(root, "docs/roadmap", versionedName);

if (!existsSync(versionedPath)) {
  console.error(
    `Roadmap pointer claims version ${roadmap.version} but docs/roadmap/${versionedName} does not exist. ` +
      "Create the versioned file instead of editing the pointer alone."
  );
  process.exit(1);
}

const versionedText = readFileSync(versionedPath, "utf8");
if (normalise(pointerText) !== normalise(versionedText)) {
  console.error(
    `docs/roadmap/roadmap.json has drifted from docs/roadmap/${versionedName}. ` +
      "A change to the current plan is a new roadmap version, not an edit to the pointer."
  );
  process.exit(1);
}

console.log(
  `Roadmap ${roadmap.version} is valid (${roadmap.items.length} item(s)) and matches ${versionedName}.`
);

/** Line endings differ between a Windows checkout and CI; the content is what must match. */
function normalise(text) {
  return text.replace(/\r\n/g, "\n").trimEnd();
}
