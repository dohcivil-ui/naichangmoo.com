import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { FacebookMark, LineMark } from "@/components/icons/brand-icons";
import { CartIcon, DoorEnterIcon, MailIcon, PersonIcon, PhoneIcon } from "@/components/icons/platform-icons";
import { SignInButton } from "@/components/landing/sign-in-button";
import { AccountMenu } from "@/components/platform/account-menu";
import { Button } from "@/components/platform/button";
import { readViewer } from "@/components/platform/site-header";
import { contactPlaceholders } from "@/lib/landing-v3-data";
import { landingActionContract, landingNavigationContract } from "@/lib/landing-interactions";
import { visualAssetUrl } from "@/lib/visual-assets";
import { readPublishedChannels } from "@/server/platform-channels";

/**
 * แถบบนของหน้าร้าน — โครงจากผืนออกแบบรุ่นสาม ส่วนที่ 5 ข้อ 1
 *
 * **แทน `SiteHeader` เฉพาะหน้าแรก** หน้าอื่นทั้งเว็บยังใช้แถบเดิม เพราะแถบเดิมเป็นแถบนำทาง
 * ของแพลตฟอร์ม ส่วนตัวนี้เป็นแถบของหน้าร้าน ซึ่งมีเบอร์โทร ตะกร้า และช่องทางติดต่ออยู่ในตัว
 *
 * อ่าน session ฝั่ง server ตัวเดียวผ่าน `readViewer` ของแถบเดิม ไม่ได้อ่านซ้ำเป็นชุดที่สอง
 * เหตุผลเดียวกับที่ `site-header.tsx` เขียนไว้ — สองชุดคือจุดที่มันจะเริ่มตอบไม่ตรงกัน
 * และการเช็ค session ฝั่ง client จะทำให้ทุกหน้าขึ้นคำว่าเข้าสู่ระบบก่อนแล้วค่อยสลับเป็นชื่อคน
 * ซึ่งอ่านว่าหลุดออกจากระบบแล้วเข้าใหม่ทุกครั้งที่เปลี่ยนหน้า
 */

/** ป้ายสองบรรทัดใต้ไอคอน — บรรทัดบนบอกว่าเรื่องอะไร บรรทัดล่างคือของจริงที่กดได้ */
function HeaderSlot({ icon, caption, children }: { icon: ReactNode; caption: string; children: ReactNode }) {
  return (
    <div className="v3-hslot v3-nl-item">
      <span className="v3-hslot__icon" aria-hidden="true">{icon}</span>
      <span className="v3-hslot__text">
        <span className="v3-hslot__caption">{caption}</span>
        {children}
      </span>
    </div>
  );
}

export async function ShopHeader() {
  const [viewer, channels] = await Promise.all([readViewer(), readPublishedChannels()]);
  const quoteHref = landingNavigationContract.find((item) => item.id === "enterprise")?.href ?? "/enterprise";

  /* ช่องทางติดต่อมาจากตารางที่ผู้ดูแลกรอกเอง ช่องที่ยังไม่กรอกไม่ขึ้นเลย ตามคำวินิจฉัย
     เจ้าของงาน 2026-08-28 ที่ท้ายเว็บใช้อยู่แล้ว · **YouTube ยังไม่มีในทะเบียนช่องทาง**
     จึงยังไม่มีวงไอคอนของมัน ไม่ใช่ลืม แต่เป็นการไม่โชว์ลิงก์ที่ยังไม่มีปลายทางจริง */
  const marks = { facebook: FacebookMark, line_oa: LineMark, email: MailIcon } as const;

  return (
    <header className="v3-header">
      <div className="v3-header__left">
        <Link className="v3-header__brand v3-nl" href={landingActionContract.homeHref} aria-label="นายช่างหมู — CIVIL APPS ASSISTANT">
          <Image src={visualAssetUrl("brand_wordmark")} alt="" width={154} height={44} priority />
        </Link>

        <HeaderSlot icon={<PhoneIcon />} caption="บริการลูกค้า">
          <a className="v3-hslot__value v3-hd v3-nl" href={contactPlaceholders.phoneHref}>{contactPlaceholders.phoneDisplay}</a>
        </HeaderSlot>

        {viewer.user ? (
          <div className="v3-header__account">
            <AccountMenu user={viewer.user} isPlatformAdmin={viewer.isPlatformAdmin} apps={viewer.apps} />
          </div>
        ) : (
          <>
            <HeaderSlot icon={<DoorEnterIcon />} caption="เข้าสู่ระบบ">
              <SignInButton tone="plain" label="Login" />
            </HeaderSlot>
            <HeaderSlot icon={<PersonIcon />} caption="สมัครสมาชิก">
              {/* เว็บนี้เข้าระบบด้วย Google อย่างเดียว การสมัครกับการเข้าสู่ระบบจึงเป็นปุ่มเดียวกัน
                  ผืนออกแบบสั่งให้มีสองช่อง และเอกสารสั่งไว้ว่าถ้าไม่มีเส้นทางสมัครแยก
                  ให้ชี้ที่เดียวกับเข้าสู่ระบบ ซึ่ง grep แล้วว่าไม่มีจริง */}
              <SignInButton tone="plain" label="Register" />
            </HeaderSlot>
          </>
        )}
      </div>

      <div className="v3-header__right">
        <Link className="v3-header__cart v3-nl" href="#cart" aria-label="ตะกร้าสินค้า ยังไม่มีรายการ">
          <CartIcon />
          <span className="v3-header__cart-count v3-hd" aria-hidden="true">0</span>
        </Link>

        <span className="v3-header__rule" aria-hidden="true" />

        {channels.length > 0 ? (
          <div className="v3-header__channels">
            {channels.map((channel) => {
              const Mark = marks[channel.key];
              return (
                <a
                  key={channel.key}
                  className={`v3-header__channel v3-nl-icon v3-channel--${channel.key}`}
                  href={channel.href}
                  aria-label={channel.label}
                  target={channel.key === "email" ? undefined : "_blank"}
                  rel="noreferrer noopener"
                >
                  <Mark />
                </a>
              );
            })}
          </div>
        ) : null}

        <Button tone="shopNav" href={quoteHref}>ขอใบเสนอราคา</Button>
      </div>
    </header>
  );
}
