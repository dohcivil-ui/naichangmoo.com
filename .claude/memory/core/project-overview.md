# Project Overview — นายช่างหมู

**ไฟล์นี้บันทึกสถานะจริงของระบบเท่านั้น** ไม่ใช่รายการงานค้างและไม่ใช่รายการตัดสินใจที่ยังไม่เคาะ
งานค้างอยู่ที่ `docs/roadmap/roadmap.json` การตัดสินใจอยู่ที่ `docs/adr/`
ทุกข้อในไฟล์นี้อ่านจากโค้ดจริง ไม่มีการเดา — เรื่องที่ตรวจไม่ได้เขียนว่า unknown

ตรวจครั้งล่าสุด 2026-08-28 ที่เวอร์ชัน 0.88.0 · `pnpm test` ผ่าน 749 เทสต์ ข้าม 36

## โปรเจกต์นี้คืออะไร

**นายช่างหมู — CIVIL APPS ASSISTANT** แพลตฟอร์มเครื่องมือวิศวกรรมโยธาที่ทำให้ผู้ใช้ทำงานเป็นลำดับ
เข้าใจผลลัพธ์ และชี้ที่มาของทุกตัวเลขได้ ไม่ใช่ตลาดรวมแอปและไม่ใช่ dashboard ที่ยัดฟีเจอร์

เป้าหมายที่กำหนดไว้ใน `PROJECT.md` — landing เดียว สมาชิกชุดเดียว แต่ละแอปตรวจสิทธิ์เองหลังยืนยันตัวตน ·
ทุกรุ่นต้องรักษาเส้นทางตรวจสอบตั้งแต่ข้อมูลนำเข้า ผ่านการคำนวณ หลักฐาน ราคา จนถึงผลลัพธ์ ·
AI เสนอปริมาณและหลักฐานได้ แต่ราคาต้องมาจากข้อมูลอ้างอิงที่ตรวจสอบได้ **AI ห้ามสร้างราคาขึ้นเอง**

## Tech Stack

Next.js 16.3.2 · React 19.2.8 · TypeScript · Drizzle ORM 0.45.2 กับ PostgreSQL · Zod 4.3.6 ·
better-auth 1.7.1 · Tailwind CSS 4 (นำเข้าผ่าน `@import "tailwindcss"` ใน `globals.css` **ไม่มี `tailwind.config`**) ·
vitest · eslint · pnpm

ปลายทางที่วางไว้คือ Hostinger VPS แบบ Next.js standalone พร้อม PostgreSQL, Cloudflare R2,
คิวงานที่ใช้ Redis และคอนเทนเนอร์ Hermes แยก · Vercel ใช้สำหรับรุ่นทดลองเท่านั้น
**ห้ามพึ่งความสามารถเฉพาะของผู้ให้บริการรายใดในตรรกะธุรกิจ**

## โครงสร้างระบบหลัก

| ชั้น | ที่อยู่ | หน้าที่ |
|---|---|---|
| Core / Domain Layer (ชั้นแกนธุรกิจ) | `src/lib/` | ตรรกะและสูตรคำนวณล้วน **ห้ามรู้จักฐานข้อมูล เซิร์ฟเวอร์ Next หรือ React** |
| ฝั่งเซิร์ฟเวอร์ | `src/server/` | action, ตรวจสิทธิ์, ผู้ดูแล, AI provider, Hermes |
| ฐานข้อมูล | `src/db/` | schema และ migration ของ Drizzle |
| หน้าจอ | `src/components/` | แยกตามโซน: `platform` `landing` `admin` `estimeter` `pricing` `prototype` `icons` `ui` |
| เส้นทางหน้าเว็บ | `src/app/` | App Router ของ Next |
| ข้อมูลอ้างอิง | `src/data/` | ชุดข้อมูลที่พกที่มาไปกับตัวเลข |

ขอบเขตนี้**ไม่ใช่ข้อตกลงลอย ๆ แต่บังคับด้วยเครื่องมือจริง** — `eslint.config.mjs` คู่กับ
`src/architecture-fence.test.ts` ตาม ADR 0020 และ AI SDK เข้าระบบได้ประตูเดียวคือ `src/server/ai/provider.ts`

## แอปในทะเบียน

ทะเบียนอยู่ที่ `src/lib/platform.ts` (`platformApps`) มี 7 แอป

| slug | ชื่อ | หน้าที่ | สถานะในโค้ด |
|---|---|---|---|
| `estimeter` | ESTIMETR | ประมาณราคางานอาคาร (แอปขายตัวแรก) | มีหน้าใช้งานจริงที่ `/apps/estimeter` |
| `pricemetr` | PRICEMETR | ราคาวัสดุรายจังหวัดและค่าแรงราชการ | ต้นแบบที่ `/prototype/price-check` |
| `work-plan` | ผู้ช่วยสร้างแผนงาน | แผนงาน S-Curve และเอกสารแนบสัญญา | ต้นแบบที่ `/prototype/work-plan` |
| `escalation-k` | ESCALATION K | ค่า K และเงินชดเชยค่างานก่อสร้าง | ชั้นแกนธุรกิจพร้อมแล้วที่ `src/lib/escalation-k.ts` ยังไม่มีหน้า |
| `rcopt` | Retaining Wall Cantilever | ออกแบบกำแพงกันดินให้ประหยัดที่สุด | อยู่ในทะเบียน ยังไม่มีหน้า workspace |
| `traffic-sign` | TRAFFIC SIGN | วัสดุป้ายจราจร จากฟอร์มไปเป็น BOQ | อยู่ในทะเบียน ยังไม่มีหน้า workspace |
| `land-acquisition` | LAND ACQUISITION V2 | งานจัดกรรมสิทธิ์ที่ดิน เฉพาะเจ้าหน้าที่กรมทางหลวง | อยู่ในทะเบียน ยังไม่มีหน้า workspace |

แอปที่ยังไม่มีหน้าใช้งานถูกแสดงผ่าน `/apps/[slug]/page.tsx` เป็นหน้าสถานะตามทะเบียน
ตาม ADR 0014 และ 0015 — **คำประกาศว่าแอปพร้อมใช้หรือฟรี เป็นสิ่งที่ผู้ดูแลกด ไม่ใช่สิ่งที่ซอร์สโค้ดพูดเอง**

โซนอื่นที่ไม่ใช่แอป — `/admin` (5 หน้า) `/market` `/pricing` `/enterprise` `/account` `/cookies`

## Shared Architecture — ของกลางที่ทุกแอปใช้ร่วมกัน

- **App Shell (โครงหลักของแอป)** `src/components/platform/app-shell.tsx` — แถบบริบท ปุ่มกลับหน้าหลัก
  และป้ายสิทธิ์จากทะเบียน มีโหมด `prototype` สำหรับต้นแบบ ทุกแอปที่ตรวจใช้ตัวนี้ ไม่มีแอปไหนเขียนแถบเอง
- ชั้นประกอบของเปลือก — `site-header.tsx` `platform-nav.tsx` `platform-footer.tsx` `account-menu.tsx` `brand-logo.tsx`
- **Assistant Dock (แผงผู้ช่วยกลาง)** `assistant-dock.tsx` — แต่ละแอปส่งผู้ช่วยของตัวเองมาแสดงผ่าน `AppAssistant`
  จำสถานะกาง/ย่อไว้ที่คีย์ `naichangmoo.assistant-dock.v1` แบบ Global preference (จำค่าเดียวทั้งแพลตฟอร์ม)
- **ปฏิทินเลือกวันที่** `src/components/ui/thai-date-field.tsx` — เดือนไทย ปี พ.ศ. เสมอ ใช้อยู่ 4 จุด
- **ไอคอน** `src/components/icons/platform-icons.tsx` และ `material-category-icons.tsx` เป็น SVG ที่คุมเอง
  หมวดที่ยังไม่มีสัญลักษณ์ได้กรอบเปล่า ไม่ใช่รูปที่หามาใส่
- **สี** ประกาศที่ `src/app/globals.css` บล็อก `:root` ที่เดียว อ่านกลับด้วย `src/lib/kitchen-colours.ts`
  เมื่อ `manifest.ts` และ `layout.tsx` ต้องใช้ค่าเดียวกันตอน build
- **ฟอนต์** จอใช้ Prompt โหลดผ่าน `next/font` ที่ `src/app/layout.tsx` · กระดาษใช้ TH Sarabun New
  ที่ self-host ไว้ใน `src/app/document-print.css`

## จุดที่ห้ามรื้อโดยไม่จำเป็น

1. **ขอบเขต `src/lib` ที่ห้ามลากฐานข้อมูลเข้ามา** (ADR 0020) — เป็นสิ่งที่ทำให้สูตรคำนวณทดสอบได้โดยไม่ต้องมีฐานข้อมูล
2. **สีประกาศที่ `globals.css` ที่เดียว** (ADR 0021) — มี `src/palette-fence.test.ts` เฝ้าอยู่
3. **ด่านตรวจอัตโนมัติ 8 ตัว** — ดู `.claude/memory/core/conventions.md` แต่ละตัวมีที่มาจากบั๊กจริงที่เคยหลุด
4. **ทะเบียนแอปที่ `src/lib/platform.ts`** — คำประกาศเรื่องแอปมาจากที่นี่ที่เดียว
5. **บันไดรุ่นและ `pnpm release`** — เคยมีเหตุที่ tag, changelog, GitHub Release และ `package.json`
   ค้างคนละเวอร์ชันโดยไม่มีใครสังเกตนาน 11 รุ่น
6. **Land Acquisition V2** — `PROJECT.md` ห้ามแตะซอร์ส schema หรือข้อมูลเดิมของระบบนี้ในรีโปนี้
7. **ขอบเขต Hermes** — รับได้เฉพาะงานตรวจหลักฐาน `takeoff_evidence_review` ห้ามเขียนข้อมูลธุรกิจ
   ห้ามส่งข้อความออก ห้ามใช้เงิน และห้ามแตะรหัสฐานข้อมูลจริง

## ลำดับแหล่งอ้างอิงเมื่อข้อมูลขัดกัน

ตาม `PROJECT.md` — `CONTEXT.md` (ศัพท์) → `PROJECT.md` (เจตนาสินค้าและข้อจำกัด) →
`docs/roadmap/roadmap.json` (แผนที่กำลังทำ) → `docs/adr/` (การตัดสินใจที่กลับยาก) →
`docs/handoff/` (สถานะล่าสุดหลัง commit)
