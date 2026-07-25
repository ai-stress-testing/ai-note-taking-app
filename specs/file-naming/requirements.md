# File naming: stable id + user-defined name

## Problem

New files are auto-named by position: `createFile` (`src/lib/store.ts`)
sets `name = \`${folderName}-${count}.md\``where`count` is the current
number of files in the folder + 1. Two problems:

1. **Collision / drift after deletion.** `count` is derived from the
   current file count, so deleting a file and creating another can reuse a
   name (`notes-3.md` twice) — the display name is not unique and doesn't
   track the file's identity.
2. **No obvious user-defined naming.** A `renameFile` action exists in the
   store, but the issue (#15) reports files are just "named after their
   place in the stack" — i.e. the rename affordance isn't discoverable/
   present in the UI, so users are stuck with positional names.

Files DO already have a stable unique `id` (`file-${uid()}`) — that part of
#15 ("unique identifier") is satisfied by the data model; the gap is that
the _name_ is neither reliably unique nor easily user-set.

## Requirements

- R1. Every file keeps its existing stable, unique `id` (already true —
  verify and reuse; do NOT introduce a second identifier).
- R2. A user can set and change a file's display name from the UI via a
  discoverable inline affordance (e.g. rename in the sidebar / double-click
  to edit), backed by the existing `renameFile` action.
- R3. The default name for a new file does not collide with an existing
  file's name in the same folder, even after deletions (monotonic or
  id-suffixed default, not a reused positional count).
- R4. Renames persist and sync: `name` already flows through sync
  encrypted; a rename updates `updatedAt` for last-write-wins (verify
  `renameFile` does this).
- R5. Empty/whitespace names are rejected (fall back to the default or keep
  the prior name), matching how other named entities behave.

## Non-goals

- Enforcing globally unique names across folders (uniqueness is per-folder
  for the default; users may intentionally name two files the same).
- A file-metadata panel or tags/titles beyond the name.
- Changing the `id` scheme or exposing ids in the UI.
- Slugifying / filename-sanitizing for export beyond what already happens
  (export uses `name` as the download filename — note but don't expand
  scope).

## Edge cases

- Deleting `notes-2.md` then creating a new file must not produce a second
  `notes-2.md`.
- Renaming to a name another file already has in the same folder: allowed
  (R-non-goal), but the default generator must still avoid producing
  collisions on its own.
- Renaming to empty → rejected, prior name retained.
- Very long names — truncate in display, store full (or cap length);
  decide in design.
