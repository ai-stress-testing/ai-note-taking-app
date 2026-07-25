# Changelog & versioning

## Problem

`package.json` has `"private": true` and **no `version` field**, and there
is no `CHANGELOG.md`. Nothing records what changed between states of the
app or gives a shared vocabulary ("we're on 0.4.0") to reason about
compatibility. Issue #2: without a versioning scheme, larger overhauls
(store migrations, sync-schema changes, backend schema) become "dicey" —
there is no anchor to say what a change is compatible with or when a
migration boundary was crossed.

Who hits this: the maintainer planning a non-trivial change (this backlog
is full of store/schema-touching features), and any future contributor
trying to understand history.

## Requirements

- R1. Adopt semantic versioning (`MAJOR.MINOR.PATCH`) for the app and set
  an explicit starting `version` in `package.json`.
- R2. Add a `CHANGELOG.md` following the Keep a Changelog format
  (Unreleased section + dated released sections; Added/Changed/Fixed/
  Removed groupings).
- R3. A lightweight, written convention for _when and how_ an entry is
  added (per user-facing change; where the store `version`/`migrate` and
  `sync-schema` bumps get called out — those are the "dicey overhaul"
  boundaries #2 is worried about).
- R4. Tie the app version to the persistence boundaries already in the
  code: the zustand `persist` `version` (currently 5) and the sync-schema
  shape. The changelog must note when either changes.
- R5. (Optional, if a natural spot exists) surface the current version
  in-app — e.g. a small version string in Settings — read from a single
  source of truth, not duplicated.

## Non-goals

- Release-automation tooling (semantic-release, changesets, CI tagging).
  YAGNI for a local-first single-maintainer app; revisit only if release
  cadence justifies it.
- Git tag / GitHub Release process design (can follow the convention
  later; not required to start).
- Retroactively reconstructing a precise history of every past change —
  seed the changelog from the current known state forward.

## Edge cases

- A change that bumps the persisted store `version` or `sync-schema` but
  is otherwise invisible to the user still needs a changelog entry (it's a
  compatibility boundary).
- Docs-only or spec-only changes: allowed to be omitted or grouped, per
  the convention — the changelog tracks the app, not the repo's every file.
