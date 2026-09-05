import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ด่านตรวจปุ่ม (IP-235)
 *
 * **บั๊กที่ด่านนี้เกิดมาเพื่อกัน** ปุ่มเคยเป็นสตริงที่คนพิมพ์เอง `className="button button--orange
 * micro-button"` ซ้ำอยู่ทั่วโปรเจกต์ นับได้ **เจ็ดแบบต่างกัน 76 จุด** สำหรับของที่ควรมีแบบเดียว
 * ผลคือปุ่มบนหน้าเดียวกันสูงไม่เท่ากัน 48 กับ 72 และไม่มีใครเห็นจนเจ้าของงานเปิดเจอเอง
 * และ `micro-button` ที่ติดอยู่ 71 จุดไม่มีกฎ CSS สักบรรทัด จึงเป็นคลาสที่ไม่เคยทำอะไรเลย
 *
 * **สิ่งที่ด่านนี้จับได้** คือมีคนพิมพ์คลาสปุ่มลงไปในไฟล์คอมโพเนนต์เองอีก แทนที่จะใช้ `<Button>`
 * ตัวกลาง · วันที่นั้นมาถึง เทสต์ต้องแดงทันที ไม่ใช่รอเจ้าของงานเปิดหน้าเว็บแล้วเห็นปุ่มเพี้ยน
 *
 * **สิ่งที่ด่านนี้จับไม่ได้** คือหน้าตาจริงของปุ่มบนจอ ความสูงเท่ากันจริงไหม เงาอยู่ครบไหม
 * ค่าพวกนั้นต้องวัดในเบราว์เซอร์ด้วย `getBoundingClientRect` ตอนตรวจงาน ไม่ใช่ที่นี่ —
 * บทเรียนเดียวกับด่านฟอนต์ตัวเลข ที่จับ "โครงหาย" ได้ แต่จับ "ค่าผิด" ไม่ได้
 */

const SRC = join(process.cwd(), "src");

/** ที่เดียวที่พูดถึงคลาสปุ่มได้ตามหน้าที่ ไม่ใช่ตามความสะดวก */
const EXEMPT = new Set([
  "src/components/platform/button.tsx",
  "src/button-fence.test.ts"
]);

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** คอมเมนต์ไม่ใช่การประกาศ — บทเรียนเดียวกับรั้วสีที่เคยจับคำอธิบายของตัวเองผิด */
export function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
}

/**
 * `className` ที่มีคลาสปุ่มอยู่ข้างใน ไม่ว่าจะเขียนเป็นสตริงตรงหรือประกอบด้วย template
 *
 * รอบแรกด่านนี้ดูเฉพาะสตริงตรง แล้วปล่อยของหลุดไปสี่จุดจริง เพราะเขียนเป็น
 * `className={` + backtick + `button ${x} micro-button` + backtick + `}` ซึ่งไม่ใช่สตริงตรง
 * เจอตอนไล่ดู HTML ที่เรนเดอร์ออกมาแล้วยังเห็นคำว่า micro-button ค้างอยู่ ทั้งที่ด่านเขียว
 * **บทเรียนคือด่านที่ผ่านไม่ได้แปลว่าไม่มีของหลุด ต้องดูผลลัพธ์จริงด้วย**
 */
export function findHandTypedButtons(content: string): { line: number; snippet: string }[] {
  const hits: { line: number; snippet: string }[] = [];
  const lines = stripComments(content).split("\n");
  lines.forEach((line, index) => {
    const inString = /className\s*=\s*(["'`])[^"'`]*\bbutton(--|\s|["'`])/.test(line);
    const inTemplate = /className\s*=\s*\{[^}]*\bbutton(--|\s|["'`])/.test(line);
    if (inString || inTemplate) hits.push({ line: index + 1, snippet: line.trim().slice(0, 90) });
  });
  return hits;
}

/** ชั้นเสริมของ `<Button>` มีไว้จัดตำแหน่ง ไม่ใช่เปลี่ยนหน้าตา */
export function findToneOverrides(content: string): { line: number; snippet: string }[] {
  const hits: { line: number; snippet: string }[] = [];
  const lines = stripComments(content).split("\n");
  lines.forEach((line, index) => {
    if (/<Button[^>]*className\s*=\s*(["'`])[^"'`]*button--/.test(line)) {
      hits.push({ line: index + 1, snippet: line.trim().slice(0, 90) });
    }
  });
  return hits;
}

describe("ด่านตรวจปุ่ม (IP-235)", () => {
  it("ไม่มีใครพิมพ์คลาสปุ่มเองในไฟล์คอมโพเนนต์ ทุกปุ่มมาจาก <Button>", () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(SRC)) {
      const relative = file.slice(process.cwd().length + 1).replace(/\\/g, "/");
      if (EXEMPT.has(relative)) continue;
      for (const hit of findHandTypedButtons(readFileSync(file, "utf8"))) {
        offenders.push(`${relative}:${hit.line} ${hit.snippet}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("ชั้นเสริมของ <Button> ไม่ถูกใช้เปลี่ยนระดับหรือหน้าตาของปุ่ม", () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(SRC)) {
      const relative = file.slice(process.cwd().length + 1).replace(/\\/g, "/");
      if (EXEMPT.has(relative)) continue;
      for (const hit of findToneOverrides(readFileSync(file, "utf8"))) {
        offenders.push(`${relative}:${hit.line} ${hit.snippet}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("ตัวตรวจเองต้องยังกัด: ปุ่มที่พิมพ์มือถูกจับ และคอมเมนต์ไม่ถูกนับ", () => {
    // IP-091: ตัวตรวจที่ไม่เคยถูกพิสูจน์ว่าจับได้ ถือว่าไม่มีตัวตรวจ
    expect(findHandTypedButtons('<a className="button button--orange">ไป</a>')).toHaveLength(1);
    expect(findHandTypedButtons('<button className="button">ไป</button>')).toHaveLength(1);
    expect(findHandTypedButtons('<div className="workspace-callout">ไป</div>')).toHaveLength(0);
    // คำว่า button ที่เป็นส่วนหนึ่งของชื่อคลาสอื่นไม่ใช่ปุ่มของเรา
    expect(findHandTypedButtons('<span className="assistant-dock__toggle">ไป</span>')).toHaveLength(0);
    expect(findHandTypedButtons('/* className="button button--orange" */')).toHaveLength(0);
    // คลาสที่ประกอบด้วย template ก็ต้องโดน — สี่จุดหลุดด่านรอบแรกด้วยรูปแบบนี้
    expect(findHandTypedButtons("<Link className={`button micro-button ${x}`} href={h}>ไป</Link>")).toHaveLength(1);
    expect(findHandTypedButtons("<b className={`gl-num ${x}`}>ไป</b>")).toHaveLength(0);
    expect(findToneOverrides('<Button tone="quiet" className="button--orange">ไป</Button>')).toHaveLength(1);
    expect(findToneOverrides('<Button tone="quiet" className="work-plan__restore">ไป</Button>')).toHaveLength(0);
  });
});
