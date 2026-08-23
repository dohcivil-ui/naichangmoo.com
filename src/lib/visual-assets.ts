export const visualAssets = {
  brand_wordmark: { file: "naichangmoo-primary-wordmark.png", pilotUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663030011961/bxbztDYdYNINutLU.png" },
  brand_mark: { file: "naichangmoo-nm-mark.png", pilotUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663030011961/pwpSvFePqWSaEXTL.png" },
  estimeter: { file: "naichangmoo-estimetr-badge.png", pilotUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663030011961/XcxKdIOguARdkxtp.png" },
  retaining_wall: { file: "naichangmoo-retaining-wall-badge.png", pilotUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663030011961/AdbinflQIvaBsjoj.png" },
  traffic_sign: { file: "naichangmoo-traffic-sign-badge.png", pilotUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663030011961/XjRmAaxmdiDRxFXb.png" },
  land_acquisition: { file: "naichangmoo-land-acquisition-badge.png", pilotUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663030011961/lDROkbIdmzfyArxV.png" },
  hermes: { file: "naichangmoo-hermes-badge.png", pilotUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663030011961/GukLExEYMYNiGlGL.png" }
} as const;

export type VisualAssetKey = keyof typeof visualAssets;

export function visualAssetUrl(key: VisualAssetKey) {
  return `/api/visual-assets/${key}`;
}
