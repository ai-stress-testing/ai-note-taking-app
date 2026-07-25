# File naming — tasks

- [ ] Confirm files already carry a stable unique `id` (`file-${uid()}`)
      and reuse it — no second identifier (R1).
- [ ] Fix `createFile` default naming (`src/lib/store.ts`): generate
      `${prefix}-${n}.md`, incrementing `n` until the name is free in that
      folder, so deletions can't cause a reused name (R3).
- [ ] Add discoverable inline rename in `src/components/Sidebar.tsx`,
      reusing the folder-rename interaction pattern; commit via
      `renameFile`; empty/whitespace reverts to prior name (R5).
- [ ] Confirm `renameFile` sets `updatedAt` (sync LWW) — add if missing.
- [ ] Browser check: create several files, delete one, create again →
      no duplicate default name; rename a file and reload → name persists.
- [ ] `bun run lint` clean.
