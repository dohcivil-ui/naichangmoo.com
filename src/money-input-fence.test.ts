import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ด่านเฝ้าช่องกรอกจำนวนเงิน
 *
 * มีอยู่เพราะบั๊กเดียวกันรอดมาสองรุ่น ช่อง "ค่างาน (บาท)" ในตารางรายการงานแคบกว่าจำนวนเงิน
 * ที่พิมพ์ลงไปได้จริง บันทึกส่งงานสองฉบับจดไว้ว่า "ยังไม่ได้แก้" แล้วก็ผ่านไปทั้งสองครั้ง
 * เพราะไม่มีอะไรร้อง วัดของจริงในเบราว์เซอร์เมื่อ 2026-08-29 พบว่าแม้แต่ค่าตั้งต้นของแผนตัวอย่าง
 * 1,407,697,000.00 ก็ถูกตัดไปแล้ว 6.11px ส่วนสิบสามหลักขาด 33.78px
 *
 * ด่านนี้ตรวจสองข้อที่ทำให้บั๊กกลับมาไม่ได้เงียบ ๆ คือช่องเงินทุกช่องต้องติดคลาสของมัน
 * และคลาสนั้นต้องกว้างเป็นหน่วย ch ไม่ใช่ px เพราะ ch คือความกว้างของเลขศูนย์ในฟอนต์ของช่องเอง
 * วันที่ใครเปลี่ยนฟอนต์หรือขนาดตัวอักษร ช่องจะโตตามโดยไม่ต้องมีใครจำเลขวิเศษได้
 */

const root = process.cwd();
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

/** สิบสามหลักกับสตางค์ 1,234,567,890,123.00 คือ 16 ตัวเลข 4 ลูกน้ำ 1 จุด */
const MINIMUM_CH = 20;

/** ตัวตรวจตัวจริง แยกออกมาเพื่อให้ยิงโค้ดละเมิดใส่มันได้ ไม่ใช่แค่เชื่อว่ามันทำงาน */
function moneyInputsMissingClass(source: string): string[] {
  const inputs = source.match(/<input\b[\s\S]*?\/>/g) ?? [];
  return inputs.filter((tag) => /value=\{formatBaht\(/.test(tag)).filter((tag) => !tag.includes("work-plan__cell--money"));
}

function moneyInputCount(source: string): number {
  const inputs = source.match(/<input\b[\s\S]*?\/>/g) ?? [];
  return inputs.filter((tag) => /value=\{formatBaht\(/.test(tag)).length;
}

describe("ด่านเฝ้าช่องกรอกจำนวนเงิน", () => {
  it("ช่องกรอกที่แสดงจำนวนเงินต้องติดคลาสความกว้างของเงินเสมอ", () => {
    const source = read("src/components/prototype/work-plan-workspace.tsx");
    expect(moneyInputCount(source)).toBeGreaterThan(0);
    expect(moneyInputsMissingClass(source)).toEqual([]);
  });

  it("คลาสความกว้างของเงินประกาศเป็น ch และกว้างพอสำหรับสิบสามหลักกับสตางค์", () => {
    const css = read("src/app/globals.css");
    const rule = css.match(/\.work-plan__cell--money\s*\{([^}]*)\}/);
    expect(rule, "ไม่พบกฎ .work-plan__cell--money ใน globals.css").not.toBeNull();

    const declared = rule![1].match(/min-width:\s*([\d.]+)ch/);
    expect(declared, "ความกว้างของช่องเงินต้องเป็นหน่วย ch ไม่ใช่ px").not.toBeNull();
    expect(Number(declared![1])).toBeGreaterThanOrEqual(MINIMUM_CH);
  });

  it("ด่านนี้กัดจริง — ยิงช่องเงินที่ลืมติดคลาสใส่ตัวตรวจแล้วต้องถูกจับ", () => {
    const offender = `<input className="work-plan__cell work-plan__cell--number" value={formatBaht(activity.costSatang)} />`;
    expect(moneyInputsMissingClass(offender)).toHaveLength(1);
  });

  it("ด่านนี้ไม่หอนใส่ของที่ถูกต้อง", () => {
    const good = `<input className="work-plan__cell work-plan__cell--number work-plan__cell--money" value={formatBaht(activity.costSatang)} />`;
    expect(moneyInputsMissingClass(good)).toEqual([]);
    const unrelated = `<input className="work-plan__cell" value={activity.title} />`;
    expect(moneyInputCount(unrelated)).toBe(0);
  });
});
