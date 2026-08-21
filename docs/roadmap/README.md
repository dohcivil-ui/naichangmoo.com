# Roadmap Versioning

`roadmap.json` is the current pointer. Every material roadmap change creates a new immutable version file named `roadmap.v<semantic-version>.json`, then copies the same content into `roadmap.json` and adds an entry to `CHANGELOG.md`.

Update the roadmap **before every commit**. The pre-commit hook verifies the current pointer has a version, timestamp and item list. Enable the hook after installing dependencies with:

```bash
node scripts/setup-git-hooks.mjs
```

Do not edit an existing versioned roadmap file after it is committed; create a new version instead.
