# Handoff — v0.6.1: Navigation Button Hierarchy

## Description

ปรับ sticky navigation ตาม feedback: เมนูทุกตัวเป็น pill button ที่มองเห็นขอบ พื้นผิว และสถานะกดได้ชัดเจน แทนข้อความลิงก์ธรรมดา โดย “ขอใบเสนอราคา” ยังคงเป็น orange primary action.

## Changed Scope

| Area | File | Summary |
|---|---|---|
| Button hierarchy | `src/app/globals.css` | ทำทุก nav link เป็น rounded button; เพิ่ม neutral/teal hover, focus-visible, elevation และ active transform |
| Primary action | `src/app/globals.css` | กำหนด quote shortcut เป็น orange primary pill พร้อม stronger shadow/contrast |
| Mobile navigation | `src/app/globals.css` | คง pill buttons ใน horizontal scroll row บนมือถือแทนการซ่อนเมนู |
| Release metadata | `package.json`, `docs/roadmap/*` | เพิ่ม v0.6.1 title, scope, verification และ rollback |

## Verification

`pnpm lint`, `pnpm test` (6 tests) และ `pnpm typecheck` ผ่านก่อนสร้าง release metadata. ต้องรัน production build, security preflight, roadmap validation และตรวจ Vercel public UI ก่อนปิด milestone.

## Rollback

Return to tag `v0.6.0-sticky-enterprise-nav` to restore the previous navigation appearance. No data, auth or route behavior changes.

## Next Action

Run final quality gate, push tag `v0.6.1-navigation-pills`, confirm Vercel public rendering, then send the new review link.
