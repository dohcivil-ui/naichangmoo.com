# Full Source Code and Continuation Guide

## Statement of repository contents

The private repository `dohcivil-ui/naichangmoo.com` is the **source of truth**. It contains editable Next.js, TypeScript, CSS, test, database-schema and governance files. A production build is run only as a release validation step; generated outputs are not committed.

The repository `.gitignore` excludes `node_modules/`, `.next/`, `out/`, `coverage/`, `*.tsbuildinfo`, `.env*`, logs, uploads, exports, temporary files and local data. The source audit on 2026-08-22 found no tracked `.next`, `dist`, `build`, `node_modules`, coverage or TypeScript build-information artifacts.

## Where to edit

| Change needed | Primary editable source |
|---|---|
| Landing copy, category order and hero | `src/app/page.tsx` |
| Platform app data, access states and detail content | `src/lib/platform.ts` |
| Landing button destinations and safe Login behavior | `src/lib/landing-interactions.ts` |
| Shared top navigation and footer | `src/components/platform/platform-nav.tsx`, `src/components/platform/platform-footer.tsx` |
| App-card rendering | `src/components/landing/app-card.tsx` |
| App-detail pages | `src/app/market/[slug]/page.tsx` |
| ESTIMETR workspace | `src/components/estimeter/estimation-workspace.tsx` |
| Global visual system and responsive styles | `src/app/globals.css` |
| Database schema boundary | `src/db/schema.ts` |
| Automated checks | `src/**/*.test.ts` |
| Version, roadmap and release handoff | `docs/roadmap/`, `docs/handoff/`, `todo.md` |

## Continue development from GitHub

An authorized developer or AI agent clones the private repository, installs dependencies and works from source:

```bash
git clone https://github.com/dohcivil-ui/naichangmoo.com.git
cd naichangmoo.com
pnpm install --frozen-lockfile
pnpm dev
```

Run the same quality checks before a release:

```bash
pnpm lint
pnpm test
pnpm typecheck
DEPLOY_TARGET=vercel NODE_ENV=production pnpm build
pnpm security:check
node scripts/check-roadmap.mjs
git diff --check
```

`pnpm build` creates a local `.next/` directory for validation or deployment. It remains local and ignored by Git. To change the product, edit the source files above, update tests and roadmap/handoff metadata, commit the source change and tag the release. Never edit a generated build output.

## Credentials and real integrations

Secrets are not stored in Git. Authentication, database, price ingestion, file storage, AI endpoints and payment integration must be configured by environment variables/secrets in the deployment environment. A developer can edit all source behavior, but must not add real keys, customer data, uploaded drawings or price exports to the repository.
