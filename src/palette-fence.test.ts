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

/**
 * ตัดคอมเมนต์ทิ้งก่อนตรวจ — คำอธิบายไม่ใช่การประกาศสี
 *
 * เคยเกิดขึ้นแล้วสองครั้งในโปรเจกต์นี้ ครั้งแรกกับด่านห้าม `await import()` ใน v0.94.0
 * และครั้งนี้กับคอมเมนต์ที่อธิบายว่าทำไม token ตัวเลขถึงไม่ควรขึ้นต้นด้วย `#` — ตัวอย่างที่
 * ยกมาประกอบคำอธิบายดันมีหน้าตาเหมือนเลขสี **คำวินิจฉัยเดิมคือแก้ด่านให้ตัดคอมเมนต์
 * ก่อนตรวจ ไม่ใช่ลบคำอธิบายทิ้งเพื่อให้เขียว** กฎที่ห้ามเขียนโค้ดแบบหนึ่งไม่ควรยิงใส่
 * คำอธิบายว่าทำไมถึงห้าม
 *
 * ตัดแบบหยาบโดยตั้งใจ: คอมเมนต์บรรทัดเดียว และคอมเมนต์แบบบล็อกเท่านั้น ไม่พยายามเข้าใจ
 * สตริงที่มีเครื่องหมายคอมเมนต์อยู่ข้างใน เพราะการตัดเกินไปในไฟล์ที่ไม่มีสีอยู่แล้วไม่เสียหาย
 * ส่วนการตัดพลาดจนปล่อยสีจริงผ่านต่างหากที่เสียหาย ซึ่งมีเทสต์ข้างล่างดักไว้แล้ว
 *
 * แทนที่ตัวอักษรในบล็อกด้วยช่องว่างแทนการลบทิ้ง เพื่อให้เลขบรรทัดที่รายงานยังตรงกับไฟล์จริง
 */
export function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
}

export function findColourLiterals(content: string): { line: number; snippet: string }[] {
  const hits: { line: number; snippet: string }[] = [];
  const scannable = stripComments(content).split("\n");
  content.split("\n").forEach((line, index) => {
    if (COLOUR_LITERAL.test(scannable[index] ?? "")) hits.push({ line: index + 1, snippet: line.trim().slice(0, 90) });
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

  it("มองข้ามคำอธิบาย แต่ยังกัดโค้ดในบรรทัดถัดไปเสมอ", () => {
    const source = [
      "// อธิบายว่าทำไมห้ามเขียน #a1b2c3 ตรง ๆ",
      "const good = 'var(--teal)';",
      "const bad = '#a1b2c3';"
    ].join("\n");
    const hits = findColourLiterals(source);
    // บรรทัดคำอธิบายไม่ถูกนับ แต่บรรทัดที่ฝังสีจริงต้องถูกนับ และเลขบรรทัดต้องยังตรง
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(3);
  });

  it("บัญชียกเว้นต้องชี้ไฟล์ที่มีอยู่จริง — รายการค้างของไฟล์ที่ถูกลบคือรูของรั้ว", () => {
    for (const rel of EXEMPT.keys()) {
      expect(existsSync(join(process.cwd(), rel)), `${rel} หายไปจากรีโปแล้ว ให้ถอนออกจากบัญชียกเว้น`).toBe(true);
    }
  });
});
