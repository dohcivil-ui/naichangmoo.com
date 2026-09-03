import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * IP-088. ADR 0013 closes a list of tables to the administrator, and until now that was true only
 * because nobody had written the query. This asserts the property at the source level, which is
 * where the guarantee actually lives: what must be impossible is not "the call is refused" but
 * "the path does not exist".
 *
 * A runtime test would need an administrator session and a database, and would still only prove
 * that the one path it exercised was blocked. This fails the moment anyone adds a column read of a
 * customer's work anywhere in the back office, which is the failure worth catching.
 */

const CLOSED_TABLES = [
  "projects",
  "drawingDocuments",
  // IP-233: สเกลที่ลูกค้ายืนยันเอง แนวเสาที่เขาร่างเอง และจุดที่เขาค้างอยู่บนแบบ
  // เป็นงานของเขาล้วน หลังบ้านไม่มีเหตุผลใดที่ต้องอ่าน — เหตุผลเดียวกับ takeoffItems
  "drawingCalibrations",
  "drawingViewStates",
  // IP-234: รอยที่ลูกค้าวาดบนแบบ ยังไม่ใช่ปริมาณด้วยซ้ำ เหตุผลเดียวกับสามบรรทัดบน
  "drawingMarks",
  "takeoffRuns",
  "takeoffGroups",
  "takeoffItems",
  "takeoffMeasurements",
  "evidenceReferences",
  "priceSets",
  // IP-163: ชุดราคาที่ส่งเข้าโครงการแล้ว และตะกร้าที่ยังหยิบอยู่ ทั้งคู่คืองานของลูกค้า
  // หลังบ้านจัดการสิทธิ์ ไม่ใช่จัดการงาน — เหตุผลเดียวกับ priceSets ที่อยู่บรรทัดบน
  "priceSetLines",
  "priceBaskets",
  "priceBasketLines",
  "priceObservations",
  "priceCatalogueItems",
  "estimateRevisions"
] as const;

/**
 * The one exception ADR 0013 grants: counting is not reading. The metrics module may name
 * `projects` to count rows, and the last assertion below holds it to counting only.
 */
const MAY_NAME_A_CLOSED_TABLE = new Set(["src/server/platform-admin-metrics.ts"]);

const ADMIN_ROOTS = ["src/server/admin", "src/app/admin", "src/components/admin"];

const ADMIN_FILES = [
  "src/server/platform-admin.ts",
  "src/server/platform-admin-metrics.ts",
  "src/server/actions/admin-entitlement.ts",
  "src/server/actions/admin-apps.ts",
  // Shared with the public pricing page, but reachable from the back office and writable by an
  // administrator, so it is held to the same rule. A module outside this list is a module outside
  // the guard.
  "src/server/app-registry.ts"
];

/**
 * Prose is not code. Every one of these files explains in a comment which tables it must not
 * touch, so a scanner that cannot tell a comment from a query would fail on the documentation
 * describing the rule — and a test that cries wolf gets deleted within the week.
 */
function stripComments(source: string): string {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, " ");
  return withoutBlocks
    .split("\n")
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n");
}

/**
 * The table as an identifier, never as somebody else's property. `metrics.projects` is a count
 * carried on a result object and has nothing to do with the drizzle table of the same name.
 */
function namesTable(source: string, table: string): boolean {
  return new RegExp(String.raw`(?<![.\w])${table}\b`).test(source);
}

/** A column read — `projects.name` — as opposed to `.from(projects)`, which only counts rows. */
function readsColumn(source: string, table: string): boolean {
  return new RegExp(String.raw`(?<![.\w])${table}\.[A-Za-z_]`).test(source);
}

function collect(dir: string, found: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collect(full, found);
      continue;
    }
    if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue;
    found.push(full.replace(/\\/g, "/"));
  }
  return found;
}

const adminSources = [...ADMIN_ROOTS.flatMap((root) => collect(root)), ...ADMIN_FILES].sort();

describe("the back office cannot reach a customer's work", () => {
  it("scans a back office that actually exists", () => {
    // Guards the guard: a path typo would make every assertion below pass against nothing.
    expect(adminSources.length).toBeGreaterThan(5);
    expect(adminSources).toContain("src/server/admin/entitlement-admin.ts");
    expect(adminSources).toContain("src/app/admin/entitlements/page.tsx");
  });

  it("can tell a comment from a query", () => {
    // The scanner's own claim, tested. Without this the suite could pass by seeing nothing at all.
    const prose = "// this module must never read projects.name\nconst x = 1;";
    expect(namesTable(stripComments(prose), "projects")).toBe(false);
    expect(namesTable(stripComments("const rows = db.select().from(projects);"), "projects")).toBe(true);
    expect(readsColumn(stripComments("eq(projects.organizationId, id)"), "projects")).toBe(true);
    expect(readsColumn(stripComments("metrics.projects.toLocaleString()"), "projects")).toBe(false);
  });

  it.each(adminSources)("%s reads no column of a closed table", (file) => {
    const source = stripComments(readFileSync(file, "utf8"));
    const offenders = CLOSED_TABLES.filter((table) => readsColumn(source, table));
    expect(offenders).toEqual([]);
  });

  it.each(adminSources)("%s does not even name a closed table, unless counting", (file) => {
    if (MAY_NAME_A_CLOSED_TABLE.has(file)) return;
    const source = stripComments(readFileSync(file, "utf8"));
    const offenders = CLOSED_TABLES.filter((table) => namesTable(source, table));
    expect(offenders).toEqual([]);
  });

  it("holds the counting exception to counting", () => {
    const source = stripComments(readFileSync("src/server/platform-admin-metrics.ts", "utf8"));

    // It may say `.from(projects)` to count rows...
    expect(source).toMatch(/\.from\(projects\)/);
    // ...and never read a column off it, which is what would turn a count into a disclosure.
    expect(readsColumn(source, "projects")).toBe(false);
    // And no other closed table appears at all.
    const others = CLOSED_TABLES.filter((table) => table !== "projects" && namesTable(source, table));
    expect(others).toEqual([]);
  });
});
