# Handoff — v0.9.1: NM Brand and Badge Public Review Verification

## Description

Records public Vercel review evidence for the NM brand composition and product badge release. This is a verification-only patch; it does not alter feature behavior or database state.

## Verification Recorded

| Check | Result |
|---|---|
| Vercel deployment | `READY` for commit `c97481d` |
| NM wordmark | Visible in sticky navigation through `/api/visual-assets/brand_wordmark` |
| Hero | Bridge/city technical line-art visible beside the ESTIMETR workflow |
| App badges | ESTIMETR, Retaining Wall, Traffic Sign and Land Acquisition badges visible in app cards |
| Asset transport | Brand wordmark, ESTIMETR asset and optimized Next Image URL returned `200 image/png` |

## Follow-up

Perform manual mobile review before a broader pilot announcement. At production cutover, transfer the same asset filenames to the trusted Cloudflare R2/CDN origin and configure `VISUAL_ASSET_ORIGIN`.

## Rollback

Return to tag `v0.9.0-nm-brand-badges` to remove only this release verification record. No application, data or asset route rollback is required.
