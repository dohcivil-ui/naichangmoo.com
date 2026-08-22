# Handoff — v0.4.2: Vercel Native Output Compatibility

## Description

แก้ Vercel deployment ที่ล้มด้วย `ENOENT: .next/next-server.js.nft.json`. สาเหตุคือ source บังคับ `output: standalone` ซึ่งเป็น target ที่เหมาะกับ Hostinger Docker แต่ไม่จำเป็นกับ Vercel pilot. Configuration ใหม่เลือก output ตาม deployment target โดยไม่เปลี่ยน application source, schema หรือ policy.

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Deployment output | `next.config.ts` | ตั้ง `output: standalone` เฉพาะ `DEPLOY_TARGET=hostinger`; Vercel ใช้ Next.js native output |
| Environment contract | `.env.example` | เพิ่ม `DEPLOY_TARGET=vercel` เป็น default สำหรับ review/pilot; Hostinger ต้อง override เป็น `hostinger` |
| Version governance | `package.json`, `docs/roadmap/roadmap.v0.4.2.json`, `docs/roadmap/roadmap.json`, `docs/roadmap/CHANGELOG.md` | บันทึก title, scope, verification, constraints และ rollback ของ output compatibility fix |

## Verification

| Check | Result |
|---|---|
| Credential-less Vercel build | `DEPLOY_TARGET=vercel NODE_ENV=production pnpm build` ผ่าน |
| Pending release gate | lint, test, typecheck, security preflight, roadmap validation, Git push และ Vercel route verification |

## Deployment Contract

Set `DEPLOY_TARGET=vercel` or omit it for Vercel. Set `DEPLOY_TARGET=hostinger` only during the Hostinger Docker build so `standalone` output is produced. The pilot remains credential-less; it does not enable database operations, real OAuth, billing or Hermes execution.

## Rollback

Return to tag `v0.4.1-vercel-auth-safe`. This restores unconditional standalone output and may reintroduce the missing trace artifact error on Vercel.

## Next Action

Run final quality gate, commit/tag/push v0.4.2, monitor the linked Vercel deployment, and verify the public Landing, app routes, Roadmap/Handoff, auth preview response and visual assets.
