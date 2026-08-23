# Handoff — `planning-harness: A planning gate before the first line of code`

## Description

กระบวนการเดิมใน `AGENTS.md` เริ่มนับที่การสร้าง branch ซึ่งแปลว่างานถูกตัดสินใจไปแล้วก่อนที่กระบวนการจะเริ่มคุม
รอบนี้ติดตั้ง `grill-with-docs` จาก `mattpocock/skills` เป็นด่านที่ศูนย์: สัมภาษณ์เป็นรอบจนไม่เหลือสมมติฐานเงียบ
แล้วเขียนคำศัพท์ลง `CONTEXT.md` และการตัดสินใจที่กลับยากลง `docs/adr/` ทันทีที่ตกผลึก ซึ่งเป็นสองไฟล์ที่โปรเจกต์นี้ใช้อยู่แล้ว
พร้อมกันนั้นบันทึกผลตรวจว่ากฎที่ประกาศไว้ถูกบังคับจริงแค่ไหน และยกสิ่งที่ยังไม่มีอะไรบังคับขึ้นเป็น roadmap item

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Skill install | `.claude/skills/`, `.agents/skills/`, `skills-lock.json` | `grill-with-docs` + dependency `grilling` และ `domain-modeling` ติดตั้งแบบ copy ไม่ใช่ symlink |
| Process rule | `AGENTS.md` | `/grill-with-docs` เป็น Required workflow ข้อ 1 (ข้อเดิมเลื่อนเป็น 2-8) และหัวข้อ `## Planning skills` ที่ override ADR format |
| Audit record | `docs/research/harness-audit-2026-08-23.md` | ผลตรวจ read-only S1-S14 พร้อมหลักฐาน path:line, index ของ `km/` และคำถามที่ยังไม่มีคำตอบ |

## Verification

- `pnpm typecheck` ผ่าน, `pnpm lint` ผ่าน 0 warnings, `pnpm test` 111 passed / 27 skipped ณ เวลาที่แก้ (ก่อน `40fd881`)
- `node scripts/check-roadmap.mjs` ผ่าน
- `.claude/skills/<skill>/SKILL.md` เป็นไฟล์จริงทั้งสามตัว ไม่ใช่ symlink — ตรวจด้วย `test -L` ทีละตัว
- `npx skills list` แสดง `grill-with-docs`, `grilling`, `domain-modeling` ครบ source `mattpocock/skills`

เหตุผลที่ต้องเป็น copy ไม่ใช่ symlink: `git config core.symlinks` ในเครื่องนี้เป็น `false` และ symlink ที่ CLI สร้างชี้ absolute path
ของเครื่องพัฒนา ถ้า commit ไปเครื่องอื่นจะได้ไฟล์ข้อความที่มี path เครื่องเรา ไม่ใช่ skill

## Security and data impact

ไม่มี ไม่มีการเปลี่ยน permission, secret, PII, storage, payment, agent policy หรือ migration
skill ทั้งสามเป็นไฟล์ instruction ล้วน ไม่มีโค้ดที่รันเอง `skills-lock.json` เก็บ sha256 ของแต่ละตัวไว้ตรวจ drift

## Rollback

Revert commit นี้ กฎใน `AGENTS.md` กลับไปเป็น 7 ข้อเดิม และลบ `.claude/skills/`, `.agents/skills/`, `skills-lock.json`
ไม่มี migration และไม่มีสถานะใดในระบบที่ผูกกับ commit นี้

## Known gaps recorded here because no other file records them

1. **IP-053 ถึง IP-058 กับบรรทัด `skill/` ใน `.gitignore` เข้าไปกับ `40fd881`** ซึ่งเป็น commit ของ slice v0.17.0
   handoff ของ v0.17.0 ไม่ได้พูดถึงทั้งสองอย่าง คนที่มาอ่านทีหลังจะหาที่มาของ IP-053..058 ไม่เจอถ้าไม่มีบรรทัดนี้
2. **`roadmap.v0.17.0.json` บรรจุ item ที่ไม่ใช่ scope ของ slice v0.17.0 อยู่ 6 ข้อ** ยอมรับได้เพราะ `status` เป็น `planned` ทั้งหมด
   และ roadmap version ถัดไปจะยกไป แต่ต้องมีคนบันทึกว่ารู้ตัว
3. **ยังไม่เพิ่ม entry ลง `docs/handoff/index.json`** เพราะไฟล์นั้นกำลังถูกแก้อยู่ในงาน v0.17.0 ที่ยังไม่ commit
   การแก้ตอนนี้จะลากงานครึ่งทางของอีกสายเข้ามาใน commit นี้ ให้เพิ่ม entry หลัง v0.17.0 ปิดงาน
4. **`.claude/skills/` กับ `.agents/skills/` เป็นสำเนาซ้ำของ skill ชุดเดียวกัน** ขณะที่ `skills-lock.json` เก็บ hash ชุดเดียว
   และกฎใน `AGENTS.md` ห้ามแก้เฉพาะ `.claude/skills/**` ยังไม่ครอบอีกชุด ต้องเลือกเก็บชุดเดียวหรือขยายกฎ

## Next action

IP-055 + IP-053 + IP-056 เป็นสไลซ์เดียว: ทำให้ quality gate เป็นของจริงก่อน เพราะตอนนี้ `hooks/pre-commit`
ไม่เคยรันเลยสักครั้ง (`.git/hooks/` ว่าง, `core.hooksPath` ไม่มีค่า) และ CI ไม่ครอบ feature branch
ห้ามเริ่ม IP-050/IP-051 จนกว่าจะตอบได้ว่าราคากลางยึดประกาศของหน่วยงานไหน ตามคำถามข้อ 1 ใน
`docs/research/harness-audit-2026-08-23.md`
