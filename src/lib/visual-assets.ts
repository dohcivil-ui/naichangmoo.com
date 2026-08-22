export const visualAssets = {
  estimeter: { file: "naichangmoo-estimetr-icon.png", pilotUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663030011961/anyLQrgyQxXqziRD.png" },
  retaining_wall: { file: "naichangmoo-retaining-wall-icon.png", pilotUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663030011961/HwPGXWPGwimBtvTU.png" },
  traffic_sign: { file: "naichangmoo-traffic-sign-icon.png", pilotUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663030011961/noMHQAjpHWQenSVC.png" },
  land_acquisition: { file: "naichangmoo-land-icon.png", pilotUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663030011961/XMobrYucpKXqaQeW.png" },
  hermes: { file: "naichangmoo-hermes-icon.png", pilotUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663030011961/SxNtnIKmDZzclTCY.png" }
} as const;

export type VisualAssetKey = keyof typeof visualAssets;

export function visualAssetUrl(key: VisualAssetKey) {
  return `/api/visual-assets/${key}`;
}
