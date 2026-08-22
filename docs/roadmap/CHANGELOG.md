# Roadmap Changelog

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
