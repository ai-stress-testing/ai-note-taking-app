# Rendered math display — tasks

- [ ] Add `katex` dependency; import its CSS; confirm its fonts are bundled
      same-origin (CSP-safe, no CDN). Measure bundle-size delta.
- [ ] Build `<MathBlock latex>` (`src/components/MathBlock.tsx`) using KaTeX
      with `throwOnError: false`; theme color via `currentColor`;
      `overflow-x: auto` for wide expressions.
- [ ] Choose + implement the anchoring surface: reuse the marker +
      `InlineWidgetLayer` path (like `/canvas`) OR a rendered non-editable
      span in the `/math` result block. Keep the raw LaTeX in the note text
      as the editable/synced source.
- [ ] Update the `/math` close path (`correctMath`/`renderBlock` in
      `src/routes/index.tsx`) to render via `<MathBlock>` instead of
      showing `$...$` as text.
- [ ] Graceful failure: invalid LaTeX → raw source + subtle hint, no crash.
- [ ] Browser check: `/math` a messy expression, confirm typeset output in
      light and dark; edit around it and confirm the anchor holds; feed bad
      LaTeX and confirm graceful fallback.
- [ ] `bun run lint` + build clean.
