import { MenuIcon } from "@/components/icons/platform-icons";

/**
 * แถบเมนูใต้แถบบน — ชิปแดง "แอปทั้งหมด · N" ตามด้วยลิงก์ในหน้า
 *
 * **แท็บโปรโมชั่นกับบล็อกโปรโมชั่นต้องตายพร้อมกัน** (`promo-link-fence`) จึงรับ `promoIsLive`
 * ค่าเดียวกับที่ page ส่งให้บล็อก ไม่อ่านนาฬิกาเอง · N คือค่าเดียวกับตัวนับในเชลฟ์
 */
export function V4MenuBar({ appCount, promoIsLive }: { appCount: number; promoIsLive: boolean }) {
  return (
    <nav className="v4-menubar" aria-label="เมนูหน้าแรก">
      <div className="v4-menubar__inner">
        <a className="v4-menubar__all" href="#apps">
          <MenuIcon aria-hidden="true" />
          <span>แอปทั้งหมด · <span className="v3-hd">{appCount}</span></span>
        </a>
        {promoIsLive ? <a className="v4-menubar__link v4-menubar__link--promo" href="#price">โปรโมชั่น</a> : null}
        <a className="v4-menubar__link" href="#hermes">Hermes 24/7</a>
        <a className="v4-menubar__link" href="#features">ความสามารถ</a>
      </div>
    </nav>
  );
}
