import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

/**
 * ด่านตรวจไอคอน (IP-196) — ไฟล์ binary พังเงียบได้ (export ผิด, ถูกเขียนทับ, git filter)
 * และ manifest ที่ชี้ไฟล์ผิดขนาดจะไม่มีใครเห็นจนมีคนกดติดตั้งบนมือถือ
 * ตามวินัย IP-091: ตัวตรวจต้องพิสูจน์ได้ว่ากัด — มี trap ยัด buffer ปลอมท้ายไฟล์
 */

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function isPng(buf: Buffer): boolean {
  return buf.length > 24 && buf.subarray(0, 8).equals(PNG_MAGIC);
}

export function pngSize(buf: Buffer): { w: number; h: number } {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** อ่านโครง ICO: header ต้องเป็น icon จริง ทุก entry เป็น PNG ขนาดตรงประกาศ offset ต่อเนื่อง */
export function checkIco(buf: Buffer): string[] {
  const problems: string[] = [];
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) problems.push("header ไม่ใช่ ICO ประเภท icon");
  const count = buf.readUInt16LE(4);
  if (count < 1) problems.push("ไม่มีภาพใน ICO");
  let expectedOffset = 6 + 16 * count;
  for (let i = 0; i < count; i++) {
    const entry = 6 + 16 * i;
    const declared = buf.readUInt8(entry);
    const length = buf.readUInt32LE(entry + 8);
    const offset = buf.readUInt32LE(entry + 12);
    if (offset !== expectedOffset) problems.push(`entry ${i} offset ไม่ต่อเนื่อง`);
    const payload = buf.subarray(offset, offset + length);
    if (!isPng(payload)) problems.push(`entry ${i} ไม่ใช่ PNG`);
    else if (pngSize(payload).w !== declared) problems.push(`entry ${i} ประกาศ ${declared}px แต่ภาพจริง ${pngSize(payload).w}px`);
    expectedOffset += length;
  }
  if (buf.length !== expectedOffset) problems.push("ความยาวไฟล์ไม่เท่าผลรวม header+entries+ภาพ");
  return problems;
}

describe("ด่านตรวจไอคอน (IP-196)", () => {
  it("favicon.ico เป็น ICO ฝัง PNG ที่โครงถูกครบ", () => {
    expect(checkIco(readFileSync(join(process.cwd(), "src/app/favicon.ico")))).toEqual([]);
  });

  it("icon.png 192 และ apple-icon.png 180 เป็น PNG ขนาดตรงจริง", () => {
    const icon = readFileSync(join(process.cwd(), "src/app/icon.png"));
    const apple = readFileSync(join(process.cwd(), "src/app/apple-icon.png"));
    expect(isPng(icon)).toBe(true);
    expect(pngSize(icon)).toEqual({ w: 192, h: 192 });
    expect(isPng(apple)).toBe(true);
    expect(pngSize(apple)).toEqual({ w: 180, h: 180 });
  });

  it("ทุกไอคอนที่ manifest ประกาศ มีไฟล์จริงใน public และขนาดตรงกับ sizes", () => {
    const offenders: string[] = [];
    for (const icon of manifest().icons ?? []) {
      const file = join(process.cwd(), "public", icon.src.replace(/^\//, ""));
      if (!existsSync(file)) {
        offenders.push(`${icon.src} ไม่มีไฟล์จริง`);
        continue;
      }
      const buf = readFileSync(file);
      const declared = Number.parseInt(icon.sizes ?? "", 10);
      if (!isPng(buf)) offenders.push(`${icon.src} ไม่ใช่ PNG`);
      else if (pngSize(buf).w !== declared || pngSize(buf).h !== declared) {
        offenders.push(`${icon.src} ประกาศ ${icon.sizes} แต่ภาพจริง ${pngSize(buf).w}x${pngSize(buf).h}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("manifest ประกาศชื่อ สี และจุดเริ่มครบ", () => {
    const m = manifest();
    expect(m.name).toContain("นายช่างหมู");
    expect(m.theme_color).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    expect(m.background_color).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    expect(m.start_url).toBe("/");
  });

  it("ตัวตรวจเองต้องยังกัด: buffer ปลอมทุกแบบที่วางกับดักไว้ถูกจับ", () => {
    // IP-091: ตัวตรวจที่ไม่เคยถูกพิสูจน์ว่าจับได้ ถือว่าไม่มีตัวตรวจ
    expect(isPng(Buffer.from("not a png at all, just text padding"))).toBe(false);
    const realIco = readFileSync(join(process.cwd(), "src/app/favicon.ico"));
    const corruptType = Buffer.from(realIco);
    corruptType.writeUInt16LE(2, 2); // type=2 คือ cursor ไม่ใช่ icon
    expect(checkIco(corruptType)).not.toEqual([]);
    const truncated = realIco.subarray(0, realIco.length - 10);
    expect(checkIco(truncated)).not.toEqual([]);
  });
});
