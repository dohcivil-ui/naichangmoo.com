# Roadmap Changelog

## v0.21.0 — The Landing Says What the Tool Is For, and Shows It Working — 2026-08-23

หน้าแรกเพิ่มสองอย่างที่หายไป: ลำดับ 01-04 ที่เดินให้เห็นพร้อมเส้นสำรวจที่อ่านแผนผังไปเรื่อย ๆ แทนภาพนิ่ง และหัวข้อปัญหาสามข้อที่มาจากงานประมาณราคาจริง — ปริมาณที่ตรวจย้อนไม่ได้ ค่าเผื่อที่ไม่รู้ที่มา และตัวคูณที่หยิบจากตารางผิดชุด — โดยการ์ดที่สามระบุตรง ๆ ว่าชั้นราคายังไม่เปิดใช้งาน ทุก motion อยู่ในสัญญา reduced-motion เดิม

## v0.18.0 — The Quality Gate Becomes Something That Actually Runs — 2026-08-23

Made the rules the project already declared enforceable by machine. The pre-commit hook now installs itself from the prepare lifecycle, because core.hooksPath lives in .git/config and cannot travel with a commit; CI runs on feature branches, where the work actually happens; the opt-in PostgreSQL suites that handoff notes have been citing as verification now run in CI against a digest-pinned PostgreSQL 16 service with migrations applied first; and check-roadmap refuses a pointer that has drifted from its versioned file, which is how a roadmap edit slipped through unnoticed in fae066b.

## v0.17.0 — ESTIMETR Take-off Quantities Become Re-checkable — 2026-08-23

ปริมาณกลายเป็นผลรวมของบรรทัดวัด จำนวน × ระยะ แทนตัวเลขที่พิมพ์เข้ามาตัวเดียว จำนวนมิติที่ต้องกรอกถูกบังคับโดยหน่วยที่เลือก งานน้ำหนักแปลงจากความยาวด้วยตัวคูณที่ต้องอ้างที่มา ค่าเผื่อวัสดุแยกออกจากปริมาณและใช้ไม่ได้ถ้าไม่ระบุหลักเกณฑ์ และกฎระดับแถวทั้งชุดถูกบังคับซ้ำด้วย CHECK constraint ในฐานข้อมูล พร้อมวางรอยต่อของสองชั้นราคาไว้ที่ projects.project_path ตาม ADR 0007 (entry นี้ถูกเพิ่มย้อนหลังในรอบ v0.18.0 เพราะ release v0.17.0 ไม่ได้เขียนไว้)

## v0.16.0 — ESTIMETR Trial Starts at Explicit Activation — 2026-08-23

Separated the two access gates. Authentication still creates platform membership; the ESTIMETR five-day clock now starts only when the member presses "เริ่มทดลองใช้" after seeing the trial terms. Reading entitlement no longer writes the database. ADR 0006 supersedes the start point in ADR 0003; the five-day, one-project, export/print lock and read-only retention terms stand.

## v0.15.0 — ESTIMETR Manual Take-off with Evidence — 2026-08-23

Made the third workflow stage real: quantities can be entered by hand against a closed unit set, summed as scaled integers so no decimal drift reaches a bill of quantities, and confirmed only after at least one evidence reference states where the measurement came from. A confirmed line is locked, closing a run stores a fingerprint of the confirmed lines only, and every read and write is scoped through `projects.organization_id` because the take-off tables carry no organization column of their own.

## v0.14.0 — ESTIMETR Project Lifecycle — 2026-08-23

Turned ESTIMETR from a demo workspace into an application that creates and opens real projects. ESTIMETR now owns `/apps/estimeter` with its own guard, all project reads are organization-scoped so an id from another organization returns nothing, and the one-project trial cap is enforced inside the write transaction under an organization row lock rather than by disabling a button. The root `todo.md` was retired into the roadmap.

## v0.13.0 — ESTIMETR Entitlement Runtime and Source Line Reconciliation — 2026-08-23

Merged the ESTIMETR workspace line back together with the intake abuse-control line, keeping the session guard on `/apps/[slug]`, and replaced the unused entitlement module with an enforced runtime: ESTIMETR is registered in `apps`, the five-day one-project trial is issued from `users.created_at` with an audit event, and every mutating control in the workspace is gated by a capability set decided on the server.

## v0.12.3 — Full Source Repository Verification — 2026-08-22

Verified that the private GitHub repository tracks editable source only, excludes build artifacts and provides a source-map/continuation guide for future development.

## v0.12.2 — Landing Interaction Contracts and Button Audit — 2026-08-22

Added a single tested interaction contract for Landing buttons/links and manually audited navigation, app entry locks, Login preview feedback, Roadmap refresh and enterprise form availability.

## v0.12.1 — Concise Landing Copy and In-App Trial Details — 2026-08-22

Reduced public Landing copy, removed Market/internal capability wording, renamed the first category to หมวดประมาณราคา and moved trial entitlement information into ESTIMETR.

## v0.12.0 — Civil Apps Market and App Detail Routes — 2026-08-22

Reworked the Landing into a direct category-to-app marketplace: each approved work category immediately shows its related app card. Added an honest detail route before workspace entry, with five-day ESTIMETR trial messaging and no numeric commercial price.

## v0.11.2 — Vercel Private Preview Verified — 2026-08-22

Verified that the private-repository preview is READY after commit attribution was aligned with the confirmed GitHub account. No product behavior changed in this release.

## v0.11.1 — Vercel Private Git Commit Attribution Recovery — 2026-08-22

Configured the repository-local Git author with the user-confirmed GitHub email after Vercel blocked the first private-repository preview for unrecognized commit attribution. This release triggers a replacement preview; no product behavior changes.

## v0.11.0 — ESTIMETR Guided Assistant and Strict Release Gates — 2026-08-22

Added a deterministic in-workspace assistant for Beginner/Fast guidance and made the ESTIMETR demo enforce explicit project-path, scale, evidence, price-set and document-release gates. The release records provenance and form-baseline policy but does not create real prices or export files.

## v0.10.2 — ESTIMETR GitHub Release Confirmation — 2026-08-22

Confirmed the ESTIMETR workspace source has been committed, pushed to GitHub and tagged under the project’s release rules. No product behavior changed.

## v0.10.1 — ESTIMETR Public Pilot Verification — 2026-08-22

Recorded a successful public Vercel review of the ESTIMETR workspace, Landing and Roadmap/Handoff routes after the v0.10.0 workspace release. This release changes no product behavior.

## v0.10.0 — ESTIMETR Traceable BOQ Estimation Workspace — 2026-08-22

Replaced the ESTIMETR placeholder with an interactive four-stage workspace for drawing review, quantity take-off, unit-cost estimation and BOQ readiness. The pilot clearly separates evidence, quantities, price-source readiness and document approval from live production data.

## v0.9.2 — ESTIMETR Estimation Terminology — 2026-08-22

Replaced the user-facing term “ผูกราคา” with “ประมาณราคา” across the ESTIMETR workflow and app registry.

## v0.9.1 — NM Brand and Badge Public Review Verification — 2026-08-22

Recorded a public Vercel desktop review confirming the wordmark, hero line-art and visible product badges render through the visual asset proxy.

## v0.9.0 — NM Brand Composition and Engineering App Badges — 2026-08-22

Applied the approved NM wordmark and engineering line-art layout to the shared platform, and replaced generic-looking icon treatments with a coherent set of civil-engineering product badges.

## v0.8.0 — Dedicated Enterprise Quotation Page — 2026-08-22

Moved the enterprise quotation form out of Landing to `/enterprise`, leaving Landing focused on product discovery and platform workflow.

## v0.7.1 — Light Teal Active Navigation — 2026-08-22

Restored the active navigation treatment to a light translucent teal surface while preserving the restrained tactile press/release behavior.

## v0.7.0 — Tactile Engineering Navigation — 2026-08-22

Added restrained press/release feedback and anchor-aware active tones for navigation pills. Active state now communicates the selected work context without decorative motion.

## v0.6.1 — Navigation Button Hierarchy — 2026-08-22

Restyled every sticky navigation item as an accessible pill button. The enterprise quotation shortcut remains the orange primary action.

## v0.6.0 — Sticky Enterprise Navigation — 2026-08-22

Made platform navigation sticky and added direct routes to apps, Hermes, Roadmap/Handoff and the enterprise quotation section. Mobile now retains these links in a horizontally scrollable navigation row. Updated the retaining-wall card as **Retaining Wall Cantilever** with a concise Bisection Algorithm optimization description.

## v0.5.1 — Public Motion Review Verified — 2026-08-22

Recorded successful public Vercel review of the Landing motion release, ESTIMETR app shell and Roadmap/Handoff route. No runtime behavior changed in this verification release.

## v0.5.0 — Responsive Engineering Motion System — 2026-08-22

Added purposeful Landing feedback: hero blueprint signals, reveal-on-scroll, mouse-only card spotlight/tilt, Hermes attention response and form focus lift. The implementation honors reduced-motion and touch constraints.

## v0.4.3 — Public Pilot Visual Asset Availability — 2026-08-22

Fixed Vercel pilot icon rendering by making the visual asset proxy use public presentation CDN URLs until the production Cloudflare R2/CDN origin is configured. The production switch remains controlled by `VISUAL_ASSET_ORIGIN`.

## v0.4.2 — Vercel Native Output Compatibility — 2026-08-22

Fixed Vercel deployment compatibility by making `output: standalone` conditional on `DEPLOY_TARGET=hostinger`. Vercel pilot deployments now use the framework-native Next.js output while the same source remains ready for a standalone Hostinger Docker build.

## v0.4.1 — Vercel Auth-Safe Pilot Build — 2026-08-22

Fixed Vercel build-time failure caused by eager Better Auth database initialization. The auth route now imports the database-backed runtime only when required environment values exist, and Landing shows a safe sign-in preview state until real authentication infrastructure is configured.

## v0.4.0 — Unified App Shell and Interactive Landing System — 2026-08-22

Added original per-app icon graphics, a visual asset proxy, micro-interaction patterns, shared PlatformNav/PlatformFooter/AppShell components, and the platform UI system specification. Corrected RCOPT’s user-facing name to กำแพงกันดิน.

## v0.3.0 — Interactive Landing and Source Status Console — 2026-08-22

Created full editable Next.js scaffold with Landing app registry, SVG icon system, Hermes pilot disclosure, ESTIMETR trial interaction preview, enterprise quotation intake and runtime Roadmap/Handoff HTML console. This version adds consistent title, description, scope, verification and rollback metadata to the active roadmap source.

## v0.2.0 — 2026-08-22

Accepted ADRs for portable pilot/production deployment, PostgreSQL/R2 data boundary, membership entitlement/trial retention, Hermes pilot isolation and enterprise quotation intake. Added logical PostgreSQL data model and runtime architecture.

## v0.1.0 — 2026-08-22

Created Initial Project governance roadmap with confirmed product scope, deployment portability, Hermes pilot boundary and implementation milestones.
