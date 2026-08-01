# /introspection — tasks

> **Sign-off gate:** the recommended Option A **bumps the persisted store
> `version`** (new `introspections` field) — a CLAUDE.md migration-boundary
> changelog gate. Confirm Option A vs B and sync-now-vs-later before landing.

## Data model (Option A)

- [ ] Add `Introspection` type and `introspections: Record<folderId,
Introspection[]>` to `src/lib/store.ts`, with `addIntrospection(
folderId, text)` (+ optional `deleteIntrospection`).
- [ ] Add `introspections` to `partialize`; drop a folder's introspections in
      `deleteFolder` cleanup.
- [ ] Bump the persisted store `version`; add a `migrate` default
      (`s.introspections ??= {}`).

## Command + capture (AI-free — R7)

- [ ] Add `/introspection` `CommandDef` (`localHint: "introspection"`) in
      `src/lib/commands.ts`.
- [ ] `case "introspection"` in `executeCommand`: with args →
      `addIntrospection(activeFile.folderId, args)`, echo a confirming line +
      toast, no AI. Empty + none stored → "write one first" notice.

## /start integration (graceful — R2/R5)

- [ ] Extend `session:start`: after the `[start …]` insert, read
      `introspections[activeFile.folderId]`. Empty → do nothing more
      (unchanged behavior). Non-empty → surface locally (reference line /
      toast), no AI.

## AI summary (R3/R4/R6)

- [ ] Add `INTROSPECTION_SUMMARY_SYSTEM` (STRICT JSON: `summary`, `themes`).
- [ ] No-arg `/introspection` (or `/introspection summary`): gather the
      folder's introspections, `sanitizeForPrompt` + bound (last N / char
      budget), `queueAi` with a representative `fileId` from the folder;
      render result as a `» /introspection ─ {source}` block.
- [ ] Privacy: short-circuit and show the raw list (no send) when the target
      `Folder.personal` is set; rely on `queueAi`'s `fileId` gate as the
      second guard. Reuse `PersonalContentError` / `isLocalAiUnreachable`
      handling.

## Housekeeping

- [ ] `CHANGELOG.md`: **Added** line for the command **and** a **Changed**
      line naming the store `version` migration boundary (CLAUDE.md).
- [ ] `bun run lint` + `bun run format`.

## Verify (browser)

- [ ] `/introspection <text>` stores it for the active file's folder (no AI);
      `/start` with none → identical to today; with some → local surface.
- [ ] No-arg `/introspection` → AI themes summary block; server down → alert,
      introspections intact, `/start` still works.
- [ ] Personal folder → capture works, AI summary skipped, raw list shown.
- [ ] Deleting the folder removes its introspections.
