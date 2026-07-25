# File naming — design

## Approach

Small, two-part change: fix the default-name generator, and surface the
existing rename action.

**1. Collision-safe default name.** Replace the `count = (files in folder)

- 1`scheme in`createFile` with one that can't reuse a name after
  deletion. Options (design picks one):

* **Monotonic per-folder counter**: a `fileSeq` (or per-folder next-index)
  persisted in the store, incremented on create, never reused. Deterministic
  human names (`notes-4.md`) that keep climbing.
* **Uniqueness-checked default**: generate `${prefix}-${n}.md`, incrementing
  `n` until no file in the folder has that name. No new persisted state;
  O(files) per create (trivially cheap here).

Recommended: the **uniqueness-checked** default — zero new state, satisfies
R3, and reads naturally. `createFile` loops `n` from `files_in_folder+1`
upward until the name is free.

**2. Discoverable rename UI.** `renameFile` already exists and sets
`updatedAt`. The gap is UI. Add an inline rename in `Sidebar.tsx`: the file
row's name becomes editable (double-click, or a small ✎ affordance
consistent with the folder-rename UI already there from the folder-CRUD
work). On commit, call `renameFile`; empty/whitespace → revert to prior
name (R5). This reuses the folder-rename interaction pattern already in the
sidebar rather than inventing a new one.

## Data model changes

- None required for the recommended (uniqueness-checked) default — no new
  fields. If the monotonic alternative is chosen instead, add a persisted
  counter + a `migrate` bump (call out in the changelog per
  `specs/changelog-versioning/`).
- `id` and `renameFile` unchanged (reused, R1/R4).

## Alternatives considered

- **Add a separate `title` field distinct from `name`.** Rejected as
  YAGNI: `name` already serves as the user-facing title and the export
  filename; a second field is two sources of truth.
- **UUID-only names, hide the pretty name.** Rejected: users want readable,
  editable names (R2); the id already provides stable identity underneath.
- **Global name uniqueness.** Rejected (non-goal): per-folder default
  uniqueness is enough; forcing cross-folder uniqueness surprises users.

## Open questions

- Monotonic counter vs uniqueness-checked default — design leans
  uniqueness-checked (no migration); confirm at implementation.
- Rename affordance detail (double-click vs explicit icon) — match whatever
  the existing folder-rename uses for consistency.
- Name length cap (display truncation vs hard limit) — pick a sane cap
  (e.g. 120 chars) at implementation.
