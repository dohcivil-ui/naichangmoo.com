import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MetadataRoute } from "next";
import { extractKitchenColour } from "@/lib/kitchen-colours";

/**
 * Web App Manifest (IP-196) — ใบประกาศของแอปต่อระบบปฏิบัติการ: ชื่อ ไอคอน สี
 * เพื่อให้ "เพิ่มไปหน้าจอหลัก" บนมือถือได้ไอคอนและชื่อที่ถูกต้อง (PWA ขั้นแรก —
 * service worker/offline เป็นงานรุ่นหน้า)
 *
 * สีไม่ประกาศซ้ำที่นี่ — อ่านจากแหล่งอ้างอิงหลัก (globals.css) ตอน build ผ่าน
 * kitchen-colours ตาม ADR 0021 · สีแถบเบราว์เซอร์เป็น teal ตามที่เจ้าของงานเคาะ 2026-08-28
 * ไอคอนชี้ไฟล์ที่ scripts/build-app-icons.mjs สร้าง และ src/icon-fence.test.ts เฝ้าอยู่
 */
export default function manifest(): MetadataRoute.Manifest {
  const kitchen = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  return {
    name: "นายช่างหมู — CIVIL APPS ASSISTANT",
    short_name: "นายช่างหมู",
    description: "เครื่องมือวิศวกรรมที่ทำงานเป็นลำดับ ตรวจสอบได้ และช่วยงานโยธาไทยให้ชัดเจนขึ้น",
    lang: "th",
    start_url: "/",
    display: "standalone",
    theme_color: extractKitchenColour(kitchen, "teal"),
    background_color: extractKitchenColour(kitchen, "canvas"),
    icons: [
      { src: "/brand/naichangmoo-app-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/naichangmoo-app-icon-512.png", sizes: "512x512", type: "image/png" }
    ]
  };
}
