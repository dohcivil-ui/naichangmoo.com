/**
 * Brand artwork ships with the source and is served by Next from `public/brand/`.
 *
 * These files used to live only on a third-party CDN, which `/api/visual-assets/[key]` fetched on
 * every render. That made our own logo depend on a host we do not control: the day it stopped
 * answering, the wordmark and every app badge became a 502. Serving the bytes ourselves also stops
 * announcing to that host which of our pages are being viewed — the same reason `next.config.ts`
 * routes a member's Google avatar through our optimizer.
 *
 * The badges arrived as 1920px PNGs of roughly 4 MB each and are drawn at 65–74 px. They are stored
 * here at 256 px, which covers 3x device pixel ratio; the wordmark keeps its 1168x334 original
 * because `BrandLogo` declares those intrinsics.
 */
export const visualAssets = {
  brand_wordmark: { file: "naichangmoo-primary-wordmark.png" },
  brand_mark: { file: "naichangmoo-nm-mark.png" },
  estimeter: { file: "naichangmoo-estimetr-badge.png" },
  retaining_wall: { file: "naichangmoo-retaining-wall-badge.png" },
  traffic_sign: { file: "naichangmoo-traffic-sign-badge.png" },
  land_acquisition: { file: "naichangmoo-land-acquisition-badge.png" },
  hermes: { file: "naichangmoo-hermes-badge.png" }
} as const;

export type VisualAssetKey = keyof typeof visualAssets;

export function visualAssetUrl(key: VisualAssetKey) {
  return `/brand/${visualAssets[key].file}`;
}
