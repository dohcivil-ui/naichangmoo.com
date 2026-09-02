import type { ReactNode } from "react";
import Link from "next/link";
import type { PlatformApp } from "@/lib/platform";
import { describeCardClaims } from "@/lib/catalogue-card";
import { landingActionContract } from "@/lib/landing-interactions";
import { AssistantDockHost } from "@/components/platform/assistant-dock";
import { PlatformFooter } from "@/components/platform/platform-footer";
import { AccountMenuSlot, SiteHeader } from "@/components/platform/site-header";
import { readCatalogueClaims } from "@/server/app-registry";

/**
 * ทางออกจากแอปเป็นปุ่มรูปบ้านกับป้ายหน้าที่ ไม่ใช่ "← ชื่อแบรนด์" เพราะลูกศรซ้ายตามด้วย
 * ชื่อแบรนด์คือแบบแผนของคู่แข่งเป๊ะ ("← ช่างคิด") เจ้าของงานสั่งเมื่อ 2026-08-26 ห้ามใช้รูปแบบนั้น
 * คำวินิจฉัยนี้เคยอยู่ในแถบของ PRICEMETR ที่เขียนเอง (gl-platbar) — การย้ายแถบนั้นเข้าเปลือกกลาง
 * (IP-157) ยกกติกาให้เป็นของทุกแอปตามไปด้วย คำบนป้ายมาจาก landingActionContract ไม่พิมพ์มือ
 */
function HomeDoor() {
  return (
    <Link className="app-shell__home" href={landingActionContract.homeHref} title="กลับหน้ารวมนายช่างหมู">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 11 12 4l8 7" />
        <path d="M6 10v9h12v-9" />
      </svg>
      {landingActionContract.homeLabel}
    </Link>
  );
}

/**
 * โหมด prototype มีไว้ให้ต้นแบบนอก /apps สวมเปลือกเดียวกันโดยไม่กลายเป็นการประกาศ (ADR 0014/0015):
 * ไม่อ่านทะเบียน ไม่มีป้ายสิทธิ์ มีป้าย "ต้นแบบ" บอกตรง ๆ ว่าหน้านี้ยังไม่ใช่แอปที่ประกาศแล้ว
 * และข้ามบล็อกชื่อแอป เพราะ workspace ของต้นแบบมีหัวเรื่องใหญ่ของตัวเองอยู่แล้ว
 */
/**
 * โหมด workspace มีไว้ให้หน้าที่เป็นพื้นที่ทำงานเต็มจอ เช่น การวัดปริมาณบนแบบ
 *
 * เปลือกเหลือแถบเดียว — ทางกลับบ้าน ทางไปแอปทั้งหมด ชื่อแอป ป้ายสิทธิ์ และเมนูบัญชี —
 * แล้วยกพื้นที่ที่เหลือทั้งจอให้เนื้องาน **ไม่มีหัวแอปและไม่มีท้ายเว็บ** เพราะคนที่กำลังวัดแบบ
 * ต้องการผืนวาด ไม่ใช่หน้าเว็บที่ต้องเลื่อนลงไปหาผืนวาด
 *
 * สิ่งที่ยังเหมือนทุกโหมดและห้ามหาย — ทางออกจากแอปที่เห็นได้ตลอดเวลา (skill `app-shell`
 * บอกว่าคนที่หาทางออกไม่เจอจะปิดแท็บทิ้ง) และแผงผู้ช่วยกลางที่ห่อเนื้อหาไว้
 */
export async function AppShell({
  app,
  mode = "app",
  children
}: {
  app: PlatformApp;
  mode?: "app" | "prototype" | "workspace";
  children: ReactNode;
}) {
  /**
   * The access badge on the context bar used to read `app.seededAccess` — the fourth place in the
   * product stating terms nobody announced, and the one ADR 0014's closing note missed because it
   * named only the landing page and /market/[slug]. ADR 0015 governs it like the rest: an app the
   * registry has not spoken for shows no badge here either.
   */
  const says = mode === "prototype" ? null : describeCardClaims((await readCatalogueClaims())[app.slug]);

  if (mode === "workspace") {
    return (
      <main className="site-shell app-shell app-shell--workspace">
        <section className="app-shell__context">
          <div className="app-shell__context-inner">
            <HomeDoor />
            <span aria-hidden="true">/</span>
            <Link href={landingActionContract.allAppsHref}>{landingActionContract.allAppsLabel}</Link>
            <span aria-hidden="true">/</span>
            <strong>{app.name}</strong>
            {says?.access ? <span className={`access access--${says.access.modifier}`}>{says.access.label}</span> : null}
            <AccountMenuSlot />
          </div>
        </section>
        <AssistantDockHost>{children}</AssistantDockHost>
      </main>
    );
  }

  return (
    <main className="site-shell app-shell">
      <SiteHeader workspace={app.name} />
      {/* IP-185: Assistant Dock (แผงผู้ช่วยกลาง) ห่อทุกอย่างใต้แถบนำทางในทั้งสองโหมด —
          ผู้ช่วยตัวแรกที่เสียบแล้วคือ work-plan (IP-184 — เสียบผ่าน <AppAssistant>)
          หน้าที่ไม่มีการลงทะเบียนผู้ช่วย Host เป็นแค่ div เปล่า ไม่มีแผงแม้แต่ปุ่ม
          ตอนกางบนเดสก์ท็อป เนื้อหาทั้งก้อนนี้ถูกดันหลบด้วย padding ไม่ใช่ถูกบัง */}
      <AssistantDockHost>
        <section className="app-shell__context"><div className="container"><HomeDoor /><span aria-hidden="true">/</span><Link href={landingActionContract.allAppsHref}>{landingActionContract.allAppsLabel}</Link><span aria-hidden="true">/</span><strong>{app.name}</strong>{mode === "prototype" ? <span className="access access--prototype">ต้นแบบ</span> : says?.access ? <span className={`access access--${says.access.modifier}`}>{says.access.label}</span> : null}</div></section>
        {mode === "app" ? (
          /*
            Every app says what it is in the same place, so arriving from a link never leaves someone
            guessing what they opened. Deliberately compact: some app pages carry their own heading, and
            two large headings stacked read as a layout mistake rather than as a hierarchy.
          */
          <section className="app-identity">
            <div className="container">
              <h1>{app.programName}</h1>
              <p>{app.purpose}</p>
            </div>
          </section>
        ) : null}
        {children}
      </AssistantDockHost>
      {/* ท้ายเว็บอยู่นอกกรอบที่ผู้ช่วยดัน — มันเป็นของแพลตฟอร์ม ไม่ใช่เนื้องานของแอป
          ตอนอยู่ข้างในมันโดนดันไปด้วย พื้นหลังจึงกว้าง 1106.6px แทนที่จะเต็มจอ 1502.6px
          เหลือแถบขาวข้างขวาที่ไม่มีอะไรอยู่ (เจ้าของงานเจอของจริง 2026-08-28)
          แผงผู้ช่วยไม่ทับท้ายเว็บ เพราะมันวัดตำแหน่งท้ายเว็บแล้วยกตัวหยุดเหนือขึ้นมา */}
      <PlatformFooter />
    </main>
  );
}
