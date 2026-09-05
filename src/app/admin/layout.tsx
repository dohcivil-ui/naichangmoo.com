import Link from "next/link";
import { BrandLogo } from "@/components/platform/brand-logo";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { landingActionContract } from "@/lib/landing-interactions";
import { resolvePlatformAdmin } from "@/server/platform-admin";
import { Button } from "@/components/platform/button";

export const metadata = {
  title: "หลังบ้าน | นายช่างหมู",
  robots: { index: false, follow: false }
};

const REFUSAL_COPY: Record<string, { title: string; detail: string }> = {
  unauthenticated: {
    title: "ต้องเข้าสู่ระบบก่อน",
    detail: "หน้านี้เปิดเฉพาะผู้ดูแลแพลตฟอร์ม เข้าสู่ระบบด้วยบัญชีที่ได้รับสิทธิ์แล้วลองอีกครั้ง"
  },
  not_an_administrator: {
    title: "บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลแพลตฟอร์ม",
    detail: "สิทธิ์นี้ต้องมีผู้ดูแลที่มีอยู่เป็นคนมอบให้ และการมอบทุกครั้งถูกบันทึกไว้ ถ้าคิดว่าควรมีสิทธิ์ ให้ติดต่อผู้ดูแลที่ดูแลอยู่"
  },
  unavailable: {
    title: "ตรวจสอบสิทธิ์ไม่ได้ในขณะนี้",
    detail: "ระบบอ่านข้อมูลสิทธิ์ไม่สำเร็จ จึงปฏิเสธไว้ก่อน การอ่านไม่สำเร็จไม่ใช่หลักฐานว่ามีสิทธิ์"
  }
};

/**
 * The guard for every back-office page. ADR 0012: the check is here, on the server, and it refuses
 * on anything short of an unrevoked grant — including a database it cannot read. Hiding the nav
 * would not be a check, so the nav is never rendered for someone who has not passed one.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const result = await resolvePlatformAdmin();

  if (!result.ok) {
    const copy = REFUSAL_COPY[result.reason] ?? REFUSAL_COPY.unavailable;
    return (
      <main className="admin-refusal">
        <div className="admin-refusal__card">
          <BrandLogo />
          <h1>{copy.title}</h1>
          <p>{copy.detail}</p>
          <Button tone="quiet" href={landingActionContract.homeHref}>
            {landingActionContract.homeLabel}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <div className="admin-shell">
      <AdminSidebar />
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar__title">
            <p className="eyebrow">หลังบ้าน</p>
            <h1>จัดการแพลตฟอร์ม</h1>
          </div>
          <div className="admin-topbar__account">
            <div className="admin-topbar__who">
              <strong>{result.admin.name}</strong>
              <span>{result.admin.email}</span>
            </div>
            <Link className="text-link" href={landingActionContract.homeHref}>
              {landingActionContract.homeLabel}<span aria-hidden="true">→</span>
            </Link>
          </div>
        </header>
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
