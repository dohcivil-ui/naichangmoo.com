# Handoff — `v0.19.0: The Design Language Stops Living Only in globals.css`

## Description

ภาษาการออกแบบของแพลตฟอร์มเคยอยู่ในหัวคนเขียนโค้ดกับใน `src/app/globals.css` เท่านั้น ไม่มีไฟล์ไหน
บอกได้ว่า teal ใช้ตอนไหน orange ใช้ตอนไหน หรือมุมมนมีกี่ขั้น รอบนี้ถอด token ที่ใช้จริงออกมาเป็น
`DESIGN.md` ที่ root ตามรูปแบบ Google Stitch เพื่อให้ design agent อ่านเองได้โดยไม่ต้องบอกซ้ำทุกครั้ง
การถอดทำให้เห็นสองอย่างที่ระบบไม่ได้ตั้งใจให้เป็น คือ tracking `-.05em` ที่บีบแรงเกินไปสำหรับภาษาที่
ไม่เว้นวรรคระหว่างคำ และค่ามุมมน 11 ค่าที่ค่อย ๆ เกิดจากการแก้ทีละจุด ทั้งสองถูกทำให้เป็นระบบในรอบเดียวกัน
เพราะเอกสารที่บันทึกความไม่เป็นระบบเอาไว้ไม่มีประโยชน์

เอกสารนี้เกิดจากการเปรียบเทียบจริง ไม่ใช่การประกาศ: หน้า take-off หน้าเดียวกันถูก render ด้วย
ภาษาการออกแบบ 75 แบบจาก `skill/awesome-design-md-main` แล้วเจ้าของผลิตภัณฑ์เลือกของเดิม
สิ่งที่ commit นี้เก็บไว้คือผลของการเลือกนั้น

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Design system document | `DESIGN.md` (ใหม่, root) | 324 บรรทัด — front matter (colors / typography / rounded / spacing / components) + 9 หัวข้อตามสเปค Stitch พร้อม Do's/Don'ts และ Agent Prompt Guide ค่าทั้งหมดถอดจาก `globals.css` ไม่ได้เขียนจากความจำ |
| Typography | `src/app/globals.css` | negative tracking เหลือสามขั้น `-.035em` display / `-.03em` section / `-.02em` card — จากเดิม `-.055em`, `-.05em`, `-.04em`, `-.03em`, `-.025em`, `-.02em` ปนกัน (แก้ 7 จุด) |
| Shape system | `src/app/globals.css` | radius เหลือ `8/12/16/24/32px` + `999px` + `50%` — จากเดิม 6, 7, 10, 11, 13, 14, 17, 18, 20, 22, 25, 26, 34 และ `99px`/`999px` ปนกัน (แก้ 29 จุด) |
| Comparison tool | `docs/design-mockups/generate.mjs`, `template.mjs` (ใหม่) | อ่าน DESIGN.md ของทุกแบรนด์แล้ว render หน้า take-off เดียวกัน ชี้ไปที่ `DESIGN.md` ที่ root แล้ว · ลบ helper `notMono` ที่ handoff v0.18.0 ข้อ 5 ทักไว้ |
| Plan | `docs/roadmap/roadmap.v0.19.0.json`, `roadmap.json`, `CHANGELOG.md`, `package.json` | roadmap v0.19.0, IP-060 done, IP-061 ตั้งใหม่, version bump 0.18.0 → 0.19.0 |

## Verification

- `pnpm lint` 0 errors · `pnpm typecheck` ผ่าน · `pnpm test` **120 passed | 29 skipped (149)** · `pnpm build` สำเร็จ render ครบ 12 route
- `node scripts/security-check.mjs` ผ่าน · `node scripts/check-roadmap.mjs` → `Roadmap 0.19.0 is valid (13 item(s)) and matches roadmap.v0.19.0.json`
- `grep -o 'border-radius: [^;]*' src/app/globals.css | sort | uniq -c` คืนเฉพาะ `12px ×17`, `8px ×11`, `999px ×8`, `24px ×8`, `50% ×6`, `16px ×6`, `32px ×1` — ไม่มีค่านอกบันไดเหลืออยู่
- `grep -o 'letter-spacing: -[^;]*'` คืนเฉพาะ `-.03em ×4`, `-.035em ×4`, `-.02em ×3`
- ทุก `{rounded.*}` ใน `DESIGN.md` ชี้ไปยังค่าที่มีอยู่จริงใน `globals.css` หลังแก้ (ไล่ทีละ reference ทั้ง 16 จุด)
- รัน `node docs/design-mockups/generate.mjs` หลังย้าย path แล้วได้ 75 หน้า (มืด 17 / สว่าง 58) แล้วลบ output ทิ้ง — พิสูจน์ว่า generator อ่าน `DESIGN.md` ที่ root ได้จริง ไม่ใช่แค่แก้ path แล้วเชื่อ

**ยังไม่ได้ตรวจ:** ผลลัพธ์บนหน้าจอจริง ไม่มีใครเปิดเบราว์เซอร์ดูในรอบนี้ การแก้เป็นการแทนค่าล้วน
ไม่แตะ selector, layout rule, โครงสร้าง component หรือสีแม้แต่จุดเดียว และ build ผ่าน จึงตรวจได้ด้วย grep
แต่ "ตรวจได้ด้วย grep" ไม่เท่ากับ "เห็นแล้วว่าสวย" จุดที่ควรดูด้วยตาก่อน push คือ `.app-card__icon-wrap`
ซึ่งกรอบนอกเป็น 24px และกรอบใน `::before` (inset 7px) เป็น 16px ตามบันได ทั้งที่ค่าที่พอดีทางเรขาคณิตคือ 17px
ต่างกัน 1px โดยตั้งใจ เพื่อไม่ให้มีค่านอกบันไดหลงเหลือ

## Security and data impact

ไม่มีการเปลี่ยน permission, secret, PII, storage, payment, agent policy, schema หรือ migration
`DESIGN.md` เป็นเอกสารสาธารณะที่ไม่มีข้อมูลลูกค้าหรือ credential ใด ๆ
`docs/design-mockups/` เก็บเฉพาะ source ของ generator ไม่เก็บ output ที่มันสร้าง

## Rollback

Revert commit ของ v0.19.0 `globals.css` กลับไปใช้ tracking และ radius ชุดเดิม `DESIGN.md` หายไปจาก root
ไม่มี runtime behaviour, schema, migration หรือ dependency เปลี่ยนทั้งขาไปและขากลับ tag ที่กลับไปได้คือ
`v0.18.0-quality-gate-enforced`

## Findings recorded here because no other file records them

1. **`DESIGN.md` ไม่มีเครื่องตรวจอยู่ข้างหลัง** ไม่มีอะไรกัน `globals.css` ให้ไม่ลอยห่างจากเอกสาร
   ซึ่งเป็นความล้มเหลวแบบเดียวกับที่ `package.json` ลอยห่างจาก roadmap pointer จนต้องตั้ง IP-059
   ตั้งเป็น **IP-061** ในรอบนี้แล้ว
2. **`docs/design-mockups/generate.mjs` เขียน output ลง working tree** รันทีเดียวได้ 75 ไฟล์ + index
   ที่ต้องลบก่อน commit ทุกครั้ง ทางที่ปลอดภัยกว่าคือให้มันเขียนลง path ที่ `.gitignore` คุมอยู่
   ยังไม่ทำในรอบนี้เพราะเป็นเครื่องมือใช้นาน ๆ ครั้ง
3. **CONTEXT.md มีงานค้างที่ยังไม่ commit** (Factor F, Costing Method, Estimate Revision,
   Cost Item Treatment รวม 16 บรรทัด) เป็นงานของ branch `feature/estimeter-measurement-breakdown`
   ไม่ได้ถูกรวมเข้า commit นี้โดยตั้งใจ ยังอยู่ใน working tree ตามเดิม
4. **การเปรียบเทียบ 75 แบบไม่ได้ถูกเก็บไว้** ตามที่เจ้าของผลิตภัณฑ์ตัดสินใจ สิ่งที่เหลือคือ generator
   ที่สร้างใหม่ได้ด้วยคำสั่งเดียว ถ้าวันหลังต้องอธิบายว่าทำไมถึงเลือกของเดิม ต้องรันใหม่ ไม่มีภาพเก็บไว้

## Next action

**IP-061** (เครื่องตรวจว่า DESIGN.md ยังตรงกับ globals.css) ทำคู่กับ **IP-059**
(เทียบ `package.json` กับ roadmap pointer และบังคับให้มี handoff จริง) ได้ในสไลซ์เดียว
เพราะทั้งคู่คือการเติม `scripts/check-*.mjs` ให้ตรวจสิ่งที่ตอนนี้พึ่งความจำของคนอยู่

งานผลิตภัณฑ์ตัวถัดไปยังเป็น **IP-054** (`capabilities.read` ไม่มีด่านฝั่ง server) คู่กับ **IP-058**
(`.limit(1)` ไม่มี `ORDER BY` ใน `estimeter-access.ts`) ตามที่ v0.18.0 ระบุไว้
