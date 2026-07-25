# Changelog & versioning — design

## Approach

Two files and one convention, no tooling:

1. **`package.json` `version`.** Set a starting version. The app has a
   shipped backend, sync, and FSRS but is pre-1.0 in stability posture →
   start at **`0.4.0`** (reflecting the four feature eras already in
   history: editor, backend+sync, FSRS, privacy/analytics). `private`
   stays `true`.

2. **`CHANGELOG.md`** at repo root, Keep a Changelog format. Seed an
   `## [Unreleased]` section and one dated `## [0.4.0] - <date>` section
   summarizing the current shipped state at a high level (editor + slash
   commands, local-only AI pipeline, encrypted SQLite sync, FSRS review,
   analytics, Docker). Entries grouped Added/Changed/Fixed/Removed.

3. **Convention** (documented in `CONTRIBUTING`-style note inside
   `CHANGELOG.md`'s header or `CLAUDE.md`): every user-facing change adds a
   line under `[Unreleased]`; a change that bumps the persisted store
   `version` (`src/lib/store.ts`) or alters `src/lib/sync-schema.ts` MUST
   add a **Changed** entry naming the migration boundary, since those are
   the compatibility-critical edits #2 exists to track. On release, the
   `[Unreleased]` block is retitled with the new version + date and
   `package.json` bumped by the same semver rule (schema/migration break →
   at least MINOR pre-1.0; data-loss-capable break → MAJOR once 1.0).

4. **In-app version (optional).** Vite can inject `package.json` version at
   build via `define` (e.g. `__APP_VERSION__`) or import of the version
   field; render it as a small muted string in the Settings modal footer.
   Single source of truth = `package.json`. Only add if it stays a
   one-liner; otherwise defer (R5 is optional).

## Data model changes

None. `package.json` gains a `version` field; no runtime store/schema
change. (The *convention* references the existing store `version`/`migrate`
and `sync-schema`, but adds nothing to them.)

## Alternatives considered

- **changesets / semantic-release.** Rejected (non-goal): automation
  overhead unjustified for a single-maintainer local-first app.
- **Date-based (CalVer).** Rejected: SemVer communicates *compatibility*,
  which is exactly what the store-migration/sync-schema concern needs;
  CalVer communicates recency, which the changelog dates already give.
- **Version derived from git tags at build.** Rejected for now: adds a
  build-time git dependency; `package.json` as the single source is
  simpler and works in the Docker build stage.

## Open questions

- Exact starting number (0.4.0 vs 0.1.0) — a labeling call, not
  structural; 0.4.0 chosen to reflect real shipped surface area.
- Whether to also document a git-tag/release step now or leave it to the
  convention header until a release actually happens (leaning: leave it).
