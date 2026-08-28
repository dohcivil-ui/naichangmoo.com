import type { Metadata } from "next";
import { AppShell } from "@/components/platform/app-shell";
import { PriceWorkspace, type LabourRow, type LedgerAnswer, type UnitPriceRow } from "@/components/prototype/price-workspace";
import { answerLedger, readProvinces } from "@/server/price-ledger-query";
import unitPriceData from "@/data/obec/obec-2569-unit-prices.json";
import labourData from "@/data/cgd/cgd-w809-labour-be2568.json";
import { platformApps } from "@/lib/platform";
import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * ต้นแบบของแอปราคาวัสดุและค่าแรง
 *
 * อยู่นอก /apps โดยตั้งใจ ด้วยเหตุผลเดียวกับต้นแบบแผนงาน คือยังไม่มีสิทธิ์ ไม่มีทะเบียนแอป
 * และไม่มีตารางในฐานข้อมูล การวางไว้ใน /apps จะทำให้มันดูเหมือนแอปที่ประกาศแล้ว
 * ซึ่ง ADR 0014 ห้ามไว้ชัดว่าการประกาศเป็นสิ่งที่ผู้ดูแลกด ไม่ใช่สิ่งที่โผล่มาเพราะมีคนเขียนโค้ดหน้าหนึ่ง
 *
 * ลบทั้งโฟลเดอร์ได้เมื่อของจริงเกิด ส่วนที่เก็บไว้ใช้ต่อคือ src/server/tpso-prices.ts,
 * src/server/price-ledger-query.ts, src/lib/price-catalogue.ts และ scripts/extract-obec-prices.mjs
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ต้นแบบ PRICEMETR ราคาวัสดุและค่าแรง",
  robots: { index: false, follow: false }
};

/**
 * รอราคาชุดแรกได้ไม่เกินสองวินาทีครึ่ง
 *
 * รอบแรกของแต่ละชั่วโมง สนค. ใช้เวลาถึงสิบสองวินาที ปล่อยให้หน้าค้างรอนานขนาดนั้นไม่ได้
 * เกินเวลาก็ส่งหน้าเปล่าที่มีโครงไปก่อน แล้วให้ฝั่งเบราว์เซอร์ขอต่อเอง ระหว่างนั้นผู้ใช้เห็นโครงตาราง
 * ไม่ใช่จอขาว และคำขอที่ค้างอยู่ฝั่งเซิร์ฟเวอร์ยังวิ่งต่อจนเข้าแคช คำขอถัดไปจึงได้ของทันที
 */
async function firstAnswerWithin(ms: number): Promise<LedgerAnswer | null> {
  const attempt = answerLedger({ province: "10" }).catch(() => null);
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));
  return Promise.race([attempt, timeout]);
}

/**
 * หมวดไหนมีภาพประกอบจริงแล้วบ้าง อ่านจากโฟลเดอร์ตอนสร้างหน้า
 *
 * ทำแบบนี้เพื่อให้เอาไฟล์ภาพมาวางแล้วใช้ได้เลย ไม่ต้องแก้โค้ดตาม และหมวดที่ยังไม่มีภาพ
 * ก็ไม่ขึ้นรูปแตก แต่ใช้สัญลักษณ์เส้นที่มีอยู่แล้วแทนอย่างตั้งใจ
 */
function readCategoryArtwork(): string[] {
  try {
    return readdirSync(join(process.cwd(), "public", "brand", "categories"))
      .filter((file) => file.endsWith(".webp"))
      .map((file) => file.replace(/\.webp$/, ""));
  } catch {
    return [];
  }
}

export default async function PriceCheckPrototypePage() {
  const [master, firstAnswer] = await Promise.all([readProvinces(), firstAnswerWithin(2500)]);
  const unitRows = unitPriceData as UnitPriceRow[];
  const labourRows = labourData as LabourRow[];
  const artwork = readCategoryArtwork();
  // เปลือกกลางโหมดต้นแบบ (IP-157): ชื่อแอปมาจาก platformApps ไม่พิมพ์มือ และไม่มีคำแถลงจากทะเบียน
  const app = platformApps.find((entry) => entry.slug === "pricemetr");
  if (!app) throw new Error("platformApps ไม่มีรายการ pricemetr แล้ว — เปลือกของต้นแบบนี้พึ่งรายการนั้น");

  return (
    <AppShell app={app} mode="prototype">
      <PriceWorkspace provinces={master.provinces} period={master.period} unitRows={unitRows} labourRows={labourRows} firstAnswer={firstAnswer} artwork={artwork} />

      {/* ก้อน "ขอบเขตของต้นแบบนี้" ถูกถอดออก 2026-08-28 — โน้ต dev/admin (แหล่งไฟล์ภายใน
          ขีดจำกัดการอ่าน ว809, path docs/requirements) ไม่ใช่ของโชว์ชาวบ้าน — คำสั่งเจ้าของงาน
          ส่วนคำเตือน "ราคาสืบ ไม่ใช่ราคากลาง" เป็นของลูกค้าจริง ย้ายไปคงไว้ให้เห็นแทน */}
      <section className="section">
        <div className="container">
          <p className="gl-afterword__note">
            ราคาในหน้านี้เป็นราคาสืบของผู้ประกาศแต่ละราย ไม่ใช่ราคากลางของโครงการใดโครงการหนึ่ง
            การนำไปขึ้นแบบ ปร.4 ต้องผ่านการทบทวนและผูกกับชุดราคาของโครงการก่อนเสมอ
          </p>
        </div>
      </section>
    </AppShell>
  );
}
