import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { landingActionContract, landingNavigationContract } from "@/lib/landing-interactions";

/**
 * IP-124. One destination had collected five names — กลับหน้ารวมแอป, กลับหน้า Landing, กลับหน้าแรก,
 * ดูเว็บไซต์ and กลับไปดูทุกแอป — because every page that needed a way back typed its own, and
 * nothing in the project could tell that the sixth one was a sixth one.
 *
 * The contract now owns both labels, and this holds the property at the source level, the same way
 * closed-tables.test.ts holds ADR 0013. A test that only checked the contract would pass while a
 * page quietly typed its own string beside it, which is exactly how the drift happened.
 */

const RETIRED_LABELS = [
  "กลับหน้ารวมแอป",
  "กลับหน้า Landing",
  "ดูเว็บไซต์",
  "กลับไปดูทุกแอป",
  "กลับหน้าแรก"
] as const;

function sourceFiles(root: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path));
      continue;
    }
    if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) found.push(path);
  }
  return found;
}

/** Comments are where the history is written down, and it is worth keeping. Only rendered text counts. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("there is one way home and it is called the same thing everywhere", () => {
  it("puts a labelled home link first in the navigation, not only on the logo", () => {
    expect(landingNavigationContract[0]).toEqual({ id: "home", label: "หน้าแรก", href: "/" });
  });

  it("names exactly one navigation entry per destination", () => {
    const hrefs = landingNavigationContract.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("holds both labels beside their destinations so a page never has to invent one", () => {
    expect(landingActionContract.homeLabel).toBe("หน้าแรก");
    expect(landingActionContract.allAppsLabel).toBe("แอปทั้งหมด");
    expect(landingActionContract.homeHref).toBe("/");
    expect(landingActionContract.allAppsHref).toBe("/#apps");
  });

  it("leaves no retired wording rendered anywhere in src", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles("src")) {
      const body = withoutComments(readFileSync(file, "utf8"));
      for (const label of RETIRED_LABELS) {
        if (body.includes(label)) offenders.push(`${file.replace(/\\/g, "/")} → ${label}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
