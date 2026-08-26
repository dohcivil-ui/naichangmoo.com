import type { Metadata } from "next";
import Link from "next/link";
import { PriceWorkspace, type LabourRow, type LedgerAnswer, type UnitPriceRow } from "@/components/prototype/price-workspace";
import { answerLedger, readProvinces } from "@/server/price-ledger-query";
import unitPriceData from "@/data/obec/obec-2569-unit-prices.json";
import labourData from "@/data/cgd/cgd-w809-labour-be2568.json";
import { landingActionContract } from "@/lib/landing-interactions";
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

  return (
    <main className="site-shell">
      <PriceWorkspace provinces={master.provinces} period={master.period} unitRows={unitRows} labourRows={labourRows} firstAnswer={firstAnswer} artwork={artwork} />

      <section className="section gl-afterword">
        <div className="container">
          <p className="eyebrow" style={{ color: "var(--teal)" }}>ขอบเขตของต้นแบบนี้</p>
          <h2>อะไรจริง อะไรยังไม่ทำ</h2>
          <div className="gl-afterword__grid">
            <div>
              <h3>จริงแล้ว</h3>
              <ul>
                <li>ราคาวัสดุดึงสดจาก API ของ สนค. ทุกครั้งที่เปิดหน้า ผ่านเซิร์ฟเวอร์เราที่แคชไว้หนึ่งชั่วโมง</li>
                <li>ครบทั้ง 74 จังหวัด เลือกปีและเดือนย้อนหลังได้ถึงที่ต้นทางมีจริง</li>
                <li>
                  ค่าวัสดุและค่าแรงต่อหน่วยงาน {unitRows.length.toLocaleString("th-TH")} รายการ 44 หมวดงาน
                  อ่านจากบัญชีราคาของ สพฐ. ปีงบประมาณ 2569 ทั้งเล่มด้วยสคริปต์ในรีโป
                </li>
                <li>เดือนที่ต้นทางไม่มีราคาเป็นช่องว่างจริงทั้งในแถวและบนกราฟ ไม่มีการลากเส้นเชื่อมให้ดูต่อเนื่อง</li>
                <li>
                  ค่าแรงถอดแบบราคากลางของกรมบัญชีกลาง ว809 ฉบับ 14 พ.ย. 2568 จำนวน {labourRows.length} รายการ
                  {" "}{labourRows.reduce((total, row) => total + row.variants.reduce((sum, entry) => sum + entry.rates.length, 0), 0)} อัตรา
                  โดยเก็บเงื่อนไขปริมาณงานของทุกอัตราไว้ครบ ไม่ได้เลือกมาแค่ตัวเดียว
                </li>
                <li>ราคาทุกบรรทัดคิดเป็นสตางค์จำนวนเต็ม คูณปริมาณแล้วรวมได้โดยไม่สะสมความคลาดเคลื่อน</li>
              </ul>
            </div>
            <div>
              <h3>ยังไม่ทำ</h3>
              <ul>
                <li>ยังไม่เก็บลงฐานข้อมูลของเรา ตอนนี้แคชอยู่ในหน่วยความจำของเซิร์ฟเวอร์ รีสตาร์ตแล้วต้องดึงใหม่</li>
                <li>
                  บัญชีค่าแรง ว809 อ่านได้เฉพาะหน้า 2 ถึง 14 ซึ่งเป็นงานโครงสร้างวิศวกรรมกับงานสถาปัตยกรรม
                  ส่วนหน้า 15 ถึง 45 ในไฟล์ที่เรามีเป็นภาพสแกน ไม่มีชั้นข้อความ ต้องหาไฟล์ต้นฉบับจาก
                  ระบบจัดซื้อจัดจ้างภาครัฐ หรือทำ OCR ก่อนถึงจะได้งานระบบกับครุภัณฑ์ครบ
                </li>
                <li>ยังไม่มีค่าขนส่งถึงหน่วยงาน และยังไม่ผูกกับ Factor F</li>
                <li>รายการที่หยิบไว้ยังอยู่ในหน่วยความจำของหน้า ปิดแล้วหาย และยังส่งต่อเข้า ESTIMETR ไม่ได้</li>
                <li>
                  ยังไม่ผูกกับสิทธิ์สมาชิก ต้นแบบนี้เปิดทุกอย่างให้ดู เส้นแบ่งฟรีกับ VIP ที่ตกลงกันแล้ว
                  อยู่ใน docs/requirements/pricemetr-membership.md และต้องตรวจสิทธิ์ที่เซิร์ฟเวอร์เมื่อทำของจริง
                </li>
              </ul>
            </div>
          </div>
          <p className="gl-afterword__note">
            ราคาในหน้านี้เป็นราคาสืบของผู้ประกาศแต่ละราย ไม่ใช่ราคากลางของโครงการใดโครงการหนึ่ง
            การนำไปขึ้นแบบ ปร.4 ต้องผ่านการทบทวนและผูกกับชุดราคาของโครงการก่อนเสมอ
          </p>
          <Link className="button button--ghost" href={landingActionContract.allAppsHref}>
            {landingActionContract.allAppsLabel}
          </Link>
        </div>
      </section>
    </main>
  );
}
