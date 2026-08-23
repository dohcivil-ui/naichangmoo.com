# Handoff — v0.9.2: ESTIMETR Estimation Terminology

## Description

Corrects the user-facing ESTIMETR workflow terminology. “ผูกราคา” is replaced with “ประมาณราคา” so the product language aligns with construction estimation work.

## Changed Scope

| Surface | File | Before | After |
|---|---|---|---|
| App registry description | `src/lib/platform.ts` | `ถอดแบบ → ผูกราคา → ตรวจเอกสาร` | `ถอดแบบ → ประมาณราคา → ตรวจเอกสาร` |
| Hero workflow step 04 | `src/app/page.tsx` | `ผูกราคาและจัดทำเอกสาร` | `ประมาณราคาและจัดทำเอกสาร` |

## Verification

Source and documentation search returned no remaining `ผูกราคา` occurrences after the update. Final quality gate and Vercel public review remain required before release.

## Rollback

Return to tag `v0.9.1-brand-badge-review` to restore the prior text. No route, visual asset, data model or entitlement behavior changes.
