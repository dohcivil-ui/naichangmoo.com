import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { SignInButton } from "@/components/landing/sign-in-button";
import { auth } from "@/lib/auth";
import { platformApps } from "@/lib/platform";

export default async function AppBoundaryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = platformApps.find((item) => item.slug === slug);
  if (!app) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  const isSignedIn = Boolean(session?.user);
  const isStaffOnly = app.access === "doh_staff_only";

  return (
    <main className="site-shell">
      <section className="hero">
        <div className="container">
          <div className="eyebrow">{app.eyebrow}</div>
          <h1 style={{ maxWidth: 720 }}>{app.name}</h1>
          <p>{app.description}</p>
          {!isSignedIn ? (
            <>
              <p className="hero__note">ต้องเข้าสู่ระบบด้วยบัญชีนายช่างหมูก่อน ระบบจะตรวจสิทธิ์การใช้งาน {app.name} บนฝั่งเซิร์ฟเวอร์หลังยืนยันตัวตน</p>
              <div className="hero__actions"><SignInButton /><Link className="button button--orange" href="/">กลับหน้ารวมแอป</Link></div>
            </>
          ) : isStaffOnly ? (
            <>
              <p className="hero__note">{app.name} เปิดเฉพาะบุคลากรกรมทางหลวงที่ได้รับสิทธิ์ หากคุณควรเข้าถึงได้แต่ยังเปิดไม่ได้ กรุณาติดต่อผู้ดูแลสิทธิ์</p>
              <div className="hero__actions"><Link className="button button--orange" href="/">กลับหน้ารวมแอป</Link></div>
            </>
          ) : (
            <>
              <p className="hero__note">คุณเข้าสู่ระบบแล้ว Workflow และการตรวจ App Entitlement จริงของ {app.name} จะเปิดตาม roadmap ที่อนุมัติ</p>
              <div className="hero__actions"><Link className="button button--orange" href="/">กลับหน้ารวมแอป</Link></div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
