import { describe, expect, it } from "vitest";
import { loadESLint } from "eslint";

/**
 * เทสต์เฝ้ารั้วสถาปัตยกรรมของ ADR 0020
 *
 * มันไม่อ่านข้อความใน eslint.config.mjs แล้วเดาว่ารั้วยังอยู่ — มันยิงโค้ดละเมิดใส่
 * ESLint ตัวจริงด้วย config ตัวจริง แล้วดูว่ารั้วกัดไหม ถ้าใครถอดโซนออกจาก config
 * (คนหรือ AI ที่อยากให้งานตัวเองผ่าน lint) เทสต์นี้แดงทันที การย้ายเส้นรั้วโดยชอบ
 * ต้องแก้ ADR 0020 ก่อน แล้วค่อยแก้เทสต์นี้กับ config พร้อมกันในรุ่นเดียว
 *
 * ปรัชญาเดียวกับ IP-091: ตัวตรวจที่ไม่เคยถูกพิสูจน์ว่ายังกัด ถือว่าไม่มีตัวตรวจ
 */

const FENCE_RULE = "@typescript-eslint/no-restricted-imports";

async function fenceErrors(filePath: string, code: string): Promise<string[]> {
  const ESLint = await loadESLint({ useFlatConfig: true });
  const eslint = new ESLint({ cwd: process.cwd() });
  const [result] = await eslint.lintText(code, { filePath, warnIgnored: true });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId === FENCE_RULE)
    .map((message) => message.message);
}

/**
 * ยี่สิบวินาที ไม่ใช่ห้าตามค่าตั้งต้น
 *
 * เทสต์ชุดนี้สตาร์ต ESLint ตัวจริงพร้อม config ตัวจริง ซึ่งเป็นราคาที่ยอมจ่ายอยู่แล้วเพื่อให้รั้ว
 * ถูกพิสูจน์ว่ายังกัด รันเดี่ยววัดได้ 4.2 วินาที แต่ตอนรันพร้อมทั้งชุดบนเครื่องที่ทำงานหนัก
 * มันแตะเพดานห้าวินาทีแล้วแดงเป็นบางครั้ง ซึ่งไม่ใช่ความผิดของรั้วและไม่ใช่ความผิดของโค้ด
 * เทสต์ที่แดงสลับเขียวโดยไม่มีอะไรเปลี่ยน คือเทสต์ที่คนเลิกเชื่อภายในสัปดาห์เดียว
 */
describe("รั้วสถาปัตยกรรม (ADR 0020)", { timeout: 20_000 }, () => {
  it("ไข่แดง src/lib ลากฐานข้อมูลเข้ามาไม่ได้", async () => {
    const errors = await fenceErrors("src/lib/__fence-probe__.ts", 'import "@/db";\n');
    expect(errors.length).toBeGreaterThan(0);
  });

  it("ไข่แดง src/lib เรียก src/server ตอนรันไม่ได้", async () => {
    const errors = await fenceErrors("src/lib/__fence-probe__.ts", 'import { readCatalogueClaims } from "@/server/app-registry";\nreadCatalogueClaims();\n');
    expect(errors.length).toBeGreaterThan(0);
  });

  it("ไข่แดง src/lib ยืม type ข้ามรั้วได้ เพราะ type หายไปตอน compile", async () => {
    const errors = await fenceErrors("src/lib/__fence-probe__.ts", 'import type { AppClaim } from "@/server/app-registry";\nexport type Probe = AppClaim;\n');
    expect(errors).toEqual([]);
  });

  it("AI SDK เข้าไฟล์อื่นนอก provider.ts ไม่ได้ แม้ในฝั่ง server เอง", async () => {
    const errors = await fenceErrors("src/server/__fence-probe__.ts", 'import "openai";\n');
    expect(errors.length).toBeGreaterThan(0);
  });

  it("ประตู AI SDK บานเดียวคือ src/server/ai/provider.ts", async () => {
    const errors = await fenceErrors("src/server/ai/provider.ts", 'import "openai";\n');
    expect(errors).toEqual([]);
  });

  it("หน้าและคอมโพเนนต์แตะฐานข้อมูลตรงไม่ได้ ต้องผ่าน src/server", async () => {
    const pageErrors = await fenceErrors("src/app/__fence-probe__.tsx", 'import "@/db";\n');
    const componentErrors = await fenceErrors("src/components/__fence-probe__.tsx", 'import "drizzle-orm";\n');
    expect(pageErrors.length).toBeGreaterThan(0);
    expect(componentErrors.length).toBeGreaterThan(0);
  });

  it("สถานะโครงการเป็นความลับภายใน — โซนสาธารณะ import แหล่งอ่านโรดแมปไม่ได้ โซน admin ได้", async () => {
    // คำสั่งเจ้าของงาน 2026-08-28: โรดแมป/เอกสารส่งต่องานห้ามโชว์ชาวบ้าน
    const publicErrors = await fenceErrors("src/app/__fence-probe__.tsx", 'import "@/server/project-status";\n');
    const componentErrors = await fenceErrors("src/components/__fence-probe__.tsx", 'import "@/server/project-status";\n');
    const adminErrors = await fenceErrors("src/app/admin/__fence-probe__.tsx", 'import "@/server/project-status";\n');
    expect(publicErrors.length).toBeGreaterThan(0);
    expect(componentErrors.length).toBeGreaterThan(0);
    expect(adminErrors).toEqual([]);
  });
});
