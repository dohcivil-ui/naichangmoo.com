# Platform UI System

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
| Responsive | 4 columns → 2 columns → 1 column; nav ลดเป็น brand/sign-in; touch target ไม่ต่ำกว่า 44px |

## Interaction rules

App cards respond to pointer and keyboard focus with a small elevation, icon scale and soft spotlight. Workflow steps respond to hover/focus by emphasizing the relevant sequence number. Forms respond through focus-visible states and clear status—not decorative motion. Scroll reveal is progressive enhancement only and never hides content when reduced motion is requested.
