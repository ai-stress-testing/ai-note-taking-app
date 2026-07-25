# Rendered math display — design

## Context

The crux is the **rendering surface**: the editor is a `<textarea>` +
`<pre class="ed-mirror">` (monospace, caret-aligned). Typeset math cannot
be injected into either without breaking editing or caret alignment. The
app already has a solution for "non-text artifact anchored at a line": the
inline-widget layer (`src/lib/inline-widgets.ts`,
`src/components/InlineWidgetLayer.tsx`) that renders overlays over reserved
marker regions — this is how `/canvas` and the `/fsrs` tray work. Rendered
math should reuse that layer, not fight the textarea.

## Approach

**1. Library: KaTeX, bundled locally (R2).** Add `katex` as a dependency;
import its CSS and ship its fonts from the app bundle (Vite copies them;
they are same-origin, satisfying CSP). KaTeX is chosen over MathJax for
smaller footprint, synchronous render (no async typeset pass), and simple
`renderToString`/`render` API. Evaluate MathML-only as a fallback but
KaTeX's self-contained fonts render consistently across browsers.

**2. Rendering surface: inline-widget overlay anchored to the math block.**
When `/math` produces LaTeX, instead of writing `$latex$` as the visible
payload, write a **marker block** (like `/canvas`/`/fsrs`) carrying the
LaTeX (or a reference), and have `InlineWidgetLayer` render a
`<MathBlock latex=...>` over it via KaTeX. The raw LaTeX remains in the
note text (inside the marker/source) so it stays editable and syncs as
plain text (R3); the overlay is pure presentation.
- Alternative lighter surface (design-time choice): render into the
  existing result block region as a non-editable rendered span positioned
  by the widget layer, keeping the `$...$` source in the buffer as the
  editable truth.

**3. Graceful failure (R4).** Wrap KaTeX in `throwOnError: false` (renders
invalid LaTeX as a highlighted error string) or catch and fall back to
showing the raw `$...$` source with a subtle hint. Never crash the editor.

**4. Theme (R-edge).** KaTeX inherits `currentColor`; set the math block's
color from the Catppuccin token so it reads in light and dark. Wide
expressions get `overflow-x: auto` within the block.

**5. `/calc` (open).** Keep `/calc`'s verified result as plain text for now
(it's an arithmetic verdict, not an expression to typeset); optionally
render its extracted expression as math in a later pass. R1 targets the
`/math` LaTeX path.

## Data model changes

- No store schema change if the LaTeX stays in the note text (marker or
  `$...$` source). If a marker block is used for anchoring, it reuses the
  existing marker/inline-widget mechanism (no new persisted type) — mirror
  how `/canvas` anchors without adding store fields for the render itself.
- New dependency: `katex` (+ its bundled CSS/fonts). Record in the
  changelog; note bundle-size delta.

## Alternatives considered

- **Render math inside the textarea/mirror.** Rejected: a textarea can't
  contain typeset elements, and the monospace mirror exists for caret
  alignment — typeset glyphs would break it.
- **MathJax.** Rejected as the default: heavier, async typesetting, larger
  bundle; KaTeX covers the app's output and self-hosts cleanly. Kept as a
  documented fallback if a needed construct is unsupported.
- **Convert LaTeX → MathML and rely on native rendering.** Rejected as
  primary: inconsistent cross-browser MathML support (esp. Chromium
  historically); KaTeX gives uniform output. Viable as a no-dependency
  fallback if bundle size becomes a hard constraint.
- **Keep showing `$...$` and call it done.** Rejected: that's the current
  broken behavior #6 is about.

## Open questions

- Exact anchoring surface: dedicated marker + `InlineWidgetLayer`
  `<MathBlock>` vs a rendered non-editable span in the result block. Both
  keep source editable; the marker path reuses the most existing
  machinery. Confirm which reads best in the editor flow.
- Whether `/calc` gets math rendering (leaning: not in this pass).
- KaTeX bundle/font size acceptability — measure; if too large, fall back
  to the MathML path.
