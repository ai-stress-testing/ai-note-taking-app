# /fidget — design

## Approach

Add `/fidget` to `COMMANDS` (`src/lib/commands.ts`) with a `localHint:
"fidget"` and handle it in `executeCommand` (`src/routes/index.tsx`) the
same way `/export` is handled: **open an overlay and insert nothing** into
the buffer (`insertAtRange(lineStart, lineEnd, "")` to clear the typed
`/fidget` line, then flip a `fidgetOpen` UI state). The scratch surface is
a component (`<FidgetPad>`) whose textarea value is **local React state
only** — never read from or written to the store.

Two surfaces were considered (see Alternatives); the chosen one is an
**ephemeral overlay/pane** backed by `useState`, because it structurally
guarantees R2/R3: there is no store field and no buffer marker to leak.

Close: an explicit ✕ / Esc handler unmounts `<FidgetPad>`; because its
content is `useState` in that component, unmounting discards it with zero
cleanup logic. Nothing writes to `setContent`, `localStorage`, or sync.

Rendering: a lightweight overlay (like the settings/download modals) or an
ephemeral pane. A modal-style overlay is simplest and avoids the pane-array
bookkeeping; it sits above the editor and never participates in `panes`.

## Data model changes

**None.** No store field, no persisted state, no `partialize` entry, no
`sync-schema` change, no marker in file `content`. This absence is the
feature's core guarantee — it must be preserved deliberately.

## Alternatives considered

- **Inline-widget marker like `/canvas` and `/fsrs`** (`markerBlock` +
  `InlineWidgetLayer`). Rejected: those write a marker string into the
  file's `content`, which IS persisted — `/fsrs` only gets away with it by
  scrubbing `REVIEW_MARKER` on mount. Reusing that pattern would mean
  fidget content (or at least a marker) touches persisted state, exactly
  what R2/R3 forbid. An overlay with local state avoids the whole class of
  leak.
- **A real ephemeral pane in `panes`** pointed at a throwaway in-memory
  "file". Rejected: `files` is persisted; a throwaway file would need to be
  excluded from `partialize` and sync, adding fragile special-casing. A
  non-store overlay is cleaner.
- **Persist fidget content "just until close" in the store.** Rejected:
  any store write is a persist/sync write (the persist middleware is
  global); there is no "store but don't persist" without new machinery the
  ladder would skip.

## Open questions

- Overlay vs docked ephemeral pane for the visual — leaning overlay
  (simplest, no `panes` involvement). Confirm with the UX sensibility that
  a full-screen-ish scratch surface feels right vs a small floating pad.
- Interaction when opened over an existing widget (canvas/fsrs tray):
  overlay-above is the default; confirm Esc closes only the topmost.
- Whether Esc alone is enough or a visible ✕ is also needed (both, likely).
