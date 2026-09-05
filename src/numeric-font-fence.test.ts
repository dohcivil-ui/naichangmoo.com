import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ด่านตรวจฟอนต์ตัวเลข (IP-203)
 *
 * บั๊กที่ด่านนี้เกิดมาเพื่อกัน: เว็บเปลี่ยนฟอนต์หลักเป็น Prompt ซึ่งไม่มีฟีเจอร์ `tnum`
 * คำสั่ง `font-variant-numeric: tabular-nums` ที่ globals.css สั่งไว้ 44 จุดจึงกลายเป็นหมัน
 * ทั้งหมดพร้อมกัน ตัวเลข ปร.4/5/6 และตารางราคาเลิกตรงหลักบนของจริงและหลุดขึ้น production ไป
 * **โดยที่ CSS ยังอ่านว่าสั่ง tabular-nums ครบทุกบรรทัด** — รีวิวโค้ดไม่มีทางจับได้
 *
 * ด่านนี้จับ "โครงหาย" ได้ คือคอลัมน์ตัวเลขเลิกผูกกับฟอนต์ตัวเลข หรือ layout เลิกโหลดฟอนต์นั้น
 * สิ่งที่ด่านนี้ **จับไม่ได้** คือถ้ามีคนผูก `--font-numeric` กับฟอนต์ที่เลขกว้างไม่เท่ากัน
 * เพราะไฟล์ฟอนต์ที่ next/font โหลดมาอยู่ใน `.next/` ซึ่ง gitignore ไว้และชื่อไฟล์เป็นแฮชที่เปลี่ยนทุก build
 * เทสต์จึงอ่านไม่ได้ **การวัดความกว้างตัวเลขจริงต้องทำในเบราว์เซอร์ตอนตรวจงาน** ไม่ใช่ที่นี่
 */

const CSS = join(process.cwd(), "src/app/globals.css");
const LAYOUT = join(process.cwd(), "src/app/layout.tsx");

/**
 * คอลัมน์ที่ตัวเลขวางซ้อนกันเป็นแถว หลักเลื่อนแล้วเห็นทันที — เจ้าของงานเคาะขอบเขตนี้ 2026-08-28
 *
 * เคยมี `.gl-row__price` กับ `.gl-row__num` อยู่ในรายการนี้ด้วย แต่ตอนเปิดของจริง 2026-08-28
 * ไม่มีหน้าไหนเรนเดอร์สองตัวนี้ออกมาเลย เป็น CSS ที่ตกค้างจากโครงเดิมของตารางราคา
 * ด่านที่เฝ้าของว่างทำให้นับผิดว่าครอบคลุมกว่าที่เป็น จึงตัดออกพร้อมกับกฎใน globals.css
 */
const NUMERIC_COLUMNS = [
  ".number-cell",
  '.admin-table [data-numeric="true"]',
  ".work-plan__cell--number",
  ".gl-num",
  ".gl-slab__price",
  ".gl-labour__rate",
  /* เลขบนหน้าแรก ESTIMETR (IP-235) — เลขขั้น เลขหน้าแบบ สเกล และจำนวนรายการ
     วางซ้อนกันเป็นคอลัมน์ในตารางโครงการ และอยู่ปนกับตัวหนังสือในการ์ดงานค้าง */
  ".eh__num",
  ".eh__n",
  /* เลขบนหน้าโครงการ (IP-237) — เลขขั้นในการ์ดสี่ใบวางเรียงเป็นแถวเดียวกัน หลักเลื่อนแล้วเห็น
     ทันที · ส่วน `__num` คือเลขในกล่องความคืบหน้าและในป้ายสถานะ ซึ่งเป็นเลขที่ปนอยู่กับ
     ตัวหนังสือไทย ไม่ได้เรียงเป็นคอลัมน์ แต่ต้องมาจากฟอนต์เดียวกับเลขที่เหลือทั้งเว็บ */
  ".stage-card__n",
  ".estimation-workspace__num",
  /* เลขบนหน้าแบบ (IP-238) — พื้นที่ห้อง ขนาดกรอบ เส้นรอบรูป และสเกล วางเรียงกันสองบรรทัด
     ให้คนเอามาเทียบกันด้วยตา หลักที่ไม่ตรงกันทำให้เทียบผิด */
  ".mk__num",
  ".mk__tour-num"
];

/**
 * คำไทยที่นั่งอยู่ในช่องตัวเลขต้องกลับไปใช้ฟอนต์เดิมของเว็บ
 *
 * กฎฟอนต์ตัวเลขสั่งที่ตัวช่อง ลูกในช่องจึงรับไปด้วยทั้งที่ไม่มีหลักให้เรียง
 * ของจริงที่โดน: หัวตาราง work-plan, วันที่ใต้ช่องกรอก และหน่วยท้ายราคาอย่าง "บาท/ชุด"
 */
const THAI_WORD_SLOTS = [
  "th.number-cell",
  '.admin-table th[data-numeric="true"]',
  ".number-cell small",
  ".number-cell em",
  ".gl-num small",
  ".gl-slab__price small",
  ".gl-labour__rate small"
];

/** ตัวเลือกทั้งหมดของทุกกฎที่สั่งฟอนต์ด้วยตัวแปรตัวนั้น — คอมเมนต์ถูกตัดทิ้งก่อนเสมอ */
function selectorsBoundTo(css: string, fontVariable: string): string[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = withoutComments.matchAll(/([^{}]+)\{[^{}]*\}/g);
  const found: string[] = [];
  for (const rule of rules) {
    if (!rule[0].includes(`var(${fontVariable})`)) continue;
    for (const one of rule[1].split(",")) {
      const trimmed = one.trim();
      if (trimmed) found.push(trimmed);
    }
  }
  return found;
}

export function numericFontSelectors(css: string): string[] {
  return selectorsBoundTo(css, "--font-numeric");
}

export function promptFontSelectors(css: string): string[] {
  return selectorsBoundTo(css, "--font-prompt");
}

describe("ด่านตรวจฟอนต์ตัวเลข (IP-203)", () => {
  it("ทุกคอลัมน์ตัวเลขในตารางผูกกับฟอนต์ตัวเลข ไม่ใช่ฟอนต์หลักของเว็บ", () => {
    const declared = numericFontSelectors(readFileSync(CSS, "utf8"));
    const missing = NUMERIC_COLUMNS.filter((selector) => !declared.includes(selector));
    expect(missing).toEqual([]);
  });

  it("คำไทยที่นั่งอยู่ในช่องตัวเลขยังเป็นฟอนต์เดิมของเว็บ ไม่ถูกฟอนต์ตัวเลขลากไปด้วย", () => {
    const declared = promptFontSelectors(readFileSync(CSS, "utf8"));
    const missing = THAI_WORD_SLOTS.filter((selector) => !declared.includes(selector));
    expect(missing).toEqual([]);
  });

  it("layout โหลดฟอนต์ตัวเลขและปล่อยตัวแปรออกมาจริง — ประกาศใน CSS อย่างเดียวไม่พอ", () => {
    const layout = readFileSync(LAYOUT, "utf8");
    expect(layout).toContain('variable: "--font-numeric"');
    expect(layout).toContain("plexNumeric.variable");
  });

  it("ตัวตรวจเองต้องยังกัด: คอลัมน์ที่หลุดออกจากกฎถูกจับ", () => {
    // IP-091: ตัวตรวจที่ไม่เคยถูกพิสูจน์ว่าจับได้ ถือว่าไม่มีตัวตรวจ
    const good = ".number-cell,\n.gl-num { font-family: var(--font-numeric), sans-serif; }";
    expect(numericFontSelectors(good)).toEqual([".number-cell", ".gl-num"]);

    const dropped = ".number-cell { font-family: var(--font-numeric), sans-serif; }";
    expect(numericFontSelectors(dropped)).not.toContain(".gl-num");

    const gone = ".number-cell { font-family: var(--font-prompt), sans-serif; }";
    expect(numericFontSelectors(gone)).toEqual([]);

    // กฎดึงคำไทยกลับก็ต้องหายไปพร้อมกันถ้ามีคนลบทิ้ง
    const bleeding = ".number-cell { font-family: var(--font-numeric), sans-serif; }";
    expect(promptFontSelectors(bleeding)).not.toContain("th.number-cell");
  });

  it("คอมเมนต์ที่มีลูกน้ำอยู่ข้างในต้องไม่ถูกนับเป็นตัวเลือก", () => {
    const withComment = "/* หนึ่ง, สอง, สาม */\n.number-cell { font-family: var(--font-numeric), sans-serif; }";
    expect(numericFontSelectors(withComment)).toEqual([".number-cell"]);
  });
});
