import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ด่านตรวจข้อมูลภายในรั่ว (Leak Fence) — คำสั่งเจ้าของงาน 2026-08-28
 *
 * โรดแมป เลขงาน IP เลขรุ่น และเอกสารส่งต่องาน เป็นครัวหลังบ้าน ห้ามโชว์ชาวบ้านเด็ดขาด
 * เทสต์นี้เดินอ่านไฟล์หน้าจอโซนสาธารณะจริง (src/app + src/components ยกเว้นโซน admin)
 * แล้วหา pattern ภายในใน**โค้ดที่ render จริง** — คอมเมนต์ถูกตัดออกก่อน เพราะเลข IP
 * ในคอมเมนต์คือประวัติที่ถูกต้อง ไม่ใช่การรั่ว (มันไม่ถูกส่งไปเบราว์เซอร์)
 */

const ROOT = join(process.cwd(), "src");
const PUBLIC_ZONES = ["app", "components"];
const ADMIN_ZONES = ["app/admin", "app/api/admin", "components/admin"].map((zone) => zone.replaceAll("/", "|"));

/** pattern ครัวหลังบ้านที่ห้ามโผล่ในโค้ดหน้าสาธารณะ */
const LEAKS: { name: string; pattern: RegExp }[] = [
  { name: "เลขงานภายใน IP-xxx", pattern: /\bIP-[0-9]+\b/ },
  { name: "คำว่า handoff", pattern: /handoff/i },
  { name: "เลขรุ่นภายใน v0.x.y", pattern: /\bv0\.[0-9]+\.[0-9]+\b/ },
  { name: "path เอกสารภายใน", pattern: /docs\/[a-z-]+/ }
];

/** ตัดคอมเมนต์ทุกแบบออก — เหลือเฉพาะโค้ดที่กลายเป็นของจริงบนเบราว์เซอร์ */
export function withoutComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function publicSourceFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const rel = full.slice(ROOT.length + 1).replaceAll("\\", "|").replaceAll("/", "|");
      if (statSync(full).isDirectory()) {
        if (ADMIN_ZONES.some((zone) => rel === zone || rel.startsWith(zone + "|"))) continue;
        walk(full);
      } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
        found.push(full);
      }
    }
  };
  for (const zone of PUBLIC_ZONES) walk(join(ROOT, zone));
  return found;
}

describe("ด่านตรวจข้อมูลภายในรั่ว (Leak Fence)", () => {
  it("โค้ดหน้าสาธารณะต้องไม่มีเลขงาน เลขรุ่น หรือคำครัวหลังบ้าน", () => {
    const offenders: string[] = [];
    for (const full of publicSourceFiles()) {
      const rel = full.slice(process.cwd().length + 1).replaceAll("\\", "/");
      const code = withoutComments(readFileSync(full, "utf8"));
      for (const leak of LEAKS) {
        const match = code.match(leak.pattern);
        if (match) offenders.push(`${rel} → ${leak.name} ("${match[0]}")`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("ตัวตรวจเองต้องยังกัด: รั่วในโค้ดถูกจับ รั่วในคอมเมนต์ถูกปล่อย", () => {
    // IP-091: ตัวตรวจที่ไม่เคยถูกพิสูจน์ว่าจับได้ ถือว่าไม่มีตัวตรวจ
    const inCode = 'const label = "งาน IP-197 รุ่น v0.85.0 ดู docs/research และ Handoff";';
    const stripped = withoutComments(inCode);
    expect(LEAKS.filter((leak) => leak.pattern.test(stripped)).length).toBe(4);

    const inComment = "// IP-197 v0.85.0 docs/handoff\n{/* handoff IP-1 */}\nconst x = 1;";
    const cleaned = withoutComments(inComment);
    expect(LEAKS.filter((leak) => leak.pattern.test(cleaned)).length).toBe(0);
  });
});
