import Link from "next/link";
import { landingActionContract } from "@/lib/landing-interactions";

export function PlatformFooter() {
  return <footer className="footer"><div className="container footer__inner"><div><strong>นายช่างหมู</strong> — CIVIL APPS ASSISTANT</div><p><Link href={landingActionContract.roadmapHref}>Roadmap &amp; Handoff</Link> · เครื่องมือวิศวกรรมที่เรียบง่าย ตรวจสอบได้ และออกแบบมาเพื่อให้งานเดินหน้า</p></div></footer>;
}
