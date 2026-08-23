# Civil Apps Market — Product Blueprint

## Purpose

`naichangmoo.com` is the shared marketplace and trusted entry point for the นายช่างหมู platform. It must help any visitor identify the relevant civil-engineering tool, understand whether it can be used now, learn what the app solves, and begin the appropriate access journey without ambiguous pricing, false availability claims, or a crowded AI-dashboard interface.

The marketplace does not replace the working application. It sits before the application as a structured decision surface: **choose work → inspect app → understand access → start appropriately → work in the app**.

## Confirmed Decisions

| Decision | Approved direction |
|---|---|
| Catalog scope | Show all four applications in one market. |
| Discovery model | Present work categories first and retain each application’s own name in the catalog. |
| Commercial message | Do not display numeric package pricing. Present **ทดลองใช้ฟรี 5 วัน** for ESTIMETR; preserve truthful access labels for other apps. |
| Audience | Serve any user; do not gate the landing message to a single profession or organization. |
| App education | Every application receives a detail experience before the user enters its workspace. |
| Product integrity | Never make a coming-soon, restricted, or non-persistent feature appear immediately usable or production-certified. |

## Marketplace Information Architecture

### 1. Persistent platform navigation

The top navigation remains a compact platform-wide escape route. It must expose the market, how the platform works, organization quotation request, and sign-in without overwhelming the work-oriented flow.

### 2. Work-category sections

The market is a short sequence of work-category sections, not a wall of application logos and not a launcher that adds a separate selection step. Every section places the related application card immediately beneath its category heading. A visitor sees the category, the application name, the job outcome, the access state and the action in one reading path.

| Work category | App | Truthful availability |
|---|---|---|
| ประมาณราคางานอาคาร | ESTIMETR | Available with a free 5-day trial; the current pilot must retain actual entitlement limits elsewhere in the product. |
| หมวดงานออกแบบวิศวกรรมโยธา | Retaining Wall Cantilever | Member free; coming soon until the rewritten app is ready. |
| หมวดงานอุปกรณ์อำนวยความปลอดภัย | TRAFFIC SIGN | Member free; coming soon until the rewritten app is ready. |
| หมวดงานสำนักจัดกรรมสิทธิ์ที่ดิน | LAND ACQUISITION V2 | Restricted to authorized Department of Highways staff. |

### 3. Application catalog

Cards are grouped and rendered immediately under their related work category. Every card must show: application name, one-sentence job outcome, access label, availability state, a specific engineering graphic, and a single appropriate primary action. The initial release must not require filtering, a category launcher, a search query or a second discovery step to reveal the card.

### 4. App-detail route

The dedicated market detail route is proposed as `/market/[slug]`, separate from the execution route `/apps/[slug]`. The detail surface provides:

| Detail section | User question answered |
|---|---|
| Job outcome | “What job does this solve?” |
| Guided flow | “What happens after I begin?” |
| What to prepare | “What files, inputs, or permissions do I need?” |
| Access and availability | “Can I use it now, and under what entitlement?” |
| Primary action | “Do I start, sign in, request access, or return later?” |

### 5. Trust and transition sections

The landing supports conversion with a short, factual explanation of the single-account platform, trial policy, guided ESTIMETR workflow, organization quotation route, and Hermes advisory boundary. It must not imitate a generic SaaS pricing page or imply that AI can certify engineering output.

## Interaction and Content Rules

The market should feel like a clean engineering instrument: restrained motion, tactile press feedback, high-contrast action states, keyboard-accessible controls and responsive layouts. Work-category sections remain visible and cards remain directly below their corresponding heading; no filter, launcher or hidden-category state is permitted. The mobile version must stack category sections and cards while preserving readable app actions without horizontal clipping.

The key conversion phrase is **“ทดลองใช้ฟรี 5 วัน”**. It must not introduce a numeric price, fabricated testimonials, ratings, usage metrics, customer logos, or claims of final document compliance.

## Acceptance Criteria for the First Market Release

| Criterion | Acceptance condition |
|---|---|
| Work-first discovery | A visitor sees the matching application card immediately below each work-category heading without knowing its name or making an extra selection. |
| Complete but honest catalog | All four apps are visible and each displays its real availability/access state. |
| Detail before execution | A market detail page/panel is reachable from every catalog card before the workspace route. |
| Clear trial message | ESTIMETR communicates only the approved free 5-day trial message; there is no numeric package price. |
| Responsive usability | Desktop and mobile layouts maintain readable categories, cards, buttons, navigation and focus states. |
| No false product claim | Coming-soon/restricted states cannot be mistaken for live workspaces; no real price data/export certification is claimed. |
