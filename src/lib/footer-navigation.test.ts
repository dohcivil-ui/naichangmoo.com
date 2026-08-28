import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { footerNavigationContract } from "@/lib/footer-navigation";

/**
 * ด่านตรวจอัตโนมัติของท้ายเว็บ (IP-200) — "ทุกลิงก์ชี้หน้าที่มีจริง" ต้องพิสูจน์กับดิสก์จริง
 * แบบเดียวกับ way-home.test.ts ไม่ใช่เช็กกับความจำของคนเขียน
 *
 * flag `exists` ถูกบังคับสองทิศทาง: ประกาศว่ามีแต่หน้าไม่มี = ลิงก์โกหกผู้ใช้ ·
 * หน้าถูกสร้างแล้วแต่ flag ยังปิด = ท้ายเว็บตามความจริงไม่ทัน ทั้งคู่ต้องแดง
 */

/** href → หลักฐานบนดิสก์: ตัด hash ก่อน แล้วแปลง path เป็นไฟล์ page.tsx ใต้ src/app */
function evidenceOf(href: string): { pagePath: string; anchor: string | null } {
  const [path, anchor] = href.split("#");
  const segments = (path === "" || path === "/") ? [] : path.replace(/^\//, "").split("/");
  return { pagePath: join(process.cwd(), "src", "app", ...segments, "page.tsx"), anchor: anchor ?? null };
}

const allLinks = footerNavigationContract.flatMap((column) =>
  column.links.map((link) => ({ ...link, column: column.heading }))
);

describe("ด่านตรวจท้ายเว็บ (IP-200)", () => {
  it("ลิงก์ที่ประกาศว่ามีจริง ต้องมีหน้า (และ anchor) อยู่จริงบนดิสก์", () => {
    const offenders: string[] = [];
    for (const link of allLinks.filter((candidate) => candidate.exists)) {
      const { pagePath, anchor } = evidenceOf(link.href);
      if (!existsSync(pagePath)) {
        offenders.push(`${link.column} → ${link.href} ไม่มีหน้า ${pagePath}`);
        continue;
      }
      if (anchor && !readFileSync(pagePath, "utf8").includes(`id="${anchor}"`)) {
        offenders.push(`${link.column} → ${link.href} หน้าไม่มี id="${anchor}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("ลิงก์ที่ประกาศว่ายังไม่มี ต้องยังไม่มีจริง — หน้าเสร็จแล้วให้พลิก exists เป็น true", () => {
    const overdue = allLinks
      .filter((link) => !link.exists)
      .filter((link) => existsSync(evidenceOf(link.href).pagePath))
      .map((link) => `หน้า ${link.href} ถูกสร้างแล้ว ให้พลิก exists เป็น true ในท้ายเว็บ`);
    expect(overdue).toEqual([]);
  });

  it("ไม่มี href ซ้ำข้ามคอลัมน์", () => {
    const hrefs = allLinks.map((link) => link.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("ทุกคอลัมน์มีหัวข้อ และทุกลิงก์มีป้ายกับปลายทางไม่ว่าง", () => {
    for (const column of footerNavigationContract) {
      expect(column.heading.length).toBeGreaterThan(0);
      expect(column.links.length).toBeGreaterThan(0);
      for (const link of column.links) {
        expect(link.label.length).toBeGreaterThan(0);
        expect(link.href.startsWith("/")).toBe(true);
      }
    }
  });
});
