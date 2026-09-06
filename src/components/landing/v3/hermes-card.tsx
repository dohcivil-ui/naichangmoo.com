import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/platform/button";
import { visualAssetUrl } from "@/lib/visual-assets";
import { readPublishedChannels } from "@/server/platform-channels";

/**
 * การ์ด Hermes ข้างแบนเนอร์ — ผืนออกแบบรุ่นสาม ส่วนที่ 3 ข้อ 3b
 *
 * **การ์ดทั้งใบกดได้ ปุ่ม LINE เป็นลิงก์ที่สอง แต่ไม่ได้ซ้อนกัน** `<a>` ซ้อน `<a>`
 * เป็นมาร์กอัปที่ผิดและเบราว์เซอร์แต่ละตัวแก้ให้คนละแบบ · ลิงก์ที่หัวเรื่องจึงแผ่แผ่นใส
 * ปูทับทั้งใบด้วย `::after` แล้วปุ่ม LINE ยกตัวขึ้นเหนือแผ่นนั้นด้วย `z-index`
 * ลำดับการอ่านของโปรแกรมอ่านหน้าจอยังเป็นหัวเรื่องก่อนปุ่ม ตามที่ตาเห็น
 *
 * เอกสารสั่งให้ดู `AppCard` ว่าทำอย่างไร · ดูแล้ว **มันไม่ได้ทำการ์ดทั้งใบเป็นลิงก์**
 * ลิงก์เดียวของมันคือปุ่มท้ายการ์ด บ้านนี้จึงยังไม่มีแบบแผนของการ์ดที่กดได้ทั้งใบ
 * ตรงนี้เป็นที่แรก · ถ้ามีการ์ดใบที่สองต้องการแบบเดียวกัน ให้ยกสามบรรทัดนี้ไปเป็นของกลาง
 * ก่อนจะมีใบที่สาม ไม่ใช่ก๊อปไปวางเป็นใบที่สอง
 *
 * **ปุ่ม LINE ขึ้นเฉพาะเมื่อทะเบียนช่องทางมี LINE จริง** ผืนออกแบบพิมพ์ URL ของ LINE
 * ตายไว้ในไฟล์ ซึ่งจะล้มคำวินิจฉัยเจ้าของงาน 2026-08-28 ที่ว่าช่องทางที่ยังไม่กรอกต้องไม่ขึ้น
 * ไม่โชว์ค่าปลอมให้ลูกค้าเห็นแม้แต่วินาทีเดียว · การ์ดที่ไม่มีปุ่มยังกดได้ทั้งใบตามปกติ
 */
export async function HermesCard({ requestHref }: { requestHref: string }) {
  const channels = await readPublishedChannels();
  const line = channels.find((channel) => channel.key === "line_oa") ?? null;

  return (
    <div className="v3-hcard">
      {/* โปสเตอร์เต็มใบ ไม่ครอปและไม่มี ken-burns ตามคำสั่งเจ้าของงาน ตัวหนังสือในโปสเตอร์
          ต้องอ่านออกครบ · `alt` ว่างเพราะทุกอย่างที่โปสเตอร์บอก แผงข้างล่างพูดเป็นตัวหนังสือ
          อยู่แล้ว การอ่านซ้ำเป็นการอ่านสองรอบสำหรับคนที่ใช้โปรแกรมอ่านหน้าจอ */}
      <Image
        className="v3-hcard__poster"
        src={visualAssetUrl("hermes_poster")}
        alt=""
        width={1122}
        height={1402}
        sizes="340px"
      />

      <div className="v3-hcard__panel">
        <div className="v3-htext">
          <span className="v3-hcard__eyebrow">บริการ · ผู้ช่วยอัตโนมัติ</span>
          <h2 className="v3-hcard__title">
            <Link className="v3-hcard__link" href={requestHref}>HERMES 24/7</Link>
          </h2>
          <span className="v3-hline" aria-hidden="true" />
          <p className="v3-hcard__lead">รับออกแบบตาม USE CASE คุณ</p>
          {line ? (
            <div className="v3-hcard__action">
              <Button tone="line" href={line.href} target="_blank" rel="noreferrer noopener" icon={<span>LINE</span>}>
                ปรึกษาฟรี คลิกเลย
              </Button>
            </div>
          ) : null}
        </div>
        <p className="v3-hsub">ตอบกลับภายใน 24 ชม. · ส่ง use case ได้ทางแชท</p>
      </div>
    </div>
  );
}
