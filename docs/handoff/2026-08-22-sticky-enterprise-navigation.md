# Handoff — v0.6.0: Sticky Enterprise Navigation

## Description

ปรับ PlatformNav ให้เป็นจุดนำทางที่ใช้งานได้ตลอดการเลื่อนหน้า โดยรวมทางลัดแอปของเรา, Hermes 24/7, สถานะโครงการ และขอใบเสนอราคาสำหรับองค์กรไว้บนแถบเดียวกัน.

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Navigation content | `src/components/platform/platform-nav.tsx` | เพิ่ม link ไปยัง Roadmap/Handoff และ action “ขอใบเสนอราคา” ไปยัง enterprise section |
| Sticky/anchor styling | `src/app/globals.css` | เพิ่ม sticky layer elevation, quote pill action, scroll margin ของ anchors และ mobile nav strip แบบ horizontal scroll |
| Responsive behavior | `src/app/globals.css` | บนมือถือยังคง navigation links ทุกตัวไว้ด้วย scrollable row; brand กับ sign-in อยู่แถวบน |
| Retaining wall copy | `src/lib/platform.ts` | เปลี่ยนชื่อเป็น **Retaining Wall Cantilever** และสรุป bounded Bisection Algorithm, stability checks และ calculation trail เป็นภาษาอังกฤษ |
| Release metadata | `package.json`, `docs/roadmap/*` | เพิ่ม roadmap v0.6.0 ที่มี title, description, scope, verification และ rollback |

## Verification

| Check | Result |
|---|---|
| `pnpm lint` | Passed before release metadata creation |
| `pnpm test` | Passed: 6 tests |
| `pnpm typecheck` | Passed |
| Pending | credential-less production build, security preflight, roadmap validation and public Vercel sticky/mobile review |

## Rollback

Return to tag `v0.5.1-public-motion-review`. This removes the Roadmap link, quote shortcut and mobile horizontal nav strip; no database rollback is necessary.

## Next Action

Complete final quality gate, deploy to Vercel, verify sticky navigation and anchor behavior on desktop/mobile, then deliver the new review URL.
