# /fidget — tasks

- [ ] Add `/fidget` to `COMMANDS` (`src/lib/commands.ts`) with
      `localHint: "fidget"` and a short description.
- [ ] Handle `case "fidget":` in `executeCommand` (`src/routes/index.tsx`):
      clear the typed line via `insertAtRange(lineStart, lineEnd, "")` and
      set a `fidgetOpen` UI state — insert no content into the buffer.
- [ ] Build `<FidgetPad>` (`src/components/FidgetPad.tsx`): a textarea whose
      value is component-local `useState`; ✕ and Esc close/unmount it.
- [ ] Render it as an overlay above the editor (modal-style, not part of
      `panes`); no store/localStorage/sync involvement.
- [ ] Verify no persistence: open `/fidget`, type, close, reload → nothing
      in the note, the store, or `localStorage`; confirm no marker is left
      in the file `content` and `partialize`/sync are untouched.
- [ ] `bun run lint` clean.
