# Handoff — v0.9.0: NM Brand Composition and Engineering App Badges

## Description

Reworks the visible brand system around the user-provided NM wordmark reference. The platform now shows the approved full wordmark in navigation, uses original engineering line-art in the Landing hero and uses purpose-built civil product badges for the app registry and Hermes panel.

## Changed Scope

| Area | File | Summary |
|---|---|---|
| Brand assets | `src/lib/visual-assets.ts`, `src/components/platform/brand-logo.tsx` | Adds approved NM wordmark/mark CDN assets through the existing allowlisted image proxy |
| Shared navigation | `src/components/platform/platform-nav.tsx`, `src/app/globals.css` | Uses wordmark across Landing and app shell; shows a compact workspace label on desktop app routes |
| Hero composition | `src/components/landing/hero-engineering-art.tsx`, `src/app/page.tsx`, `src/app/globals.css` | Replaces predominant abstract circles with source-controlled bridge, building and technical guide line-art alongside ESTIMETR workflow |
| App badge system | `src/lib/visual-assets.ts`, `src/components/landing/app-card.tsx`, `src/app/globals.css` | Adds product-grade visual assets and a consistent badge frame with per-app accent colors/technical-grid treatment |
| Asset review | `docs/research/app-badge-review-2026-08-22.md` | Records visual grammar and lightweight suitability review for the new badge direction |

## Verification

Lint, six unit tests, typecheck and a credential-less production build pass. Run security preflight, roadmap validation and Vercel review before release.

## Production Asset Note

Pilot URLs use the public visual asset CDN. On Hostinger production, upload the same filenames to the approved Cloudflare R2/CDN origin and set `VISUAL_ASSET_ORIGIN`; the existing proxy will route to that trusted origin without source-code changes.

## Rollback

Return to tag `v0.8.0-enterprise-page` to restore the earlier simplified mark, abstract hero signal layer and initial app icon assets. No database migration or business-data change is involved.

## Next Action

Complete the final release gate, deploy to Vercel and review the Landing at desktop/mobile widths for wordmark scaling, hero line-art legibility and app badge recognition.
