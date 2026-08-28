import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ด่านตรวจ Assistant Dock (แผงผู้ช่วยกลาง) — IP-185
 *
 * "แผงผู้ช่วยกลางต้องมีช่องเดียวใน AppShell ไม่ใช่เจ็ดช่องเจ็ดแบบ" (ai-assistant-design.md ข้อ 5
 * บทเรียน gl-platbar) — บทเรียนที่เป็นแค่คำเตือนจะถูกลืม เทสต์นี้ทำให้มันเป็นด่าน:
 * เดินอ่านซอร์สจริงทั้ง src แบบ way-home.test.ts
 */

const ROOT = join(process.cwd(), "src");
const DOCK_COMPONENT = join("components", "platform", "assistant-dock.tsx").replaceAll("\\", "/");

function sourceFiles(root: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) found.push(...sourceFiles(path));
    else if (/\.(tsx?|css)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) found.push(path);
  }
  return found;
}

describe("ด่านตรวจแผงผู้ช่วยกลาง (IP-185)", () => {
  it("คลาส assistant-dock ปรากฏได้เฉพาะคอมโพเนนต์กลางกับ globals.css — ห้ามใครเขียนแผงเลียนแบบ", () => {
    // จับเฉพาะการใช้เป็นคลาส (BEM ลูก หรือ className ราก) — import path กับชื่อคีย์เก็บสถานะ
    // ไม่ใช่การเขียนแผงเลียนแบบ จึงไม่นับ
    const MIMIC = /assistant-dock__|className="assistant-dock[" ]/;
    const allowed = new Set([DOCK_COMPONENT, "app/globals.css"]);
    const offenders: string[] = [];
    for (const full of sourceFiles(ROOT)) {
      const rel = full.slice(ROOT.length + 1).replaceAll("\\", "/");
      if (allowed.has(rel)) continue;
      if (MIMIC.test(readFileSync(full, "utf8"))) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it("AppShell ห่อเนื้อหาด้วย AssistantDockHost — แอปเข้าถึงแผงผ่านเปลือกเท่านั้น", () => {
    const shell = readFileSync(join(ROOT, "components/platform/app-shell.tsx"), "utf8");
    expect(shell).toContain("AssistantDockHost");
    expect(shell).toMatch(/<AssistantDockHost>[\s\S]*\{children\}[\s\S]*<\/AssistantDockHost>/);
  });

  it("ท้ายเว็บอยู่นอกกรอบที่แผงดัน — ไม่งั้นพื้นหลังจะกว้างไม่เต็มจอ เหลือแถบขาวข้างขวา", () => {
    // เจ้าของงานเจอของจริง 2026-08-28: footer อยู่ในกรอบที่ถูกดัน จึงกว้าง 1106.6px แทนที่จะเต็ม 1502.6px
    // footer เป็นของแพลตฟอร์ม ไม่ใช่เนื้องานของแอป จึงไม่ควรโดนดันไปกับเนื้องาน
    const shell = readFileSync(join(ROOT, "components/platform/app-shell.tsx"), "utf8");
    const closesHost = shell.indexOf("</AssistantDockHost>");
    const rendersFooter = shell.indexOf("<PlatformFooter />");
    expect(closesHost).toBeGreaterThan(-1);
    expect(rendersFooter).toBeGreaterThan(closesHost);
  });

  it("แผงรู้ตำแหน่งท้ายเว็บ — ยกตัวหยุดเหนือแทนที่จะยาวลงไปทับ", () => {
    const dock = readFileSync(join(ROOT, DOCK_COMPONENT), "utf8");
    expect(dock).toContain('document.querySelector("footer")');
    expect(dock).toContain('"--dock-bottom"');
    const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");
    expect(css).toMatch(/\.assistant-dock \{[^}]*bottom:\s*var\(--dock-bottom/);
  });

  it("แผงต้องนิ่งสนิทใต้ prefers-reduced-motion — ประกาศชัดใน globals.css ไม่พึ่งบล็อกกลางอย่างเดียว", () => {
    const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");
    const reduced = css.slice(css.indexOf(".assistant-dock"));
    expect(reduced).toMatch(/prefers-reduced-motion[\s\S]*\.assistant-dock\.is-busy[^}]*animation:\s*none/);
  });

  it("จุดปลาย portal ของแผงอยู่ใน DOM เสมอ — ซ่อนด้วย hidden ไม่ใช่ถอดออก (state ผู้ช่วยห้ามหายตอนย่อ)", () => {
    const dock = readFileSync(join(ROOT, DOCK_COMPONENT), "utf8");
    // __body ต้องไม่อยู่หลังเงื่อนไข open ? ... : null — ตรวจว่า render เป็น element ตรง ๆ ใน panel
    expect(dock).toContain('className="assistant-dock__body"');
    expect(dock).not.toMatch(/\{open\s*\?\s*<div className="assistant-dock__body"/);
  });
});
