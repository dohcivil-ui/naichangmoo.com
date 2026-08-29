import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ด่านเฝ้าบัญชีบันทึกส่งงาน
 *
 * `src/server/project-status.ts` ตรวจอยู่แล้วว่าทุกรายการในบัญชีชี้ไปยังไฟล์ที่มีจริง
 * แต่ไม่มีอะไรตรวจทางกลับ คือไฟล์ที่มีจริงต้องมีชื่อในบัญชี ผลคือบัญชีค่อย ๆ ขาดไปเงียบ ๆ
 * ตรวจเมื่อ 2026-08-29 พบว่าไฟล์บนดิสก์ 79 ฉบับแต่ในบัญชีมี 68 ขาดไปสิบเอ็ดฉบับ
 * และบันทึกส่งงานเก่าจดตัวเลขไว้ผิดด้วยว่าขาดสิบ เพราะไม่มีใครนับใหม่
 *
 * ด่านนี้ปิดทั้งสองทาง และเป็นเหตุผลว่าทำไม `version` ถึงเป็นช่องที่มีหรือไม่มีก็ได้
 * ไม่ใช่ทุกเซสชันจะปิดรุ่น การบังคับให้มีเลขรุ่นคือการบังคับให้กรอกเลขปลอมหรือทิ้งบันทึกไว้นอกบัญชี
 */

const root = process.cwd();
const HANDOFF_DIR = join(root, "docs/handoff");

/** แม่แบบไม่ใช่บันทึกของงานจริง จึงไม่มีที่ในบัญชี */
const NOT_A_HANDOFF = new Set(["HANDOFF_TEMPLATE.md"]);

type Entry = { version?: string; title: string; description: string; scope: string[]; verification: string[]; rollback: string; path: string };

const index = JSON.parse(readFileSync(join(HANDOFF_DIR, "index.json"), "utf8")) as Entry[];
const files = readdirSync(HANDOFF_DIR).filter((name) => name.endsWith(".md") && !NOT_A_HANDOFF.has(name));

describe("ด่านเฝ้าบัญชีบันทึกส่งงาน", () => {
  it("บันทึกทุกฉบับบนดิสก์ต้องมีชื่อในบัญชี", () => {
    const listed = new Set(index.map((entry) => entry.path.replace("docs/handoff/", "")));
    expect(files.filter((name) => !listed.has(name))).toEqual([]);
  });

  it("ทุกรายการในบัญชีต้องชี้ไปยังไฟล์ที่มีจริง", () => {
    const onDisk = new Set(readdirSync(HANDOFF_DIR));
    expect(index.filter((entry) => !onDisk.has(entry.path.replace("docs/handoff/", ""))).map((entry) => entry.path)).toEqual([]);
  });

  it("ไม่มีไฟล์ไหนถูกลงบัญชีสองครั้ง", () => {
    const paths = index.map((entry) => entry.path);
    expect(paths.length).toBe(new Set(paths).size);
  });

  it("ทุกรายการมีเนื้อครบตามที่หน้าจอสถานะต้องใช้", () => {
    for (const entry of index) {
      expect(entry.title, entry.path).toBeTruthy();
      expect(entry.description, entry.path).toBeTruthy();
      expect(entry.rollback, entry.path).toBeTruthy();
      expect(Array.isArray(entry.scope) && entry.scope.length > 0, `${entry.path} ไม่มี scope`).toBe(true);
      expect(Array.isArray(entry.verification) && entry.verification.length > 0, `${entry.path} ไม่มี verification`).toBe(true);
    }
  });

  it("รายการแรกคือบันทึกที่ใหม่ที่สุด เพราะหน้าจอสถานะอ่านแค่รายการแรก", () => {
    const dateOf = (entry: Entry) => entry.path.split("/").pop()!.slice(0, 10);
    const newest = [...index].map(dateOf).sort().at(-1);
    expect(dateOf(index[0])).toBe(newest);
  });
});
