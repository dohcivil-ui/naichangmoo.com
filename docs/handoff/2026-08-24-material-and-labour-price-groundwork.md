# Groundwork for material and labour prices — 2026-08-24

`/grill-with-docs` was run: `grilling` and `domain-modeling` both loaded and two rounds were answered. The question frontier is **not** empty — one round remains, listed at the end. No source code was changed in this session, so nothing was implemented past the frontier.

## Changed files

- `CONTEXT.md` — added the term **ราคาพาณิชย์รายจังหวัด** after **Price Set**.
  Caveat: another session was committing in this same working directory at the time, and this edit was swept into `abf1c9d feat(admin): let an administrator change access…` rather than into a commit of its own. The text is correct and in place at `CONTEXT.md:49`; only its commit provenance is wrong.
- `docs/research/changkid-boq-building-competitor-2026-08-24.md` — added earlier in the session (commit `8c36458`, pushed on `feature/estimeter-measurement-breakdown`).
- This note.

Branch `feature/estimeter-price-reference` was created but carries **no commits of its own**; it points at the same object as `origin/feature/pricing-page-and-access-copy`. It can be deleted.

## The rules, read from the source documents

The authoritative document is `km/คู่มือการประมาณราคา.pdf` (DPT, 211 pp), which reproduces หลักเกณฑ์การคำนวณราคากลางงานก่อสร้างอาคาร verbatim. Read with `node scripts/read-circular.mjs text` — the only PDF reader that works here.

**Material price sources are a fixed cascade, not a choice — p.114**

| Case | 1st | 2nd | 3rd |
|---|---|---|---|
| ส่วนกลาง (กทม. นนทบุรี ปทุมธานี สมุทรปราการ) | สำนักดัชนีเศรษฐกิจการค้า กระทรวงพาณิชย์ | พาณิชย์จังหวัดใกล้เคียง | สืบราคาเอง ใช้ราคาต่ำสุด + ทำบันทึก |
| ส่วนภูมิภาค | พาณิชย์จังหวัดที่สถานที่ก่อสร้างตั้งอยู่ | พาณิชย์จังหวัดใกล้เคียง | สืบราคาเอง ใช้ราคาต่ำสุด + ทำบันทึก |

ข้อ 4 permits another source only if `ราคาที่ใช้นั้นเมื่อรวมค่าขนส่งแล้วต้องไม่สูงกว่าราคาวัสดุก่อสร้างต่ำสุดที่…เผยแพร่`, with a written record of the reason. ข้อ 5 requires สืบราคาจากแหล่งผลิต for high-volume materials when that is cheaper including transport.

This settles the question ADR 0008 left open for *materials*: the **rule** is DPT's หลักเกณฑ์, the **data** is กระทรวงพาณิชย์. Both, not either. ADR 0008 fixed กรมบัญชีกลาง as the authority for Factor F only.

**ค่าขนส่ง does NOT go into the unit price — p.28**

> ไม่มีข้อกำหนดให้คำนวณค่าขนส่งวัสดุก่อสร้างในหลักเกณฑ์ฯ … ในกรณีที่มีความจำเป็น เช่น การก่อสร้างอาคารบนเกาะ บนภูเขา … ให้กำหนดเป็นค่าใช้จ่ายพิเศษตามข้อกำหนดฯ รายการหนึ่ง … นำยอดรวมมากำหนดไว้ในแบบ ปร.4(พ)

ปร.4(พ) sits **outside** the Factor F base. Adding transport to the unit price would put it inside, multiplying it by Factor F and destroying the justification trail the rule requires. Rates come from `ตารางค่าขนส่งวัสดุก่อสร้าง` (p.115 item 8) — **that table is not in `km/`**, so transport cannot be computed here yet.

**VAT arrives through Factor F — p.25, p.31**

> ให้คำนวณค่าวัสดุ ค่าแรงงาน … ในราคาทุน (ไม่รวมค่าอำนวยการ ดอกเบี้ย กำไร และค่าภาษีมูลค่าเพิ่ม)

Adding 7% at ปร.4 double-counts. Exceptions that carry their own VAT and stay out of the Factor F base: ปร.5(ข) ครุภัณฑ์จัดซื้อ (p.31) and ปร.4(พ) ค่าใช้จ่ายพิเศษ (p.32).

**This is conditional on Costing Method.** The rules above are the `factor_f` path. On the `contractor_cost` path there is no Factor F, so VAT and transport must be handled explicitly. Any rule written about this must name the costing method; a flat statement will mislead one path or the other.

**"ราคาปัจจุบัน" has a legal definition — p.115 item (1)**

> ราคาวัสดุก่อสร้างในช่วงระยะเวลา 30 วัน นับจากวันที่จัดทำรายงานสรุปการคำนวณราคากลางงานก่อสร้างนั้น

A checkable staleness rule. Note `CONTEXT.md` bans "ราคาปัจจุบัน" as a *product* term while the หลักเกณฑ์ uses it as a *defined* term — keep the two apart.

**Not established, do not write as rule**

- The "สืบราคาอย่างน้อย 3 ราย" convention appears in **no document in `km/`** (all 42 text-bearing PDFs searched). The หลักเกณฑ์ requires only *lowest price* + *written record*.
- `ตารางค่าขนส่งวัสดุก่อสร้าง` is cross-referenced twice but absent.
- Six `km/` PDFs are image-only and unread; the most likely to matter is `หลักเกณฑ์ประมาณราคางานอาคาร.pdf` (25 pp).
- The cover of `คู่มือการประมาณราคา.pdf` is a scan, so its document number and publication date are still unverified — needed before citing it formally.

## The price API, verified live

`https://index-api.tpso.go.th` — public, no key.

- `GET /OpenApi/CmiPrice/Month/MasterData` → `types` = 74 provinces; `dataAvailablePeriods` = monthly, 1/2545 → 7/2569; `commodities` returns **empty**.
- `POST /OpenApi/CmiPrice/Month` body `{"year":2568,"month":6,"type":14}` → 256 rows.

```json
{"commodityCode":"0101010100100000",
 "commodityNameTH":"คอนกรีตผสมเสร็จรูปลูกบาศก์ 180 กก./ตร.ซม. … ตราซีแพค",
 "unitName":"ลบ.ม.","curMonth":6,"curYear":2568,
 "priceCur":2200.0,"priceVAT":2354.0}
```

- `priceVAT` = `priceCur` × 1.07 exactly, so **`priceCur` is the value that maps to `price_observations.price_excluding_vat`** and is the correct figure for ปร.4.
- `unitName` supplies the `unit` column the measurement-breakdown handoff recorded as missing.
- Item names are **brand-specific** (`ตราซีแพค`). Matching a BOQ line to a commodity code is the highest-risk step in the whole feature.
- Full backfill would be ≈ 256 × 74 × 294 ≈ 5.5M rows. Do not backfill blindly.

## Defect shipped in v0.29.0 — number columns no longer align

`src/app/layout.tsx` now loads **Prompt** for the whole site. The weight audit in that change was right: `globals.css` really did ask for 800 and 900 against a face that only shipped 400–700, and fixing the faux bold was worth doing.

What was not checked is digit metrics. Measured directly from the font files (advance widths, em = 1000):

| Face | digit widths 0–9 | uniform |
|---|---|---|
| IBM Plex Sans Thai (previous) | 600 ×10 | yes |
| Prompt (current) | 672, 363, 581, 574, 601, 570, 609, 545, 602, 609 | no — 30.9% spread |

Prompt exposes only `kern`, `liga`, `locl`; it has **no `tnum` feature**, so `font-variant-numeric: tabular-nums` has nothing to switch to. Six declarations are now inert:

`src/app/globals.css` — `.number-cell` (:160), `.measurement-list__working` (:282), `.access-tier__amount strong` (:361), `.day-pass__price strong` (:368), `.admin-stat__value` (:414), `.admin-table [data-numeric="true"]` (:445)

This is invisible in review because the CSS still reads `tabular-nums`. In an estimating product the ปร.4/ปร.5/ปร.6 columns are the wrong place to lose digit alignment.

**Fix:** declare a `--font-numeric` variable bound to IBM Plex Sans Thai (or another face whose digits are uniform) and apply it to those six selectors only; leave Prompt everywhere else. `next/font/google` can load both. Verify by re-measuring, not by eye.

## A knowledge file on disk is teaching the opposite

`km/ฐานความรู้-ถอดปริมาณครบทุกหมวด.md:117-118` instructs that published prices `ต้องบวกเพิ่มเอง` for both VAT and transport, and tells the model to repeat that to users. Its header claims `กฎเหล็ก: GPT ต้องใช้ค่าจากไฟล์นี้ ห้ามเดาเอง`.

On the `factor_f` path this is wrong twice — see p.28 and p.31 above. On the `contractor_cost` path it is defensible. The file states it unconditionally, which is the actual defect. `km/` is gitignored, so the owner must edit it; the durable fix is to write the conditional rule into `docs/rules/engineering.md`, which currently has no material-price section at all.

## Decisions settled with the owner

| Question | Answer |
|---|---|
| How far may a พาณิชย์ figure travel? | Attach to a BOQ line, gated — but the gate is **"which rung of the cascade did this come from"**, not "enter transport first" |
| First ingest scope | Latest month for all provinces; fetch history only for items someone opens |
| Where the feature lives | Reference page inside ESTIMETR; not a separately sold app |
| Term | **ราคาพาณิชย์รายจังหวัด** |
| Province | Determined by site location per p.114, not a free choice |
| Month | The project's stated reference month, defaulting to latest; never "always latest" — a frozen revision must not drift |
| AI's role | Proposes **per work item** (งานดินขุด, ดินถม, ทรายรองพื้น, คอนกรีตหยาบ, ฐานราก F1…Fn), flagging what needs checking against the drawing; a person accepts each one |
| Font | Prompt for display, a uniform-digit face for numerals |

## Verification performed

No code changed, so no gate was run. Evidence gathered: the API was called live and its responses read; the ว480 and คู่มือ PDFs were read with `scripts/read-circular.mjs`; font metrics were parsed from `hmtx`/`cmap` in the actual TTF files.

## Risk

The main risk is that the shipped `tabular-nums` defect stays invisible. The second is that the rules above exist only in this note — `docs/rules/engineering.md` still has no material-price section, and the wrong knowledge file is still on disk and still authoritative-looking.

## Rollback

Nothing to roll back. `CONTEXT.md:49` is additive; removing that block restores the previous glossary.

## Next action, in order

1. **Fix the numeral font.** Smallest change, already-shipped defect, no design decision left.
2. Write the material-price and transport rules into `docs/rules/engineering.md`, conditioned on Costing Method.
3. Finish the grilling round that is still open: how a work item expands into วัสดุมวลรวม before a price attaches (`km/เกณฑ์การเผื่อและการคำนวณเผื่อวัสดุมวลรวมต่อหน่วย.pdf` is the source); what the AI proposal shows when the drawing does not state a thickness; and whether the cascade rung is stored per observation or per price set.
4. Reserve roadmap ids **from IP-092** — IP-085 is taken and IP-091 is the highest in use. The plan drafted this session assumed IP-083…IP-087 and must be renumbered.
5. Then the slice itself: ADR → ว480 dataset + module + tests → พาณิชย์ API client + cascade logic + tests → reference page.

The full draft plan is at `C:\Users\moosu\.claude\plans\stateful-munching-walrus.md`. Its rule sections hold; its font section is obsolete and its roadmap ids collide.

## Working-directory hazard

Two Claude sessions were committing in `d:\AIProject\naichangmoo` at the same time during this session. That is how a glossary edit ended up inside an unrelated admin commit, and how a branch was created from a different base than intended. Before starting the next slice, confirm no other session is live in this directory.
