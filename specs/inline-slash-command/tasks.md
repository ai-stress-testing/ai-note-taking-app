# Inline `/command` — tasks

- [ ] Add `findSlashToken(value, caret)` helper in `src/routes/index.tsx`
      (or a small local module) implementing the backward-scan + boundary
      rule from design.md.
- [ ] Rewire `detectSlash` to use `findSlashToken` instead of the
      line-anchored regex; keep `SlashState.startIdx` semantics as "token
      start."
- [ ] Update `commitCompletion` to replace `(slash.startIdx, caret)`
      instead of recomputing `(lineStart, endIdx)` from scratch.
- [ ] Add the "needs leading newline" wrapper around `insertAtRange` for
      `tpl:*` branches in `executeCommand`, so a mid-line command's block
      template still starts on its own line.
- [ ] Manual test: type prose, then `/vocab` mid-line — menu opens, Tab
      completes, prefix text is preserved before the inserted template.
- [ ] Manual test: `/>` typed mid-line after other text on the same line
      still closes the enclosing block correctly.
- [ ] Manual test: URL/path edge cases (`https://x.com/y`, `~/docs/vocab`,
      `a/b /vocab`) — menu does not open on the non-command slashes, does
      open on the real command.
- [ ] Manual test: caret moved back into an already-completed inline
      command re-opens/filters the menu; backspacing past the `/` closes
      it.
- [ ] Manual test: whole-line Enter-to-commit path (R6) still works
      unchanged for a line that is only `/cmd args`.
- [ ] Regression pass over existing start-of-line command flows
      (`/question`, `/calc`, `/math`, `/note`, `/end`, `/canvas`, `/fsrs`,
      `/split`) to confirm no behavior changed for the line-start case.
