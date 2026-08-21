import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/platform/app-shell";
import { platformApps } from "@/lib/platform";

export default async function AppBoundaryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = platformApps.find((item) => item.slug === slug);
  if (!app) notFound();

  return (
    <AppShell app={app}>
      <section className="app-workspace-intro"><div className="container"><div className="eyebrow">{app.eyebrow}</div><h1>{app.name}</h1><p>{app.description}</p><p className="hero__note">หน้านี้ใช้ app shell, navigation, status labels และ responsive system ชุดเดียวกับทุกแอปใน platform โดย workflow เฉพาะจะเปิดตาม roadmap ที่อนุมัติ</p><div className="hero__actions"><Link className="button button--orange micro-button" href="/">กลับหน้ารวมแอป</Link></div></div></section>
    </AppShell>
  );
}
