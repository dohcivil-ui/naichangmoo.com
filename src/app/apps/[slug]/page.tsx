import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { EstimationWorkspace } from "@/components/estimeter/estimation-workspace";
import { SignInButton } from "@/components/landing/sign-in-button";
import { AppShell } from "@/components/platform/app-shell";
import { getPlatformSessionUser } from "@/lib/auth-session";
import { platformApps } from "@/lib/platform";

export default async function AppBoundaryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = platformApps.find((item) => item.slug === slug);
  if (!app) notFound();

  const user = await getPlatformSessionUser(await headers());

  if (!user) {
    return (
      <AppShell app={app}>
        <section className="app-workspace-intro">
          <div className="container">
            <div className="eyebrow">{app.eyebrow}</div>
            <h1>{app.name}</h1>
            <p>{app.description}</p>
            <p className="hero__note">ต้องเข้าสู่ระบบด้วยบัญชีนายช่างหมูก่อน ระบบจะตรวจสิทธิ์การใช้งาน {app.name} บนฝั่งเซิร์ฟเวอร์หลังยืนยันตัวตน</p>
            <div className="hero__actions"><SignInButton /><Link className="button button--orange micro-button" href="/">กลับหน้ารวมแอป</Link></div>
          </div>
        </section>
      </AppShell>
    );
  }

  if (app.access === "doh_staff_only") {
    return (
      <AppShell app={app}>
        <section className="app-workspace-intro">
          <div className="container">
            <div className="eyebrow">{app.eyebrow}</div>
            <h1>{app.name}</h1>
            <p className="hero__note">{app.name} เปิดเฉพาะบุคลากรกรมทางหลวงที่ได้รับสิทธิ์ หากคุณควรเข้าถึงได้แต่ยังเปิดไม่ได้ กรุณาติดต่อผู้ดูแลสิทธิ์</p>
            <div className="hero__actions"><Link className="button button--orange micro-button" href="/">กลับหน้ารวมแอป</Link></div>
          </div>
        </section>
      </AppShell>
    );
  }

  if (slug === "estimeter") {
    return <AppShell app={app}><EstimationWorkspace /></AppShell>;
  }

  return (
    <AppShell app={app}>
      <section className="app-workspace-intro">
        <div className="container">
          <div className="eyebrow">{app.eyebrow}</div>
          <h1>{app.name}</h1>
          <p>{app.description}</p>
          <p className="hero__note">หน้านี้ใช้ app shell, navigation, status labels และ responsive system ชุดเดียวกับทุกแอปใน platform โดย workflow เฉพาะจะเปิดตาม roadmap ที่อนุมัติ</p>
          <div className="hero__actions"><Link className="button button--orange micro-button" href="/">กลับหน้ารวมแอป</Link></div>
        </div>
      </section>
    </AppShell>
  );
}
