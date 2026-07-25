# Changelog & versioning — tasks

- [ ] Add `"version": "0.4.0"` to `package.json` (keep `"private": true`).
- [ ] Create `CHANGELOG.md` (Keep a Changelog): `[Unreleased]` + a dated
      `[0.4.0]` section summarizing the current shipped surface.
- [ ] Add the entry convention (header in `CHANGELOG.md` + a line in
      `CLAUDE.md`): every user-facing change → `[Unreleased]`; any store
      `version`/`migrate` or `sync-schema` change → an explicit **Changed**
      entry naming the migration boundary.
- [ ] (Optional) Inject `package.json` version at build (Vite `define`
      `__APP_VERSION__`) and show it as a muted string in the Settings
      footer; single source of truth = `package.json`.
- [ ] Verify build still succeeds with the injected define (if added).
