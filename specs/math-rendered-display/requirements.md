# Rendered math display

## Problem

`/math` corrects informal math to LaTeX, and `/calc` verifies arithmetic,
but the result is shown as **raw source text**, not rendered math.
`renderBlock` emits the `/math` result as `$<latex>$` (a literal dollar-
delimited string in the note buffer, `src/routes/index.tsx` ~line 418), so
the user sees `$x_{1} \cdot x_{2}$` as characters rather than the typeset
expression. Issue #6: "math is represented as text and not the corrected
view" — the correction happens, but the payoff (readable math) doesn't.

The editor is a plain `<textarea>` mirrored by a `<pre class="ed-mirror">`
for caret-aligned syntax highlighting. Rendered math cannot live _inside_
the editable buffer (it must stay plain text for editing/caret math), so
the core question is **where** rendered math appears.

## Requirements

- R1. LaTeX produced by `/math` (and any LaTeX the app emits) is displayed
  as typeset math, not as raw `$...$` source.
- R2. Rendering is **fully local** — no CDN, no external fonts or scripts
  (strict CSP). Any library and its fonts/CSS are bundled and self-hosted.
- R3. The underlying note text stays plain/editable — rendering is a
  presentation layer over (or beside) the source, not a replacement that
  breaks editing or sync.
- R4. Rendering failures degrade gracefully: invalid LaTeX shows the raw
  source (and ideally a subtle error hint), never a blank or a crash.
- R5. Consistent with how the app already shows non-text artifacts anchored
  in the buffer (canvas, `/fsrs` tray via the inline-widget layer).

## Non-goals

- A full WYSIWYG math editor or live-as-you-type math preview in the
  textarea (the editor stays a textarea; this is about displaying results).
- Rendering arbitrary Markdown/rich text — scope is math from `/math`
  (and optionally surfacing `/calc`'s expression as math).
- Server-side rendering of math (local-first; render in the browser).
- KaTeX/MathJax feature parity debates beyond "renders our output
  correctly and self-hosts under CSP."

## Edge cases

- Invalid/partial LaTeX from the model → show raw source + hint (R4).
- Very wide expressions → horizontal scroll within the rendered block, no
  page overflow.
- Editing the note around a rendered math block must not desync the
  render's anchor (ties to how inline widgets anchor to lines/markers).
- `/calc` currently emits plain arithmetic text, not LaTeX — decide whether
  it also gets math rendering or stays as verified plain text (design
  question; R1 is about the `/math` LaTeX path first).
- Theme: rendered math must read in both light and dark (Catppuccin) —
  color via `currentColor`, not baked-in black.
