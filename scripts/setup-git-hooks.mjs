import { execFileSync } from "node:child_process";

// core.hooksPath is stored in .git/config, which Git never tracks, so the hook
// path cannot travel with a commit. A fresh clone therefore starts with no gate
// at all until someone remembers to run a setup command, and nobody remembers.
// Running this from the prepare lifecycle makes `pnpm install` do it instead.
function insideGitWorkTree() {
  try {
    const output = execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output.toString().trim() === "true";
  } catch {
    return false;
  }
}

if (!insideGitWorkTree()) {
  // A build that installs from a tarball or an exported directory has no
  // repository to configure. Skipping keeps the install working there rather
  // than failing a deployment over a developer convenience.
  console.log("Not a Git work tree; skipping hook setup.");
  process.exit(0);
}

execFileSync("git", ["config", "core.hooksPath", "hooks"], { stdio: "inherit" });
console.log("Git hooks enabled from ./hooks");
