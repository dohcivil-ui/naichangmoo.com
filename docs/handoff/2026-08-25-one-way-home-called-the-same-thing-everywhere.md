# Handoff — `v0.42.0: One Way Home, Called the Same Thing Everywhere`

## Description

The owner reported that after moving to another page there was no shortcut back to the home page.
Investigating it found something more specific than a missing button.

**There was a button on almost every page — the logo.** `PlatformNav` has always wrapped
`<BrandLogo />` in a `<Link href="/">`. But nothing on screen ever said *home*: the top bar's five
pills were `แอปของเรา` · `Hermes 24/7` · `ราคา` · `สถานะโครงการ` · `ขอใบเสนอราคา`, and a visitor had
to already know a logo is clickable.

Three layers, all now closed:

1. **Nothing was labelled `หน้าแรก`.** On `/pricing`, `/enterprise` and `/account` the logo was the
   only way back.
2. **`/roadmap` had no header at all** — the only page in the product without one, and linked from
   the footer of every other page, so it was the easiest place to land and the hardest to leave.
3. **One destination, five names**, spread over two destinations: `กลับหน้ารวมแอป` ·
   `กลับหน้า Landing` · `กลับหน้าแรก` · `ดูเว็บไซต์` · `กลับไปดูทุกแอป`/`แอปทั้งหมด`, across `/`
   and `/#apps`. Each page that needed a way back had typed its own, and nothing could tell that
   the sixth one was a sixth one.

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Nav | `src/lib/landing-interactions.ts`, `src/components/platform/platform-nav.tsx` | A sixth pill, `หน้าแรก` → `/`, first; both labels now live beside their hrefs |
| Wording | `market/[slug]`, `apps/[slug]` (×4), `entry-blocked`, `admin/layout` (×2), `account`, `app-shell` | Five labels became two, taken from the contract |
| Roadmap page | `src/app/roadmap/page.tsx`, `globals.css` | Gains `SiteHeader` and `PlatformFooter`; padding moved off `<main>` onto a body wrapper; `.back-link` retired |
| Trust module | `src/lib/business-identity.ts` (new), `platform-footer.tsx`, `globals.css` | A trustmark registry that renders nothing until an issuer grants one |
| Governance | `docs/adr/0016-*.md` | A trustmark is a claim and the issuer owns it |
| Correction | `src/components/platform/app-shell.tsx` | The fourth `seededAccess` claim, missed in v0.41.0 |
| Guard | `src/lib/way-home.test.ts` (new) | Source scan: no retired wording rendered anywhere |

## The trustmark, and why it ships empty

The owner asked for a footer row for an online-shop trustmark, naming **หจก.ไทสกลวิศวกรรม** as the
payee — while also saying the registration has not been done and that the choice between a new
company and trading as a natural person is still open.

**A mark cannot be rendered before an issuer grants it.** That is a false claim of registration, a
legal matter rather than a design one, and not something a later edit undoes — the damage happens
the moment someone reads it and believes it. It is also the same shape this branch spent the day on:
ADR 0015 forbids a card from stating what the registry has not stated; ADR 0016 applies it to an
authority outside the platform.

So `business-identity.ts` ships **populated with the shape and empty of evidence**. A mark renders
only when it carries **both** an issuer-granted number and the issuer's own artwork — one without
the other means we would be supplying the missing half ourselves, and a hand-drawn lookalike is the
same false claim with extra steps. When nothing qualifies the footer renders no row at all, not an
empty bordered strip. Adding a future mark is one array entry and no code.

`businessOperator.publish` is `false`: the legal name is recorded so the decision has something to
switch on, not so the footer prints it today (**IP-127**). No payment is collected anywhere yet in
any case — **IP-081** is still `planned`.

## Found while verifying

**The mobile navigation's horizontal scroller has never worked.**
`.site-nav .nav-links` sets `flex-wrap: wrap` at specificity 0-2-0
([globals.css:47](src/app/globals.css#L47)); the `overflow-x: auto` rule inside
`@media (max-width: 760px)` is only `.nav-links` at 0-1-0, and a media query adds no specificity, so
the wrap rule wins and the scroller is dead. Pre-existing, not introduced here. At 390px all six
pills are visible across two rows, which is arguably better than a scroller with `scrollbar-width:
none` and no affordance — so the behaviour was left alone and the dead rule filed as **IP-125**
rather than changed unasked.

## Verification

- `pnpm test` — 285 pass. New: the nav contract's shape and one-entry-per-destination; a source scan
  over every non-test `.ts`/`.tsx` in `src` proving no retired wording is rendered (comments are
  exempt — that is where the history is kept); and the trustmark rules — no number, no render; no
  artwork, no render; nothing qualifying, no row; today's DBD entry qualifying for none of it.
- `npx tsc --noEmit` clean; `npm run lint` leaves only the pre-existing `thai-baht.test.ts` warning;
  `check-roadmap.mjs` and `security:check` pass.
- In a browser: `/roadmap` now carries header and footer; `หน้าแรก` lights at the top of `/` and
  `สถานะโครงการ` lights on `/roadmap`; six pills fit one line at 1440px and wrap to two at 390px
  with none cut off; `footer__trust` appears in the HTML of no page.

## Security and data impact

None. No migration, no schema change, no write path. The trust module can only ever render less than
it holds.

## Rollback

Revert the commit.

## Next action

1. **The v0.41.0 card work and this are both uncommitted.**
2. **Announce the five apps in the back office** — still outstanding from v0.41.0, still a human act
   under ADR 0014. `rcopt` and `traffic-sign` must be announced with **open = false**.
3. **The cookie notice** — a round of questions was put and not answered: disclosure vs consent
   (the audit says only strictly necessary cookies exist today, so PDPA asks for disclosure), site-wide
   vs landing only, remembered vs shown always, and what it links to given there is no privacy page
   (**IP-110**). The footer now has a place for that link.
4. **IP-114** — `/account` while signed in, and press the sign-out-other-devices button.
