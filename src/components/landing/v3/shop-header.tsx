import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { FacebookMark, LineMark } from "@/components/icons/brand-icons";
import { CartIcon, DoorEnterIcon, HeadsetIcon, MailIcon, PersonIcon } from "@/components/icons/platform-icons";
import { SignInButton } from "@/components/landing/sign-in-button";
import { AccountMenu } from "@/components/platform/account-menu";
import { Button } from "@/components/platform/button";
import { readViewer } from "@/components/platform/site-header";
import { landingActionContract, landingNavigationContract } from "@/lib/landing-interactions";
import { visualAssetUrl } from "@/lib/visual-assets";
import type { ChannelKey } from "@/lib/platform-channels";
import { readPublishedChannels } from "@/server/platform-channels";

/**
 * แถบบนของหน้าร้าน — โครงจากผืนออกแบบรุ่นสาม ส่วนที่ 5 ข้อ 1
 *
 * **แทน `SiteHeader` เฉพาะหน้าแรก** หน้าอื่นทั้งเว็บยังใช้แถบเดิม เพราะแถบเดิมเป็นแถบนำทาง
 * ของแพลตฟอร์ม ส่วนตัวนี้เป็นแถบของหน้าร้าน ซึ่งมีตะกร้าและช่องทางติดต่ออยู่ในตัว
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
  /* **ตารางนี้ไม่ครบทุกชนิดโดยตั้งใจ จึงต้องเป็น `Partial`** ชนิดที่ยังไม่มีรูปให้วาด เช่น
     `phone` ที่เป็นช่องสองบรรทัดไม่ใช่วงไอคอน และ YouTube ที่ยังไม่เข้าทะเบียน จะได้
     `undefined` ซึ่ง TypeScript ต้องมองเห็น · ถ้าประกาศเป็น `as const` เฉย ๆ ตัวตรวจชนิด
     จะเชื่อว่าหยิบได้เสมอ แล้วการกันพลาดตอนรันจะกลายเป็นเงื่อนไขที่มันบอกว่าไม่มีวันเป็นเท็จ */
  const marks: Partial<Record<ChannelKey, typeof FacebookMark | typeof LineMark | typeof MailIcon>> = {
    facebook: FacebookMark,
    line_oa: LineMark,
    email: MailIcon
  };

  /* ช่องโทรศัพท์ไม่ใช่วงไอคอน มันเป็นช่องสองบรรทัดที่อยู่คนละฝั่งของแถบ จึงหยิบออกมาต่างหาก */
  const phone = channels.find((channel) => channel.key === "phone") ?? null;

  /**
   * **แถววงไอคอนรับเฉพาะชนิดที่มีรูปให้วาด ไม่ใช่ทุกชนิดที่ทะเบียนคืนมา**
   *
   * เดิมโค้ดหยิบ `marks[channel.key]` ตรง ๆ โดยถือว่าทุกชนิดต้องมีรูปเสมอ ซึ่งจริงตอนที่
   * ทะเบียนมีสามชนิดพอดี · วันที่เพิ่มชนิด `phone` เข้ามา มันจะได้ `undefined` แล้ว
   * **ทั้งหน้าพังตอนเรนเดอร์** ไม่ใช่แค่ไอคอนหาย เพราะ React เรียกคอมโพเนนต์ที่ไม่มีอยู่จริง
   *
   * กรองด้วยการมีอยู่ของรูปแทนการไล่ชื่อชนิดที่ไม่เอา ทำให้ชนิดถัดไปที่ยังไม่มีรูป เช่น
   * YouTube ที่รออยู่ ไม่ต้องมาแก้ตรงนี้อีก — มันจะไม่ขึ้นเอง ซึ่งเป็นพฤติกรรมที่ถูกอยู่แล้ว
   */
  const iconChannels = channels.flatMap((channel) => {
    const Mark = marks[channel.key];
    return Mark ? [{ channel, Mark }] : [];
  });

  return (
    <header className="v3-header">
      <div className="v3-header__left">
        <Link className="v3-header__brand v3-nl" href={landingActionContract.homeHref} aria-label="นายช่างหมู — CIVIL APPS ASSISTANT">
          <Image src={visualAssetUrl("brand_wordmark")} alt="" width={154} height={44} priority />
        </Link>

        {/* ช่องโทรศัพท์เป็นช่องแรกตามผืน (`redesign/V3/Home Redesign v3.dc.html` บรรทัด 24)
            ทะเบียนรับชนิด `phone` แล้วตั้งแต่ 2026-09-07 · **แต่เบอร์ยังไม่ถูกกรอก ช่องนี้
            จึงยังไม่ขึ้น** กติกาเดียวกับ LINE และ YouTube คือช่องที่ผู้ดูแลยังไม่กรอกต้องไม่ขึ้น
            (คำวินิจฉัย 2026-08-28) · กรอกที่ `/admin/channels` แล้วขึ้นเองโดยไม่ต้องแก้โค้ด

            เบอร์ต่างจากราคาตรงที่ติดป้าย "ตัวอย่าง รอยืนยัน" ไม่ได้ คนเห็นเบอร์แล้วโทร
            ไม่ได้อ่านป้าย และปลายสายเป็นคนจริงที่ไม่รู้เรื่องด้วย จึงห้ามพิมพ์เบอร์ตายไว้ที่นี่
            แม้จะรู้เบอร์แล้วก็ตาม */}
        {phone ? (
          <a className="v3-hslot v3-nl-item v3-nl" href={phone.href}>
            <span className="v3-hslot__icon" aria-hidden="true"><HeadsetIcon /></span>
            <span className="v3-hslot__text">
              <span className="v3-hslot__caption">บริการลูกค้า</span>
              {/* `.v3-hd` เพราะเป็นช่องตัวเลข — เลขที่กว้างไม่เท่ากันทำให้เบอร์อ่านยาก
                  และ `numeric-font-fence` เฝ้าคลาสนี้อยู่ · ห้ามตัดบรรทัดตามผืน */}
              <span className="v3-hslot__value v3-hd">{phone.display}</span>
            </span>
          </a>
        ) : null}

        {viewer.user ? (
          <div className="v3-header__account">
            <AccountMenu user={viewer.user} isPlatformAdmin={viewer.isPlatformAdmin} apps={viewer.apps} />
          </div>
        ) : (
          <>
            <HeaderSlot icon={<DoorEnterIcon />} caption="เข้าสู่ระบบ">
              <SignInButton tone="plain" size="fit" label="Login" />
            </HeaderSlot>
            <HeaderSlot icon={<PersonIcon />} caption="สมัครสมาชิก">
              {/* เว็บนี้เข้าระบบด้วย Google อย่างเดียว การสมัครกับการเข้าสู่ระบบจึงเป็นปุ่มเดียวกัน
                  ผืนออกแบบสั่งให้มีสองช่อง และเอกสารสั่งไว้ว่าถ้าไม่มีเส้นทางสมัครแยก
                  ให้ชี้ที่เดียวกับเข้าสู่ระบบ ซึ่ง grep แล้วว่าไม่มีจริง */}
              <SignInButton tone="plain" size="fit" label="Register" />
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

        {iconChannels.length > 0 ? (
          <div className="v3-header__channels">
            {iconChannels.map(({ channel, Mark }) => {
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

        <Button tone="shopNav" size={40} href={quoteHref}>ขอใบเสนอราคา</Button>
      </div>
    </header>
  );
}
