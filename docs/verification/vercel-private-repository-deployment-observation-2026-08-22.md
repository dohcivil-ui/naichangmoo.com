# Vercel Private Repository Deployment Observation — 2026-08-22

## Observed state

After `feature/estimeter-guided-assistant` commit `7f6287f4128a1a3c9c9c6eaac1076291f1fb90c1` was pushed to the now-private GitHub repository, Vercel created deployment `dpl_13x7A9yqRobTTVWHXkndELvoCox4` with preview URL `https://naichangmoo-9l37earps-suriya-patchotchais-projects.vercel.app`.

The Vercel deployment listing reports the state as **`BLOCKED`**. Its metadata correctly identifies the branch, commit and repository visibility as `private`. No causal build log has been reviewed yet, so this record does not attribute the block to a specific configuration or permission issue.

## Recovery outcome

The replacement deployment `dpl_AHqJaJbZAJNt38LwKCzh7FFp4BxV` reached **`READY`** after the follow-up commit `285abcb` used the user-confirmed GitHub email. Its preview URL is `https://naichangmoo-liq29gbpn-suriya-patchotchais-projects.vercel.app` and its metadata identifies GitHub login `dohcivil-ui`.

The originally blocked deployment remains a historical failure record. The `READY` preview is the only Vercel link that may be described as containing the Guided AI Assistant source.
