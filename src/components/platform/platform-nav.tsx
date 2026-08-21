import Link from "next/link";
import { NaiChangMooMark } from "@/components/icons/platform-icons";
import { SignInButton } from "@/components/landing/sign-in-button";

export function PlatformNav({ workspace }: { workspace?: string }) {
  return (
    <nav className="site-nav" aria-label="เมนูหลัก">
      <div className="container site-nav__inner">
        <Link className="brand" href="/"><NaiChangMooMark /><span>นายช่างหมู<small>{workspace ?? "CIVIL APPS ASSISTANT"}</small></span></Link>
        <div className="nav-links"><Link href="/#apps">แอปของเรา</Link><Link href="/#hermes">Hermes 24/7</Link><Link href="/#enterprise">องค์กร/หน่วยงาน</Link></div>
        <SignInButton />
      </div>
    </nav>
  );
}
