export const visualAssetFiles = {
  estimeter: "naichangmoo-estimetr-icon_e5f58d86.png",
  retaining_wall: "naichangmoo-retaining-wall-icon_d603dc49.png",
  traffic_sign: "naichangmoo-traffic-sign-icon_1faaa77b.png",
  land_acquisition: "naichangmoo-land-icon_4ac3b8b8.png",
  hermes: "naichangmoo-hermes-icon_b78a26b9.png"
} as const;

export type VisualAssetKey = keyof typeof visualAssetFiles;

export function visualAssetUrl(key: VisualAssetKey) {
  return `/api/visual-assets/${key}`;
}
