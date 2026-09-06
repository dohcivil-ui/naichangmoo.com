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
 */
export function CategoryBar() {
  return (
    <nav className="v3-catbar" aria-label="หมวดของหน้าร้าน">
      <Link className="v3-catbar__all v3-nl" href={landingActionContract.allAppsHref}>
        <MenuIcon aria-hidden="true" />
        <span>{landingActionContract.allAppsLabel}</span>
        <span className="v3-hd">{platformApps.length}</span>
      </Link>

      {/* ผืนออกแบบ (`PROMPT.md:227`) มีแท็บโปรโมชั่นชี้ไป `#promo` แต่บล็อกโปรโมชั่นเป็นงาน
          ขั้นที่ 3 ยังไม่ลงหน้า ในหน้าจึงยังไม่มี id นั้น · แท็บที่กดแล้วไม่ไปไหนคือญาติของ
          route ปลอมที่เจ้าของงานห้ามไว้ · แท็บนี้กลับมาในก้อนเดียวกับที่บล็อกโปรโมชั่นลงจริง */}
      <Link className="v3-catbar__tab v3-nl-tab" href="#hermes">Hermes 24/7</Link>
    </nav>
  );
}
