# Handoff — v0.4.3: Public Pilot Visual Asset Availability

## Description

แก้ icon graphic ของ Landing ที่ Vercel pilot แสดงเป็น placeholder เพราะ visual asset proxy อ้างอิง storage origin ภายใน sandbox. Pilot จึงใช้ public CDN URLs สำหรับ presentation asset ที่สร้างไว้ และ production สามารถสลับไป Cloudflare R2/CDN ได้ผ่าน `VISUAL_ASSET_ORIGIN` โดยไม่เปลี่ยน app card source.

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Asset registry | `src/lib/visual-assets.ts` | เก็บ filename สำหรับ production และ public pilot URL สำหรับ icon graphic ทั้งห้ารายการ |
| Asset proxy | `src/app/api/visual-assets/[key]/route.ts` | ใช้ allowlisted pilot URL เป็น fallback; ใช้ `VISUAL_ASSET_ORIGIN/{file}` เมื่อ production storage พร้อม |
| Environment contract | `.env.example` | เพิ่ม `VISUAL_ASSET_ORIGIN` สำหรับ Cloudflare R2/CDN domain |
| Roadmap record | `package.json`, `docs/roadmap/roadmap.v0.4.3.json`, `docs/roadmap/roadmap.json`, `docs/roadmap/CHANGELOG.md` | บันทึก version, scope, verification และ rollback ของ asset availability fix |

## Verification

| Check | Result |
|---|---|
| Pilot CDN asset | `curl -I` ส่ง `200` และ `content-type: image/png` |
| Credential-less Vercel build | lint, 6 unit tests, typecheck และ production build ผ่านเมื่อไม่มี DB/auth credentials |
| Security | `pnpm security:check` ผ่าน |
| Roadmap | `node scripts/check-roadmap.mjs` ต้องผ่านก่อน commit |
| Pending | Push/redeploy และตรวจ visual icon บน public Vercel URL |

## Security and Data Impact

Only five allowlisted, non-user presentation asset URLs are exposed by the proxy. User uploads, drawings, project data, database records, credentials and Hermes payloads do not use the public asset fallback. Production must use an approved R2/CDN origin through `VISUAL_ASSET_ORIGIN`.

## Rollback

Return to tag `v0.4.2-vercel-native-output`. This restores the sandbox-only origin and will cause Vercel pilot icon rendering to fail; no data rollback is necessary.

## Next Action

Run the final roadmap/quality gate, commit/tag/push v0.4.3, wait for Vercel, then verify the Landing app cards, Hermes icon, app routes and Roadmap before sharing the confirmed URL.
