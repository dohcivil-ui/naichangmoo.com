# Agent Instructions — นายช่างหมู

Read `PROJECT.md`, `CONTEXT.md`, `docs/roadmap/roadmap.json` and the latest file in `docs/handoff/` before changing source code.

## Required workflow

1. Run `/grill-with-docs` before touching source code for new work, and continue until the question frontier is empty. "It is a small change" is not a reason to skip. Skip only for a typo, a constant whose source is already recorded, or a fix that introduces no new term and no new decision. When you skip, state the reason on the first line of the handoff note.
2. Work on the single trunk branch. A short-lived branch is allowed only when the work must be kept apart, and it is merged and deleted in the same session — side branches left open are how the release ladder came apart before.
3. Add the work as an unchecked roadmap item before implementation.
4. Update the versioned roadmap and the `roadmap.json` pointer before every commit. Both must include a title, description, scope, verification and rollback that align with the tag and handoff.
5. Use an ADR only for difficult-to-reverse decisions with real trade-offs. Run the ADR command instructions in `.agent/commands/adr.md`.
6. Run the quality gate required by the changed code before committing.
7. After every commit, add a dated handoff note that states changed files, verification, risk, rollback and next action.
8. Close every version with `pnpm release`, which tags, pushes and publishes the GitHub Release together. A GitHub Release is not the same object as a tag; publishing only the tag is what left the repository showing a release twenty-five versions old.

## Safety rules

- Never read, print, commit or expose `.env*`, R2 credentials, OAuth provider credentials, Stripe secrets, production data, signed URLs or customer drawing files.
- Hermes is an untrusted execution boundary. It only receives typed review jobs and has no direct database, Stripe or infrastructure secrets.
- Do not make a customer-visible or irreversible change without an explicit user authorization recorded in an approval/audit record.
- Prefer server-side authorization checks over hiding UI controls.

## Browser control

- Drive the browser only through the `chrome-devtools` MCP server. Do not write a throwaway Puppeteer or Playwright script to automate a page.
- Call `take_snapshot` before every `click` or `fill`. Element uids come from the most recent snapshot and go stale after a navigation.
- On a login page, navigate to it and then stop. Tell the user the Chrome window is open and waiting, ask them to type the credentials themselves, and wait for their confirmation before continuing.
- Never read `.env*` to obtain a credential and type it into `fill` or `fill_form`. This is the first Safety rule applied to the browser.
- Chrome keeps a persistent profile at `~/.cache/chrome-devtools-mcp/chrome-profile`, so a login survives across sessions. When a session expires, ask the user to log in again instead of working around it.

## Design rules

- The UI must remain an engineering tool: one work objective, a short form, validation close to input, visible calculation/evidence and one primary action per state.
- Use source-controlled SVG symbols for UI iconography. Do not use emoji, stock hero images, copied competitor assets or fabricated user content.
- Avoid generic dashboards and decorative cards. Any component must earn its place by helping a user progress through the workflow.

## Planning skills

Three skills from `mattpocock/skills` are installed in `.claude/skills/` and pinned by `skills-lock.json`: `grill-with-docs`, `grilling` and `domain-modeling`. They are committed as real files, not symlinks, because this repository runs with `core.symlinks=false`.

- `grill-with-docs` is one line that calls `grilling` and `domain-modeling`. All three must load. If a session asks every question at once with no recommended answer, or never touches `CONTEXT.md`, the dependencies did not load: say so and restart the session instead of continuing.
- **ADR format is the project's, not the skill's.** Write every ADR with `.agent/commands/adr.md`: the full template (Status / Context / Decision / Alternatives considered / Consequences), `NNNN-slug` numbering, plus the roadmap and handoff references required by steps 4 and 7. Ignore `.claude/skills/domain-modeling/ADR-FORMAT.md`, which specifies a one-paragraph form. The skill's three gates for *whether* a decision deserves an ADR still apply: hard to reverse, surprising without context, a real trade-off.
- `CONTEXT.md` is a glossary and nothing else. No specification, no implementation detail, no session notes. Terms land in it the moment they resolve, not in a batch at the end.
- Do not edit anything under `.claude/skills/**`. Their hashes are recorded in `skills-lock.json`, and a local edit makes `npx skills update` report drift forever. Every project-specific override belongs in this file.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
