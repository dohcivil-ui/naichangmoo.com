# Handoff — v0.7.0: Tactile Engineering Navigation

## Description

Navigation now behaves like a restrained engineering-tool control: press briefly compresses the pill, release settles it back, and the selected section receives a darker active tone. The motion is short, interruptible and semantic rather than decorative.

## Changed Scope

| Area | File | Summary |
|---|---|---|
| Active context | `src/components/platform/platform-nav.tsx` | Uses `usePathname` and IntersectionObserver to reflect the active Landing section; Roadmap receives route-aware state |
| Tactile response | `src/app/globals.css` | Adds pressed scale, a short settle keyframe, ink/dark-orange active tones and active focus/hover behavior |
| Accessibility | `src/components/platform/platform-nav.tsx`, `src/app/globals.css` | Preserves native Link navigation, `aria-current`, focus-visible outline and existing reduced-motion rules |
| Release metadata | `package.json`, `docs/roadmap/*` | Adds v0.7.0 title, scope, verification and rollback metadata |

## Verification

Lint, six unit tests and typecheck pass. Final production build, security preflight, roadmap validation and public Vercel review remain required before release.

## Rollback

Return to tag `v0.6.1-navigation-pills`. No data, route, entitlement or auth behavior changes.

## Next Action

Complete final quality gate, deploy to Vercel, verify active/pressed navigation behavior, and deliver the public test link.
