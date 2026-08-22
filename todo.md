# Project TODO

- [x] Update RCOPT product name to กำแพงกันดิน across Landing, registry and handoff metadata.
- [x] Replace generic line icons with original app-card icon graphics aligned to the NaiChangMoo visual system.
- [x] Add accessible micro-interactions for hover, focus, click and scroll-in-view without obstructing engineering workflow.
- [x] Create a shared platform design system and app shell so every page and app uses the same navigation, layout, card, form, status, motion and responsive conventions.
- [x] Update roadmap v0.4.0, handoff, verification and rollback metadata before committing the visual interaction milestone.
- [x] Run lint, tests, typecheck, production build, security preflight and browser verification.
- [x] Commit, annotate a semantic Git tag, and push the full source milestone to GitHub.
- [ ] Diagnose inaccessible temporary preview and provide a user-accessible review channel with a verified URL.
- [ ] Inspect Vercel integration and prepare a Vercel pilot deployment for the source branch with no production secrets.
- [ ] Verify public Landing, app routes, Roadmap/Handoff and safe asset handling on the Vercel review URL.
- [x] Fix Vercel build failure caused by eager Better Auth database initialization when DATABASE_URL is absent in pilot preview.
- [ ] Add safe preview sign-in state, run quality gate, version the fix, deploy to Vercel and verify all review routes.
- [ ] Remove or bypass Vercel Authentication for the credential-less pilot preview and verify public review access without a Vercel login.
- [ ] Replace the sandbox-only visual asset origin with a public pilot-safe asset origin, then verify all app-card and Hermes icon graphics on Vercel.
