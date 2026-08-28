"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/platform/brand-logo";

/**
 * The nav is grouped by what a section changes, not by which table it touches: someone opening the
 * back office is asking "where do I change the price", not "which repository holds it".
 *
 * A section with no surface behind it yet is rendered as disabled rather than hidden. A back office
 * that quietly grows menu items teaches nobody what it will eventually do, and a link that leads to
 * an unfinished page is worse than one that says it is not ready.
 */
export const adminNavigation = [
  {
    group: "ภาพรวม",
    items: [
      { id: "overview", label: "แดชบอร์ด", href: "/admin", ready: true },
      // สถานะโครงการย้ายจากหน้าสาธารณะเข้ามาที่นี่ 2026-08-28 — โรดแมปเป็นความลับภายใน
      { id: "roadmap", label: "สถานะโครงการ", href: "/admin/roadmap", ready: true }
    ]
  },
  {
    group: "เนื้อหาที่ลูกค้าเห็น",
    items: [
      { id: "pricing", label: "ราคาและสิทธิ์", href: "/admin/pricing", ready: false },
      { id: "promotions", label: "ช่วงลดราคา", href: "/admin/promotions", ready: false },
      { id: "apps", label: "ทะเบียนแอป", href: "/admin/apps", ready: true },
      { id: "channels", label: "ช่องทางติดต่อ", href: "/admin/channels", ready: true }
    ]
  },
  {
    group: "การเข้าถึง",
    items: [
      { id: "entitlements", label: "สิทธิ์การใช้งานของลูกค้า", href: "/admin/entitlements", ready: true },
      { id: "administrators", label: "ผู้ดูแลแพลตฟอร์ม", href: "/admin/administrators", ready: false },
      { id: "audit", label: "บันทึกการเปลี่ยนแปลง", href: "/admin/audit", ready: false }
    ]
  }
] as const;

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="admin-sidebar" aria-label="เมนูหลังบ้าน">
      <Link className="admin-sidebar__brand" href="/admin">
        <BrandLogo />
      </Link>

      {adminNavigation.map((section) => (
        <div className="admin-sidebar__group" key={section.group}>
          <p className="admin-sidebar__group-label">{section.group}</p>
          <ul>
            {section.items.map((item) =>
              item.ready ? (
                <li key={item.id}>
                  <Link
                    className={`admin-sidebar__link${pathname === item.href ? " is-active" : ""}`}
                    href={item.href}
                    aria-current={pathname === item.href ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              ) : (
                <li key={item.id}>
                  <span className="admin-sidebar__link admin-sidebar__link--pending" aria-disabled="true">
                    {item.label}
                    <em>ยังไม่เปิด</em>
                  </span>
                </li>
              )
            )}
          </ul>
        </div>
      ))}
    </nav>
  );
}
