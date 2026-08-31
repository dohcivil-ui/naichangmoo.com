# ไอคอนแอป — ที่มาของภาพและวิธีเลือก

ไฟล์นี้เก็บสองอย่าง คือคำค้นที่ใช้ซื้อภาพจากคลังภาพ ซึ่งเป็นทางที่เลือกแล้ว
และ prompt ของ Midjourney ที่เก็บไว้เผื่อกลับไปใช้ ทั้งคู่มีไว้เพื่อให้ไอคอนทั้งชุดหน้าตาเป็นชุดเดียวกัน

## ศูนย์ — สิ่งที่เปลี่ยนเมื่อ 2026-08-30

**เลิกใช้ Midjourney แล้วซื้อภาพจาก Shutterstock แทน ทั้งเจ็ดตัว** เจ้าของงานลอง render จริง
แล้วภาพที่ได้ไม่สมจริงพอ จึงตัดสินว่าซื้อของที่ถ่ายไว้แล้วคุ้มกว่า และเมื่อซื้อ ก็ซื้อทั้งชุด
ไม่ใช่ซื้อเฉพาะสามตัวที่ขาด เพราะไอคอนสี่ตัวเดิมเป็นภาพคนละชนิดกับภาพถ่าย (ดูหมวดหนึ่ง)
การเติมสามตัวที่เป็นภาพถ่ายเข้าไปในชุดของภาพเขียน จะทำให้หน้าแอปทั้งหมดมีไอคอนสองแบบปนกัน

**คำเตือนเรื่องเบราว์เซอร์** Shutterstock ปิดกั้นเบราว์เซอร์ที่ถูกสั่งงานด้วยเครื่องมือควบคุม
ขึ้นข้อความว่า Access is temporarily restricted จึงค้นแทนจากเซสชันของ AI ไม่ได้
ต้องเปิดในหน้าต่างปกติของเจ้าของงานเอง

**เครื่องมือที่เลือก คือตัวสร้างภาพของ Shutterstock ไม่ใช่ Nano Banana** เคาะเมื่อ 2026-08-30
หลังลองทั้งสองตัวในวันเดียวกัน Shutterstock ให้ภาพที่เจ้าของงานรับว่าสมจริงตั้งแต่รอบแรก
ส่วน Nano Banana ไม่ผ่านสองรอบติดกัน รอบแรกได้ภาพที่อ่านออกว่าเป็น render
รอบสองเติมชื่อกล้อง เลนส์ ฝุ่น สนิม และเกรนเข้าไปแล้วยังไม่ผ่าน สองรอบที่ล้มด้วยวิธีเดียวกัน
คือลายมือของเครื่องมือ ไม่ใช่เรื่องคำสั่ง จึงเลิกดันต่อ

ข้อต่างที่ต้องจำ **Shutterstock รู้จัก `--ar 1:1` แต่ Nano Banana ไม่รู้จัก** ตัวหลังต้องเขียน
สัดส่วนเป็นคำ ถ้าใช้ผิดตัวจะได้ภาพ 16:9 อย่างที่เกิดขึ้นจริงมาแล้ว

## หนึ่ง — ตระกูลของภาพที่มีอยู่แล้ว

ไอคอนเดิมสี่ตัว (ESTIMETR, กำแพงกันดิน, ป้ายจราจร, จัดกรรมสิทธิ์ที่ดิน) **ไม่ใช่ภาพถ่าย**
แต่เป็นภาพเขียนเชิงเทคนิค ตรวจจากไฟล์จริงใน `public/brand/` เมื่อ 2026-08-30 ได้ลักษณะร่วมคือ

- สี่เหลี่ยมจัตุรัสมุมมน กรอบหนาสีกรมท่าเข้ม มีขอบในบางสีอ่อนอีกชั้น พื้นครีมนวล
- วัตถุเขียนด้วยเส้นขอบบางสีกรมท่าคุมทุกชิ้น ผิวเป็นเทาและขาวไล่เงาอ่อน
- พื้นหลังมีเส้นบอกระยะสีฟ้าจาง เส้นประ และเส้นชี้แบบแบบก่อสร้าง
- มุมมองแบบ Axonometric และหลายตัวตัดเฉือนให้เห็นข้างใน เช่น ชั้นดินและเหล็กเสริมของกำแพงกันดิน
- มีสีส้มเป็นจุดเน้นหนึ่งจุดเสมอ เช่น ไม้บรรทัด หมุดสำรวจ ขอบป้าย หรือจุดบอกระยะ
- ไม่มีตัวหนังสือที่อ่านออก ไม่มีคน ไม่มีโลโก้

**เอกสารรุ่นก่อนหน้าเขียนหมวดนี้ผิด** โดยบอกว่าเป็น photorealistic product photography
ซึ่งเป็นคนละชนิดกับของจริงบนดิสก์ prompt ที่ต่อท้ายด้วยคำนั้นจึงให้ภาพที่ไม่เข้าพวกตั้งแต่ต้น
นี่คือสาเหตุที่ผลจาก Midjourney ดูไม่เข้าชุด ไม่ใช่เพราะเครื่องมือ

ของที่ยังขาดและต้องหาคือ **PRICEMETR · ESCALATION K · ผู้ช่วยสร้างแผนงาน**
ทั้งสามตัวตอนนี้ยืมตราของแพลตฟอร์มมาใช้ชั่วคราว ซึ่งอ่านได้ว่าเป็นความผิดพลาด ไม่ใช่ของชั่วคราว

## สอง — คำค้นที่ Shutterstock และเกณฑ์คัดภาพ

ค้นเป็นภาษาอังกฤษ เพราะคลังภาพจัดดัชนีด้วยคำอังกฤษ คำไทยให้ผลน้อยกว่ามาก
คำแรกของแต่ละแอปคือคำที่ควรลองก่อน

| แอป | คำค้น |
|---|---|
| PRICEMETR | `construction materials isolated white background` · `cement bag steel rebar sand pile studio` · `building material samples price list magnifying glass` |
| ESCALATION K | `construction contract document calculator blueprint` · `contract folder calculator rising graph desk` · `cost index chart printout calculator` |
| ผู้ช่วยสร้างแผนงาน | `construction schedule gantt chart printed blueprint` · `project planning desk calendar pencil drawings` |
| ESTIMETR | `quantity takeoff sheet clipboard blueprint calculator` · `building cost estimate documents scale ruler` |
| กำแพงกันดิน | `retaining wall concrete section model` · `cantilever retaining wall reinforcement` |
| TRAFFIC SIGN | `traffic sign blank aluminium post reflective sheeting` · `road sign components mounting brackets` |
| LAND ACQUISITION | `cadastral land parcel map surveying total station` · `land title deed documents boundary marker` |
| Hermes (ตรา ไม่ใช่แอป) | `server node indicator lights desk headset` · `operations desk always on service` |

**เกณฑ์คัด เรียงตามความสำคัญ**

1. **ทั้งเจ็ดตัวต้องอยู่ในโทนแสงเดียวกัน** ถ้าหาได้จากช่างภาพรายเดียวกันหรือชุดเดียวกันยิ่งดี
   ข้อนี้สำคัญกว่าความสวยของภาพเดี่ยว เพราะไอคอนขึ้นเรียงกันบนหน้าเดียว
2. เป็นภาพถ่าย ไม่เอาเวกเตอร์ ไม่เอา 3D การ์ตูนมันวาว (กรอง Image type เป็น Photos)
3. พื้นหลังสว่างสีเดียว ขาวหรือครีม ครอบเป็นจัตุรัสได้โดยของสำคัญไม่ถูกตัด
4. วัตถุกองรวมกันมองจากมุมเอียงค่อนไปทางสูง ไม่ใช่ภาพระยะใกล้ชิ้นเดียว
5. ไม่มีคน ไม่มีตัวหนังสือที่อ่านออก ไม่มีโลโก้ยี่ห้อในภาพ
6. ด้านสั้นอย่างน้อย 1024 จุด และซื้อแบบ Standard license ก็พอสำหรับใช้บนเว็บ

ถ้าภาพที่ได้ไม่มีสีส้มในตัว ให้เติมทีหลังตอนแต่งภาพ เช่น ปรับสีของวัตถุชิ้นเดียวให้เป็น `#f47721`
เพื่อรักษาจุดเน้นหนึ่งจุดที่เป็นลักษณะร่วมของทั้งชุด

## สาม — ส่วนท้ายที่ทุก prompt ใช้เหมือนกัน

เนื้อของภาพอยู่ในหมวดสี่ ส่วนท้ายอยู่ในหมวดนี้ ต่อท้ายทุกครั้งเพื่อให้ทั้งชุดเป็นตระกูลเดียวกัน
ส่วนท้ายมีสองแบบเพราะเครื่องมือคนละตัวรับคำสั่งคนละอย่าง

**สำหรับตัวสร้างภาพของ Shutterstock** ซึ่งเป็นทางที่ใช้อยู่

```
photographed with a full-frame camera and an 85mm macro lens at f/8, arranged on a worn plywood
workbench in soft morning daylight falling from the upper left, against a plain dark charcoal
wall well out of focus behind it, gentle contact shadows, true photographic depth of field,
authentic surface detail such as paper fibre, mill scale and light surface rust on the steel,
individual dust grains, small scuffs and creases, subtle sensor grain and a slight vignette,
colour graded but not retouched, three-quarter view from slightly above, one burnt orange accent
object, any printed sheet carries small realistic English text printed in deep navy and teal ink,
generous empty margin on all four sides with every object kept well away from the corners, this
is a real photograph and not a 3D render, no CGI look, no clay render look, no floating title
text, no watermark, no signage, no people, no hands, no brand logos --ar 1:1
```

**ทำไมต้องตรึงพื้นหลัง** รอบแรกส่วนท้ายเขียนแค่ว่าอยู่ริมหน้าต่าง สี่รูปที่ได้จึงมีพื้นหลัง
คนละแบบหมด รูปหนึ่งเป็นหน้าต่างสว่างจ้า รูปหนึ่งเป็นไซต์งานเบลอ รูปหนึ่งเป็นผนังมืด
ความสว่างและโทนสีห่างกันจนวางเรียงกันแล้วไม่เป็นชุด ผนังชาร์โคลมืดมาจากรูปที่ดีที่สุดในรอบนั้น
จึงยกมาเป็นมาตรฐานให้อีกเจ็ดตัวตาม

**ทำไมส่วนท้ายเดิมได้ภาพที่ดูเป็น render** ของเดิมเขียนว่า studio product photograph กับ
soft diffused light ซึ่งเป็นคำที่ตรงกับกองภาพ render พอ ๆ กับกองภาพถ่าย และไม่ได้สั่งตำหนิใด ๆ
ภาพจึงเนียนเกินกว่าของจริง หกอย่างที่เพิ่มเข้ามาแล้วได้ผลคือ ชื่อกล้องและเลนส์ · ตำหนิบนผิววัสดุ ·
แสงหน้าต่างแทนแสงสตูดิโอ · ระยะชัดลึกแบบกล้องจริง · เกรนกับขอบมืด · และการปฏิเสธความเป็น CG ตรง ๆ

**สิ่งที่แลกไป** ระยะชัดลึกกับเกรนเห็นผลชัดที่หน้ารายละเอียดแอปซึ่งวาดที่ 202 จุด
ส่วนบนการ์ดแอปที่ 104 จุด รายละเอียดพวกนี้เกือบหายหมด อย่าดันจนฉากหลังเบลอมาก
เพราะที่ขนาดไอคอนจะเหลือแค่ก้อนเลอะ

**ต้องเขียนสัดส่วนเป็นคำ** Nano Banana ไม่รู้จัก flag แบบ `--ar 1:1` ของ Midjourney
และถ้าไม่บอกอะไรเลยมันเลือกเอง ซึ่งเมื่อ 2026-08-30 ได้ 16:9 ออกมา ต้องพิมพ์ว่า
`square 1:1 aspect ratio` ไว้ในประโยค และตั้งสัดส่วนในหน้าจอของแอปให้เป็นจัตุรัสด้วยถ้ามีให้ตั้ง

**เรื่องขอบ** การ์ดแอปครอบภาพด้วยกรอบมุมมนรัศมี 25 จุด ของที่วางชิดมุมจะหายไปกับมุมที่ถูกมน
prompt จึงต้องสั่งเว้นขอบทุกครั้ง ไม่ใช่หวังว่ามันจะเว้นเอง

**เรื่องตัวหนังสือ เอกสารในภาพใช้ภาษาอังกฤษ** เคาะเมื่อ 2026-08-30 หลังเห็นว่าตัวสร้างภาพ
เขียนอักษรไทยไม่เป็น ตัวอย่างของ Shutterstock สั่งสโลแกนว่า โครงสร้างไม่ใช่อะไรก็ได้
แล้วได้ กูวมผิสคีจระคืนเซัน ออกมา ส่วนใบราคาของ PRICEMETR รอบแรกได้คำว่า ปูนซีเมนต์/ถุง
ซ้ำสามบรรทัดติดกัน ภาษาอังกฤษออกมาอ่านได้จริงและไม่มั่ว จึงใช้แทน
ที่ขนาดไอคอนไม่มีใครอ่านออกอยู่แล้ว ข้อนี้จึงไม่ขัดกับการที่แอปพูดภาษาไทยกับลูกค้า

**เรื่องพื้นหลัง วางบนโต๊ะไม้อัดริมหน้าต่าง ไม่ใช่พื้นครีมเรียบ** เคาะวันเดียวกัน
เหตุผลคือการจัดของบนพื้นเรียบไร้ที่มาเป็นภาพชนิดที่ AI ทำออกมาเหมือน render มากที่สุด
เพราะภาพแบบนั้นในโลกจริงจำนวนมากก็เป็น render จริง ๆ คือภาพ mockup สินค้า
ของที่วางบนโต๊ะจริงมีแสงธรรมชาติและมีที่มา จึงอ่านเป็นภาพถ่ายได้ทันที
**สิ่งที่แลกไป** พื้นจะไม่ครีมเรียบเหมือนไอคอนสี่ตัวเดิม แต่เดิมก็ตัดสินไว้แล้วว่าทำใหม่ทั้งชุด
จึงไม่มีของเก่าให้เข้าชุดด้วยอยู่แล้ว

**สำหรับ Nano Banana** ซึ่งเป็นตัวสร้างภาพของ Google ต่างจากสองตัวข้างบนตรงที่**แนบภาพอ้างอิงได้**
ให้แนบไอคอนเดิมใน `public/brand/` แล้วเขียนเป็นภาษาพูด ไม่ต้องใส่ flag

```
Here are four existing app icons from the same product family. Study their shared style: a rounded
square frame with a deep navy border on a soft cream ground, objects drawn with thin navy outlines
and soft grey shading, faint blue dimension lines in the background, one burnt orange accent, an
axonometric view from slightly above, no text and no people.

Now create one new icon in exactly this style, matching the line weight, colour and lighting of the
four references so it can sit beside them without looking out of place. Square 1:1. The subject is:
<เนื้อของภาพจากหมวดสี่>
```

ถ้าจะให้ออกมาเป็นภาพถ่ายสมจริงแทนภาพเขียน ให้เปลี่ยนคำบรรยายตระกูลข้างบนเป็นแบบภาพถ่าย
แต่ต้องทำใหม่ทั้งชุด ไม่ใช่เฉพาะตัวใหม่ ดูเหตุผลในหมวดศูนย์

**สำหรับ Midjourney** เก็บไว้เผื่อกลับไปใช้ ต่างกันตรงที่รับ flag ได้มากกว่า

```
isometric three-quarter view from slightly above, arranged as a small still-life on a soft warm
cream background, inside a rounded-square app icon frame with a thin deep navy blue outline,
teal and burnt orange accents, soft diffused studio lighting from the upper left, gentle contact
shadows, physically based materials, sharp focus throughout, photorealistic product photography,
clean and uncluttered --ar 1:1 --style raw --v 7 --no text, lettering, watermark, signature,
people, hands, cartoon, flat vector
```

**สีที่ต้องคุมให้ตรงกับเว็บ** กรมท่าเข้ม `#073047` · เขียวหัวเป็ด `#0d8282` · ส้ม `#f47721` ·
พื้นครีม `#f4f7f7` ถึงขาวนวล — ถ้าสีเพี้ยน ให้ระบุเพิ่มว่า
`deep navy #073047, teal #0d8282, burnt orange #f47721`

**ห้ามขอตัวหนังสือไทยในภาพเด็ดขาด** ตัวสร้างภาพเขียนอักษรไทยไม่เป็น ตัวอย่างที่เจ้าของงานลอง
เมื่อ 2026-08-30 ได้คำว่า กูวมผิสคีจระคืนเซัน ซึ่งไม่ใช่คำในภาษาใด ข้อนี้ตรงกับกติกาของไอคอนอยู่แล้ว
ที่ห้ามมีตัวหนังสือ แต่ต้องเขียนไว้เพราะมันพังแบบที่คนไม่คุ้นอาจไม่ทันสังเกต

**Generate ทั้งชุดติดกันในรอบเดียว ด้วยเครื่องมือตัวเดียวกัน** อย่าทำทีละตัวห่างกันหลายวัน
หรือสลับเครื่องมือกลางคัน แสงกับโทนของแต่ละรอบและแต่ละเครื่องมือไม่เท่ากัน

### คำสั่งปฏิเสธไม่พอ ต้องบรรยายว่าของหน้าตาอย่างไร

บทเรียนจากรอบแรกของ PRICEMETR เมื่อ 2026-08-30 ส่วนท้ายเขียน `no brand logos` และ `no people`
ไว้ครบ แต่ผลที่ได้สี่รูป **มีโลโก้ยี่ห้อจริงสามรูป** คือถุงปูน SCG ตราช้างพร้อมเลข มอก. สองรูป
และ TPI Polene อีกหนึ่งรูป **และมีคนสองรูป** รูปหนึ่งเป็นคนยืนสองคนที่มุมซ้ายบน

เครื่องมือให้น้ำหนักกับสิ่งที่บรรยายมากกว่าสิ่งที่ห้าม ทางแก้คือย้ายไปเขียนในส่วนหัวว่า
**ของชิ้นนั้นหน้าตาอย่างไร** เช่น `a plain unbranded kraft paper cement sack with a blank
surface and no printing, logo or lettering on it at all` และปิดท้ายส่วนหัวด้วย
`The scene is completely empty of any person, including far away and out of focus in the background.`

**ใช้หลักนี้กับทุกชิ้นที่ในโลกจริงมักมียี่ห้อพิมพ์อยู่** ถุงปูน เครื่องคิดเลข หมวกนิรภัย
แฟ้มสัญญา กล้อง total station และเทปวัดระยะ · เหตุผลไม่ใช่ความสวย แต่เป็นเครื่องหมายการค้า
ไอคอนที่มีตราของผู้ผลิตรายหนึ่งอ่านได้ว่าผู้ผลิตรายนั้นร่วมมือกับเรา และขัด Design rules
ใน `AGENTS.md` ที่ห้ามใช้ของของคนอื่น

**เอกสารราชการหนักกว่าโลโก้ยี่ห้อ** สองแอปมีของที่ในโลกจริงเป็นเอกสารของรัฐ คือสัญญาของ
หน่วยงานรัฐใน ESCALATION K และโฉนดที่ดินใน LAND ACQUISITION ถ้าเขียนส่วนหัวตามคำจริง
เครื่องมือจะสร้างเอกสารราชการปลอมที่มีตราครุฑขึ้นมา ซึ่งเป็นการปลอมบันทึกของทางการ
ไม่ใช่แค่ยืมโลโก้ ส่วนหัวของสองตัวนี้จึงเขียนว่าเป็นเอกสารเปล่า ไม่มีหัวจดหมาย ไม่มีตรา
ไม่มีดวงตราประทับ และเลี่ยงคำว่า Thai government กับ title deed ไปเลย

**อีกสองอย่างที่ต้องตรวจทุกรูปก่อนรับ** หนึ่ง ลายน้ำ AI-Generated Image พาดกลางภาพในหน้าพรีวิว
ต้องโหลดไฟล์จริงมาดูโซนที่ถูกทับก่อนตัดสิน สอง เครื่องมือชอบเชื่อมของสองอย่างเข้าด้วยกัน
รอบนี้ได้แท่งคอนกรีตตัวอย่างที่มีหูจับติดข้างเหมือนเหยือกน้ำ ให้ไล่ดูทีละชิ้นว่าเป็นของจริงที่มีอยู่
และไอคอนพวกนี้ขึ้นเรียงกันบนหน้าเดียว ความต่างของแสงจึงเห็นชัดกว่าที่คิด

## สี่ — เนื้อของภาพรายตัว เจ็ดแอปกับตราของ Hermes

ทะเบียนมีเจ็ดแอป ส่วน Hermes เป็นตราของผู้ช่วยเบื้องหลัง ไม่ได้ขึ้นเป็นการ์ดแอป
แต่มีไฟล์ตราอยู่แล้วจึงทำใหม่พร้อมกันเพื่อไม่ให้เหลือของเก่าปนอยู่ตัวเดียว

### PRICEMETR — ราคาวัสดุและค่าแรง

```
A still-life of construction cost reference materials: a small neat pile of river sand, a short
bundle of deformed steel rebar tied with wire, a plain unbranded kraft paper cement sack with a
blank surface and no printing, logo or lettering on it at all, a plain grey concrete test cylinder
with no handle and no markings, and a folded printed price schedule with a brass magnifying glass
resting on it, a small burnt orange price tag on a string. The scene is completely empty of any
person, including far away and out of focus in the background.
```

### ESCALATION K — ค่า K และเงินชดเชยตามสัญญา

```
A still-life of construction contract and price index references: a thick bound contract document
with a burnt orange spine clip and a plain blank cover with no letterhead, emblem, seal or logo of
any kind, a folded printout of a rising line graph, a plain unbranded desktop calculator with no
maker's name on it, a short steel rebar offcut and a small unmarked cement sample resting beside
them. The scene is completely empty of any person, including far away and out of focus in the
background.
```

### ผู้ช่วยสร้างแผนงาน — แผนงานก่อสร้าง

```
A still-life of construction planning tools: a rolled-out printed bar chart schedule with a smooth
S shaped progress curve drawn over it, a plain desk calendar block, a plain unbranded mechanical
pencil, a plain burnt orange safety helmet with a completely blank shell and no logo, sticker or
lettering on it, and a folded set of building drawings underneath. The scene is completely empty
of any person, including far away and out of focus in the background.
```

สี่ตัวถัดไปคือของที่มีไอคอนอยู่แล้ว ต้องทำใหม่ด้วยเพราะของเดิมเป็นภาพเขียน คนละชนิดกับสามตัวบน

### ESTIMETR — ประมาณราคางานอาคาร

```
A still-life of building cost estimating tools: a small scale model of a reinforced concrete
building frame, a plain clipboard holding a printed quantity take-off sheet, a rolled architectural
drawing, a burnt orange triangular scale ruler with no maker's name, and a plain unbranded compact
calculator. The scene is completely empty of any person, including far away and out of focus in
the background.
```

### กำแพงกันดิน — Retaining Wall Cantilever

```
A still-life of a retaining wall study: a small concrete cantilever retaining wall section model
cut away to show its footing, a compacted soil bank behind it, a steel rebar cage sample, and a
folded structural drawing with a plain burnt orange engineering scale beside it carrying no
maker's name. The scene is completely empty of any person, including far away and out of focus in
the background.
```

### TRAFFIC SIGN — วัสดุป้ายจราจร

```
A still-life of road sign components: a blank reflective aluminium traffic sign face with no symbol
or lettering on it, mounted on a short galvanised steel post, a coil of reflective sheeting,
mounting brackets and bolts laid out neatly, and a plain burnt orange measuring tape with no brand
name on its case. The scene is completely empty of any person, including far away and out of focus
in the background.
```

### LAND ACQUISITION — งานจัดกรรมสิทธิ์ที่ดิน

```
A still-life of land survey field work: a folded land parcel map showing plain plot outlines, a
surveyor's tripod head with a plain unbranded total station carrying no maker's name, a concrete
boundary marker post lying on its side, a document folder with a burnt orange band, and a small
stack of plain land document papers with no official emblem, seal or crest on them. The scene is
completely empty of any person, including far away and out of focus in the background.
```

### Hermes — ผู้ช่วยทำงาน 24/7

```
A still-life of an always-on operations desk: a plain unbranded compact server node with soft
indicator lights and no maker's name on its face, a plain headset resting beside it, a small plain
wall clock, a stack of paper job tickets on a spike, and a burnt orange cable coiled neatly. The
scene is completely empty of any person, including far away and out of focus in the background.
```

## ห้า — ทำอย่างไรกับไฟล์ที่ได้

1. เลือกภาพที่พื้นหลังสะอาดที่สุด แล้ว upscale ให้ได้อย่างน้อย 1024 จุด
2. ครอบเป็นจัตุรัส และเก็บเป็น WebP ขนาด **640 จุด**

   **เลขนี้แก้เมื่อ 2026-08-30 เพราะของเดิมคิดจากขนาดที่ไม่จริงแล้ว** คอมเมนต์ใน
   `src/lib/visual-assets.ts` เขียนว่าไอคอนถูกวาดที่ 65 ถึง 74 จุด และเก็บ 256 จุดพอสำหรับ
   จอสามเท่า วัดจาก `globals.css` วันนี้ได้ว่าการ์ดแอปวาดที่ 104 จุด หน้ารายละเอียดแอปวาดที่
   202 จุด จอสามเท่าจึงต้องการ 606 จุด ไฟล์ 256 จุดที่ใช้อยู่ไม่คมพอมาตั้งแต่แรก
   640 จุดครอบทุกที่ที่ไอคอนถูกวาดจริง และยังห่างไกลจากไฟล์ 4 MB ของรอบแรก
   **เมื่อวางไฟล์ชุดใหม่ ให้แก้คอมเมนต์นั้นด้วย** ไม่งั้นรอบหน้าจะคิดจากเลขผิดอีก
3. ตั้งชื่อไฟล์ตามแบบเดิม `naichangmoo-<slug>-badge.webp` แล้ววางที่ `public/brand/`
   ตราแอปเป็นภาพถ่ายจึงเก็บเป็น WebP ส่วนตราคำกับตราย่อยังเป็น PNG เพราะเป็นภาพลายเส้นพื้นโปร่ง
4. เพิ่มคีย์ใน `visualAssets` แล้วเปลี่ยน `iconSrc` ของแอปนั้นใน `src/lib/platform.ts`
   จาก `visualAssetUrl("brand_mark")` เป็นคีย์ใหม่ พร้อมแก้ `iconAlt` ให้เลิกบอกว่าเป็นของชั่วคราว
5. ลบคำว่า PLACEHOLDER ในคอมเมนต์ของแอปนั้นออก เพราะมันไม่ใช่ของยืมอีกต่อไป
