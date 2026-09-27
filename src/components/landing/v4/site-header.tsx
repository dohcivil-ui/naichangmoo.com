import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { FacebookMark, LineMark, YouTubeMark } from "@/components/icons/brand-icons";
import { CartIcon, DoorEnterIcon, HeadsetIcon, MailIcon, PersonIcon } from "@/components/icons/platform-icons";
import { SignInButton } from "@/components/landing/sign-in-button";
import { AccountMenu } from "@/components/platform/account-menu";
import { readViewer } from "@/components/platform/site-header";
import { landingActionContract } from "@/lib/landing-interactions";
import { channelKinds, type ChannelKey } from "@/lib/platform-channels";
import { visualAssetUrl } from "@/lib/visual-assets";
import { HeaderShell } from "./header-shell";
import { LineCta } from "./line-cta";
import { PendingChannel } from "./pending-channel";

/** ช่องทางที่ `readPublishedChannels()` คืนมา — ส่งเข้ามาจาก page ไม่อ่านซ้ำที่นี่ */
export type PublishedChannel = { key: ChannelKey; href: string; label: string; display: string };

function NavSlot({ icon, caption, children }: { icon: ReactNode; caption: string; children: ReactNode }) {
  return (
    <div className="v4-nav-item">
      <span className="v4-nav-item__icon" aria-hidden="true">{icon}</span>
      <span className="v4-nav-item__text">
        <span className="v4-nav-item__caption">{caption}</span>
        {children}
      </span>
    </div>
  );
}

/**
 * แถบบนรุ่นสี่ — โครงเดียวกับ `v3/shop-header.tsx` (session ตัวเดียว ช่องทางจากทะเบียน)
 * ต่างที่หน้าตาและพฤติกรรมย่อเมื่อเลื่อน
 *
 * เบอร์โทร LINE Facebook YouTube อีเมล มาจาก `/admin/channels` ทั้งหมด ห้ามพิมพ์ตาย
 * (เบอร์ 08 4989 1456 ในผืนต้องกรอกที่หน้าผู้ดูแล)
 *
 * **คำตัดสินเจ้าของงาน 2026-09-28 แทนที่คำตัดสิน 2026-08-28 เฉพาะหน้าแรก v4:**
 * ปุ่มและไอคอนช่องทางติดต่อต้องแสดงตามผืนเสมอ ไม่ซ่อนเมื่อยังไม่กรอก · ช่องที่ยังไม่มีค่า
 * **กดได้และมีท่าทางเหมือนปุ่มปกติทุกอย่าง แต่กดแล้วไม่พาไปไหน** ขึ้นข้อความสั้น ๆ แทน
 * (`PendingChannel` — รอบสองของคำตัดสินเดียวกัน แทนรอบแรกที่ให้เป็น disabled)
 * · ช่องบริการลูกค้าขึ้นเสมอ ไม่มีเบอร์ = "เร็ว ๆ นี้"
 * · ไอคอนโซเชียลครบสี่วงเสมอ เรียง Facebook, LINE, YouTube, อีเมล
 * · ตะกร้าแสดง badge "0" ตามผืน
 * ท้ายเว็บ (`PlatformFooter`) ยังใช้กติกาเดิม คือซ่อนช่องที่ยังไม่กรอก
 */
export async function V4SiteHeader({ channels, lineHref }: { channels: readonly PublishedChannel[]; lineHref: string | null }) {
  const viewer = await readViewer();
  const phone = channels.find((c) => c.key === "phone") ?? null;
  /* ลำดับตามผืน · ป้ายมาจากทะเบียนชนิดช่องทาง จึงมีป้ายแม้ช่องนั้นยังไม่กรอก */
  const socials = ([
    ["facebook", FacebookMark, "ยังไม่ได้ตั้งค่าเพจ Facebook"],
    ["line_oa", LineMark, "ยังไม่ได้ตั้งค่า LINE OA"],
    ["youtube", YouTubeMark, "ยังไม่ได้ตั้งค่าช่อง YouTube"],
    ["email", MailIcon, "ยังไม่ได้ตั้งค่าอีเมล"]
  ] as const).map(([key, Mark, pendingMessage]) => ({
    key,
    Mark,
    pendingMessage,
    label: channelKinds.find((kind) => kind.key === key)?.label ?? key,
    channel: channels.find((c) => c.key === key) ?? null
  }));

  return (
    <HeaderShell>
      <div className="v4-header__inner">
        <Link className="v4-header__brand" href={landingActionContract.homeHref} aria-label="นายช่างหมู — CIVIL APPS ASSISTANT">
          <Image className="v4-header__logo" src={visualAssetUrl("brand_wordmark")} alt="" width={224} height={64} priority />
        </Link>

        <div className="v4-header__right">
          {phone ? (
            <a className="v4-nav-item" href={phone.href}>
              <span className="v4-nav-item__icon" aria-hidden="true"><HeadsetIcon /></span>
              <span className="v4-nav-item__text">
                <span className="v4-nav-item__caption">บริการลูกค้า</span>
                <span className="v4-nav-item__value v3-hd">{phone.display}</span>
              </span>
            </a>
          ) : (
            <PendingChannel as="plain" className="v4-nav-item" message="ยังไม่ได้ตั้งค่าเบอร์โทร">
              <span className="v4-nav-item__icon" aria-hidden="true"><HeadsetIcon /></span>
              <span className="v4-nav-item__text">
                <span className="v4-nav-item__caption">บริการลูกค้า</span>
                <span className="v4-nav-item__value">เร็ว ๆ นี้</span>
              </span>
            </PendingChannel>
          )}

          {viewer.user ? (
            <div className="v4-header__account">
              <AccountMenu user={viewer.user} isPlatformAdmin={viewer.isPlatformAdmin} apps={viewer.apps} />
            </div>
          ) : (
            <>
              <NavSlot icon={<DoorEnterIcon />} caption="เข้าสู่ระบบ">
                <SignInButton tone="plain" size="fit" label="Login" />
              </NavSlot>
              <NavSlot icon={<PersonIcon />} caption="สมัครสมาชิก">
                <SignInButton tone="plain" size="fit" label="Register" />
              </NavSlot>
            </>
          )}

          {/* badge "0" ตามผืน — เจ้าของงานเคาะ 2026-09-28 · ตะกร้ายังไม่มีแหล่งข้อมูล
              วันที่มีระบบตะกร้าจริง ต้องเปลี่ยนเลขนี้ให้อ่านจากข้อมูล ไม่ใช่ค่าคงที่ */}
          <Link className="v4-nav-item v4-cart" href="#cart" aria-label="ตะกร้าสินค้า ยังไม่มีรายการ">
            <CartIcon />
            <span className="v4-cart__count v3-hd" aria-hidden="true">0</span>
          </Link>

          <div className="v4-socials">
            {socials.map(({ key, Mark, label, pendingMessage, channel }) =>
              channel ? (
                <a
                  key={key}
                  className={`v4-social v4-social--${key}`}
                  href={channel.href}
                  aria-label={label}
                  target={key === "email" ? undefined : "_blank"}
                  rel="noreferrer noopener"
                >
                  <Mark />
                </a>
              ) : (
                <PendingChannel key={key} as="plain" className={`v4-social v4-social--${key}`} ariaLabel={label} message={pendingMessage}>
                  <Mark />
                </PendingChannel>
              )
            )}
          </div>

          <div className="v4-header__cta">
            <LineCta href={lineHref} size="sm" />
          </div>
        </div>
      </div>
    </HeaderShell>
  );
}
