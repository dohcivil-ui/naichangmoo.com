# Government Construction Form Baseline Discovery — 2026-08-22

## Status

This is a source-discovery record only. No source listed here is yet approved as the ESTIMETR export baseline. The implementation must not claim compliance with the Department of Public Works and Town & Country Planning (DPT) or Comptroller General's Department (CGD) standard until the exact current instrument, effective date, form revision and calculation rules are reviewed and pinned.

## Candidate official sources

| Candidate | Why it matters | Verification status |
| --- | --- | --- |
| [กรมโยธาธิการและผังเมือง — มาตรฐาน มยผ.](https://www.dpt.go.th/th/dpt-standard/) | Official DPT standards entry point. | Browser navigation returned an HTTP/2 protocol error and text extraction returned no content; requires a later alternative access path or owner-supplied official file. |
| [กระทรวงพาณิชย์ — ประกาศหลักเกณฑ์และวิธีกำหนดราคากลางงานก่อสร้าง](https://www.moc.go.th/th/content/category/detail/id/347/cid/36/iid/10162) | Government publication candidate for a 2569 construction-cost instrument. | Search result discovered; full document/version fields not yet reviewed. |
| [กรมบังคับคดี — หลักเกณฑ์การคำนวณราคากลางงานก่อสร้างอาคาร 2569](https://sub.led.go.th/financial/p/2759/) | Government-hosted notice candidate for building cost-calculation rules. | Search result discovered; full document/version fields not yet reviewed. |
| [กรมบัญชีกลาง — ประกาศราคากลาง](https://www.cgd.go.th/cs/internet/internet/%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%81%E0%B8%B2%E0%B8%A8%E0%B8%A3%E0%B8%B2%E0%B8%84%E0%B8%B2%E0%B8%81%E0%B8%A5%E0%B8%B2%E0%B8%87.html) | Official CGD publication/index candidate. | Search result discovered; not a confirmed form-template source. |
| [สำนักงบประมาณ — บัญชีราคามาตรฐานสิ่งก่อสร้าง มกราคม 2569](https://www.bb.go.th/topic-detail.php?id=18270&mid=280&catID=0) | Official reference candidate for standard construction costs. | Search result discovered; relevance to the selected building form/rules must be verified. |

## Product rule while verification is incomplete

The Guided AI Assistant may teach the *document lineage* and flag readiness gaps, but `ปร.4(ก)`, `ปร.5(ก)`, `ปร.6`, Excel and PDF release must remain **not standard-certified / not releasable** until an approved, versioned form baseline and validation test pack are stored in the project.

## Verified findings from official sources reviewed on 2026-08-22

| Finding | Evidence status | Product implication |
| --- | --- | --- |
| The Ministry of Commerce page publishes the committee announcement titled **“หลักเกณฑ์และวิธีการกำหนดราคากลางงานก่อสร้าง”** and explicitly points to the Royal Gazette publication dated **8 June 2026**. | Verified from the ministry page and the linked PDF download path. | ESTIMETR should pin its rule engine to a dated government instrument, not a floating community copy. |
| The downloaded official PDF is a large rule set with a dedicated **building construction** section dated **2569**. | Verified by local PDF metadata and visual review of the building-volume cover. | Building-estimate behavior must be versioned by rule year and work type. |
| In the building section, the rule text states that BOQ / itemized calculation details are the source material and that the construction-cost summary is consolidated into **แบบ ปร.4**. | Verified from the reviewed pages around the building guidance and the explicit line `แบบสรุปราคากลางงานก่อสร้างอาคาร : แบบ ปร.4`. | ESTIMETR must treat document output as a downstream projection of reviewed BOQ data, not a separate editable estimate space. |
| The reviewed building pages enumerate upstream sheets such as **ปร.1**, **ปร.2**, **ปร.3** and then the final building summary **ปร.4**. | Verified from the official building guidance pages viewed locally. | The government document chain is broader than the current mockup. Even if the first teaching UI emphasizes Prelim → ปร.4 → ปร.5 → ปร.6, the release engine must preserve compatibility with the full official lineage. |

## Current conclusion for implementation

The project now has enough official evidence to justify a **strict readiness model**: the assistant may teach the chain and explain blockers, but it still must not claim that exported `ปร.4(ก)`, `ปร.5(ก)` or `ปร.6` are standards-compliant until the exact sheet set, field mapping, rounding rules, Factor F conditions and validation fixtures are extracted and pinned into versioned tests.
