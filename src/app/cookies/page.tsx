import type { Metadata } from "next";
import { PlatformFooter } from "@/components/platform/platform-footer";
import { SiteHeader } from "@/components/platform/site-header";
import { doesNotDo, notSetByThisSite, secureCookiePrefixNote, storedItems } from "@/lib/cookie-disclosure";

export const metadata: Metadata = {
  title: "นโยบายการใช้คุกกี้ | นายช่างหมู",
  description: "รายการคุกกี้และข้อมูลที่เว็บไซต์นายช่างหมูเก็บไว้ในเบราว์เซอร์ของผู้ใช้ พร้อมวัตถุประสงค์และอายุของแต่ละรายการ"
};

/**
 * A statement of what the code does, not a privacy policy.
 *
 * Every row of the table below was read off a real response header or the real database. Nothing
 * here is drawn from better-auth's documented defaults, because what matters to a visitor is what
 * this deployment actually sets, and the two are only the same until someone changes a setting.
 *
 * It deliberately names no legal entity, address or contact channel: those are facts the product
 * owner holds and has not settled (IP-126, IP-127), and inventing them would be the same kind of
 * false claim that ADR 0015 and ADR 0016 exist to prevent. The full privacy policy is IP-110.
 */
export default function CookiePolicyPage() {
  return (
    <main className="site-shell">
      <SiteHeader />
      <section className="section policy-page">
        <div className="container">
          <div className="eyebrow" style={{ color: "var(--teal-text)" }}>ความเป็นส่วนตัว</div>
          <h1>นโยบายการใช้คุกกี้</h1>
          <p className="policy-page__lead">
            หน้านี้บอกว่าเว็บไซต์นายช่างหมูเก็บอะไรไว้ในเบราว์เซอร์ของคุณบ้าง เพื่ออะไร และนานเท่าไร
            ทุกรายการตรวจสอบได้ด้วยตัวเองจากเครื่องมือสำหรับนักพัฒนาในเบราว์เซอร์
          </p>

          <div className="policy-page__panel policy-page__panel--good">
            <strong>เว็บไซต์นี้ไม่ทำสิ่งเหล่านี้</strong>
            <ul>{doesNotDo.map((line) => <li key={line}>{line}</li>)}</ul>
          </div>

          <h2>รายการที่ถูกเก็บไว้ในเบราว์เซอร์</h2>
          <div className="policy-table-wrap">
            <table className="policy-table">
              <thead>
                <tr><th>ชื่อ</th><th>ประเภท</th><th>ตั้งเมื่อไร</th><th>อายุ</th><th>เพื่ออะไร</th></tr>
              </thead>
              <tbody>
                {storedItems.map((item) => (
                  <tr key={item.id}>
                    <td><code>{item.name}</code><span className="policy-table__attrs">{item.attributes}</span></td>
                    <td>{item.kind === "cookie" ? "คุกกี้" : "ที่เก็บในเบราว์เซอร์"}</td>
                    <td>{item.setWhen}</td>
                    <td>{item.lifetime}</td>
                    <td>{item.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="policy-page__note">{secureCookiePrefixNote}</p>

          <h2>ชื่อที่อาจเห็นแต่เว็บนี้ไม่ได้ตั้ง</h2>
          <p className="policy-page__lead">
            เมื่อออกจากระบบ ระบบยืนยันตัวตนจะสั่งลบชื่อเหล่านี้ไปด้วยเสมอ ไม่ว่าจะเคยตั้งไว้หรือไม่
            จึงอาจเห็นชื่อผ่านตาได้ ทั้งที่เว็บนี้ไม่เคยสร้างมันขึ้นมา
          </p>
          <ul className="policy-page__list">
            {notSetByThisSite.map((item) => (
              <li key={item.name}><code>{item.name}</code> — {item.why}</li>
            ))}
          </ul>

          <div className="policy-page__panel">
            <strong>ทำไมหน้านี้ไม่มีปุ่มยอมรับหรือปฏิเสธ</strong>
            <p>
              คุกกี้ที่ระบุไว้ข้างต้นเป็นคุกกี้ที่จำเป็นต่อการทำงานของระบบเข้าสู่ระบบ ถ้าไม่มีก็ล็อกอินไม่ได้
              จึงไม่มีทางเลือกให้กดปฏิเสธอย่างมีความหมาย ปุ่มยอมรับสำหรับสิ่งที่เกิดขึ้นอยู่แล้วจะทำให้เข้าใจผิดว่าควบคุมได้
              หากวันหนึ่งมีการฝังเนื้อหาจากบริการภายนอกซึ่งวางคุกกี้ติดตาม จะมีการขอความยินยอมจริงก่อนโหลดเนื้อหานั้น
              และคุณจะปฏิเสธได้โดยเนื้อหานั้นจะไม่ถูกโหลด
            </p>
          </div>

          <div className="policy-page__panel">
            <strong>การจัดการคุกกี้ด้วยตัวเอง</strong>
            <p>
              เบราว์เซอร์ทุกตัวลบคุกกี้และข้อมูลเว็บไซต์ได้จากการตั้งค่า การลบคุกกี้เข้าสู่ระบบจะทำให้ต้องล็อกอินใหม่
              และการลบข้อมูลเว็บไซต์จะทำให้แถบแจ้งเรื่องคุกกี้กลับมาแสดงอีกครั้ง
            </p>
          </div>
        </div>
      </section>
      <PlatformFooter />
    </main>
  );
}
