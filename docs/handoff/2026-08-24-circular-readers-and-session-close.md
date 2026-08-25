# Handoff — `v0.25.0: The Tools That Read a Circular Live in the Repository`

## Description

`scripts/extract-factor-f.mjs` ถูก commit ไปตั้งแต่ v0.22.0 โดยที่ `pdfjs-dist` ไม่ได้อยู่ใน dependency
ของโปรเจกต์ — มันถูกติดตั้งไว้แค่ในไดเรกทอรีชั่วคราวของ session ที่เขียนมัน สคริปต์นั้นจึงรันไม่ได้จาก clone ใหม่
รอบนี้แก้ให้รันได้จริง และเพิ่มเครื่องมืออ่านหนังสือเวียนที่ครอบทั้งสองรูปแบบที่เอกสารราชการมาในมือเรา

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Dependency | `package.json`, `pnpm-lock.yaml` | `pdfjs-dist` เป็น devDependency |
| Tool | `scripts/read-circular.mjs` | โหมด `text` อ่านตารางเป็นแถว, `image` ดึงหน้าสแกนออกมาเป็น PNG, `hash` คืน sha256 ของไฟล์ |
| Plan | `docs/roadmap/roadmap.v0.25.0.json` และ pointer | IP-074 done, ปิดสถานะ v0.24.0 |

## Verification

- `node scripts/extract-factor-f.mjs <ว481>` รันได้จาก repository แล้ว รายงาน 48 ตาราง 1,644 แถว ตรวจตัวเองผ่านหมด
- `node scripts/read-circular.mjs hash <ว481>` คืน `809fe26f…0575` **ตรงกับ checksum ที่บันทึกไว้ใน**
  `src/data/factor-f/cgd-w481-be2569.json` — ยืนยันได้ว่าชุดข้อมูลมาจากไฟล์นั้นจริง
- `node scripts/read-circular.mjs text <ว481> 4 4` อ่านหน้า 4 ออกมาเป็นแถวได้
- `pnpm typecheck` ผ่าน, `pnpm lint` 0 errors, `pnpm test` **168 passed | 33 skipped**

## Security and data impact

ไม่มี ตัวหนังสือเวียนยังอยู่นอก repository ใต้ `km/` ที่ `.gitignore` กันไว้
เข้ามาใน repository เฉพาะตัวเลขที่พิมพ์อยู่ในเอกสารราชการที่เผยแพร่สาธารณะ และ checksum ที่ผูกตัวเลขกับไฟล์

## Rollback

Revert commit นี้และถอน `pdfjs-dist` ชุดข้อมูล Factor F ที่อยู่ใน repository แล้วไม่ได้รับผลกระทบ
เสียแค่ความสามารถในการสร้างมันขึ้นใหม่จาก PDF

---

# สภาพ ณ เวลาปิด session

## งานที่ session นี้ส่งมอบ

| Version | Tag | เรื่อง |
|---|---|---|
| (planning-harness) | — | ติดตั้ง `grill-with-docs` เป็นด่านวางแผนก่อนแตะโค้ด พร้อม audit S1-S14 |
| v0.18.0 | `v0.18.0-quality-gate-enforced` | ทำให้ quality gate รันจริง: hook ติดตั้งตัวเองตอน `pnpm install`, CI ครอบ feature branch, 29 เทสต์ที่ไม่เคยรันใน CI ผ่านบน PostgreSQL 16, checker จับ roadmap drift |
| v0.21.0 | `v0.21.0-landing-sequence-and-problem` | landing hero เคลื่อนไหวตามลำดับการทำงาน และหัวข้อปัญหาสามข้อจากงานจริง |
| v0.22.0 | `v0.22.0-factor-f-dataset` | ตาราง Factor F 48 ตาราง 1,644 แถว พร้อมหนังสือเวียนที่ประกาศมัน |
| v0.23.0 | `v0.23.0-latest-circular-rule` | กฎ: หนังสือเวียนต้องใช้ฉบับล่าสุด ว480/ว481 แทน ว809/ว499 |
| v0.24.0 | `v0.24.0-factor-f-interpolation-rule` | กฎ: ค่างานระหว่างขั้นให้เทียบอัตราส่วน ปัดสี่ตำแหน่งก่อนคูณ หนึ่งค่าต่อหนึ่งหมวดงาน |
| v0.25.0 | (commit นี้) | เครื่องมืออ่านหนังสือเวียนที่รันได้จริง |

## เอกสารอ้างอิงที่สร้างไว้ อ่านก่อนทำงานต่อ

- `docs/research/factor-f-provenance-2026-08-24.md` — ที่มาของ ว499, ว480, ว481 กลไก MLR
  เส้นเวลา 2565-2569 และสิ่งที่ยังไม่รู้
- `docs/research/harness-audit-2026-08-23.md` — สภาพ harness และหนี้ทางเทคนิค S1-S14
- `docs/rules/engineering.md` หัวข้อ **Official circulars and reference tables** — กฎทั้งสองข้อที่เจ้าของงานตัดสิน

## งานค้างเรียงตามความสำคัญ

1. **IP-054 + IP-058** — สองข้อนี้**พังอยู่ตอนนี้ ไม่ใช่ความเสี่ยงอนาคต**: `capabilities.read` ประกาศไว้
   แต่ไม่มี call site ฝั่ง server (ปิดสวิตช์แล้วยังอ่านโครงการได้) และ `estimeter-access.ts:81-97, 115-122`
   เลือก organization ด้วย `.limit(1)` ที่ไม่มี `ORDER BY`
2. **IP-051** — ดึงบัญชีค่าแรง ว480 (45 หน้า 5 หมวด) เป็นชุดข้อมูล ใช้ `scripts/read-circular.mjs`
   ที่เพิ่ง ship ความยากอยู่ที่หนึ่งรายการมีได้หลายอัตราตามช่วงจำนวนหรือเขตพื้นที่ ซึ่งต้องเก็บเป็นข้อมูล ไม่ใช่หมายเหตุ
3. **IP-073** — แสดงในผลลัพธ์ว่า Factor F มาจากขั้นที่พิมพ์หรือจากการเทียบอัตราส่วน พร้อมสองขั้นที่คร่อม
4. **IP-070** — ยังไม่มีผู้มีคุณวุฒิรับรองชุดข้อมูล Factor F (`reviewedBy` ยังเป็น `null`)
5. **IP-072** — กลไกบอกว่าหนังสือเวียนที่ระบบถืออยู่ยังเป็นฉบับล่าสุดหรือไม่
6. **IP-067** — roadmap item id ชนกันแล้วหนึ่งครั้ง (`IP-059` ออกสองรอบสำหรับงานคนละเรื่อง)

## คำถามที่ยังไม่มีคำตอบ

- **ราคากลางย้อนหลัง** — กฎ "ใช้ฉบับล่าสุด" ตอบว่าตั้งราคาใหม่ใช้ฉบับไหน แต่ยังไม่ตอบว่าการตรวจซ้ำ
  โครงการที่ตั้งราคาไปแล้วควรใช้ฉบับ ณ วันนั้นหรือฉบับล่าสุด
- **หนังสือเวียนที่เปลี่ยนอัตรา 7% เป็น 6%** ยังไม่พบ อยู่ระหว่าง ส.ค. 2566 ถึง มิ.ย. 2569
  ภายใต้กฎฉบับล่าสุดมันไม่บล็อกการคำนวณแล้ว แต่ยังเป็นช่องว่างของเส้นเวลา

## ข้อควรรู้เรื่องสภาพแวดล้อม

- **มีอีก session ทำงานคู่ขนานบน branch เดียวกัน** ตลอด session นี้ ไฟล์ที่ยัง modified ในเครื่อง
  (`page.tsx`, `globals.css`, `layout.tsx`, `landing-motion.tsx`, `next-env.d.ts`) เป็นของสายนั้น ไม่ใช่ของ commit นี้
- **dev server รันอยู่ที่ port 3000** ปิดด้วย `netstat -ano | findstr :3000` แล้ว `taskkill /PID <pid> /F`
  ถ้าเจออาการ curl ค้างโดยไม่มีคำตอบ ให้ดู `.next/dev/logs/next-development.log` ก่อน — เคยเจอ dev server
  ที่ยัง LISTEN แต่ตายไปแล้วด้วย `uncaughtException: EPIPE`
- **การอ่าน PDF ในเครื่องนี้** ต้องใช้ `scripts/read-circular.mjs` เท่านั้น เครื่องไม่มี poppler
  และ canvas backend ที่ลองแล้ว segfault

## Next action

IP-051 — บัญชีค่าแรง ว480 เป็นอีกครึ่งของค่างานต้นทุนที่จะถูกคูณด้วย Factor F ที่ตอนนี้พร้อมแล้ว
เมื่อทั้งสองครึ่งอยู่ในระบบ ชั้นราคาตาม ADR 0007 จึงจะมีของจริงให้คำนวณ
