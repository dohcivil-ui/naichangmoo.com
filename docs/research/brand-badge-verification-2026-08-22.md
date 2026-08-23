# Brand and Badge Verification — 2026-08-22

## Public Review Result

Vercel deployment for commit `c97481d` returned `READY`. The NM wordmark loaded through the allowlisted visual asset proxy, the Landing hero rendered the source-controlled bridge/city engineering line-art, and the app registry rendered the new ESTIMETR, Retaining Wall, Traffic Sign and Land Acquisition product badges.

## Visual Checks

| Surface | Result |
|---|---|
| Sticky navigation | NM wordmark is visible at desktop width; navigation pills and enterprise action remain readable |
| Hero | Text remains on the left and the technical bridge/city line-art remains on the right beside the ESTIMETR workflow |
| App badges | All visible card badges load and retain distinct civil-engineering subject matter within the shared grid/accent frame |
| Asset delivery | `/api/visual-assets/brand_wordmark`, `/api/visual-assets/estimeter` and the corresponding Next image URL return `200 image/png` |

## Follow-up

The wordmark needs a manual mobile-width check after deploy; the desktop public review shows no blank image or route failure. Production should move these same filenames from the pilot CDN to the configured Cloudflare R2/CDN origin through `VISUAL_ASSET_ORIGIN`.
