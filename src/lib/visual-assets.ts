/**
 * Brand artwork ships with the source and is served by Next from `public/brand/`.
 *
 * These files used to live only on a third-party CDN, which `/api/visual-assets/[key]` fetched on
 * every render. That made our own logo depend on a host we do not control: the day it stopped
 * answering, the wordmark and every app badge became a 502. Serving the bytes ourselves also stops
 * announcing to that host which of our pages are being viewed — the same reason `next.config.ts`
 * routes a member's Google avatar through our optimizer.
 *
 * **ตราแอปเปลี่ยนเป็นภาพถ่ายทั้งชุดเมื่อ 2026-08-30 (IP-166)** ของเดิมเป็นภาพเขียนเชิงเทคนิค
 * และมีอยู่แค่ห้าตัว อีกสามแอปยืมตราแพลตฟอร์มมาใช้ ซึ่งอ่านได้ว่าเป็นความผิดพลาดมากกว่าของชั่วคราว
 * ชุดใหม่ทำครบแปดตัวในคราวเดียวด้วยคำสั่งชุดเดียวกัน เหตุผลและคำสั่งอยู่ใน
 * `docs/design/app-icon-prompts.md`
 *
 * **เก็บเป็น WebP 640px ไม่ใช่ PNG** เพราะเป็นภาพถ่าย ชุดเดียวกันนี้เก็บเป็น PNG กินพื้นที่ 4.6 MB
 * แต่ WebP กิน 533 KB โดยตาไม่เห็นความต่าง และ Next แปลงเป็น WebP ส่งให้เบราว์เซอร์อยู่แล้ว
 * การเก็บ PNG จึงเป็นการเก็บไฟล์ใหญ่ไว้เพื่อแปลงทิ้งทุกครั้ง ตราคำและตราย่อยังเป็น PNG
 * เพราะเป็นภาพลายเส้นพื้นโปร่ง ซึ่งเป็นงานที่ PNG ทำได้ดีกว่า
 *
 * เลข 640 มาจากขนาดที่ไอคอนถูกวาดจริง คือ 104px บนการ์ดหน้าแรกและ 202px บนหน้ารายละเอียดแอป
 * จอความละเอียดสามเท่าจึงต้องการ 606px — **คอมเมนต์เดิมเขียนว่าวาดที่ 65–74px และเก็บ 256px
 * ก็พอ ซึ่งไม่จริงทั้งสองข้อ** เลข 65 คือค่าที่ `AppCard` ประกาศให้ optimizer ไม่ใช่ขนาดที่วาด
 * ส่วนตราคำยังเก็บ 1168x334 ตามต้นฉบับ เพราะ `BrandLogo` ประกาศขนาดนั้นไว้
 */
export const visualAssets = {
  brand_wordmark: { file: "naichangmoo-primary-wordmark.png" },
  brand_mark: { file: "naichangmoo-nm-mark.png" },
  estimeter: { file: "naichangmoo-estimetr-badge.webp" },
  pricemetr: { file: "naichangmoo-pricemetr-badge.webp" },
  retaining_wall: { file: "naichangmoo-retaining-wall-badge.webp" },
  traffic_sign: { file: "naichangmoo-traffic-sign-badge.webp" },
  land_acquisition: { file: "naichangmoo-land-acquisition-badge.webp" },
  escalation_k: { file: "naichangmoo-escalation-k-badge.webp" },
  work_plan: { file: "naichangmoo-work-plan-badge.webp" },
  hermes: { file: "naichangmoo-hermes-badge.webp" },
  /* โปสเตอร์แนวตั้ง 1122x1402 ไม่ใช่ตราสี่เหลี่ยม 640 เหมือนตัวอื่นในตารางนี้ ·
     วาดจริงกว้าง 338px ในคอลัมน์ 340 ต้นฉบับจึงใหญ่พอสำหรับจอสามเท่าอยู่แล้ว ไม่ต้องขยาย ·
     **ห้ามครอปและห้าม ken-burns** ตัวหนังสือในโปสเตอร์ต้องอ่านออกครบทั้งใบ */
  hermes_poster: { file: "naichangmoo-hermes-poster.webp" }
} as const;

export type VisualAssetKey = keyof typeof visualAssets;

export function visualAssetUrl(key: VisualAssetKey) {
  return `/brand/${visualAssets[key].file}`;
}
