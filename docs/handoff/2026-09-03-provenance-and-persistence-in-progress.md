# 2026-09-03 — ที่มาของปริมาณและงานวัดลงฐาน (ค้างขั้นกดจริง)

**สาขา** `initial-project/nextjs-foundation` · **รุ่น** ยังอยู่ที่ 0.98.0 ไม่ตัดรุ่น · **รายการ** IP-232 IP-233 (IP-234 ออกแบบแล้ว ยังไม่เริ่ม)
**สถานะ** commit ครบ 12 ตัวนับจาก `0bf4a75` ถึง `0c9e551` **ยังไม่ push** · ต้นไม้สะอาด (เหลือ `next-env.d.ts` ที่ Next dev เขียนเอง ไม่ต้องสน)
**ทำไมปิดเซสชัน** MCP `chrome-devtools` ค้างทั้งเซสชัน (`Target closed`) พิสูจน์แล้วว่า Edge เองเปิดได้ปกติ ต้องเปิดเซสชันใหม่ให้ MCP เริ่มใหม่

---

## หนึ่ง — เซสชันใหม่ต้องทำอะไรต่อทันที

**ขั้น 6 ของ `docs/plans/2026-09-03-ip-233-build-steps.md` — กดจริงใน Edge** ยังไม่เคยทำเลย

1. `git status` ต้องสะอาด · `git log --oneline -12` ต้องเห็น `0c9e551` บนสุด
2. dev server อาจยังรันที่ `http://localhost:3000` (ตรวจด้วย `curl`) ถ้าไม่ ให้ `pnpm dev`
3. `list_pages` ของ chrome-devtools ต้องตอบได้ — **ต้นเหตุ `Target closed` หาเจอแล้ว (2026-09-03 เย็น):** Edge 152.0.4191.53
   (อัปเดต 29 ส.ค.) ปิดตัวเองใน 17 ms เมื่อ puppeteer เปิดด้วย `--remote-debugging-pipe` ไม่เกี่ยวกับเซสชันหรือ profile
   (profile ใหม่เอี่ยมก็พัง · chrome-devtools-mcp 1.7.0 ก็พัง) แต่ต่อผ่าน TCP port ได้ปกติ · ทางแก้: `~/.claude/edge-mcp.cmd`
   เปิด Edge เองด้วย `--remote-debugging-port=9333` (profile เดิม) แล้วรัน MCP ด้วย `--browserUrl` · `~/.claude.json`
   ชี้ command ไปที่ launcher นี้แล้ว · ถ้าวันหนึ่ง Edge อัปเดตแล้ว pipe กลับมาใช้ได้ ค่อยเปลี่ยนกลับ
4. เดินขั้น 6.2–6.9 ตามสเปก: แบบกุสุมาลย์หน้า 7 → ร่างกริด → ระยะจริง 5.00 → สเกลต้องได้ **1:125** → ปิดแท็บ เปิดใหม่ เลือกไฟล์เดิม → หน้า 7 ซูมเดิม กริด ระยะจริง สเกล กลับมาครบ ประวัติย้อนกลับว่าง → วัดช่วงถัดไปต้องได้ **5.00** (เทียบเลขที่แบบเขียนเสมอ) · ภาพหน้าจอทุกขั้น · ทิ้ง Edge ไว้ให้เจ้าของงานดู · ล้าง emulation
5. ผ่านแล้วจึงตัดรุ่นได้ตามกติกาข้อ 8 (roadmap ต้องเพิ่ม IP-233 IP-234 เป็นรายการใหม่ · CHANGELOG · ไม้ต่อฉบับเต็ม · `pnpm release`)

## สอง — สิ่งที่เจ้าของงานเคาะวันนี้ (อย่าถามซ้ำ)

| เรื่อง | คำตัดสิน |
|---|---|
| รูปทรงบรรทัดถอดปริมาณ | **backup sheet** — แยกย่อยทีละจุด ชี้ที่มาได้ ยอดรวมขึ้น ปร.4 · measurement = บรรทัดใน backup sheet · take-off item = ยอดที่ขึ้น ปร.4 |
| ตัวตนของไฟล์แบบ | **checksum (SHA-256) ฝั่งเบราว์เซอร์** ไม่รอ R2 เพราะ phase 1 ยังไม่เปิดให้ทำงานเป็นทีม · `storage_key = unstored:<checksum>` |
| เปิดมาแล้ว | **ต้องอยู่จุดเดิม** หน้า ซูม ตำแหน่ง — ตาราง `drawing_view_states` รายคน ไม่ลง audit |
| ศัพท์ | **ใช้คำ dev สากลทับศัพท์ ห้ามแปลเป็นชื่อไทยเอง** (migration, revert, hash, ORM, foreign key) ภาษาไทยมีไว้อธิบาย · "ลายนิ้วมือของไฟล์" ถูกสั่งห้าม · กฎเขียนไว้ใน `~/.claude/thai-terms.md` และ memory `use-standard-dev-terms-explain-in-thai` |
| migration ใบใหม่ | **ต้องถามก่อนรัน `db:migrate` ทุกครั้ง** — 0016 (`drawing_marks` ของ IP-234) ยังไม่ได้ขออนุญาต |

## สาม — ของที่เปลี่ยนวันนี้

**ฐานข้อมูล** migration `0015_harsh_cobalt_man.sql` รันแล้ว — `takeoff_measurements` + `method` `proposal_id` `method_context` + CHECK `(method='model') = (proposal_id IS NOT NULL)` · ตารางใหม่ `drawing_calibrations` (`confirmed_by NOT NULL`) และ `drawing_view_states` · แถวเดิม backfill `typed`

**ไฟล์ใหม่** `src/lib/quantity-provenance.ts` `drawing-calibration-method.ts` `drawing-state.ts` (+เทสต์) · `src/server/estimeter/edit-access.ts` `drawing-repository.ts` (+integration test 10 ตัว) · `src/server/actions/estimeter-drawing.ts` · `docs/adr/0024-…md` · `docs/plans/2026-09-02-quantity-provenance-and-persistence.md` `2026-09-02-estimeter-on-a-phone.md` `2026-09-03-ip-233-build-steps.md` `2026-09-03-ip-234-build-steps.md`

**แก้** `schema.ts` · `takeoff-repository.ts` (`method:"typed"` + export `WRITABLE_PROJECT_STATES`) · `estimeter-takeoff.ts` (import ด่านสิทธิ์จากโมดูลกลาง) · `closed-tables.test.ts` (+2 ตาราง) · `takeoff-repository.integration.test.ts` (+CHECK สองทิศ) · `markup/page.tsx` (ส่ง `projectId`) · `drawing-markup.tsx` (checksum ก่อน pdf.js · ล้าง state ครบ แก้บั๊ก grid ค้างข้ามไฟล์ · persist + effect สองตัว · ป้ายบันทึกแล้ว) · `globals.css`

**เทสต์** 1,017 → **1,062** · ยิงฐานจริง `ESTIMETR_DB_TESTS=1` 45 ตัวผ่าน

## สี่ — ความเสี่ยงและทางถอย

- ขั้น 5 (`84fcbde`) ยังไม่เคยเห็นในเบราว์เซอร์ ถ้าพัง `git revert 84fcbde` ตัวเดียว ฝั่งเซิร์ฟเวอร์ไม่กระทบ
- migration 0015 ย้อนด้วย revert ไม่ได้ ต้องเขียนใบใหม่ถอน — แต่เป็นการเพิ่มล้วน ไม่มีข้อมูลเสีย
- IP-230 (มือถือ) เป็น**แบบเท่านั้น** ห้ามเริ่มโค้ดจนกว่า IP-232 IP-233 IP-234 และ IP-229 ลงครบ (ดูแผนหัวข้อเจ็ด)

## ห้า — รอเจ้าของงาน

`bash scripts/setup-r2.sh` (ไม่ด่วน) · เคาะ migration 0016 ก่อนเริ่ม IP-234 ขั้น 1 · ตั้งศัพท์ไทยสามคำที่ค้างใน `2026-09-02-estimeter-on-a-phone.md` หัวข้อห้า
