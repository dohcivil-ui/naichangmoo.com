# Handoff — `v0.82.0 ถึง v0.88.0: เจ็ดรุ่น ครัวปิดประตู และผู้ช่วยที่เสนอผ่านประตูเดียว`

**วันที่:** 2026-08-28 (เซสชันบ่าย–ค่ำ ต่อจาก handoff ห้ารุ่นเช้าวันเดียวกัน)
**สาขา:** `initial-project/nextjs-foundation`
**รุ่นล่าสุด:** `v0.88.0-assistant-proposes-through-one-gate` (เซสชันนี้ปิด v0.82.0–v0.88.0 รวม 7 รุ่น)
**เทสต์:** 749 ผ่าน 36 skip · typecheck สะอาด · lint ไม่มี output
**โรดแมป:** 116 รายการ · IP-197/199/200/196/185/201/202/184 ปิดครบในเซสชันนี้

---

## ศูนย์ — สิ่งแรกที่ต้องทำก่อนเริ่มงาน ห้ามข้าม

**เรียก `/grill-with-docs` ก่อนเริ่มทุกครั้ง** และรันห้าคำสั่งตรวจสาขา:
`git log --oneline -5` · `git status` · `node scripts/check-roadmap.mjs` · `node scripts/check-release.mjs` · `git describe --tags`

**กฎเหล็กใหม่ของเซสชันนี้ (อยู่ใน `~/.claude/CLAUDE.md` แล้ว):**
1. **Fable คิด Opus 5 เขียน** — งานวิเคราะห์/ออกแบบส่งเข้า agent โมเดล Fable ทำบรีฟก่อน แล้ว Opus 5 เขียนตาม
2. **หลักการเขียนเอกสารให้มือใหม่**: ประโยคไทยเข้าใจง่ายก่อน แล้ววงเล็บศัพท์ Dev — ตารางศัพท์โตขึ้นมาก
   (SSOT, Core Layer, Adapter, Migration, UI Sweep Script, Project Rules, Icon Generator,
   Color Token Reader, Exception List, Assistant Dock = **แผงผู้ช่วยกลาง**, Date Picker = **ปฏิทินเลือกวันที่**,
   Proposal Lifecycle = วงจรของข้อเสนอ, Automated Quality Gate ฯลฯ) — ดูตารางเต็มใน CLAUDE.md เครื่อง

## หนึ่ง — เจ็ดรุ่นของเซสชันนี้

| รุ่น | เรื่อง |
|---|---|
| v0.82.0 | **hero ฉากสาธิตสด** (IP-197): ลูป 4 จังหวะจาก mockup — บทเขียนใหม่ให้ตัวเลขบวกครบ 100% อ้างเอกสาร วสท. หน้า 92–94 จริง (mockup อ้างเรื่องที่เอกสารไม่ได้พูด) · จังหวะเวลาเป็น pure function ใน `src/lib/hero-demo-script.ts` · หยุดเมื่อพ้นจอ/สลับแท็บ · reduced-motion ได้เฟรมจบจาก SSR · ด่านห้าม `<button>` ในฉาก + **IP-199 จอมือถือ 4 จุด** (ต้นตอใหญ่: dropdown สพฐ. ไร้ width ถ่างการ์ด 641px — โผล่หลังคลิกเข้าชั้นเท่านั้น ซึ่ง v0.80.0 เคยวินิจฉัยผิดว่าเป็นซากเครื่องมือ) |
| v0.83.0 | **ท้ายเว็บโครงใหม่** (IP-200): เลิกไล่ชื่อแอป — 4 คอลัมน์ตามที่เจ้าของงานร่าง ลิงก์คุมด้วย flag `exists` ใน `footer-navigation.ts` + ด่านตรวจพิสูจน์กับดิสก์สองทิศทาง (ประกาศมีแต่ไม่มี=แดง สร้างแล้วแต่ flag ปิด=แดง) หน้าอนาคต 5 หน้า (about/articles/contact/faq/guides) รออยู่ในโครง |
| v0.84.0 | **favicon + Web App Manifest** (IP-196): Icon Generator `scripts/build-app-icons.mjs` (วัด bbox จริง, ICO ฝัง PNG ประกอบเอง) · Color Token Reader `src/lib/kitchen-colours.ts` อ่านสีจาก globals.css ตอน build แทนการเพิ่ม Exception List · theme color = teal ตามคำเคาะ · ตรวจแล้ว globals.css ติดไป standalone build |
| v0.85.0 | **แผงผู้ช่วยกลาง** (IP-185): `AssistantDockHost` ห่อเนื้อหาใน AppShell — เดสก์ท็อปแผงตรึงขวาเต็มความสูง**ดันเนื้อหาหลบไม่บัง** มือถือแผ่นเลื่อนจากล่าง เริ่มกาง (คำชี้ขาดหลังกลับคำหนึ่งรอบ — ดูข้อสาม) จำคีย์เดียว `naichangmoo.assistant-dock.v1` · จุดปลาย portal อยู่ใน DOM เสมอแม้ย่อ · ด่านห้ามเขียนแผงเลียนแบบ |
| v0.86.0 | **อุดรอยรั่วความลับ** (IP-201): `/api/project-status` เคยเปิดโล่ง + หน้า /roadmap สาธารณะ → ย้ายเข้า `/admin/roadmap` + `/api/admin/project-status` ตอบ 404 กับคนนอก (ไม่ redirect — การเด้งก็บอกว่ามีของ) ถอดลิงก์ 3 จุด + โน้ต dev "ขอบเขตของต้นแบบนี้" บนต้นแบบทั้งสอง · leak-fence สแกนโค้ดหน้าสาธารณะ (ตัดคอมเมนต์ก่อน) + ESLint zone ห้าม import project-status นอกโซน admin |
| v0.87.0 | **ปฏิทินเลือกวันที่แบบไทย** (IP-202): `ThaiDateField` เดือนไทย ปี พ.ศ. พิมพ์ วว/ดด/ปปปป ได้ (พิมพ์ ค.ศ. โดนเตือน ไม่เดาใจแปลง) อธิกสุรทินเช็คจากปี ค.ศ. หลัง −543 · เปลี่ยนครบ 6 จุด ค่าภายในยัง ISO · popover แบบ fixed เพราะช่องอยู่ในตารางเลื่อน · ด่านห้าม `type="date"` งอกกลับ |
| v0.88.0 | **ผู้ช่วย work-plan เข้าประตูเดียว** (IP-184): วงจรของข้อเสนอเต็มรูป — โมเดลตอบเป็นข้อเสนอรอตัดสิน คนกดรับถึงทับ (ก่อนทับ push snapshot) ปฏิเสธแผนไม่ขยับ คืนค่าถอย 5 ชั้น in-memory · UI ทั้งหมดอยู่แผงผู้ช่วยกลาง · เรียกโมเดลผ่าน `requestAssistant`/`settleAssistantProposal` (server action ชั้นอ้างอิง ไม่รู้จักชื่อแอป) · ลบ `work-plan-assistant.ts` + ด่าน G5 ห้าม askForJson/askWithFallback นอก src/server/ai |

## สอง — คำวินิจฉัยของเจ้าของงานที่ผูกงานถัดไป

1. **ความลับภายในห้ามออกหน้าสาธารณะเด็ดขาด** — leak-fence คุมอยู่ ห้ามอ่อนข้อ pattern: `IP-\d`, handoff, `v0.x.y`, `docs/...` ในโค้ดที่ render (คอมเมนต์ไม่นับ)
2. **หลัง IP-184 ผู้ช่วยบนต้นแบบต้องเข้าสู่ระบบเป็นผู้ดูแล** (แอปยังไม่เปิดขาย) — เจ้าของงานรับแล้ว เป็นกติกา ADR 0019 เอง สมาชิกทั่วไปเห็นคำปฏิเสธ "แอปนี้ยังไม่เปิดใช้งาน"
3. **แผงผู้ช่วยกลางค่าเริ่มต้น "กาง"** — คำตอบแรกเป็น "ย่อ" แต่คำชี้ขาดสุดท้ายคือ **กาง** (Default State: Expanded) เพื่อให้คนค้นพบฟีเจอร์ · ตำแหน่ง: ดันเนื้อหาหลบด้วย padding ไม่ใช่การ์ดลอยบังงาน
4. **ผลตรวจแผน (critique) ไม่มีปุ่มรับ/ปฏิเสธ** — เป็นคำแนะนำอ่านแล้วผ่านไป ปล่อยหมดอายุ 24 ชม. เอง
5. **แผงคำแนะนำ ESTIMETR (ข้อความคงที่) คงที่เดิมจนถึง IP-187** — ช่วงเปลี่ยนผ่านมีสองแบบชั่วคราว
6. **กติกาบ้าน UI ใหม่สองข้อใน memory:** เขตกดจริง ≥48px (หน้าตาเดิม ใช้ pseudo-element) · ฟอนต์ต้องพอดีช่อง ห้ามพับจนไม่สวย ข้อมูลตารางจัดกึ่งกลาง (ค่าก้อนเดียวเช่นวันที่ nowrap)
7. **mm/dd/yyyy บนช่องวันที่** เคยเป็น native ของเบราว์เซอร์ — ตอนนี้หมดปัญหาเพราะ ThaiDateField แทนครบทุกจุดแล้ว

## สาม — งานที่ยังค้าง เรียงตามความพร้อม

**พร้อมเริ่ม:** IP-187 ย้ายแผงคำแนะนำ ESTIMETR เข้าแผงผู้ช่วยกลาง (แบบอย่างจาก IP-184 มีแล้ว) ·
หน้าเนื้อหา 5 หน้าของท้ายเว็บ (about/contact ทำได้เร็ว — ข้อมูลมีใน business-identity + platform_channels แล้ว) ·
IP-144 undo ถาวรของ work-plan (กองประวัติ 5 ชั้น in-memory ของ IP-184 คือรุ่นแรกของมัน)
**เฟส 2 ตาม DIRECTION.md:** work-plan (IP-143 Gantt/CPM, 137, 138, 139 Postgres) · ESCALATION K (IP-096–099, 107, 186) · ESTIMETR เก็บตก (IP-064, 070, 073, 052, 187) → เกต IP-179 · PRICEMETR (IP-161–164, 166, 188 — หมายเหตุ: วันที่ PRICEMETR ได้ผู้ช่วย เม็ดยาแผงกลางจะทับ gl-basket ต้องเผื่อ offset)
**รอเจ้าของงาน:** เข้าสู่ระบบใหม่ในเบราว์เซอร์ทดสอบ (session Suriya หมดอายุ — หน้า /admin/roadmap รอเขาดู) · กรอกช่องทางติดต่อจริง · จดบริษัทใหม่ + เลข DBD (IP-126) · แปลศัพท์ค้าง (Handoff)

## สี่ — เรื่องที่เจ็บแล้วต้องจำของเซสชันนี้

1. **rAF/timer แช่แข็งเมื่อหน้าต่าง Edge ถูกบัง** — ลูป hero "ไม่เดิน" ทั้งที่โค้ดถูก เพราะเบราว์เซอร์หยุดนาฬิกาแท็บที่มองไม่เห็น ก่อนวัดอนิเมชันต้อง `Page.bringToFront` เสมอ และ `awaitPromise` บน timer ของหน้าที่ถูกบังจะค้างไม่มีกำหนด
2. **`scroll-behavior:smooth` หลอกตัววัด** — `scrollIntoView` ยังเลื่อนอยู่ตอน `elementFromPoint` จิ้ม ผลออก null ทั้งที่ CSS ถูก ใช้ `behavior:"instant"` + รอ 300ms ในสคริปต์ตรวจเสมอ
3. **grid track `1fr` เฉย ๆ หดต่ำกว่า min-content ไม่ได้** — การ์ดใน hero ล้นจอแคบเพราะ media query เดิมของ repo ใช้ `1fr` ตัองเป็น `minmax(0,1fr)` ทุกชั้นที่มีเนื้อหากว้าง
4. **สคริปต์แทรก import แบบหา "บรรทัด import สุดท้าย" พังกับ import หลายบรรทัด** — แทรกกลาง `import {` ไปสามไฟล์ ตรวจ syntax หลังแทรกอัตโนมัติเสมอ หรือใช้ Edit ตรงจุด
5. **rename เหมาทั้งไฟล์ชนชื่อซ้ำข้าม module** — `WorkPlanSnapshot` มีทั้งใน storage และไฟล์ใหม่ เปลี่ยนชื่อฝั่งใหม่เป็น `PlanRevertSnapshot` แล้วต้องไล่คืนฝั่ง storage ที่โดนหางเลข
6. **production build เขียนทับ `next-env.d.ts`** (ชี้ .next/types แทน .next/dev/types) — `pnpm release` จะไม่ยอมปิดรุ่นเพราะไฟล์ค้าง `git checkout -- next-env.d.ts` ได้เลย เป็นไฟล์ generate
7. **ภาพใน context เยอะเกิน → API ปฏิเสธรูปทั้งเซสชัน** — ช่วงท้าย Read ภาพไม่ได้อีก ให้ยึดค่าวัดจาก DOM (getBoundingClientRect/scrollWidth) เป็นหลักฐานแทน และส่งภาพให้เจ้าของงานทาง SendUserFile ได้ตามปกติ
8. **แบบแผนที่ใช้ซ้ำได้:** สคริปต์ CDP ทั้งชุดอยู่ scratchpad เซสชันนี้ (`mobile-sweep.mjs`, `verify-mobile-fixes.mjs`, `shot-*.mjs`, `build-app-icons-proof.mjs`) — เปิด Edge :9223 โปรไฟล์ mcp เดิม จบทุกครั้งต้อง `Emulation.clearDeviceMetricsOverride`

## ห้า — สภาพแวดล้อม

- ฐานข้อมูลยังที่ migration 0010 — เซสชันนี้ไม่มี migration ใหม่
- Automated Quality Gate ตอนนี้มี **8 ด่าน**: import (ADR 0020) · สี (ADR 0021) · way-home · footer-navigation · hero-demo · icon · assistant-dock.contract · leak-fence + date-input-fence + assistant-path (G5) — **ห้ามแก้ด่านเพื่อให้งานตัวเองผ่าน**
- dev server :3000 รันอยู่ · Edge ทดสอบ :9223 เปิดค้าง (บัญชี Suriya **หมดอายุ ต้องเข้าสู่ระบบใหม่**)
- mockup `.design/landing-hero-live-demo/` หมดหน้าที่แล้ว (ของจริงขึ้น v0.82.0) — ยัง untracked บนเครื่องนี้

## rollback

กลับธงรายรุ่นได้ตามลำดับ v0.87.0 → v0.82.0 → `v0.81.0-footer-tells-only-what-true`
ไม่มี migration ใหม่ ทุกรุ่นเป็นโค้ดล้วน ยกเว้นข้อควรรู้: การถอย v0.86.0 จะเปิดรอยรั่วความลับกลับมา —
ถ้าจำเป็นต้องถอยรุ่นอื่น ให้ cherry-pick กันรั่วของ v0.86.0 ติดไว้เสมอ
