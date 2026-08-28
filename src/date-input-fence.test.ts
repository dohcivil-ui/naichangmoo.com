import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ด่านตรวจปฏิทินเลือกวันที่ (IP-202) — คำสั่งเจ้าของงาน 2026-08-28:
 * ช่องกรอกวันที่ทั้งเว็บต้องเป็นเดือนไทย ปี พ.ศ. ผ่าน ThaiDateField เท่านั้น
 * native date input โชว์ ค.ศ. ตามภาษาเครื่อง ทำให้คนทำแผนงานมั่ว — ห้ามงอกกลับ
 * ด่านนี้ประกาศได้เพราะทั้ง 6 จุดถูกย้ายครบแล้ว ด่านที่มีข้อยกเว้นคือด่านที่ไม่กัด
 */

const ROOT = join(process.cwd(), "src");
const FORBIDDEN = /type="(date|datetime-local|month)"/;

export function findNativeDateInputs(source: string): number[] {
  const hits: number[] = [];
  source.split("\n").forEach((line, index) => {
    if (FORBIDDEN.test(line)) hits.push(index + 1);
  });
  return hits;
}

function componentFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...componentFiles(full));
    else if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) found.push(full);
  }
  return found;
}

describe("ด่านตรวจปฏิทินเลือกวันที่ (IP-202)", () => {
  it("ไม่มี native date input เหลือในหน้าจอ — ทุกช่องวันที่ใช้ ThaiDateField", () => {
    const offenders: string[] = [];
    for (const full of componentFiles(ROOT)) {
      const rel = full.slice(process.cwd().length + 1).replaceAll("\\", "/");
      for (const line of findNativeDateInputs(readFileSync(full, "utf8"))) {
        offenders.push(`${rel}:${line} — ใช้ ThaiDateField จาก @/components/ui/thai-date-field แทน`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("ตัวตรวจเองต้องยังกัด: ทุกรูปแบบที่วางกับดักไว้ถูกจับ", () => {
    // IP-091: ตัวตรวจที่ไม่เคยถูกพิสูจน์ว่าจับได้ ถือว่าไม่มีตัวตรวจ
    const trap = '<input type="date" />\n<input type="datetime-local" />\n<input type="month" />';
    expect(findNativeDateInputs(trap)).toEqual([1, 2, 3]);
    expect(findNativeDateInputs('<input type="text" inputMode="numeric" />')).toEqual([]);
  });
});
