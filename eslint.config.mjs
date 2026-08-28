import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * รั้วสถาปัตยกรรม — ADR 0020
 *
 * สามโซนข้างล่างเปลี่ยนกติกา "ชั้นคำนวณห้ามรู้จักโลกภายนอก" จากวินัยที่ต้องจำ
 * เป็นโครงสร้างที่ฝ่าแล้ว lint แดง ซึ่งสำคัญเป็นพิเศษเพราะโค้ดในรีโปนี้ถูกเขียนโดย
 * AI หลายเซสชันคู่ขนาน และกฎที่เป็นแค่ข้อความคือกฎที่ถูกเผลอละเมิดมาแล้วทุกครั้ง
 *
 * ห้ามแก้หรือถอดโซนเพื่อให้งานของตัวเองผ่าน: การย้ายเส้นรั้วต้องแก้ ADR 0020 ก่อน
 * และ src/architecture-fence.test.ts ยิงโค้ดละเมิดใส่รั้วจริงทุกครั้งที่รันเทสต์ —
 * ถอดรั้วเมื่อไหร่เทสต์แดงทันที (ปรัชญาเดียวกับ IP-091: ตัวตรวจต้องพิสูจน์ได้ว่าตัวเองยังกัด)
 *
 * อนุญาต import type ข้ามรั้วได้ในบางโซน เพราะ type หายไปตอน compile
 * จึงไม่ใช่การพึ่งพาของจริงตอนรัน
 */

const aiSdkPaths = [
  { name: "openai", message: "AI SDK เข้าได้ประตูเดียวคือ src/server/ai/provider.ts (รอยต่อแบบจำลองของ IP-131) — ที่อื่นเรียกผ่าน runAssistant" },
  { name: "@anthropic-ai/sdk", message: "AI SDK เข้าได้ประตูเดียวคือ src/server/ai/provider.ts (รอยต่อแบบจำลองของ IP-131) — ที่อื่นเรียกผ่าน runAssistant" }
];

const dbPatterns = [
  { group: ["@/db", "@/db/*"], allowTypeImports: true, message: "หน้าและคอมโพเนนต์คุยกับฐานข้อมูลผ่าน src/server เท่านั้น จะได้มีที่เดียวที่ตรวจสิทธิ์ก่อนอ่านเขียน" },
  { group: ["pg", "drizzle-orm", "drizzle-orm/*"], allowTypeImports: true, message: "ไดรเวอร์ฐานข้อมูลอยู่ได้เฉพาะ src/db และ src/server" }
];

const fence = [
  {
    name: "fence/ai-sdk-only-in-provider",
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: ["src/server/ai/provider.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", { paths: aiSdkPaths }]
    }
  },
  {
    name: "fence/ui-reaches-db-through-server",
    files: ["src/app/**/*.ts", "src/app/**/*.tsx", "src/components/**/*.ts", "src/components/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", { paths: aiSdkPaths, patterns: dbPatterns }]
    }
  },
  {
    name: "fence/lib-is-the-pure-core",
    files: ["src/lib/**/*.ts", "src/lib/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", {
        paths: [
          ...aiSdkPaths,
          { name: "pg", message: "ไข่แดงห้ามรู้จักฐานข้อมูล — รับข้อมูลเป็น argument แล้วคืนผลลัพธ์" },
          { name: "ioredis", message: "ไข่แดงห้ามรู้จักคิวและแคช — งานฝั่งโครงสร้างพื้นฐานอยู่ src/server" },
          { name: "bullmq", message: "ไข่แดงห้ามรู้จักคิวและแคช — งานฝั่งโครงสร้างพื้นฐานอยู่ src/server" },
          { name: "next", message: "ชั้นคำนวณต้องรันได้โดยไม่มีเฟรมเวิร์ก จะได้เทสต์เร็วและย้ายไปไหนก็ได้" },
          { name: "react", message: "ชั้นคำนวณต้องรันได้โดยไม่มี UI — ยกเว้นตัวช่วยฝั่ง client อย่าง auth-client ที่พึ่ง better-auth เอง" },
          { name: "react-dom", message: "ชั้นคำนวณต้องรันได้โดยไม่มี UI" }
        ],
        patterns: [
          { group: ["@/db", "@/db/*"], allowTypeImports: true, message: "ไข่แดงห้ามรู้จักฐานข้อมูล — รับข้อมูลเป็น argument แล้วคืนผลลัพธ์" },
          { group: ["@/server", "@/server/*"], allowTypeImports: true, message: "ไข่แดงเรียก server ไม่ได้ มีแต่ server เรียกไข่แดง" },
          { group: ["@/components/*", "@/app/*"], message: "ไข่แดงห้ามรู้จักหน้าจอ" },
          { group: ["next/*"], message: "ชั้นคำนวณต้องรันได้โดยไม่มีเฟรมเวิร์ก" },
          { group: ["drizzle-orm", "drizzle-orm/*"], allowTypeImports: true, message: "ไข่แดงห้ามรู้จักฐานข้อมูล" },
          { group: ["@aws-sdk/*"], message: "ไข่แดงห้ามคุยกับบริการภายนอก" }
        ]
      }]
    }
  },
  {
    /* สถานะโครงการเป็นความลับภายใน (คำสั่งเจ้าของงาน 2026-08-28) — โซนสาธารณะห้ามรู้จัก
       แหล่งอ่านโรดแมป/เอกสารส่งต่องาน มีเฉพาะโซน admin เท่านั้นที่อ่านได้
       (ต้อง union กับกฎของ fence/ui-reaches-db-through-server เพราะ flat config ทับทั้งก้อน) */
    name: "fence/project-status-stays-behind-admin",
    files: ["src/app/**/*.ts", "src/app/**/*.tsx", "src/components/**/*.ts", "src/components/**/*.tsx"],
    ignores: ["src/app/admin/**", "src/app/api/admin/**", "src/components/admin/**"],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", {
        paths: [
          ...aiSdkPaths,
          { name: "@/server/project-status", message: "สถานะโครงการเป็นความลับภายใน — อ่านได้เฉพาะโซน admin (คำสั่งเจ้าของงาน 2026-08-28)" }
        ],
        patterns: dbPatterns
      }]
    }
  }
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  ...fence,
  globalIgnores([".next/**", "node_modules/**", "drizzle/**"])
]);
