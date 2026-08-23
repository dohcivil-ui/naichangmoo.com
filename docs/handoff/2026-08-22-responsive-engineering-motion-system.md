# Handoff — v0.5.0: Responsive Engineering Motion System

## Description

ปรับ Landing ของนายช่างหมูให้ตอบสนองระหว่างการสำรวจด้วย motion ที่ช่วยสื่อโครงสร้างงาน: blueprint signal ใน hero, reveal-on-scroll, pointer spotlight/tilt บน app card, Hermes attention ring และ form focus feedback โดยคง hierarchy และอ่านง่ายแบบเครื่องมือวิศวกรรม.

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Motion controller | `src/components/landing/landing-motion.tsx` | เพิ่ม client controller ใช้ IntersectionObserver เปิด reveal ทีละครั้ง และหยุด observer เมื่อแสดงผลแล้ว |
| Landing composition | `src/app/page.tsx` | ผูก controller, hero signal layer และ reveal targets ใน hero, app registry, Hermes และ enterprise intro |
| App card response | `src/components/landing/app-card.tsx` | เพิ่ม mouse-only spotlight coordinates และ tilt variables; touch input ไม่คำนวณ tilt |
| Shared style | `src/app/globals.css` | เพิ่ม signal keyframes, reveal state, pointer tilt, larger icon crop, Hermes attention ring และ form focus lift |
| Release metadata | `package.json`, `docs/roadmap/*` | เพิ่ม roadmap v0.5.0 พร้อม title, description, scope, verification และ rollback |

## Verification

| Check | Result |
|---|---|
| `pnpm lint` | Passed |
| `pnpm test` | Passed: 6 tests |
| `pnpm typecheck` | Passed |
| Credential-less `DEPLOY_TARGET=vercel NODE_ENV=production pnpm build` | Passed |
| Pending | `pnpm security:check`, roadmap validation, Vercel public review และ responsive interaction inspection after deploy |

## Interaction Safety

Motion never gates navigation, app access, trial entitlement, pricing or document actions. Pointer tilt runs only for mouse input. Existing touch/coarse-pointer rules remove hover transforms, and `prefers-reduced-motion` converts non-essential transitions and animations to near-instant states.

## Rollback

Return to tag `v0.4.3-public-pilot-assets` to remove `LandingMotion`, hero signal styling and the new pointer/scroll effects. No database migration or data rollback is needed.

## Next Action

Complete quality/security/roadmap checks, commit/tag/push `v0.5.0-responsive-motion`, wait for Vercel, then validate the public Landing, all app routes and Roadmap/Handoff before sharing the updated review link set.
