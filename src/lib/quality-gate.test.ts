import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/**
 * These guard the gate itself rather than product behaviour. Both failures they cover
 * happened for real: the opt-in database suites were claimed as verification in handoff
 * notes while CI never ran them, and the roadmap pointer drifted from its versioned file
 * without the checker noticing.
 */

const repoRoot = path.resolve(__dirname, "../..");

describe("CI runs the opt-in database suites", () => {
  const workflow = readFileSync(path.join(repoRoot, ".github/workflows/quality.yml"), "utf8");

  it("provides a PostgreSQL service pinned by digest", () => {
    expect(workflow).toMatch(/image:\s*postgres:[^\s@]+@sha256:[0-9a-f]{64}/);
  });

  it("enables the suites that are otherwise skipped", () => {
    expect(workflow).toContain('ESTIMETR_DB_TESTS: "1"');
  });

  it("applies migrations before running them, or the schema under test is empty", () => {
    const migrateAt = workflow.indexOf("pnpm db:migrate");
    const suitesAt = workflow.indexOf('ESTIMETR_DB_TESTS: "1"');
    expect(migrateAt).toBeGreaterThan(-1);
    expect(suitesAt).toBeGreaterThan(migrateAt);
  });

  it("runs on feature branches, where the commits actually land", () => {
    expect(workflow).toContain("feature/**");
  });
});

describe("check-roadmap compares the pointer with its versioned file", () => {
  const created: string[] = [];

  afterEach(() => {
    for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function fixture(pointer: unknown, versioned: unknown, versionedName = "roadmap.v0.1.0.json") {
    const root = mkdtempSync(path.join(tmpdir(), "roadmap-check-"));
    created.push(root);
    mkdirSync(path.join(root, "docs/roadmap"), { recursive: true });
    writeFileSync(path.join(root, "docs/roadmap/roadmap.json"), JSON.stringify(pointer, null, 2));
    if (versioned !== undefined) {
      writeFileSync(path.join(root, "docs/roadmap", versionedName), JSON.stringify(versioned, null, 2));
    }
    return root;
  }

  function run(root: string) {
    try {
      const stdout = execFileSync(
        process.execPath,
        [path.join(repoRoot, "scripts/check-roadmap.mjs"), root],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
      );
      return { code: 0, output: stdout };
    } catch (error) {
      const failure = error as { status: number; stderr: string };
      return { code: failure.status, output: failure.stderr };
    }
  }

  const plan = { version: "0.1.0", updatedAt: "2026-08-23T00:00:00+07:00", items: [{ id: "IP-001" }] };

  it("accepts a pointer that matches its versioned file", () => {
    const result = run(fixture(plan, plan));
    expect(result.code).toBe(0);
    expect(result.output).toContain("matches roadmap.v0.1.0.json");
  });

  it("refuses a pointer edited without a new version, which is how fae066b slipped through", () => {
    const edited = { ...plan, updatedAt: "2026-08-23T20:10:00+07:00" };
    const result = run(fixture(edited, plan));
    expect(result.code).toBe(1);
    expect(result.output).toContain("drifted");
  });

  it("refuses a version with no versioned file at all", () => {
    const result = run(fixture(plan, undefined));
    expect(result.code).toBe(1);
    expect(result.output).toContain("does not exist");
  });

  it("still refuses a pointer missing version, updatedAt or items", () => {
    const result = run(fixture({ version: "0.1.0" }, plan));
    expect(result.code).toBe(1);
    expect(result.output).toContain("version, updatedAt and items");
  });

  it("passes against the repository as it stands", () => {
    const result = run(repoRoot);
    expect(result.code).toBe(0);
  });
});
