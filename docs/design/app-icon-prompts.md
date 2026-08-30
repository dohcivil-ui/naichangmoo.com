# Prompt สำหรับสร้างไอคอนแอปด้วย Midjourney

ไฟล์นี้เก็บ prompt ที่ใช้จริง เพื่อให้ไอคอนที่ render รอบหน้าอยู่ในตระกูลเดียวกับของเดิม
ไม่ใช่ของใหม่ที่หน้าตาไม่เข้าพวก

## หนึ่ง — ตระกูลของภาพที่มีอยู่แล้ว

ไอคอนเดิมสี่ตัว (ESTIMETR, กำแพงกันดิน, ป้ายจราจร, จัดกรรมสิทธิ์ที่ดิน) มีลักษณะร่วมกันคือ

- สี่เหลี่ยมจัตุรัสมุมมน พื้นครีมนวล ขอบเส้นบางสีกรมท่าเข้ม
- วัตถุจริงของงานนั้นวางรวมกันเป็นกอง มองจากมุมสามส่วนสี่ ค่อนไปทางมุมสูง
- มีสีส้มเป็นจุดเน้นหนึ่งจุดในภาพเสมอ เช่น ไม้บรรทัด สันแฟ้ม หรือหมวกนิรภัย
- ไม่มีตัวหนังสือที่อ่านออก ไม่มีคน ไม่มีโลโก้

ของที่ยังขาดและต้องสร้างคือ **PRICEMETR · ESCALATION K · ผู้ช่วยสร้างแผนงาน**
ทั้งสามตัวตอนนี้ยืมตราของแพลตฟอร์มมาใช้ชั่วคราว ซึ่งอ่านได้ว่าเป็นความผิดพลาด ไม่ใช่ของชั่วคราว

## สอง — ส่วนท้ายที่ทุก prompt ใช้เหมือนกัน

ต่อท้ายทุก prompt ด้วยชุดนี้ เพื่อให้ทั้งตระกูลเป็นชุดเดียวกัน

```
isometric three-quarter view from slightly above, arranged as a small still-life on a soft warm
cream background, inside a rounded-square app icon frame with a thin deep navy blue outline,
teal and burnt orange accents, soft diffused studio lighting from the upper left, gentle contact
shadows, physically based materials, sharp focus throughout, photorealistic product photography,
clean and uncluttered --ar 1:1 --style raw --v 7 --no text, lettering, watermark, signature,
people, hands, cartoon, flat vector
```

**สีที่ต้องคุมให้ตรงกับเว็บ** กรมท่าเข้ม `#073047` · เขียวหัวเป็ด `#0d8282` · ส้ม `#f47721` ·
พื้นครีม `#f4f7f7` ถึงขาวนวล — ถ้า Midjourney ให้สีเพี้ยน ให้ระบุเพิ่มว่า
`deep navy #073047, teal #0d8282, burnt orange #f47721`

## สาม — Prompt รายแอป

### PRICEMETR — ราคาวัสดุและค่าแรง

```
A still-life of Thai construction cost reference materials: a small neat pile of river sand, a
short bundle of deformed steel rebar tied with wire, a grey paper cement sack, a grey concrete
test cylinder, and a folded printed price schedule with a brass magnifying glass resting on it,
a small burnt orange price tag on a string
```

### ESCALATION K — ค่า K และเงินชดเชยตามสัญญา

```
A still-life of a Thai government construction contract file: a thick bound contract document with
a burnt orange spine clip, a folded printout of a rising line graph, a slim desktop calculator, a
short steel rebar offcut and a small cement sample resting beside them as price index references
```

### ผู้ช่วยสร้างแผนงาน — แผนงานก่อสร้าง

```
A still-life of construction planning tools: a rolled-out printed bar chart schedule with a smooth
S shaped progress curve drawn over it, a desk calendar block, a mechanical pencil, a small
burnt orange safety helmet, and a folded set of building drawings underneath
```

## สี่ — ถ้าจะ render ของเดิมใหม่ให้ทั้งชุดสมจริงเท่ากัน

ใช้ prompt เหล่านี้กับส่วนท้ายชุดเดียวกัน แล้วจะได้ตระกูลที่กลมกลืนกันทั้งเจ็ดตัว

### ESTIMETR — ประมาณราคางานอาคาร

```
A still-life of building cost estimating tools: a small scale model of a reinforced concrete
building frame, a clipboard holding a printed quantity take-off sheet, a rolled architectural
drawing, a burnt orange scale ruler and a compact calculator on a drafting board
```

### กำแพงกันดิน — Retaining Wall Cantilever

```
A still-life of a retaining wall study: a small concrete cantilever retaining wall section model
cut away to show its footing, a compacted soil bank behind it, a steel rebar cage sample, and a
folded structural drawing with a burnt orange engineering scale beside it
```

### TRAFFIC SIGN — วัสดุป้ายจราจร

```
A still-life of Thai road sign components: a reflective aluminium traffic sign blank on a short
galvanised steel post, a coil of reflective sheeting, mounting brackets and bolts laid out neatly,
and a burnt orange measuring tape
```

### LAND ACQUISITION — งานจัดกรรมสิทธิ์ที่ดิน

```
A still-life of land acquisition field work: a folded cadastral land parcel map, a surveyor's
tripod head with a total station, a concrete boundary marker post lying on its side, a document
folder with a burnt orange band, and a small stack of title deed papers
```

### Hermes — ผู้ช่วยทำงาน 24/7

```
A still-life of an always-on operations desk: a compact server node with soft indicator lights, a
headset resting beside it, a small wall clock, a stack of routed job tickets on a spike, and a
burnt orange cable coiled neatly
```

## ห้า — ทำอย่างไรกับไฟล์ที่ได้

1. เลือกภาพที่พื้นหลังสะอาดที่สุด แล้ว upscale ให้ได้อย่างน้อย 1024 จุด
2. ครอบเป็นจัตุรัส และเก็บเป็น PNG ขนาด **256 จุด** ตามที่ `src/lib/visual-assets.ts` อธิบายไว้ว่า
   ไอคอนถูกวาดที่ 65 ถึง 74 จุด จึงพอสำหรับจอความละเอียดสามเท่า และไม่ต้องเก็บไฟล์ 4 MB เหมือนรอบแรก
3. ตั้งชื่อไฟล์ตามแบบเดิม `naichangmoo-<slug>-badge.png` แล้ววางที่ `public/brand/`
4. เพิ่มคีย์ใน `visualAssets` แล้วเปลี่ยน `iconSrc` ของแอปนั้นใน `src/lib/platform.ts`
   จาก `visualAssetUrl("brand_mark")` เป็นคีย์ใหม่ พร้อมแก้ `iconAlt` ให้เลิกบอกว่าเป็นของชั่วคราว
5. ลบคำว่า PLACEHOLDER ในคอมเมนต์ของแอปนั้นออก เพราะมันไม่ใช่ของยืมอีกต่อไป
