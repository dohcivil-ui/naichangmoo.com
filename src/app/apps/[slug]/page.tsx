import Link from "next/link";
import { notFound } from "next/navigation";
import { platformApps } from "@/lib/platform";

export default async function AppBoundaryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = platformApps.find((item) => item.slug === slug);
  if (!app) notFound();

  return (
    <main className="site-shell">
      <section className="hero"><div className="container"><div className="eyebrow">{app.eyebrow}</div><h1 style={{ maxWidth: 720 }}>{app.name}</h1><p>{app.description}</p><p className="hero__note">Initial Project จะเปิด workflow และสิทธิ์จริงของ app นี้ตาม roadmap ที่อนุมัติ ไม่แสดงหน้า dashboard ที่ไม่มีงานให้ทำ</p><div className="hero__actions"><Link className="button button--orange" href="/">กลับหน้ารวมแอป</Link></div></div></section>
    </main>
  );
}
