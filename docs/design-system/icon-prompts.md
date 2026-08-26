# Prompt สำหรับสร้าง graphic icon

ไอคอนทุกตัวบนแพลตฟอร์มมาจาก GPT 5.6 เท่านั้น **ห้ามใช้ emoji ในทุกกรณี** เอกสารนี้คือคำสั่งที่ใช้สร้าง
เพื่อให้ของที่ได้กลับมาเสียบเข้าระบบได้ทันทีโดยไม่ต้องออกแบบซ้ำ

มีสองเส้นทาง ใช้ผิดเส้นทางแล้วของที่ได้จะใช้ไม่ได้เลย

| ต้องการอะไร | เส้นทาง | ผลลัพธ์ | ปลายทาง |
|---|---|---|---|
| ไอคอนใน UI | สั่งให้ GPT **เขียนโค้ด SVG** | path data | `src/components/icons/platform-icons.tsx` |
| ตราประจำแอป | สั่งให้ GPT **สร้างภาพ** | PNG | `public/brand/` |

ไอคอน UI ต้องเป็น SVG เพราะมันรับสีจากธีมผ่าน `currentColor` ถ้าสั่งเป็นภาพจะได้ PNG ที่สีตายตัว
เปลี่ยนตามบริบทไม่ได้และไม่คมทุกขนาด

---

## จานสีของแพลตฟอร์ม

ค่าจริงจาก `src/app/globals.css` **ห้ามใช้สีนอกรายการนี้เด็ดขาด**

| ตัวแปร | ค่า | ใช้ทำอะไร |
|---|---|---|
| `--ink` | `#073047` | สีหลักของเส้นและตัวอักษร |
| `--ink-deep` | `#051f2f` | เงาเข้มสุด |
| `--teal` | `#0d8282` | สีนำของแบรนด์ |
| `--orange` | `#f47721` | สีเน้น ใช้น้อย จุดเดียวต่อภาพ |
| `--canvas` | `#f4f7f7` | พื้นหลังเว็บ |
| `--paper` | `#ffffff` | พื้นผิวการ์ด |
| `--mist` | `#d8e4e4` | พื้นรอง |
| `--line` | `#c9d8d9` | เส้นบาง |
| `--success` | `#32765d` | สถานะผ่าน |

สีประจำแอป ใช้เป็นสีนำของตราแอปนั้น

| แอป | สี |
|---|---|
| ESTIMETR | `#0d8282` |
| กำแพงกันดิน | `#e56e20` |
| ป้ายจราจร | `#2d7994` |
| กรรมสิทธิ์ที่ดิน | `#315e78` |

---

## เส้นทาง A — ไอคอน UI

วางบล็อกนี้ก่อน แล้วต่อท้ายด้วยบรรทัด Subject จากตารางถัดไป

```
Write SVG markup for one line-art icon. Output ONLY the inner elements
(<path>, <rect>, <circle>, <line>) — no <svg> wrapper, no <style>, no id,
no fill, no colour attributes, no comments.

Hard constraints:
- Drawn on a 48 x 48 grid, viewBox "0 0 48 48"
- All artwork inside x/y 5..43. Nothing touches the edge
- Stroke only, never filled. Do NOT write stroke, stroke-width or colour
  attributes: the parent <svg> already supplies stroke="currentColor",
  stroke-width="2.4", stroke-linecap="round", stroke-linejoin="round".
  The icon is monochrome and inherits whichever theme colour the page gives it
- Must stay readable at 20px: at most 6 elements, nothing finer than 3 units apart
- Drawn like a drafting symbol on an engineering drawing: orthographic,
  flat, geometric, straight lines and true arcs. No perspective, no shading,
  no texture, no rounded-cartoon shapes, no mascots
- No text, letters, numbers or lettering of any kind inside the artwork

Context: this icon belongs to a Thai civil-engineering platform used by
engineers to produce official government construction cost estimates.
The tone is instrument-like and exact, never playful.

Subject: <วางบรรทัด Subject ที่นี่>
```

### บรรทัด Subject รายไอคอน

ตรงกับ export ใน `src/components/icons/platform-icons.tsx`

| Export | หมายถึงงานอะไร | Subject |
|---|---|---|
| `EstimateIcon` | ESTIMETR — ถอดปริมาณแล้วแปลงเป็นราคากลาง | `a bill-of-quantities sheet with ruled line items, a scale ruler laid across it` |
| `WallIcon` | กำแพงกันดิน — หน้าตัดโครงสร้างกันดิน | `the cross-section of a cantilever retaining wall with its footing and the retained earth line behind it` |
| `SignIcon` | ป้ายจราจร — งานป้ายตามมาตรฐานทางหลวง | `a road sign panel on a single post, seen straight on, with a chevron marking inside the panel` |
| `LandIcon` | กรรมสิทธิ์ที่ดินและเวนคืน | `a cadastral land parcel boundary with a corner survey marker and a centre-line of a road crossing it` |
| `HermesIcon` | ผู้ช่วย AI ที่ทบทวนงาน ไม่ใช่ทำแทน | `a magnifier held over a stack of drawing sheets, one sheet flagged for review` |
| `QuoteIcon` | คำขอใบเสนอราคาสำหรับองค์กร | `a formal document with a stamped seal at its lower corner and ruled cost lines above` |
| `ShieldIcon` | Approval Gate — จุดที่คนต้องอนุมัติก่อนมีผล | `a shield with a checkmark, drawn as a certification stamp rather than a security badge` |
| `NaiChangMooMark` | ตราแบรนด์ | `a simplified building elevation under a surveyor level line, forming a compact mark` |

### บรรทัด Subject สำหรับสามช่องที่ยังเป็นตัวอักษร

`R` `S` `Q` ใน `src/components/estimeter/estimation-workspace.tsx` รอไอคอนแทนอยู่

| แทนตัวไหน | หมายถึงงานอะไร | Subject |
|---|---|---|
| `R` — Drawing revision | ยืนยันว่าแบบกับ specification เป็นชุดเดียวกัน | `two drawing sheets overlaid slightly offset, with a revision triangle marker on the top sheet` |
| `S` — Scale reference | ตั้งสเกลจากระยะจริงที่ตรวจสอบได้ ห้ามเดา | `a dimension line with arrowheads at both ends spanning between two witness lines, a scale bar beneath it` |
| `Q` — Open issues | บันทึกข้อขัดแย้งก่อนถอดปริมาณ | `a clouded revision balloon on a drawing fragment with a leader line pointing into it` |

### บรรทัด Subject สำหรับอักขระที่ยังทำหน้าที่ไอคอนอยู่

ยังไม่มีไอคอนสี่ตัวนี้ ทำให้โค้ดต้องใช้ตัวอักษรแทนไปก่อน ทุกจุดมีรูปแบบเดียวกันคือ
`<span aria-hidden="true">อักขระ</span>` ซึ่งเป็นเครื่องหมายว่าอักขระนั้นกำลังทำงานเป็นไอคอน

| ต้องมี | ตอนนี้ใช้อะไรแทน | อยู่ที่ไหน | Subject |
|---|---|---|---|
| `CheckIcon` | `U+2713` | `src/app/pricing/page.tsx`, `src/components/estimeter/estimation-workspace.tsx` | `a single checkmark drawn as a surveyor tick, two straight strokes meeting at a sharp angle` |
| `PendingIcon` | `U+25CB` | `src/components/estimeter/estimation-workspace.tsx` | `an empty circle with a single tick mark on its upper edge, reading as a step not yet reached` |
| `NotIncludedIcon` | `U+2014` | `src/app/pricing/page.tsx` | `a short horizontal bar centred in the frame, drawn with the same weight as a dimension line, meaning not applicable` |
| `ArrowRightIcon` | `U+2192` | `src/components/platform/account-menu.tsx` | `a plain rightwards arrow, one shaft and two straight barbs, drawn like a leader line arrowhead on a drawing` |

ลูกศรที่อยู่กลางประโยค เช่น `form → list → BOQ` ใน `src/lib/platform.ts` หรือ `← กลับ` ใน
`src/components/platform/app-shell.tsx` **ไม่ต้องเปลี่ยน** เพราะมันเป็นเครื่องหมายวรรคตอนในข้อความ
ไม่ได้ทำหน้าที่ไอคอน กฎนี้ใช้กับสัญลักษณ์ที่ยืนเดี่ยวเท่านั้น

---

## เส้นทาง B — ตราประจำแอป

```
A square app badge illustration. Exactly 512 x 512 pixels, 1:1, PNG.

Subject: <ใส่สิ่งที่ต้องการ>

Style: clean isometric technical illustration for a Thai civil-engineering
software platform. Flat vector rendering with restrained depth. Serious and
instrument-like — this is professional engineering tooling used to produce
official government cost estimates, not a consumer app. No photorealism,
no glossy highlights, no drop shadow outside the object, no busy background
pattern.

Colour — use ONLY these values and nothing else, no other hue at all:
  lead colour  <ใส่สีประจำแอปจากตารางด้านบน>
  deep navy    #073047
  darker navy  #051f2f
  off-white    #f4f7f7
  white        #ffffff
  pale mist    #d8e4e4
  hairline     #c9d8d9
  orange       #f47721   — accent only, one small area at most, may be omitted

Composition: the subject fills the frame edge to edge. The badge is displayed
cropped inside a rounded square, so leave no intentional margin and keep
nothing important within the outer 8% on any side.

Absolutely no text, no letters, no numbers, no logo, no watermark,
no emoji, no human faces, no brand names.
```

**ขนาดสำคัญ** ตราชุดแรกถูกส่งมาที่ 1920px หนักไฟล์ละ 4 MB ทั้งที่แสดงจริงที่ 98px ต้องมาย่อทีหลัง
prompt นี้จึงล็อกไว้ที่ 512px ถ้าได้ใหญ่กว่านั้นให้ย่อก่อนเข้า repo ทั้งชุดควรอยู่ในหลักร้อย KB

---

## ตรวจก่อนรับเข้า repo

1. ไม่มีตัวอักษรหรือตัวเลขอยู่ในภาพ
2. ไม่มีสีนอกจานสีด้านบน
3. เส้นทาง A ต้องไม่มี `fill`, `stroke`, `stroke-width` หรือค่าสีติดมากับ path
4. เส้นทาง A ย่อดูที่ 20px แล้วยังอ่านออก
5. เส้นทาง B ไม่เกิน 512px และไฟล์ไม่เกินหลักร้อย KB
6. ไม่มี emoji ในทุกที่ รวมถึงชื่อไฟล์

---

## เส้นทาง C — ภาพประกอบหมวดวัสดุ ๒๑ ใบ สำหรับการ์ดหมวดของ PRICEMETR

การ์ดหมวดในแอปราคาวัสดุเป็นแนวตั้ง แถบภาพกินพื้นที่ราว 60% ของการ์ด ภาพจึงเป็นตัวหลัก
ไม่ใช่ไอคอนเล็กมุมบน วัดจากของจริงบนจอ 1440px การ์ดกว้าง 219px แถบภาพสูง 178px
ภาพถูกครอบแบบ cover ขอบทั้งสี่ด้านจึงถูกตัดได้ ห้ามวางของสำคัญไว้ริมภาพ

**มติของเจ้าของงาน 2026-08-26:** ชุดนี้เป็นภาพถ่ายสมจริง สร้างที่ Midjourney ทีละหมวด
ไม่ใช่ภาพเวกเตอร์แบน ๆ แบบตราประจำแอป เพราะการ์ดหมวดต้องบอกให้รู้ทันทีว่าเป็นวัสดุอะไรจริง ๆ

**ปลายทาง** `public/brand/categories/<รหัสสองหลัก>.png` เช่น `01.png` `16.png`
หน้าเว็บอ่านโฟลเดอร์นี้เอง วางไฟล์แล้วใช้ได้ทันที หมวดที่ยังไม่มีไฟล์จะใช้สัญลักษณ์เส้นใน
`src/components/icons/material-category-icons.tsx` แทนไปก่อน โดยไม่มีรูปแตกและไม่ต้องแก้โค้ด

### สูตรของ prompt

ต่อสามส่วนนี้เข้าด้วยกัน แล้ววางลง Midjourney

```
<Subject ของหมวดนั้น>, <บล็อกสไตล์> <บล็อกพารามิเตอร์>
```

**บล็อกสไตล์** เหมือนกันทุกหมวด ห้ามแก้ เพราะยี่สิบเอ็ดใบต้องดูเป็นชุดเดียวกัน
ถ้าแต่ละใบแสงคนละทิศหรือพื้นหลังคนละสี หน้าจอจะกลายเป็นคอลลาจ ไม่ใช่แผงหมวด

```
studio product photograph on a seamless pale grey-green background, soft diffused
daylight from the upper left, one soft contact shadow beneath the objects, slight
three-quarter elevated camera angle, sharp focus throughout, muted teal and deep
navy colour grading, calm industrial catalogue photography, objects centred and
filling about 75 percent of the frame with clear empty space on all four sides
```

**บล็อกพารามิเตอร์** เหมือนกันทุกหมวดเช่นกัน

```
--ar 5:4 --style raw --v 7 --no text, letters, numbers, labels, price tag, logo, watermark, brand name, people, hands, clutter, background scene, sky, grass
```

> **ทำไมต้อง `--no text, letters, numbers`** เพราะภาพสินค้าก่อสร้างจริงมักมีตัวหนังสือบนถุงปูน
> บนป้ายมัดเหล็ก และบนกล่อง ถ้าปล่อยไว้ Midjourney จะเขียนตัวหนังสือมั่ว ๆ ที่อ่านไม่ออก
> ลงบนของ ซึ่งบนการ์ดจะเห็นชัดมากและดูเหมือนของปลอมทันที

### บรรทัด Subject รายหมวด

รหัสตรงกับ `headCategory` ของ สนค. และตรงกับชื่อไฟล์ที่ต้องวาง

| ไฟล์ | หมวด | Subject |
|---|---|---|
| `01.png` | วัสดุเทหล่อกับที่ | `fresh grey concrete being poured into a timber formwork box, the surface screeded flat and still wet` |
| `02.png` | วัสดุก่อ | `a short wall of grey concrete masonry blocks laid three courses high in running bond with visible mortar beds` |
| `03.png` | ชิ้นส่วนโครงสร้างสำเร็จรูป | `a stack of three precast prestressed concrete floor planks with steel lifting loops on the top plank` |
| `04.png` | วัสดุชิ้นส่วนหน้าตัดรูปต่างๆ | `a steel H-beam standing end-on beside a tied bundle of deformed reinforcing bars` |
| `05.png` | วัสดุท่อ | `three unbranded plastic and steel pipes of different diameters lying together with open ends toward the camera and one elbow fitting beside them` |
| `06.png` | วัสดุลวดตาข่าย มุ้งลวด ลวดหนาม | `a partly unrolled roll of welded steel wire mesh with the flat part showing the square grid, a small coil of tie wire beside it` |
| `07.png` | วัสดุฉนวน | `a roll of glass wool insulation blanket partly unrolled, the cut edge showing its fibrous thickness` |
| `08.png` | วัสดุแผ่นซ้อนทับ | `four corrugated fibre cement roof sheets overlapping in a shallow stepped run` |
| `09.png` | วัสดุแผ่นแข็ง | `three flat rigid fibre cement and plywood boards leaning together, the front one turned to show its cut edge` |
| `10.png` | วัสดุตกแต่งผิว | `nine unglazed square floor tiles laid in a grid with one tile lifted and tilted to show its underside` |
| `11.png` | วัสดุไม้ | `a stack of sawn timber planks with the end grain facing the camera and one plank set slightly out of line` |
| `12.png` | วัสดุฉาบผิว | `a paint roller resting across a rectangular paint tray with one steel plastering trowel laid beside it` |
| `13.png` | วัสดุขัดผิว | `a stack of abrasive sandpaper sheets with the top sheet curled at one corner showing its grit surface` |
| `14.png` | วัสดุชิ้นส่วนสำเร็จรูป | `a prefabricated door leaf standing upright in its frame slightly ajar, a rolled steel shutter panel behind it` |
| `15.png` | วัสดุผลิตภัณฑ์ | `three stacked plain unprinted cement sacks with folded sealed tops, the top sack leaning slightly` |
| `16.png` | วัสดุผสมคอนกรีต | `two conical piles side by side, one of coarse river sand and one of crushed stone aggregate, a few loose stones at the base` |
| `17.png` | วัสดุถม/รองพื้น | `three separate mounded piles of earth fill standing side by side, one of pale fill sand, one of dark brown soil, and one of reddish laterite gravel, with a small hand plate compactor standing beside them` |
| `18.png` | วัสดุและอุปกรณ์งานประปา | `a brass gate valve with a handwheel joined between two short pipe sections, a water meter body beside it` |
| `19.png` | วัสดุและอุปกรณ์งานสุขาภิบาล | `a plastic P-trap pipe assembly with a cleanout plug and a round cast iron drainage grating lying flat beside it` |
| `20.png` | วัสดุและอุปกรณ์งานไฟฟ้า | `a coil of electrical cable beside a wall socket outlet and a short length of electrical conduit with a coupling` |
| `21.png` | เครื่องสุขภัณฑ์ | `a white ceramic washbasin with a chrome mixer tap seen from a raised angle with a squat closet pan behind it` |

### ตรวจก่อนรับเข้า repo

1. ไม่มีตัวอักษร ตัวเลข ป้ายราคา โลโก้ หรือยี่ห้อโผล่ในภาพ แม้เป็นตัวเบลอ ๆ
2. พื้นหลังเป็นพื้นเรียบโทนเดียวกันทั้งยี่สิบเอ็ดใบ ไม่มีฉากหลัง ไม่มีท้องฟ้า ไม่มีพื้นหญ้า
3. ทิศแสงเหมือนกันทุกใบ คือมาจากบนซ้าย
4. ของหลักอยู่กลางภาพ ไม่มีของสำคัญอยู่ในขอบ 10% รอบด้าน เพราะการ์ดจะครอบขอบทิ้ง
5. ย่อดูที่ความกว้าง 219px แล้วยังบอกได้ว่าเป็นวัสดุหมวดอะไร
6. บันทึกเป็น PNG กว้างไม่เกิน 800px และไฟล์ไม่เกินหลักร้อย KB ต่อใบ
7. ตั้งชื่อไฟล์เป็นรหัสสองหลักตามตาราง วางที่ `public/brand/categories/`

---

## ตราประจำแอป PRICEMETR

เพิ่มในตารางสีประจำแอปด้านบน — ใช้สีนำของแบรนด์ ไม่ตั้งสีใหม่ เพราะแอปนี้อยู่ในธีมเดียวกับทั้งเว็บ

| แอป | สี |
|---|---|
| PRICEMETR ราคาวัสดุและค่าแรง | `#0d8282` |

ตราประจำแอปยังใช้ **เส้นทาง B** เหมือนแอปอื่น คือภาพเวกเตอร์ isometric ล็อกจานสี ไม่ใช่ภาพถ่าย
เพราะมันต้องยืนเรียงกับตราของ ESTIMETR และแอปอื่นบนหน้าแรก ใส่ Subject นี้

```
Subject: an isometric price ledger board standing upright with a rising step
line plotted across it, flanked at its base by a small group of construction
materials — one cement sack, a short bundle of reinforcing bars, and a stack
of two masonry blocks
```

ปลายทาง `public/brand/naichangmoo-pricemetr-badge.png` แล้วเพิ่มคีย์ `pricemetr`
ใน `src/lib/visual-assets.ts`
