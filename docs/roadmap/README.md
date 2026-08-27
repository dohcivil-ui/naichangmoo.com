# Roadmap Versioning

`roadmap.json` is the current pointer. Every material roadmap change creates a new immutable version file named `roadmap.v<semantic-version>.json`, then copies the same content into `roadmap.json` and adds an entry to `CHANGELOG.md`.

Update the roadmap **before every commit**. The pre-commit hook verifies the current pointer has a version, timestamp and item list. Enable the hook after installing dependencies with:

```bash
node scripts/setup-git-hooks.mjs
```

Do not edit an existing versioned roadmap file after it is committed; create a new version instead.

## The `app` field (since v0.66.0)

Every item carries an `app` key naming which app or platform area it belongs to, so `/roadmap` can
group progress per app the way the owner reads it. Valid values are the group keys in
`src/lib/roadmap-groups.ts` (app slugs plus `landing`, `deploy`, `hermes`, `platform`). A new item
must state its `app`; an item without one, or with an unknown value, is shown under the platform
group rather than dropped. Item statuses are updated at each release as part of the closing ritual
(roadmap bump + CHANGELOG + commit + tag + GitHub Release) — that ritual is what keeps the per-app
status page current, so there is no separate tracker to maintain.
