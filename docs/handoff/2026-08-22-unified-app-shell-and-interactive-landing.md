# Handoff — v0.4.0: Unified App Shell and Interactive Landing System

## Description

ปรับ Landing และ app routes ของนายช่างหมูให้ใช้ design system เดียวกัน พร้อม icon graphic เฉพาะแอป, micro-interaction ที่มีเป้าหมาย และ shared app shell เพื่อให้ทุกแอปเปลี่ยนเฉพาะ workflow กับสิทธิ์ ไม่เปลี่ยนรูปแบบการใช้งาน.

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| App naming | `src/lib/platform.ts` | เปลี่ยนชื่อ user-facing ของ RCOPT เป็น “กำแพงกันดิน” |
| Icon graphics | `src/lib/visual-assets.ts`, `src/app/api/visual-assets/[key]/route.ts` | เพิ่ม allowlisted proxy สำหรับ icon graphic ของ 4 แอปและ Hermes; source มีจุดเปลี่ยนไป R2/CDN ด้วย `STATIC_ASSET_ORIGIN` |
| Landing cards | `src/components/landing/app-card.tsx`, `src/app/page.tsx` | ใช้ icon graphic, pointer spotlight, hover/focus elevation และ scroll reveal hook |
| Shared app shell | `src/components/platform/*`, `src/app/apps/[slug]/page.tsx` | เพิ่ม PlatformNav, PlatformFooter และ AppShell พร้อม entitlement context bar ที่ใช้ร่วมกันทุก app |
| Platform style | `src/app/globals.css`, `docs/design-system/platform-ui-system.md` | สร้าง shared color/motion/focus/responsive rules, form state, card behavior และ reduced-motion policy |
| Version governance | `docs/roadmap/roadmap.v0.4.0.json`, `docs/roadmap/roadmap.json`, `docs/roadmap/CHANGELOG.md` | บันทึก version title, description, scope, verification และ rollback สำหรับ milestone นี้ |

## Verification

| Check | Result |
|---|---|
| `pnpm lint` | Passed with no warnings |
| `pnpm test` | Passed: 4 unit tests |
| `pnpm typecheck` | Passed |
| `NODE_ENV=production pnpm build` | Passed; visual asset route and all app routes compile |
| `pnpm security:check` | Passed; no tracked secret or build artifact |
| `node scripts/check-roadmap.mjs` | Validated roadmap v0.4.0 |
| Browser verification | Landing icon graphics, ESTIMETR app shell and กำแพงกันดิน app shell render through shared UI system |

## Security and Data Impact

No database migration, user data, provider credential or runtime Hermes deployment changed. The visual asset proxy permits only the five defined asset keys; it does not proxy arbitrary URLs. Before production, `STATIC_ASSET_ORIGIN` must point to the approved Cloudflare R2/CDN origin rather than the local mockup asset host.

## Rollback

Return to tag `v0.3.0-interactive-landing` to remove the visual asset proxy, generated icon integration, shared app shell and related motion styles. No database rollback is required.

## Next Action

Obtain user review of the updated Landing. After approval, build the ESTIMETR engineering workspace HTML mockup within the same `AppShell`, then create the next roadmap version, handoff, tag and GitHub push.
