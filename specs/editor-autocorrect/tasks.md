# Editor autocorrect / spellcheck — tasks

- [ ] Audit every `<textarea>` and text input in `src/routes/index.tsx`
      (the per-pane note editors) and note current `spellCheck` values.
- [ ] Enable native spellcheck on the note editing surfaces: set
      `spellCheck` (and `autoCapitalize="sentences"`, `autoCorrect="on"`
      for the platforms that honor it) on the main note `<textarea>`.
- [ ] Confirm the surfaces that must stay `spellCheck={false}` remain off:
      the slash-command palette input, the settings URL/model fields, and
      any code/math/command-line inputs called out in the design.
- [ ] Verify the syntax-highlight mirror (`ed-mirror`) is unaffected —
      spellcheck squiggles render on the textarea layer only.
- [ ] Browser check: type a misspelled word in a note and confirm the
      native squiggle appears; confirm a `/command` line and a `── Math`
      block don't get noisy false positives (adjust per the design's R4
      guidance if they do).
- [ ] `bun run lint` clean.
