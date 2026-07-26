# Markdown inline render — tasks

- [ ] Confirm this app's bundled `--font-mono` bold variant has identical
      advance width to regular (check the font file/CSS), to decide whether
      `.md-bold` can safely use `font-weight` or needs a fallback.
- [ ] Extend `renderHighlighted` (`src/routes/index.tsx`) to detect
      `>>`-prefixed lines and wrap them in a `.md-quote` span, alongside the
      existing `ai-line`/`rule` checks — excluding lines that are already
      inside an AI-response (`»`) or marker (`⟦...⟧`) context.
- [ ] Add `.md-quote` CSS to `src/styles.css` (color + left accent bar via
      border/box-shadow inside existing padding — no width or line-height
      change), visually distinct from `.ai-line`.
- [ ] Add heading-prefix detection (`#`, `##`, `###` + required space) →
      `.md-h1`/`.md-h2`/`.md-h3` classes (color/weight only).
- [ ] Add inline `**bold**` span detection within a line, composing with
      whichever line-level class already applies; apply `.md-bold` per the
      font-metrics finding above.
- [ ] Handle the malformed/mid-typing case (unclosed `**`) without
      styling the remainder of the line.
- [ ] Manually verify caret placement and typing remain correct at various
      cursor positions inside a quote line, a heading line, and inside/at
      the edges of a bold span.
- [ ] Manually verify `>>`/`**`/`#` inside math/canvas marker payloads and
      inside `»`-prefixed AI-response lines are not mistakenly styled.
- [ ] Add a `CHANGELOG.md` entry under `[Unreleased] → Added` (#21).
