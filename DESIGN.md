---
version: alpha
name: Naichangmoo-design-analysis
description: "ภาษาการออกแบบปัจจุบันของแพลตฟอร์มนายช่างหมู — canvas สีเทาอมเขียว (#f4f7f7) พื้นการ์ดขาว หมึกน้ำเงินเข้มอมเขียว (#073047) และคู่สีประจำแบรนด์ teal (#0d8282) + orange (#f47721) โดย teal คือสีของการกระทำและสถานะที่ตรวจสอบแล้ว ส่วน orange สงวนไว้สำหรับ CTA ที่สำคัญที่สุดและเส้นเตือนเท่านั้น ตัวอักษรเป็น IBM Plex Sans Thai ทั้งระบบ หัวเรื่องบีบ letter-spacing ติดลบ (-.035em) การ์ดมุมมน 12–16px มีเงาฟุ้งบาง ๆ และ hero เป็นแถบไล่สีเข้มพร้อมกริดวิศวกรรมจาง ๆ ทับอยู่"

colors:
  primary: "#0d8282"
  primary-deep: "#0a6f70"
  primary-soft: "#eff9f7"
  on-primary: "#ffffff"
  accent: "#f47721"
  accent-hover: "#ff964f"
  accent-soft: "#fff6eb"
  on-accent: "#17120d"
  ink: "#073047"
  ink-deep: "#051f2f"
  ink-muted: "#5f7178"
  ink-subtle: "#799096"
  ink-body: "#3f545f"
  canvas: "#f4f7f7"
  surface-1: "#ffffff"
  surface-2: "#eff8f6"
  surface-3: "#e7f1f1"
  hairline: "#d9e5e4"
  hairline-strong: "#c9d8d9"
  hairline-soft: "#e8efee"
  mist: "#d8e4e4"
  inverse-canvas: "#051f2f"
  inverse-ink: "#ffffff"
  inverse-ink-muted: "#c7dcdf"
  semantic-success: "#32765d"
  semantic-warning: "#a5500b"
  semantic-error: "#8a3b3b"
  focus: "#f47721"
  series-plan: "#0aa0a0"
  series-requested: "#f47721"
  series-certified: "#2f7fe0"

typography:
  display-xl:
    fontFamily: IBM Plex Sans Thai
    fontSize: 74px
    fontWeight: 700
    lineHeight: 1.06
    letterSpacing: -2.6px
  display-lg:
    fontFamily: IBM Plex Sans Thai
    fontSize: 58px
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: -2.0px
  display-md:
    fontFamily: IBM Plex Sans Thai
    fontSize: 42px
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: -1.5px
  headline:
    fontFamily: IBM Plex Sans Thai
    fontSize: 30px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.9px
  card-title:
    fontFamily: IBM Plex Sans Thai
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -.36px
  subhead:
    fontFamily: IBM Plex Sans Thai
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: 0
  body:
    fontFamily: IBM Plex Sans Thai
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: 0
  body-sm:
    fontFamily: IBM Plex Sans Thai
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
  table:
    fontFamily: IBM Plex Sans Thai
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  number:
    fontFamily: IBM Plex Sans Thai
    fontSize: 13px
    fontWeight: 900
    lineHeight: 1.5
    letterSpacing: 0
  caption:
    fontFamily: IBM Plex Sans Thai
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: 0
  eyebrow:
    fontFamily: IBM Plex Sans Thai
    fontSize: 11px
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: 1.8px
  button:
    fontFamily: IBM Plex Sans Thai
    fontSize: 15px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0

rounded:
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  pill: 999px
  full: 999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 21px
  xl: 30px
  xxl: 48px
  section: 76px

components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: 11px 16px
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
  button-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: 11px 16px
  button-secondary:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: 7px 9px
  nav-pill:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: 7px 11px
  nav-pill-active:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.primary-deep}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: 7px 11px
  feature-card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 21px
  workspace-panel:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 32px
  evidence-panel:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: 19px
  status-chip:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.primary-deep}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 6px 10px
  status-chip-attention:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.semantic-warning}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 6px 10px
  text-input:
    backgroundColor: "#fbfdfd"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: 11px 12px
  text-input-focused:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: 11px 12px
  workspace-notice:
    backgroundColor: "#fffaf5"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: 12px 16px
  top-nav:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    height: 76px
  footer:
    backgroundColor: "{colors.inverse-canvas}"
    textColor: "{colors.inverse-ink-muted}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: 34px 20px
---

# นายช่างหมู — DESIGN.md

> **ไฟล์นี้ไม่ใช่แหล่งอ้างอิงหลักอีกแล้ว (2026-08-28)**
>
> เอกสาร Design System หลักคือ [`docs/design-system/platform-ui-system.md`](docs/design-system/platform-ui-system.md)
> และ **ค่าสีจริงประกาศที่ `src/app/globals.css` บล็อก `:root` ที่เดียว**
>
> ไฟล์นี้เก็บไว้เป็นบันทึกภาษาการออกแบบช่วงแรก และมีข้อมูลที่ล้าสมัยอย่างน้อยสองเรื่อง —
> ระบุฟอนต์เป็น IBM Plex Sans Thai ทั้งที่ของจริงเปลี่ยนเป็น Prompt ตั้งแต่ 2026-08-24
> และเรียกชื่อ token คนละชุดกับ `globals.css` (`primary` / `surface-2` / `hairline`
> แทนที่จะเป็น `--teal` / `--mist` / `--line`) **ห้ามใช้ไฟล์นี้ตัดสินค่าใด ๆ**

## Overview

> ที่มา: `src/app/globals.css`, หน้า landing (`src/app/page.tsx`), Civil Apps Market และ ESTIMETR workspace

ภาษาการออกแบบของนายช่างหมูตั้งอยู่บนความคิดเดียวคือ **"เครื่องมือวิศวกรรมที่ตรวจสอบย้อนกลับได้"** ไม่ใช่ SaaS marketing site หน้าเว็บจึงไม่ขายด้วยภาพ แต่ขายด้วยลำดับขั้นตอนที่มองเห็นได้ (input → validation → calculation → evidence) สีเขียวน้ำทะเลคือสีของ "สิ่งที่ตรวจแล้ว" สีส้มคือสีของ "สิ่งที่ต้องตัดสินใจ" และไม่มีสีใดถูกใช้เพื่อความสวยอย่างเดียว

## Colors

### Brand & Accent
- **Teal** (`{colors.primary}` — `#0d8282`): สีการกระทำหลัก ลิงก์ สถานะ active ตัวเลขที่ยืนยันแล้ว ขั้นตอนที่ผ่านแล้ว
- **Teal Deep** (`{colors.primary-deep}` — `#0a6f70`): ข้อความบนพื้น teal อ่อน
- **Orange** (`{colors.accent}` — `#f47721`): CTA สำคัญที่สุดของหน้า เส้นเตือนซ้ายของ notice และ focus ring — ห้ามใช้เกินหนึ่งจุดต่อหนึ่งจอ
- **Ink** (`{colors.ink}` — `#073047`): หมึกหลัก น้ำเงินเข้มอมเขียว ไม่ใช่ดำ

### Surface
- **Canvas** (`{colors.canvas}` — `#f4f7f7`): พื้นหน้าเว็บ เทาอมเขียวบาง ๆ ทำให้การ์ดขาวลอยขึ้นมาโดยไม่ต้องใช้เงาแรง
- **Surface 1** (`#ffffff`): การ์ด แผง ตาราง
- **Surface 2** (`#eff8f6`): พื้น teal อ่อน — ขั้นตอน active, chip สถานะพร้อม, การ์ดสรุป
- **Hairline** (`#d9e5e4`): เส้น 1px ของการ์ดและตาราง

### Semantic
- Success `#32765d` · Warning `#a5500b` บนพื้น `#fff6eb` · Error `#8a3b3b` บนพื้น `#f9e7e7`

### Charts
จานสีของกราฟเป็นข้อยกเว้นเดียวที่ออกนอกคู่สีประจำแบรนด์ และผ่านการตรวจด้วย `validate_palette.js` แล้ว
- **Plan** `#0aa0a0` · **Requested** `#f47721` · **Certified** `#2f7fe0`
- สีส้มมีความต่างกับพื้นต่ำกว่า 3:1 กราฟที่ใช้สีนี้จึงต้องมีป้ายชื่อและตารางกำกับเสมอ ห้ามเอาออก

### หมายเหตุการตั้งชื่อ
เอกสารนี้เขียนไว้ก่อน `--ink-body` และจานสีกราฟถูกเพิ่มเข้าระบบ ทั้งสองถูกเติมกลับแล้วข้างต้น
และ `globals.css` เปิดเส้นออกมาเป็น `--line` (`#c9d8d9`) ตัวเดียว ไม่ได้แยก `hairline` กับ `hairline-strong`
อย่างที่ frontmatter ไล่ไว้ — ค่าที่ใช้จริงคือตัวเข้ม

## Typography

**IBM Plex Sans Thai** ทั้งระบบ ไม่มีคู่ display/body แยก ลำดับชั้นสร้างจากขนาด + น้ำหนัก + letter-spacing

หัวเรื่องใหญ่บีบ tracking ติดลบที่ `-.035em` ซึ่งเป็นลายเซ็นของแบรนด์ ค่านี้ถูกผ่อนลงจาก `-.05em` เพราะภาษาไทยไม่เว้นวรรคระหว่างคำ การบีบแรงเกินไปทำให้หาขอบคำยากขึ้น ไม่ใช่ทำให้ดูแน่นขึ้น ระดับ tracking มีสามขั้นคือ `-.035em` สำหรับ display, `-.03em` สำหรับหัวข้อ section และ `-.02em` สำหรับหัวการ์ด ส่วน eyebrow ใช้ตัวพิมพ์เล็กมาก น้ำหนัก 800 และกาง tracking `+.16em` เพื่อทำหน้าที่เป็นป้ายหมวด ตัวเลขในตารางใช้ `font-variant-numeric: tabular-nums` และน้ำหนัก 900 เสมอ เพื่อให้อ่านคอลัมน์ปริมาณลงมาตรง ๆ ได้

## Layout

- Container `min(1160px, 100% - 40px)`
- Workspace เป็น 2 คอลัมน์ `minmax(0,1fr) / 280–310px` โดยคอลัมน์ขวาเป็นแผงหลักฐานที่ sticky อยู่ที่ `top: 98px`
- Section padding 76px · การ์ด padding 21px · แผง workspace padding `clamp(1.15rem, 3vw, 2rem)`
- App grid 4 คอลัมน์ → 2 → 1

## Elevation & Depth

| ระดับ | การใช้ | ค่า |
|---|---|---|
| 0 | ข้อความ พื้น canvas | ไม่มีเงา |
| 1 | การ์ดทั่วไป | 1px hairline + `0 16px 35px rgba(8,58,80,.045)` |
| 2 | การ์ด hover | `0 18px 38px rgba(7,48,71,.14)` + ขอบเปลี่ยนเป็น teal |
| 3 | hero | ไล่สี `132deg #073047 → #0a4f59` + กริดวิศวกรรม 34px จาง ๆ ทับ |

เงาเป็นแบบฟุ้งกว้างและจางมาก ไม่ใช่เงาคม การยกระดับส่วนใหญ่มาจาก **การเปลี่ยนสีขอบเป็น teal** มากกว่าการเพิ่มเงา

## Shapes

| Token | ค่า | ใช้กับ |
|---|---|---|
| `{rounded.sm}` | 8px | ปุ่มทุกตัว, input, select, textarea, notice, ไอคอนเล็ก |
| `{rounded.md}` | 12px | การ์ดแอป การ์ดสรุป ตาราง ขั้นตอน |
| `{rounded.lg}` | 16px | แผง workspace, แผงหลักฐาน, กล่องความคืบหน้า |
| `{rounded.xl}` | 24px | การ์ดหมวดใน Civil Apps Market, กรอบไอคอนแอป |
| `{rounded.xxl}` | 32px | กรอบภาพใหญ่ในหน้ารายละเอียดแอป |
| `{rounded.pill}` | 999px | nav pill, chip สถานะ, badge สิทธิ์ |

บันไดนี้เป็นทวีคูณของ 4 ทั้งหมด (8/12/16/24/32) ก่อนหน้านี้มี 7, 10, 11, 13, 14, 17, 18, 20, 22, 25, 26 และ 34px ปนกันอยู่ ซึ่งเป็นค่าที่ค่อย ๆ เกิดจากการแก้ทีละจุด ไม่ใช่ระบบที่ตั้งใจ

## Do's and Don'ts

### Do
- ใช้ teal บอก "ตรวจแล้ว/ทำได้" และ orange บอก "ต้องตัดสินใจ" อย่างสม่ำเสมอ
- ให้ทุกตัวเลขปริมาณมีที่มาแสดงคู่กันเสมอ (แบบ/หน้า/สูตร)
- เก็บ tracking ติดลบบนหัวเรื่อง — ถ้าปล่อยเป็น 0 หน้าจะดูเป็นเว็บทั่วไปทันที แต่อย่าบีบเกิน `-.035em` เพราะภาษาไทยไม่มีช่องว่างระหว่างคำ
- ใช้ tabular-nums กับทุกคอลัมน์ตัวเลข

### Don't
- อย่าใช้ orange เกินหนึ่งจุดต่อหนึ่งจอ
- อย่าใส่เงาคมหรือเงาเข้ม — ระบบนี้ยกด้วยขอบและพื้น ไม่ใช่ด้วยเงา
- อย่าใช้สีเทากลาง ๆ เป็นหมึก ให้ใช้ `#5f7178` ซึ่งอมเขียวเข้ากับ canvas
- อย่าทำ dashboard ที่ไม่มี action ชัดเจน — ทุกแผงต้องบอกว่าขั้นต่อไปคืออะไร

## Responsive Behavior

- Breakpoints: 960 / 940 / 760 / 720 / 640
- ที่ ≤960px workspace ยุบเป็นคอลัมน์เดียวและแผงหลักฐานเลิก sticky
- ที่ ≤760px nav links กลายเป็นแถวเลื่อนแนวนอนซ่อน scrollbar
- ที่ ≤720px แถบขั้นตอนกลายเป็น carousel เลื่อนแนวนอนแบบ scroll-snap
- ทุก interactive มี `:focus-visible` เป็นเส้น orange 3px offset 3px

## Agent Prompt Guide

```
ใช้ canvas #f4f7f7 การ์ดขาวขอบ #d9e5e4 มุมมน 8/12/16/24px หมึก #073047
สีการกระทำ teal #0d8282 CTA สำคัญที่สุดสีส้ม #f47721 (จุดเดียวต่อจอ)
ตัวอักษร IBM Plex Sans Thai หัวเรื่อง 700 letter-spacing -.035em
ตัวเลขทุกคอลัมน์ tabular-nums น้ำหนัก 900 ชิดขวา
ทุกแผงต้องบอกขั้นตอนถัดไป และทุกปริมาณต้องมีที่มากำกับ
```
