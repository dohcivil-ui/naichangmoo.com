import Link from "next/link";
import { MenuIcon } from "@/components/icons/platform-icons";
import { landingActionContract } from "@/lib/landing-interactions";
import { platformApps } from "@/lib/platform";

/**
 * แถบหมวดใต้แถบบน — ผืนออกแบบรุ่นสาม ส่วนที่ 5 ข้อ 2
 *
 * **เลขจำนวนแอปนับจากทะเบียน ไม่พิมพ์ตาย** วันที่มีแอปที่แปดเข้ามา แถบนี้เปลี่ยนตามเอง
 * ไม่มีใครต้องจำว่าต้องมาแก้เลขตรงนี้ด้วย ซึ่งเป็นแบบที่หน้าเดิมทำอยู่แล้วกับแถบตัวเลข
 *
 * ป้ายทุกอันห้ามตัดบรรทัด เพราะแถบสูงคงที่ 44 การตัดบรรทัดจะดันความสูงจนแถบเสียทรง
 * `white-space: nowrap` อยู่ที่ `.v3-nl-tab` ในครัวกลาง ไม่ได้สั่งซ้ำที่นี่
 *
 * **`promoIsLive` เป็น prop ไม่ใช่ค่าที่แถบนี้ไปอ่านเอง** ถ้าแถบอ่านนาฬิกาเองและหน้าอ่านอีกครั้ง
 * จะกลายเป็นสองคำตัดสินที่บังเอิญตรงกัน ไม่ใช่คำตัดสินเดียว · ที่ต้องเป็นค่าเดียวเพราะแท็บกับ
 * ปลายทางของมันต้องเกิดพร้อมกันและ**ตายพร้อมกัน** ไม่ใช่แค่เกิดพร้อมกัน
 */
export function CategoryBar({ promoIsLive }: { promoIsLive: boolean }) {
  return (
    <nav className="v3-catbar" aria-label="หมวดของหน้าร้าน">
      <Link className="v3-catbar__all v3-nl" href={landingActionContract.allAppsHref}>
        <MenuIcon aria-hidden="true" />
        <span>{landingActionContract.allAppsLabel}</span>
        <span className="v3-hd">{platformApps.length}</span>
      </Link>

      {/* แท็บนี้เคยถูกเอาออกเพราะ `#promo` ยังไม่มีปลายทาง กลับมาในก้อนเดียวกับที่บล็อก
          โปรโมชั่นลงหน้าจริง ตามกติกาว่าปลายทางกับลิงก์ต้องเกิดพร้อมกันเสมอ

          **เดิมแท็บนี้ขึ้นตลอด ซึ่งเป็นระเบิดเวลา** วันที่โปรโมชั่นหมดอายุ บล็อก `#promo`
          จะหายไปตามที่ตั้งใจ แต่แท็บยังอยู่และกลายเป็นลิงก์ที่ไม่มีปลายทางเอง โดยไม่มีใคร
          แตะโค้ดเลยสักบรรทัด · กติกาที่เขียนไว้เองข้างบนจึงพังตัวเองตามปฏิทิน */}
      {promoIsLive ? <Link className="v3-catbar__tab v3-nl-tab" href="#promo">โปรโมชั่น</Link> : null}
      <Link className="v3-catbar__tab v3-nl-tab" href="#hermes">Hermes 24/7</Link>
    </nav>
  );
}
