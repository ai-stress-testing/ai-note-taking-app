# Markdown inline render — design

## The crux: textarea + mirror can't do true WYSIWYG

The editor is a real `<textarea class="ed-textarea overlay">` with
transparent text/caret, layered exactly over a `<pre class="ed-mirror">`
that shows the styled/highlighted text underneath it. `styles.css`
L1145-1153 spells out why this works at all:

```css
.ed-textarea.overlay {
  /* Must occupy the exact same box as .ed-mirror (same `inset: 0` on the
     same positioned ancestor) — any size mismatch between the two desyncs
     the real caret from the highlighted text underneath it. */
  position: absolute;
  inset: 0;
  ...
  color: transparent;
  caret-color: var(--ctp-mauve);
}
```

The textarea's real (invisible) text and the mirror's visible text must
occupy **pixel-identical positions**, character for character, or the
visible caret (drawn by the browser inside the transparent textarea) stops
lining up with the glyph it appears to sit next to. That constrains any
markdown rendering to changes that don't alter character advance widths or
line height:

- No hiding/removing markdown syntax characters (the classic WYSIWYG move
  of showing "**bold**" as just "bold" with the asterisks invisible) —
  that changes the character count and every position after it in the
  textarea vs. the mirror.
- No font-size changes for headings — a taller heading line in the mirror
  than in the textarea (which uses one fixed `line-height`, `inline-widgets.ts`
  `LINE_HEIGHT_PX`) desyncs every line below it.
- Bold via `font-weight` is _usually_ safe in a true monospace font (fixed
  advance width regardless of weight) but must be verified against this
  app's bundled `--font-mono` before relying on it — some monospace fonts'
  bold cut is not perfectly fixed-width. If it isn't, fall back to a
  color/underline treatment for emphasis instead of `font-weight`.

This is the existing precedent already in the codebase: `renderHighlighted`
(`src/routes/index.tsx` L1161-1189) already does exactly this kind of
constrained styling — `»`-prefixed AI lines and `── rule ──` separator
lines get a CSS class (color, weight) but every character, including the
markup itself (the dashes, the `»`), stays visible and in place.

## Options considered

**(a) Extend the mirror highlighter (`renderHighlighted`) with markdown
token detection, styling only — no reflow.**

Add line-prefix detection (`>>` → blockquote class) alongside the existing
`ai-line`/`rule` checks, and inline-span detection within a line (`**...**`
→ bold-ish class) using the same span-per-segment approach `renderHighlighted`
already uses per line. Every character stays in the DOM in the same order;
only a wrapping `<span className="...">` changes. This is a direct
extension of a pattern already proven to keep the textarea/mirror in sync.

_Trade-off:_ markdown syntax characters stay visible (`>> like this` reads
as a styled quote with the `>>` still shown, not hidden) — a real,
disclosed limitation, not a bug. Users get visual feedback, not full
WYSIWYG.

**(b) A separate rendered preview surface** (a "reading mode" pane showing
real HTML from a markdown parser, decoupled from the textarea).

Real WYSIWYG becomes possible here since there's no caret-alignment
constraint — but it is not "inline" as the issue asks (it's a mode switch
or a second pane), and it adds real scope: markdown parsing, a second
scrollable view, and either one-way (edit-then-view) or two-way
(scroll-sync, click-to-edit) sync between the two surfaces. Bigger feature
than what #21 is asking for.

**(c) Inline-widget overlays** (the `InlineWidgetLayer`/marker mechanism
already used for `/canvas`, `/fsrs`, and rendered `/math`) applied to
markdown block elements.

This mechanism works well for _opaque, block-level, non-inline-editable_
artifacts: the source becomes a marker, reserved blank lines hold its
space, and a React component renders on top. It's a poor fit for markdown
text formatting specifically:

- Bold and headings are inline/short-lived by nature — they don't want the
  "reserve N blank lines for a widget" treatment built for canvases and
  math blocks.
- A blockquote or bold run is still _text the user is actively editing_ —
  turning it into an opaque marker+overlay would mean the visible quote is
  no longer the thing being typed into (defeats the purpose; canvas/math
  work because their content genuinely isn't inline-editable plain text).

## Recommendation

**(a): extend the mirror highlighter.** It's the only option that is
inline (no mode switch), inherits the caret-alignment guarantee the
textarea/mirror pair already has, and matches an existing, working pattern
in this codebase (`renderHighlighted`'s current line-prefix handling)
rather than introducing a new rendering mechanism. The trade-off — markdown
syntax stays visible rather than being hidden — is inherent to this
architecture and should be stated plainly to whoever files/reviews this:
this is "styled markdown-aware text," not a WYSIWYG editor.

(b) is worth keeping in mind as a possible separate future feature ("reading
mode") but is out of scope here. (c) is the wrong tool for inline text
formatting and should be reserved for block-level, non-text artifacts as it
is today.

## MVP scope

What `>>` becomes: per the issue, a **blockquote** — styled as its own
class (e.g. `.md-quote`): a distinct text color and/or a left accent bar
achieved via `border-left`/`box-shadow` inside the existing line padding
(not consuming a character column, so it doesn't shift any text). Must be
visually distinct from the existing `»`-prefixed `.ai-line`/`.ai-head`
treatment so the two aren't confused — different color token.

First three constructs, in priority order (matches the issue's explicit
example first, then the next-most-common markdown people type):

1. Blockquote — `>>`-prefixed lines → `.md-quote`.
2. Headings — `#`, `##`, `###` line prefixes (space required after the
   `#`s) → `.md-h1`/`.md-h2`/`.md-h3`, color/weight only, no font-size
   change.
3. Bold — `**text**` inline spans → `.md-bold` (font-weight, pending the
   font-metrics check above; fall back to color/underline if the bundled
   mono font's bold isn't fixed-width).

Italics, inline code, links, lists are deferred to a later pass.

## Data model changes

None. This is a rendering-layer-only change inside `renderHighlighted` (or
a new sibling tokenizer it calls into) — no store schema change, no
persisted format change, no `sync-schema.ts` change. A `CHANGELOG.md` entry
goes under `Added` (new visual behavior), not `Changed` (no migration
boundary).

## Alternatives considered

See "Options considered" above — full WYSIWYG (hiding syntax, reflowing
text) is rejected outright as incompatible with the textarea/mirror
caret-alignment mechanism this app depends on; a separate preview pane is
rejected as out of scope for "inline"; inline-widget overlays are rejected
as the wrong mechanism for editable inline text.

## Open questions

- Exact color tokens for `.md-quote`/`.md-h1..3`/`.md-bold` (Catppuccin
  palette) — a design/ux-architect call.
- Whether consecutive `>>` lines should visually join into one continuous
  quote block (nicer, more code — would need to detect line runs, not just
  individual lines) or each render independently styled (simplest,
  consistent with `renderHighlighted`'s existing per-line approach). Lean
  towards per-line for the MVP given the existing architecture, revisit if
  it looks disjointed.
- Confirm whether this app's bundled `--font-mono` bold variant is
  fixed-width before committing to `font-weight` for `.md-bold`; if not,
  decide the fallback treatment (color vs. underline vs. both).
- Precedence/ordering when a line matches multiple checks (e.g. a `>>` line
  that also contains `**bold**`) — `renderHighlighted` currently branches
  per-line on the first matching prefix; bold is an inline (within-line)
  match and needs to compose with whichever line-level class applies, not
  replace it.
