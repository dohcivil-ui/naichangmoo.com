# Handoff — `ไม่ขึ้นเวอร์ชันใหม่: Landing Chrome และกฎการขับเบราว์เซอร์`

ข้าม `/grill-with-docs` ตาม AGENTS.md ข้อ 1 เพราะงานทั้งหมดในรอบนี้เป็นการปรับค่าที่มีอยู่แล้วในเลย์เอาต์ ไม่มีศัพท์ใหม่และไม่มีการตัดสินใจใหม่ ส่วนงาน slider ของหน้า landing ที่เป็นของใหม่จริงนั้น *ยังอยู่ในขั้น grilling* และยังไม่ได้เขียนโค้ดใด ๆ

## Description

รอบนี้ทำสองเรื่องที่ไม่เกี่ยวกัน เรื่องแรกคือลดความสูงของ hero บนหน้า landing ลงตามที่เจ้าของงานชี้กรอบมา และปรับโลโก้บนแถบนำทางให้อ่านออกในระยะปกติ เรื่องที่สองคือเขียนกฎการขับเบราว์เซอร์ลง `AGENTS.md` เพื่อให้เซสชันถัดไปรู้ว่าเจอหน้า login แล้วต้องหยุดส่งไม้ให้คน ไม่ใช่หาทางกรอกรหัสเอง ทั้งสองเรื่องไม่แตะ `roadmap.json` โดยตั้งใจ ซึ่งเป็นการเบี่ยงจาก AGENTS.md ข้อ 4 ที่บันทึกไว้ในหัวข้อ Risk ด้านล่าง

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Landing chrome | `src/app/globals.css` | `.hero` padding `92px 0 72px` → `30px 0 26px`, `.hero__side` min-height `342px` → `300px` |
| Nav brand | `src/app/globals.css` | `.brand-logo__wordmark` เปลี่ยนจากกำหนดด้วยความกว้าง (`width: min(260px, 27vw)` + `max-height: 56px`) มาเป็นกำหนดด้วยความสูง (`height: 84px; width: auto; max-width: min(340px, 30vw)`) แล้วเพิ่มพื้นขาว มุมโค้ง 14px และเงา ให้กรอบขาวที่ติดมากับไฟล์ภาพอ่านเป็นการ์ดลอยที่ตั้งใจ; `.site-nav__inner` min-height `76px` → `100px`; กฎ ≤760px ปรับตามเป็น `height: 64px` |
| Agent policy | `AGENTS.md` | เพิ่มหัวข้อ `## Browser control` ต่อจาก `## Safety rules` — ขับเบราว์เซอร์ผ่าน `chrome-devtools` MCP เท่านั้น, `take_snapshot` ก่อน `click`/`fill`, เจอหน้า login ให้หยุดและให้ผู้ใช้พิมพ์เอง, ห้ามอ่าน `.env*` มากรอกลงฟอร์ม, session หมดอายุให้ขอ login ใหม่ |

## Verification

| คำสั่ง / การตรวจ | ผล |
|---|---|
| `pnpm lint` | 0 error, 1 warning ที่มีอยู่ก่อนแล้ว (`formatSatang` ไม่ได้ใช้ใน `src/lib/thai-baht.test.ts`) |
| `pnpm typecheck` | ผ่าน |
| `pnpm test` | 168 passed, 33 skipped (24 ไฟล์) |
| `node scripts/check-roadmap.mjs` | `Roadmap 0.25.0 is valid (14 item(s)) and matches roadmap.v0.25.0.json` |

ตรวจด้วยเบราว์เซอร์จริงบน `localhost:3000` ที่ viewport 1524 px วัดด้วย `getBoundingClientRect`:

- `.hero` สูง 518 → **410 px** โดย `.hero__grid` ยังสูง 354 px เท่าเดิม — ที่หายไปเป็น padding ล้วน ไม่ได้ตัดเนื้อหา
- `.site-nav` สูง 77 → **101 px**; กล่องโลโก้ 260×56 → **294×84** ซึ่งเป็น 1.5 เท่าของโลโก้ที่มองเห็นเดิม (196×56)
- ที่ความกว้าง 502 px คอลัมน์ยุบเป็นแถวเดียว และ `documentElement.scrollWidth > innerWidth` เป็น `false` คือไม่มี horizontal overflow

## Security and data impact

ไม่มี ไม่แตะสิทธิ์ ความลับ PII พื้นที่จัดเก็บ การชำระเงิน หรือ migration การเปลี่ยนแปลงเป็น CSS กับเอกสารกฎของเอเจนต์เท่านั้น

หัวข้อ `## Browser control` ที่เพิ่มเข้ามา *ขยาย* กฎข้อแรกของ `## Safety rules` ไม่ได้ผ่อนกฎใด — มันห้ามอ่าน `.env*` เพื่อเอา credential ไปกรอกฟอร์มอย่างชัดเจน

## Risk

`roadmap.json` ไม่ถูกอัปเดต ซึ่งเบี่ยงจาก AGENTS.md ข้อ 4 ที่บังคับให้อัปเดตก่อนทุก commit เจ้าของงานตัดสินใจเช่นนี้เพราะรอบนี้เป็น CSS กับเอกสาร ไม่มี migration ไม่มี schema `node scripts/check-roadmap.mjs` ยังผ่านเพราะมันตรวจว่า pointer ตรงกับไฟล์เวอร์ชันเท่านั้น ไม่ได้บังคับว่าทุก commit ต้องมีเวอร์ชันใหม่

บันทึกนี้ไม่ได้เพิ่มเข้า `docs/handoff/index.json` เพราะรายการในไฟล์นั้นผูกกับเลขเวอร์ชัน และรอบนี้ไม่มีเวอร์ชันใหม่ มีบันทึกที่ไม่อยู่ใน index อยู่ก่อนแล้วสองฉบับ

หมายเหตุที่ยังค้าง: กรอบขาวรอบโลโก้ไม่ได้หายไป แต่ถูกทำให้เป็นการ์ดลอยที่ตั้งใจ ไฟล์ `naichangmoo-primary-wordmark.png` ยังมีพื้นหลังทึบ `rgba(254,254,254,255)` และมีหมึกอยู่แค่แถว 12–152 จาก 167 คือประมาณ 84% ของความสูง ทำให้โลโก้ที่มองเห็นสูงจริง ~70 px ในกล่อง 84 px

## Rollback

`git revert` สอง commit ของรอบนี้ ไม่มี migration และไม่มี production data เกี่ยวข้อง ถ้าต้องการย้อนเฉพาะความสูง hero ให้คืน `.hero { padding: 92px 0 72px; }` กับ `.hero__side { min-height: 342px; }` ที่ `src/app/globals.css`

## Next action

1. งานใหม่ที่ยังค้างอยู่ในขั้น grilling คือ slider แผงหลักฐานบนหน้า landing — คำถามที่ยังไม่ปิดคือชุดสไลด์ 4 ใบที่ของจริงรองรับได้ทั้งหมด และป้ายกำกับกับปลายทางของปุ่ม "ดูทั้งหมด" ยังไม่มีโค้ดใดถูกเขียน
2. ขอไฟล์ `wordmark` ที่ครอปชิดหมึกและพื้นหลังโปร่งใส แล้วโลโก้สูง 84 px จะให้หมึกเต็ม 84 px เทียบเท่าเว็บอ้างอิงที่ใช้เปรียบเทียบ โดยไม่ต้องดันกล่องขึ้นเป็น 106 px และไม่ต้องพึ่งการ์ดขาว
3. `roadmap.json` และ `roadmap.v0.25.0.json` ยังมี `status` เป็น `implementation_in_progress` ทั้งที่ v0.25.0 commit push และ tag (`v0.25.0-circular-readers`) ไปแล้ว ค่าที่ควรเป็นตามไฟล์ก่อนหน้าคือ `pushed_tagged_and_released`
