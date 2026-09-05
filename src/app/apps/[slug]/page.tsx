import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SignInButton } from "@/components/landing/sign-in-button";
import { AppShell } from "@/components/platform/app-shell";
import { getPlatformSessionUser } from "@/server/auth-session";
import { landingActionContract } from "@/lib/landing-interactions";
import { ESTIMETR_APP_SLUG } from "@/lib/estimeter-trial";
import { platformApps } from "@/lib/platform";
import { readAppOpenState } from "@/server/app-registry";
import { Button } from "@/components/platform/button";

export default async function AppBoundaryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = platformApps.find((item) => item.slug === slug);
  if (!app) notFound();

  // ESTIMETR owns /apps/estimeter with its own layout, guard and routes.
  if (slug === ESTIMETR_APP_SLUG) redirect(`/apps/${ESTIMETR_APP_SLUG}`);

  const user = await getPlatformSessionUser(await headers());

  if (!user) {
    return (
      <AppShell app={app}>
        <section className="app-workspace-intro">
          <div className="container">
            <div className="eyebrow">{app.eyebrow}</div>
            <h1>{app.name}</h1>
            <p>{app.description}</p>
            <p className="hero__note">ต้องเข้าสู่ระบบด้วยบัญชีนายช่างหมูก่อน ระบบจะตรวจสอบสิทธิ์การใช้งาน {app.name} บนฝั่งเซิร์ฟเวอร์หลังยืนยันตัวตน</p>
            <div className="hero__actions"><SignInButton /><Button tone="primary" href={landingActionContract.allAppsHref}>{landingActionContract.allAppsLabel}</Button></div>
          </div>
        </section>
      </AppShell>
    );
  }

  if (app.seededAccess === "doh_staff_only") {
    return (
      <AppShell app={app}>
        <section className="app-workspace-intro">
          <div className="container">
            <div className="eyebrow">{app.eyebrow}</div>
            <h1>{app.name}</h1>
            <p className="hero__note">{app.name} เปิดเฉพาะบุคลากรกรมทางหลวงที่ได้รับสิทธิ์ หากคุณควรเข้าถึงได้แต่ยังเปิดไม่ได้ กรุณาติดต่อผู้ดูแลสิทธิ์</p>
            <div className="hero__actions"><Button tone="primary" href={landingActionContract.allAppsHref}>{landingActionContract.allAppsLabel}</Button></div>
          </div>
        </section>
      </AppShell>
    );
  }

  /**
   * ADR 0014: when the registry says an app is announced but not open, the door is shut here. A
   * switch labelled off that lets people through teaches the administrator that the control is a
   * decoration. `unknown` — no row, or a database that could not be read — keeps the behaviour the
   * product had before the registry existed, because one outage must not close every app; and the
   * authorization gate is `app_entitlements`, which is untouched either way.
   */
  const openState = await readAppOpenState(slug);
  if (openState === "preparing") {
    return (
      <AppShell app={app}>
        <section className="app-workspace-intro">
          <div className="container">
            <div className="eyebrow">{app.eyebrow}</div>
            <h1>{app.name}</h1>
            <p className="hero__note">
              {app.name} ประกาศไว้แล้วแต่ยังกำลังเตรียมระบบอยู่ จึงยังเปิดหน้าทำงานไม่ได้
              เมื่อผู้ดูแลเปิดใช้งาน หน้านี้จะเปิดให้ทันทีโดยไม่ต้องสมัครอะไรเพิ่ม
            </p>
            <div className="hero__actions">
              <Button tone="primary" href={landingActionContract.allAppsHref}>{landingActionContract.allAppsLabel}</Button>
            </div>
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell app={app}>
      <section className="app-workspace-intro">
        <div className="container">
          <div className="eyebrow">{app.eyebrow}</div>
          <h1>{app.name}</h1>
          <p>{app.description}</p>
          {/* ข้อความเดิมเป็นศัพท์ครัวหลังบ้าน (app shell / workflow / roadmap) บนหน้าลูกค้า —
              เปลี่ยนเป็นภาษาลูกค้าตามคำสั่งเจ้าของงาน 2026-08-28 */}
          <p className="hero__note">ความสามารถเพิ่มเติมของแอปนี้จะทยอยเปิดให้ใช้งาน</p>
          <div className="hero__actions"><Button tone="primary" href={landingActionContract.allAppsHref}>{landingActionContract.allAppsLabel}</Button></div>
        </div>
      </section>
    </AppShell>
  );
}
