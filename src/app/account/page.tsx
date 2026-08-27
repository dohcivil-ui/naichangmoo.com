import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { PlatformFooter } from "@/components/platform/platform-footer";
import { SiteHeader } from "@/components/platform/site-header";
import { SignOutOtherDevices } from "@/components/platform/sign-out-others";
import { getPlatformSessionUser } from "@/server/auth-session";
import { landingActionContract } from "@/lib/landing-interactions";
import { entitlementStateLabel } from "@/lib/platform-admin-labels";
import { formatThaiDate, formatThaiDateTime } from "@/lib/thai-format";
import { readMemberAppAccess, readMemberOrganizations, readMemberSessions } from "@/server/member-account";
import { resolvePlatformAdmin } from "@/server/platform-admin";

export const metadata = {
  title: "บัญชีของฉัน | นายช่างหมู",
  robots: { index: false, follow: false }
};

const organizationKindLabel: Record<string, string> = {
  personal: "ส่วนบุคคล",
  company: "บริษัท/ห้างหุ้นส่วน",
  government: "หน่วยงานราชการ"
};

const memberRoleLabel: Record<string, string> = {
  owner: "เจ้าของ",
  admin: "ผู้ดูแล",
  member: "สมาชิก",
  viewer: "ผู้อ่าน"
};

/**
 * What the platform knows about the person looking, and the few things they can act on.
 *
 * Everything here is read-only on purpose. Name, photo and email arrive from the identity provider
 * and are captured at sign-in; a form that let someone edit them here would either be a lie (the
 * next sign-in overwrites it) or a second source of truth. Where a value comes from somewhere else,
 * the page says where instead of pretending otherwise.
 */
export default async function AccountPage() {
  const user = await getPlatformSessionUser(await headers());

  if (!user) {
    return (
      <main className="site-shell">
        <SiteHeader />
        <div className="container account-page">
          <section className="account-page__card">
            <h1>ต้องเข้าสู่ระบบก่อน</h1>
            <p>หน้านี้แสดงข้อมูลบัญชีของผู้ที่เข้าสู่ระบบแล้ว</p>
            <Link className="button button--ghost" href={landingActionContract.homeHref}>
              {landingActionContract.homeLabel}
            </Link>
          </section>
        </div>
        <PlatformFooter />
      </main>
    );
  }

  const [administrator, apps, memberships, activeSessions] = await Promise.all([
    resolvePlatformAdmin(),
    readMemberAppAccess(user.id),
    readMemberOrganizations(user.id),
    readMemberSessions(user.id)
  ]);

  // Every session but the one serving this request. The current one is not identified by id here,
  // so the count is one fewer than the total rather than a filtered list.
  const otherSessionCount = Math.max(0, activeSessions.length - 1);

  return (
    <main className="site-shell">
      <SiteHeader />
      <div className="container account-page">
        <header className="account-page__head">
          <p className="eyebrow">บัญชีของฉัน</p>
          <h1>{user.name.trim() || user.email}</h1>
        </header>

        <section className="account-page__card">
          <h2>ข้อมูลส่วนตัว</h2>
          <div className="account-page__profile">
            {user.image ? (
              <Image className="account-page__photo" src={user.image} alt="" width={72} height={72} />
            ) : null}
            <dl className="account-page__facts">
              <div>
                <dt>ชื่อที่แสดง</dt>
                <dd>{user.name.trim() || "—"}</dd>
              </div>
              <div>
                <dt>อีเมล</dt>
                <dd>{user.email}</dd>
              </div>
              <div>
                <dt>สถานะในแพลตฟอร์ม</dt>
                <dd>{administrator.ok ? "ผู้ดูแลแพลตฟอร์ม" : "สมาชิก"}</dd>
              </div>
            </dl>
          </div>
          <p className="account-page__note">
            ชื่อ รูปโปรไฟล์ และอีเมล มาจากบัญชี Google ที่ใช้เข้าสู่ระบบ แก้ไขที่บัญชี Google แล้วเข้าสู่ระบบใหม่
            ค่าที่นี่จึงจะเปลี่ยนตาม การกรอกชื่อจริง ข้อมูลติดต่อ และการรับข่าวสารเป็นงานที่ยังไม่เปิด
          </p>
        </section>

        <section className="account-page__card">
          <h2>สิทธิ์การใช้งาน</h2>
          {apps.length === 0 ? (
            <p className="account-page__empty">ยังไม่มีสิทธิ์ใช้แอปใด เริ่มทดลองใช้ได้จากหน้าแอป</p>
          ) : (
            <ul className="account-page__list">
              {apps.map((app) => (
                <li key={app.slug}>
                  <div className="account-page__row-main">
                    <Link className="text-link" href={`/apps/${app.slug}`}>
                      {app.name}
                    </Link>
                    <span className="account-page__chip">{entitlementStateLabel[app.state] ?? app.state}</span>
                  </div>
                  <p className="account-page__row-note">
                    {app.endsAtIso ? `ถึง ${formatThaiDate(app.endsAtIso)}` : "ไม่มีกำหนดสิ้นสุด"}
                    {app.daysRemaining !== null ? ` · เหลือ ${app.daysRemaining.toLocaleString("th-TH")} วัน` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="account-page__card">
          <h2>องค์กรที่สังกัด</h2>
          {memberships.length === 0 ? (
            <p className="account-page__empty">ยังไม่ได้สังกัดองค์กรใด</p>
          ) : (
            <ul className="account-page__list">
              {memberships.map((organization) => (
                <li key={organization.id}>
                  <div className="account-page__row-main">
                    <strong>{organization.name}</strong>
                    <span className="account-page__chip">
                      {memberRoleLabel[organization.role] ?? organization.role}
                    </span>
                  </div>
                  <p className="account-page__row-note">
                    {organizationKindLabel[organization.kind] ?? organization.kind}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="account-page__note">
            สิทธิ์การใช้งานเป็นของ<strong>องค์กร</strong> ไม่ใช่ของบุคคล องค์กรส่วนบุคคลถูกสร้างให้อัตโนมัติเมื่อเข้าสู่ระบบครั้งแรก
          </p>
        </section>

        <section className="account-page__card">
          <h2>อุปกรณ์ที่เข้าระบบอยู่</h2>
          <p className="account-page__count">{activeSessions.length.toLocaleString("th-TH")} อุปกรณ์</p>
          {activeSessions.length > 0 ? (
            <ul className="account-page__list">
              {activeSessions.map((session) => (
                <li key={session.id}>
                  <div className="account-page__row-main">
                    <strong>{formatThaiDateTime(session.createdAtIso) ?? "—"}</strong>
                  </div>
                  <p className="account-page__row-note">
                    หมดอายุ {formatThaiDateTime(session.expiresAtIso) ?? "—"}
                    {session.userAgent ? ` · ${session.userAgent.slice(0, 60)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
          <SignOutOtherDevices otherSessionCount={otherSessionCount} />
        </section>
      </div>
      <PlatformFooter />
    </main>
  );
}
