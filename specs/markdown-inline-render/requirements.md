# Markdown inline render — requirements

## Problem

Issue #21. The editor is a plain `<textarea>` mirrored by a
syntax-highlighting `<pre class="ed-mirror">` for caret alignment (see
`design.md` for how that pairing works). Today the mirror only styles a
small, app-specific set of line prefixes (AI response lines, `── rule ──`
separators, marker lines) — see `renderHighlighted` in
`src/routes/index.tsx`. Ordinary markdown written in a note (blockquotes,
bold, headings) is not recognized at all: it displays as flat, unstyled
monospace text, identical to any other line. `>>` in particular displays
literally as two greater-than characters instead of reading as a
blockquote.

**Who hits it:** anyone writing markdown-formatted notes (which is most
users, given this is a study/notes app) and expecting visual feedback for
common markdown syntax while typing, without switching to a separate
preview mode.

## Requirements

- Lines beginning with `>>` render as a blockquote — visually distinct
  (e.g. accent color and/or a left accent bar) from plain text and from the
  app's existing `»`-prefixed AI-response styling.
- `**bold text**` renders with visual emphasis (bold or an equivalent
  non-reflowing treatment — see design.md for the font-metrics constraint).
- Headings (`#`, `##`, `###` line prefixes) render with visual emphasis
  (color/weight) distinguishing them from body text.
- Rendering happens live, inline, in the same editing surface the user is
  typing in — no separate "preview" pane or mode switch required to see it.
- Typing and cursor placement inside a styled line/span must continue to
  work exactly as before: no dropped keystrokes, no caret drift, no
  changed selection behavior.
- The underlying note content stays plain text: the raw markdown characters
  (`>>`, `**`, `#`) remain in the saved/synced content unchanged — this is a
  visual-only rendering layer, not a content transformation.

## Non-goals

- Full CommonMark/GFM parity (tables, images, nested lists, links,
  footnotes, code fences with language-aware highlighting, etc.) is out of
  scope for this pass.
- Hiding or replacing markdown syntax characters (true WYSIWYG editors
  often hide the `**`/`#`/`>>` markers once styled) is out of scope — see
  design.md for why this is a hard constraint of the current architecture,
  not just a sequencing choice.
- A separate rendered/reading-mode pane is not part of this feature (may be
  a follow-up; not needed to satisfy the "render inline" ask).
- Changing font size for headings is out of scope for the MVP (risks
  breaking line-height/caret alignment — see design.md).

## Edge cases

- `>>` appearing inside an AI response block (`»`-prefixed lines) or inside
  a closed `/question`/`/card`/`/vocab` block — must not be double-styled or
  conflict with the existing `ai-line`/`rule` treatment.
- Multiple consecutive `>>` lines (a multi-line blockquote) — each line
  still renders correctly; whether they visually join into one continuous
  quote block or render as independent styled lines is a design.md open
  question.
- `**` that opens but never closes on the same line (malformed/mid-typing)
  — must degrade gracefully (e.g. no styling applied, not a crash or a
  runaway match consuming the rest of the line).
- A heading marker not followed by a space (e.g. `#tag` vs `# Heading`) —
  should not be misidentified as a heading.
- `>>` or `**`/`#` appearing inside a math marker (`⟦math:…⟧`) or canvas
  marker (`⟦canvas:…⟧`) payload — must not be styled as markdown since that
  text isn't visible body content.
- Very long notes — per-line/per-token detection must not introduce a
  visible typing-latency regression.
