import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

/**
 * Pull every Factor F table out of a Comptroller General's Department circular.
 * Every number here ends up multiplying a real cost of work, so the extractor
 * checks itself rather than trusting the parse: the VAT column must be the
 * Factor column times 1.07, each table must carry a distinct advance/retention
 * pair, and each work type must have exactly twelve tables.
 */

const file = process.argv[2];
const out = process.argv[3];

const bytes = readFileSync(file);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;

const rowsOf = async (n) => {
  const page = await doc.getPage(n);
  const content = await page.getTextContent();
  const buckets = new Map();
  for (const item of content.items) {
    if (!item.str || !item.str.trim()) continue;
    const y = Math.round(item.transform[5]);
    const key = [...buckets.keys()].find((k) => Math.abs(k - y) <= 3) ?? y;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push({ x: item.transform[4], s: item.str.trim() });
  }
  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, cells]) => cells.sort((a, b) => a.x - b.x).map((c) => c.s).join(" "));
};

const WORK_TYPES = [
  { from: 4, to: 15, key: "building", label: "งานก่อสร้างอาคาร" },
  { from: 17, to: 28, key: "road", label: "งานก่อสร้างทาง" },
  { from: 30, to: 41, key: "bridge_box_culvert", label: "งานก่อสร้างสะพานและท่อเหลี่ยม" },
  { from: 43, to: 54, key: "irrigation", label: "งานก่อสร้างชลประทาน" },
];

const problems = [];
const tables = [];

for (const work of WORK_TYPES) {
  for (let p = work.from; p <= work.to; p++) {
    const lines = await rowsOf(p);
    const text = lines.join("\n");

    const cond = text.match(/ล่วงหน้า\s*\|?\s*(\d+)\s*%[\s\S]*?ดอกเบี้ยเงินกู้\s*\|?\s*(\d+)\s*%/);
    const ret = text.match(/ประกันผลงาน\s*\|?\s*(\d+)\s*%[\s\S]*?ภาษีมูลค่าเพิ่ม[\s\S]*?(\d+)\s*%/);
    if (!cond || !ret) { problems.push(`page ${p}: conditions not found`); continue; }

    const advance = Number(cond[1]);
    const interest = Number(cond[2]);
    const retention = Number(ret[1]);
    const vat = Number(ret[2]);

    const rows = [];
    for (const line of lines) {
      // "≤ 0.5 1.2218 1.3073" / "2 1.2182 1.3034" / irrigation adds two more columns
      const m = line.match(/^(≤\s*|>\s*)?([\d.]+)\s+((?:[\d.]+\s*){2,4})$/);
      if (!m) continue;
      const nums = m[3].trim().split(/\s+/).map(Number);
      if (nums.length < 2 || nums.some((v) => !(v > 1 && v < 2))) continue;
      rows.push({
        bound: m[1]?.trim() === "≤" ? "at_or_below" : m[1]?.trim() === ">" ? "above" : "exact",
        costMillionBaht: Number(m[2]),
        factor: nums[0],
        factorWithVat: nums[1],
        ...(nums.length === 4 ? { factorHeavyRain1: nums[2], factorHeavyRain2: nums[3] } : {}),
      });
    }

    // Self-check: the VAT column is the factor column plus 7%, computed before rounding.
    for (const r of rows) {
      const expected = r.factor * (1 + vat / 100);
      if (Math.abs(expected - r.factorWithVat) > 0.0002) {
        problems.push(`page ${p} row ${r.costMillionBaht}: ${r.factor} x ${1 + vat / 100} = ${expected.toFixed(6)}, table says ${r.factorWithVat}`);
      }
      if (r.factorHeavyRain1 !== undefined && !(r.factorHeavyRain1 > r.factorWithVat && r.factorHeavyRain2 > r.factorHeavyRain1)) {
        problems.push(`page ${p} row ${r.costMillionBaht}: heavy-rain factors are not increasing`);
      }
    }

    tables.push({ workType: work.key, workTypeLabel: work.label, page: p, advancePercent: advance, retentionPercent: retention, interestPercent: interest, vatPercent: vat, rows });
  }
}

for (const work of WORK_TYPES) {
  const mine = tables.filter((t) => t.workType === work.key);
  if (mine.length !== 12) problems.push(`${work.key}: ${mine.length} tables, expected 12`);
  const pairs = new Set(mine.map((t) => `${t.advancePercent}/${t.retentionPercent}`));
  if (pairs.size !== mine.length) problems.push(`${work.key}: duplicate advance/retention pairs`);
  const rates = new Set(mine.map((t) => t.interestPercent));
  if (rates.size !== 1) problems.push(`${work.key}: mixed interest rates ${[...rates]}`);
  const counts = new Set(mine.map((t) => t.rows.length));
  if (counts.size !== 1) problems.push(`${work.key}: row counts differ ${[...counts]}`);
}

console.log(`sha256 ${sha256}`);
console.log(`tables ${tables.length}, rows ${tables.reduce((n, t) => n + t.rows.length, 0)}`);
console.log(`rows per table: ${[...new Set(tables.map((t) => `${t.workType}=${t.rows.length}`))].join(", ")}`);
if (problems.length) { console.log(`\nPROBLEMS (${problems.length}):`); problems.slice(0, 25).forEach((p) => console.log(" -", p)); }
else console.log("\nall self-checks passed");

if (out) { writeFileSync(out, JSON.stringify({ sha256, tables }, null, 2)); console.log(`\nwrote ${out}`); }
