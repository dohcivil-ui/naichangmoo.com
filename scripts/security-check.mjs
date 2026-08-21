import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const forbidden = [".env", ".env.local", "service-account.json", "credentials.json"];
const root = process.cwd();
const trackedFiles = new Set(execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean));

for (const name of forbidden) {
  if (trackedFiles.has(name)) {
    console.error(`Forbidden secret file is tracked by Git: ${name}`);
    process.exit(1);
  }
}

if ([...trackedFiles].some((file) => file.startsWith(".next/") || file.startsWith("node_modules/") || file.startsWith("dist/") || file.startsWith("out/"))) {
  console.error("Build/dependency artifacts must not be tracked by Git.");
  process.exit(1);
}

for (const file of [".env.example", "PROJECT.md", "AGENTS.md"]) {
  if (!existsSync(join(root, file))) {
    console.error(`Required governance file missing: ${file}`);
    process.exit(1);
  }
}

const envExample = readFileSync(join(root, ".env.example"), "utf8");
if (envExample.includes("sk_live_") || envExample.includes("whsec_")) {
  console.error("Example environment file appears to include a real Stripe secret.");
  process.exit(1);
}

console.log("Security preflight passed: no local secrets or build directories detected.");
