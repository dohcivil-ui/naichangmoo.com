# Landing Interaction Audit — 2026-08-22

## Objective

Verify that every public interaction reachable from the Landing has an intentional destination or state, and that app readiness rules prevent a visitor from accidentally entering an unavailable or restricted workspace.

## Manual interaction results

| Interaction | Expected behavior | Result |
|---|---|---|
| Brand wordmark | Returns to `/` | Passed from the enterprise page. |
| แอปของเรา | Returns to `/#apps` | Passed from an app-detail page. |
| Hermes 24/7 | Scrolls to `/#hermes` | Passed. |
| สถานะโครงการ | Opens `/roadmap` | Passed; Refresh สถานะ updated the runtime timestamp. |
| ขอใบเสนอราคา | Opens `/enterprise` | Passed; all form fields and consent control are present. Submission was intentionally not triggered because it sends a real organization request. |
| Login, preview mode | Announces `กำลังเตรียมระบบเข้าสู่ระบบ` instead of acting as a dead button | Passed. |
| ESTIMETR card | Opens `/market/estimeter` | Passed. |
| ESTIMETR entry | Opens `/apps/estimeter` | Passed. |
| Retaining Wall card | Opens detail only; no workspace entry | Passed. |
| Traffic Sign card | Opens detail only; no workspace entry | Passed. |
| Land Acquisition card | Opens detail only; no workspace entry | Passed. |
| Detail back action | Returns to `/#apps` | Passed from multiple app-detail routes. |
| Footer Roadmap & Handoff | Points to `/roadmap` through the shared action contract | Covered by the interaction contract test. |

## Automated guardrails

`src/lib/landing-interactions.ts` is the single source of truth for brand/home, hero catalog, primary navigation, app-detail, app-entry and Login contracts. `src/lib/landing-interactions.test.ts` verifies the approved primary routes, requires every registered app to expose a detail route, permits workspace entry only when app status is `available`, and checks both preview Login and configured Google Login behavior.

The UI components for navigation, hero action, app cards, app-detail entry, footer and SignInButton consume this contract rather than duplicating route strings. This makes route or readiness changes fail unit tests before release.

## Login boundary

The private Vercel pilot intentionally runs without `DATABASE_URL`, Better Auth runtime secrets or Google OAuth credentials. Therefore Login is **not a live identity flow in preview**; it is an explicit preview-safe status button. When production authentication is enabled, the same tested contract invokes Google sign-in and returns to `/apps/estimeter`. This release does not claim otherwise.
