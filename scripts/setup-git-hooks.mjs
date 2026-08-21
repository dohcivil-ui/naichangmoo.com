import { execFileSync } from "node:child_process";

execFileSync("git", ["config", "core.hooksPath", "hooks"], { stdio: "inherit" });
console.log("Git hooks enabled from ./hooks");
