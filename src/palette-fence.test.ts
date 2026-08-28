import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * รั้วสี — ADR 0021
 *
 * เปิดหน้าไหนสีก็ต้องไม่เพี้ยน: ค่าสีจริงประกาศได้ที่ครัวกลาง (globals.css) ที่เดียว
 * ไฟล์อื่นทั้ง src ห้ามฝังเลขสีดิบ ต้องตักจากกระปุก var(--...) เสมอ เทสต์นี้เดินอ่าน
 * ไฟล์จริงทุกไฟล์ ไม่ใช่เช็กลิสต์ที่เขียนไว้เฉย ๆ — เพิ่มไฟล์ใหม่แล้วแอบฝังสี เทสต์แดงทันที
 *
 * ห้ามแก้บัญชียกเว้นเพื่อให้งานของตัวเองผ่าน: การเพิ่มข้อยกเว้นโดยชอบต้องมีเหตุผล
 * กำกับเป็นรายไฟล์ และเหตุผลนั้นต้องเป็นจริงตาม ADR 0021 (เช่น เป็นไฟล์กราฟ/จานสี)
 */

/** ที่เดียวที่ประกาศค่าสีจริงได้ ตามหน้าที่ของไฟล์ ไม่ใช่ตามความสะดวก */
const EXEMPT: ReadonlyMap<string, string> = new Map([
  ["src/app/globals.css", "ครัวกลาง — บ้านของกระปุกสีทุกใบ"],
  ["src/app/document-print.css", "เอกสารพิมพ์ A4 อิงระเบียบงานสารบรรณ ไม่ใช่ธีมเว็บ"],
  ["src/components/prototype/price-workspace.tsx", "จานสีหมวดวัสดุ 21 เนื้อสี คำนวณจากตัวแปร — กราฟฟรีจริงตามคำวินิจฉัยเจ้าของงาน 2026-08-28"],
  ["src/palette-fence.test.ts", "ไฟล์นี้เอง — พก pattern ของสีไว้ใช้ตรวจ"]
]);

/** เลขสีดิบทุกรูปแบบที่ browser อ่านเป็นสี: hex, rgb(), rgba(), hsl(), hsla(), oklch(), oklab() */
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\(/;

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSourceFiles(full));
    else if (/\.(ts|tsx|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

export function findColourLiterals(content: string): { line: number; snippet: string }[] {
  const hits: { line: number; snippet: string }[] = [];
  content.split("\n").forEach((line, index) => {
    if (COLOUR_LITERAL.test(line)) hits.push({ line: index + 1, snippet: line.trim().slice(0, 90) });
  });
  return hits;
}

describe("รั้วสี (ADR 0021)", () => {
  it("ไฟล์นอกครัวกลางต้องไม่ฝังเลขสีดิบ — สีทุกค่าตักจากกระปุก var(--...)", () => {
    const violations: string[] = [];
    for (const full of listSourceFiles(join(process.cwd(), "src"))) {
      const rel = full.slice(process.cwd().length + 1).replaceAll("\\", "/");
      if (EXEMPT.has(rel)) continue;
      for (const hit of findColourLiterals(readFileSync(full, "utf8"))) {
        violations.push(`${rel}:${hit.line} → ${hit.snippet}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("ตัวตรวจเองต้องยังกัด: เจอสีดิบทุกรูปแบบที่วางกับดักไว้", () => {
    // IP-091: ตัวตรวจที่ไม่เคยถูกพิสูจน์ว่าจับได้ ถือว่าไม่มีตัวตรวจ
    const trap = [
      'color: "#a1b2c3"',
      "background: rgb(1, 2, 3)",
      "border-color: rgba(0,0,0,.5)",
      "fill: hsl(180 50% 50%)",
      "stroke: oklch(0.6 0.1 180)"
    ].join("\n");
    expect(findColourLiterals(trap)).toHaveLength(5);
    expect(findColourLiterals("color: var(--teal); background: var(--paper);")).toHaveLength(0);
  });

  it("บัญชียกเว้นต้องชี้ไฟล์ที่มีอยู่จริง — รายการค้างของไฟล์ที่ถูกลบคือรูของรั้ว", () => {
    for (const rel of EXEMPT.keys()) {
      expect(existsSync(join(process.cwd(), rel)), `${rel} หายไปจากรีโปแล้ว ให้ถอนออกจากบัญชียกเว้น`).toBe(true);
    }
  });
});
