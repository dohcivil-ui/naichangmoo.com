# Platform UI System

**ไฟล์นี้เป็นเอกสาร Design System หลัก (SSOT — แหล่งอ้างอิงหลัก) ของแพลตฟอร์ม**
เมื่อเอกสารอื่นเขียนเรื่องหน้าตาไม่ตรงกับไฟล์นี้ ให้ยึดไฟล์นี้ · `DESIGN.md` ที่รากรีโปเป็นเอกสารเก่า
ที่ยังมีข้อมูลล้าสมัยอยู่ ห้ามใช้เป็นแหล่งอ้างอิง · **ค่าสีจริงประกาศที่ `src/app/globals.css` บล็อก `:root`
ที่เดียวเท่านั้น** เอกสารนี้อธิบายกฎ ไม่ใช่ที่เก็บค่า

## Purpose

นายช่างหมูใช้ระบบหน้าตาเดียวกันสำหรับ Landing, ESTIMETR, กำแพงกันดิน, Traffic Sign และ Land Acquisition V2 เพื่อให้ผู้ใช้เรียนรู้การใช้งานครั้งเดียวแล้วสลับเครื่องมือได้โดยไม่สับสน. App เปลี่ยนเฉพาะ workflow และสิทธิ์ ไม่เปลี่ยนโครง navigation, spacing, form หรือการตอบสนองพื้นฐาน.

| Layer | Shared rule |
|---|---|
| Navigation | `PlatformNav` มี brand mark, app jump links และ sign-in action ในตำแหน่งเดียวกัน |
| App context | `AppShell` แสดง breadcrumb, ชื่อ app และ entitlement ก่อน workspace ทุกครั้ง |
| Layout | container, section gap, panel radius, border และ text scale ใช้ token จาก `globals.css` |
| Cards | app/workspace cards มี icon zone, status/access label, focus ring, hover lift และ pointer spotlight แบบเดียวกัน |
| Forms | labels, fields, validation space, consent และ primary action ใช้ form pattern เดียวกัน |
| Status | access label, roadmap state, Hermes advisory status และ locked capability ใช้สี/ข้อความเชิง semantic ชุดเดียวกัน |
| Motion | transition สั้น 140–220ms, ใช้ transform/opacity, keyboard/focus instant, ลด motion เมื่อผู้ใช้ตั้งค่า reduced motion |
| Responsive | 4 columns → 2 columns → 1 column; nav ลดเป็น brand/sign-in; touch target ไม่ต่ำกว่า 48px |

## Interaction rules

App cards respond to pointer and keyboard focus with a small elevation, icon scale and soft spotlight. Workflow steps respond to hover/focus by emphasizing the relevant sequence number. Forms respond through focus-visible states and clear status—not decorative motion. Scroll reveal is progressive enhancement only and never hides content when reduced motion is requested.

## การตัดสินใจที่เจ้าของงานเคาะแล้ว (2026-08-28)

แปดข้อนี้เกิดจากการสำรวจสภาพจริงของโค้ดที่ v0.88.0 **ทุกข้อเป็นทิศทาง ยังไม่ใช่งานที่ทำแล้ว**
งานที่ต้องทำตามข้อเหล่านี้เข้าคิวที่ `docs/roadmap/roadmap.json` ตามปกติ

1. **ตัวเลขที่ต้องเรียงหลักตรง ใช้ `--font-numeric` แยก** — ฟอนต์ Prompt ไม่มีฟีเจอร์ `tnum`
   คำสั่ง `font-variant-numeric: tabular-nums` ที่ประกาศไว้ราว 45 จุดใน `globals.css` จึงไม่มีผลจริง
   ทางแก้คือผูกฟอนต์ตัวเลขคงที่ให้เฉพาะช่องที่เป็นตัวเลข **ไม่เปลี่ยนฟอนต์ UI หลักทั้งระบบ
   เพราะเรื่อง `tnum` อย่างเดียว**
2. **ไฟล์นี้เป็นเอกสาร Design System หลัก** — `DESIGN.md` ที่รากรีโปให้ชี้มาที่นี่
   ห้ามมีเอกสารสองชุดกำหนดค่าขัดกัน
3. **spacing, radius, shadow และ breakpoint จะมีชุดมาตรฐานกลาง** แต่**ห้ามแปลงของเดิมทั้งระบบในคราวเดียว**
   ประกาศ token ใหม่ก่อน แล้วปรับเมื่อไปแตะส่วนนั้นอยู่แล้วหรือมีเหตุผลชัดเจน · breakpoint ปัจจุบันใช้อยู่
   16 ค่า ให้ยุบเป็นชุดมาตรฐานจากการใช้จริง (720px และ 640px คือสองค่าที่ใช้บ่อยที่สุด)
   **ไม่ยกทั้ง 16 ค่ามาเป็น token**
4. **Loading, Error และ Not Found เป็นรูปแบบกลางสำหรับ route ที่ใช้งานจริงและจำเป็น**
   ไม่บังคับสร้างไฟล์ครบทุก route เพียงเพื่อให้ครบกฎ
5. **ห้ามสร้าง Component Library ล่วงหน้า** — สร้างของกลางเมื่อพบรูปแบบซ้ำจริงและพฤติกรรมเหมือนกันจริง
   ตารางที่มี 4 ระบบให้สำรวจก่อนว่ารวมได้แค่ไหน · Modal, Toast, Empty State, Badge ค่อยสร้างเมื่อมีการใช้ซ้ำจริง
6. **กฎห้าม Emoji ยังคงเดิม** · อักขระ `✓` `○` `→` ที่ทำหน้าที่ไอคอนหรือปุ่ม ให้เปลี่ยนเป็น SVG ตามระบบไอคอน
   ถ้าเป็นเครื่องหมายวรรคตอนหรือข้อความธรรมดา ไม่ห้าม **ห้ามทำด่านตรวจที่แบนอักขระเหล่านี้แบบเหมารวม**
7. **จุดไข่ปลาในข้อความสถานะใช้ `…`** ไม่ต้องทำด่านตรวจแยกสำหรับเรื่องเล็กนี้
8. **สีที่ใช้ซ้ำหรือมีความหมายเชิงสถานะ** (error, success, muted) ให้ยกขึ้นเป็น token ใน `:root`
   สีที่ใช้ครั้งเดียวไม่ต้องบังคับเป็น token — เป้าหมายคือแก้ครั้งเดียวแล้วค่าที่มีความหมายเดียวกันเปลี่ยนตาม

นอกจากนี้ **เขตกดบนจอสัมผัสยืนยันที่ 48px** (เดิมเอกสารนี้เขียน 44px) หน้าตาปุ่มคงเดิมได้
ใช้ pseudo-element ขยายเขตกดที่มองไม่เห็น
