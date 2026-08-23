# Handoff — `v0.18.0: The Quality Gate Becomes Something That Actually Runs`

## Description

กฎคุณภาพของโปรเจกต์ถูกประกาศไว้ครบใน `AGENTS.md`, `docs/rules/engineering.md` และ `docs/roadmap/README.md`
แต่ไม่มีอะไรบังคับ รอบนี้เปลี่ยนสามข้อจาก "เขียนไว้" เป็น "เครื่องตรวจ": hook ติดตั้งตัวเองตอน `pnpm install`,
CI รันบน feature branch และรันชุดทดสอบฐานข้อมูลที่ handoff อ้างมาตลอดว่าเป็นหลักฐาน และ `check-roadmap`
ปฏิเสธ pointer ที่แตกจากไฟล์เวอร์ชัน ทุกข้อมีเทสต์คุมพฤติกรรม ไม่ใช่แค่แก้ไฟล์แล้วเชื่อว่าใช้ได้

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Hook installation | `package.json`, `scripts/setup-git-hooks.mjs` | `prepare` lifecycle ตั้ง `core.hooksPath` ให้ทุก clone และข้ามเงียบเมื่อไม่ใช่ Git work tree |
| CI coverage | `.github/workflows/quality.yml` | push trigger ครอบ `feature/**`, PostgreSQL 16 service pinned by digest, `pnpm db:migrate` ก่อน แล้วรันชุดทดสอบด้วย `ESTIMETR_DB_TESTS=1` |
| Roadmap integrity | `scripts/check-roadmap.mjs` | เทียบ pointer กับ `roadmap.v<version>.json` และปฏิเสธเมื่อแตกหรือไม่มีไฟล์เวอร์ชัน รับ root argument เพื่อให้เทสต์ได้ |
| Tests | `src/lib/quality-gate.test.ts` | 9 เทสต์คุม workflow contract และพฤติกรรม checker ทั้งทางผ่านและทางปฏิเสธ |
| Plan | `docs/roadmap/roadmap.v0.18.0.json`, `roadmap.json`, `CHANGELOG.md`, `package.json` | roadmap v0.18.0 และ version bump |

## Verification

- `pnpm install` เริ่มจาก `core.hooksPath` ที่ไม่มีค่า แล้วพิมพ์ `. prepare$ node scripts/setup-git-hooks.mjs` และหลังจบ `git config core.hooksPath` คืนค่า `hooks` — พิสูจน์ในเครื่องนี้จริง ไม่ได้อ้างจากเอกสาร pnpm
- `git ls-files | grep '^\.git/'` คืน 0 บรรทัด และ `git config --show-origin --get core.hooksPath` ก่อนหน้านั้น exit 1 — ยืนยันว่า hook path commit ไม่ได้ จึงต้องมาจาก lifecycle ไม่ใช่จากไฟล์ใน repo
- `pnpm typecheck` ผ่าน, `pnpm lint` 0 errors, `pnpm test` **120 passed | 29 skipped (149)**
- `node scripts/check-roadmap.mjs` → `Roadmap 0.18.0 is valid (11 item(s)) and matches roadmap.v0.18.0.json`
- `node scripts/security-check.mjs` ผ่าน, `git diff --check` ไม่มี output
- digest ของ image ดึงจาก Docker Hub registry จริง (`postgres:16-alpine` → `sha256:cf78e766…0685`) ไม่ได้เดา
- รูปแบบ service container (image / env / `--health-cmd pg_isready` / ports / เชื่อมผ่าน `localhost`) ตรงตามที่ GitHub Actions documentation กำหนดสำหรับ job ที่รันบน runner โดยตรง

**ตรวจแล้วบน CI จริง:** run `32649341753` ถูก trigger ด้วย push บน feature branch เป็นครั้งแรก และรายงาน `Test Files 21 passed (21)` / `Tests 149 passed (149)` **ไม่มี skipped เลย** — 29 เทสต์ที่ไม่เคยรันใน CI ผ่านบน PostgreSQL 16 รวม `makes a second submit wait for the lock instead of counting stale rows` (312ms) และ `makes a second confirmation wait for the item lock instead of reading a stale state` (428ms) ซึ่งเป็นสองข้อที่ handoff ก่อนหน้าอ้างเป็นหลักฐานมาตลอดโดยที่เครื่องไม่เคยตรวจ โค้ดจึงไม่ได้พึ่งพฤติกรรมของ PostgreSQL 18 ที่เครื่อง dev ใช้

## Security and data impact

ไม่มีการเปลี่ยน permission, secret, PII, storage, payment, agent policy หรือ migration
CI ได้ฐานข้อมูล throwaway ของตัวเองในคอนเทนเนอร์ ผูกกับ job เท่านั้น รหัสผ่าน `postgres` เป็นค่าใน service
ที่เข้าถึงได้เฉพาะภายใน job ไม่ใช่ credential ของระบบใด และไม่มี secret ใหม่ถูกเพิ่มเข้า repository หรือ workflow

`prepare` รันคำสั่งเดียวคือ `git config core.hooksPath hooks` และข้ามทันทีเมื่อไม่ใช่ Git work tree
จึงไม่ทำให้ deployment ที่ติดตั้งจาก tarball ล้ม

## Rollback

Revert commit นี้ hook ยังคงถูกตั้งไว้ในเครื่องที่ `pnpm install` ผ่านไปแล้ว ถอนด้วย
`git config --unset core.hooksPath` ไม่มี schema, migration หรือพฤติกรรมของผลิตภัณฑ์เปลี่ยนในเวอร์ชันนี้

## Findings recorded here because no other file records them

1. **CHANGELOG ไม่มี entry ของ v0.17.0** ทั้งที่ release นั้น push, tag และปิดงานแล้ว — เพิ่มย้อนหลังในรอบนี้
   พร้อมหมายเหตุกำกับว่าเพิ่มทีหลัง
2. **`package.json` version ค้างที่ 0.16.0** ข้ามรอบ v0.17.0 ไป รอบนี้ bump เป็น 0.18.0 ตรงกับ roadmap
   การเทียบสองค่านี้อัตโนมัติคือ IP-059 ที่ยังไม่ทำ
3. **`docs/handoff/2026-08-23-planning-harness.md` (commit `2727ac7`) ยังไม่มี entry ใน `index.json`**
   เพราะตอนนั้นไฟล์กำลังถูกแก้ในงาน v0.17.0 — เพิ่มพร้อมกันในรอบนี้
4. **เครื่อง dev รัน PostgreSQL 18.6 แต่ ADR 0002 และ ARCHITECTURE.md ระบุ production target เป็น 16**
   CI ยึด 16 ตาม ADR การรัน CI ครั้งแรกจะบอกว่าโค้ดพึ่งพฤติกรรมของ 18 หรือไม่ ถ้าอยากให้ทั้งสามตรงกัน
   ต้องเป็นการตัดสินใจที่บันทึกไว้ ไม่ใช่ค่าที่ต่างกันเงียบ ๆ
5. **`docs/design-mockups/generate.mjs` มี lint warning** (`notMono` ประกาศแล้วไม่ได้ใช้) ไฟล์นั้นยัง untracked
   และไม่ใช่ของเวอร์ชันนี้ จึงไม่แตะ แต่จะติดไปกับ commit ของใครก็ตามที่ track มันเข้ามา

6. **`docs/roadmap/README.md` ห้ามแก้ไฟล์เวอร์ชันหลัง commit แต่ practice จริงแก้ทุกรอบ** — `9905f55`
   แก้ `roadmap.v0.17.0.json` เพื่อบันทึกว่า push และ tag เสร็จแล้ว และรอบนี้ก็ทำแบบเดียวกันเพื่อบันทึกสถานะ
   กฎกับความจริงจึงขัดกัน ทางที่ตรงกว่าคือระบุให้ชัดว่า `status`, `updatedAt` และ `verification`
   อัปเดตได้หลัง release ส่วน `scope`, `items` และ `rollback` แก้ไม่ได้ — แต่นั่นคือการเปลี่ยนกฎ
   ต้องผ่านการตัดสินใจ ไม่ใช่แก้เงียบ ๆ ยกเป็น roadmap item ในเวอร์ชันถัดไป

## Next action

IP-054 (`capabilities.read` ไม่มีด่านฝั่ง server — kill switch ปิดการอ่านไม่ได้จริง) พร้อม IP-058
(`.limit(1)` ไม่มี `ORDER BY` ใน `estimeter-access.ts:81-97` และ `:115-122`) ทำเป็นสไลซ์เดียวเพราะอยู่ไฟล์เดียวกัน

**IP-050 และ IP-051 ถูกทำเครื่องหมาย `blocked`** จนกว่าจะตอบได้ว่าราคากลางยึดประกาศของหน่วยงานไหน
ระหว่างคณะกรรมการราคากลาง (พาณิชย์) ตาม `docs/architecture/estimeter-operating-policy.md`
กับกรมโยธาธิการและผังเมืองตาม IP-042 — งานนี้คือเปิดประกาศฉบับจริง ไม่ใช่เขียนโค้ด
