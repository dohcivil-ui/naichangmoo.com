# Handoff — VS Code Continuation — ESTIMETR (2026-08-23)

> เปิดแชท/เซสชันใหม่ใน VS Code แล้วอ่านไฟล์นี้ + `PROJECT.md` + `CONTEXT.md` + `docs/roadmap/roadmap.json` ก่อนแตะโค้ด

## สถานะ repo ปัจจุบัน

| รายการ | ค่า |
|---|---|
| **Repo** | `D:\AIProject\naichangmoo` (remote: `dohcivil-ui/naichangmoo.com`) |
| **Branch หลักที่ทำงาน** | `feature/estimeter-trial-activation` |
| **HEAD** | `ea0974e` — `fix(ci): enable pnpm before setup-node cache lookup` |
| **Feature commit** | `aebdbbb` — v0.16.0 trial activation (ADR 0006) |
| **Roadmap** | `0.16.0` — ESTIMETR Trial Starts at Explicit Activation |
| **Tag ล่าสุดบน GitHub** | `v0.16.0-estimeter-trial-activation` (ชี้ `aebdbbb`) |
| **PR หลัก** | [#6](https://github.com/dohcivil-ui/naichangmoo.com/pull/6) — **CI + Vercel ผ่านแล้ว** |
| **Local DB** | PostgreSQL 18.6, database `naichangmoo`, migration 0000+0001 apply แล้ว |
| **Dev server** | มักรันที่ http://localhost:3000 (ถ้าพอร์ตถูกใช้ ให้ kill process เก่าก่อน) |

## สิ่งที่ทำเสร็จแล้ว (ESTIMETR slices 1–4 ในเชิง policy)

| Tag | Slice | สรุป |
|---|---|---|
| v0.13.0 | Entitlement runtime | รวมสองสาย git, บังคับ trial ฝั่ง server (เดิมนับจาก `users.created_at`) |
| v0.14.0 | Project lifecycle | สร้าง/เปิดโครงการจริง, เพดาน 1 โครงการใน transaction |
| v0.15.0 | Manual takeoff | ถอดปริมาณ + หลักฐาน, หน่วยปิด, บวกด้วย scaled integer |
| v0.16.0 | Trial activation | **โมเดล 2 ด่าน**: สมาชิกเว็บ ≠ สิทธิ์แอป; นาฬิกา 5 วันเริ่มเมื่อกด **เริ่มทดลองใช้** (ADR 0006) |

**CI fix** (`ea0974e`): สลับลำดับ step ใน `.github/workflows/quality.yml` — enable pnpm ก่อน `setup-node cache: pnpm` (แก้ PR แดงทุกอันเมื่อ merge fix เข้า branch นั้น)

## โมเดลสิทธิ์ (ต้องจำ)

1. **ด่าน 1 — Platform Membership:** สมัคร/ล็อกอิน = เป็นสมาชิกเว็บ ไม่เริ่มนาฬิกา ESTIMETR
2. **ด่าน 2 — App Entitlement:** กด **เริ่มทดลองใช้** ที่ `/apps/estimeter` → สร้างแถว `app_entitlements`, นาฬิกา 5 วัน, audit `entitlement.trial_activated`
3. **ยังไม่เริ่มทดลอง** = ไม่มีแถว entitlement → สถานะคำนวณ `not_activated` (อ่านได้ แก้ไม่ได้)
4. **`getEstimeterAccess` อ่านอย่างเดียว** — ไม่เขียน DB ตอนเปิดหน้า

เอกสาร: `docs/adr/0006-trial-clock-starts-at-explicit-activation.md`

## PR ที่เปิดอยู่ (ยังไม่ merge)

| PR | Branch | หมายเหตุ |
|---|---|---|
| [#6](https://github.com/dohcivil-ui/naichangmoo.com/pull/6) | `feature/estimeter-trial-activation` | **ล่าสุด — CI เขียว** |
| [#5](https://github.com/dohcivil-ui/naichangmoo.com/pull/5) | `feature/estimeter-manual-takeoff` | CI แดง (workflow เก่า) — อยู่ใน #6 แล้ว |
| [#4](https://github.com/dohcivil-ui/naichangmoo.com/pull/4) | `feature/estimeter-entitlement-runtime` | อยู่ใน #6 แล้ว |
| [#3](https://github.com/dohcivil-ui/naichangmoo.com/pull/3) | `feature/estimeter-project-lifecycle` | อยู่ใน #6 แล้ว |
| [#2](https://github.com/dohcivil-ui/naichangmoo.com/pull/2) | `fix/quotation-intake-abuse-controls` | abuse controls — แยกจาก ESTIMETR line |

**แนะนำ:** merge ตามลำดับ slice หรือ merge #6 เป็นหลัก (มีทุก slice + ADR 0006 + CI fix)

## งานถัดไป (เลือกหนึ่งทาง)

### Slice 4 — อัปโหลดแบบ + ผูกหลักฐานกับไฟล์ (ยังไม่ต้อง migration)

- ใช้ `drawing_documents`, `evidence_references.document_id`, `geometry`
- **ต้องตัดสินก่อนลงมือ:** Cloudflare R2, checksum, การสแกนไฟล์, policy upload
- Roadmap ถัดไปน่าจะเป็น **v0.17.0**

### Slice 5 — ประมาณราคา (ต้องขยาย schema)

- BOQ line item, หน่วยฝั่งราคา, Factor F, VAT
- **ต้องมีเอกสารจากคุณ:** ราคากลาง (ระบุปี/เดือน) + ตาราง Factor F งานอาคาร
- ไม่ฝังตัวเลขในโค้ดถ้าไม่มีแหล่งอ้างอิง

### Governance / infra

- Merge PR #6 → `initial-project/nextjs-foundation` (หรือ branch หลักที่ทีมใช้)
- ปิด PR #3–#5 ซ้ำ หรือ rebase ให้ CI เขียว
- สร้าง **GitHub Release** จาก tag v0.16.0 (ถ้าต้องการเห็นใน sidebar Releases)
- Dependabot moderate 1 รายการ — ดูที่ GitHub Security

## คำสั่ง VS Code (PowerShell)

### เริ่มต้น

```powershell
cd D:\AIProject\naichangmoo
git fetch origin
git checkout feature/estimeter-trial-activation
git pull
git status
git log -3 --oneline
```

### Dev + ทดสอบ

```powershell
# ถ้าพอร์ต 3000 ถูกใช้
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

pnpm dev
# เปิด http://localhost:3000/apps/estimeter
```

```powershell
pnpm typecheck
pnpm lint
pnpm test
$env:ESTIMETR_DB_TESTS="1"; pnpm test
pnpm build
pnpm security:check
node scripts/check-roadmap.mjs
```

### DB (local)

```powershell
pnpm db:migrate
# psql -U postgres -d naichangmoo
# เคลียร์ entitlement เก่า (dev เท่านั้น):
# DELETE FROM app_entitlements;
```

### Git / GitHub

```powershell
gh pr view 6
gh pr checks 6
gh pr list --state open
git tag -l "v0.1*"
```

### เริ่ม slice ใหม่ (ตาม AGENTS.md)

```powershell
git checkout feature/estimeter-trial-activation
git pull
git checkout -b feature/estimeter-drawing-upload
# แก้ roadmap → v0.17.0 ก่อน commit
```

## ไฟล์สำคัญที่ควรเปิด

| ไฟล์ | ทำไม |
|---|---|
| `docs/roadmap/roadmap.json` | แผนปัจจุบัน |
| `docs/adr/0006-trial-clock-starts-at-explicit-activation.md` | นโยบาย trial |
| `src/server/estimeter-access.ts` | ด่าน 1/2 entitlement |
| `src/components/estimeter/trial-activation.tsx` | UI เริ่มทดลอง |
| `src/server/estimeter/takeoff-repository.ts` | takeoff write path |
| `.github/workflows/quality.yml` | CI (แก้แล้ว) |
| `AGENTS.md` | branch / roadmap / handoff / tag policy |

## URL ทดสอบ

| URL | คาดหวัง |
|---|---|
| http://localhost:3000 | Landing |
| http://localhost:3000/apps/estimeter | Sign-in หรือ หน้าเริ่มทดลอง / workspace |
| http://localhost:3000/apps/estimeter/projects/new | สร้างโครงการ (หลัง activate) |
| http://localhost:3000/roadmap | Roadmap/Handoff console |

**Sign-in:** ต้องมี OAuth ใน `.env` (Google/Facebook/LINE) — ห้าม commit ค่า secret

## Verification ล่าสุด

- PR #6 Quality Gate: **pass** (หลัง `ea0974e`)
- Local: typecheck / lint / build / security:check ผ่าน; `ESTIMETR_DB_TESTS=1` → 100 tests

## Rollback

- Feature: tag `v0.15.0-estimeter-manual-takeoff` หรือ revert `aebdbbb` + `ea0974e`
- ไม่มี migration ใน v0.16.0

## Next action (แนะนำ)

1. ใน VS Code: `git pull` แล้ว `pnpm dev` ทด flow sign-in → เริ่มทดลอง → สร้างโครงการ → takeoff
2. ตัดสินใจ merge PR #6 หรือเริ่ม slice 4 (drawing upload)
3. ถ้าเริ่ม slice 4: สร้าง branch ใหม่ + bump roadmap v0.17.0 ก่อน implement
