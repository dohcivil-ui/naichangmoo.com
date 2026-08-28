import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ด่านตรวจเส้นทางผู้ช่วย (กฎ G5) — IP-184
 *
 * เส้นทางเก่าของ work-plan เคยเรียกแบบจำลองตรง (askForJson) โดยไม่ผ่านประตูกลาง:
 * ไม่มีโควตา ไม่มีบันทึกตรวจสอบ ไม่ตรวจสิทธิ์ รุ่นนี้ลบทิ้งแล้ว — ด่านนี้ปิดทางไม่ให้
 * เส้นทางแบบนั้นงอกกลับในแอปไหนอีก: ตัวเรียกแบบจำลอง (askForJson / askWithFallback)
 * ถูก import ได้เฉพาะใต้ src/server/ai เท่านั้น
 */

const ROOT = join(process.cwd(), "src");
const CALLER_PATTERN = /import\s[^;]*\b(askForJson|askWithFallback)\b[^;]*from/;

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) found.push(full);
  }
  return found;
}

describe("ด่านตรวจเส้นทางผู้ช่วย (G5, IP-184)", () => {
  it("askForJson/askWithFallback ถูก import ได้เฉพาะใต้ src/server/ai — ทุกแอปต้องเดินประตูกลาง", () => {
    const offenders: string[] = [];
    for (const full of sourceFiles(ROOT)) {
      const rel = full.slice(ROOT.length + 1).replaceAll("\\", "/");
      if (rel.startsWith("server/ai/")) continue;
      if (CALLER_PATTERN.test(readFileSync(full, "utf8"))) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it("ตัวตรวจเองต้องยังกัด: import ตัวเรียกแบบจำลองในไฟล์นอกโซนถูกจับ", () => {
    // IP-091: ตัวตรวจที่ไม่เคยถูกพิสูจน์ว่าจับได้ ถือว่าไม่มีตัวตรวจ
    expect(CALLER_PATTERN.test('import { askForJson } from "@/server/ai/provider";')).toBe(true);
    expect(CALLER_PATTERN.test('import { askWithFallback } from "@/server/ai/failover";')).toBe(true);
    expect(CALLER_PATTERN.test('import { runAssistant } from "@/server/ai/assistant";')).toBe(false);
  });
});
