# Math inline position fix — design

## Root cause

Not a CSS `position: fixed`/`sticky` bug — `styles.css` has no rule for
`.ed-inline-widget` at all; every widget's position comes from the inline
`style={{ position: "absolute", top, left }}` set in
`src/components/InlineWidgetLayer.tsx`. The defect is in when that style
gets recomputed, not what positioning scheme it uses.

Scroll mechanics in this editor: the visible `<textarea class="ed-textarea
overlay">` (`src/routes/index.tsx` ~L1012-1035) is the element that actually
scrolls its content natively (browser textarea overflow). The `<pre
class="ed-mirror">` sibling is `overflow: hidden` and has no scroll of its
own — its `scrollTop` is puppeted to match the textarea's via the
textarea's `onScroll` handler (`routes/index.tsx` L1023-1026:
`if (m) m.scrollTop = e.currentTarget.scrollTop`). Both `.ed-mirror` and
`.ed-textarea.overlay` are `position: absolute; inset: 0` inside
`.ed-mirror-wrap` (`styles.css` L1104-1153), which is itself
`position: relative` but is **not** the scrolling element — it's sized to
the viewport (`flex: 1 0 auto; min-height: 220px`), not to full document
height.

`InlineWidgetLayer` renders its widgets (canvas, review tray, math) as
further absolutely-positioned children of that same non-scrolling
`.ed-mirror-wrap`. Their `top`/`left` come from `getCaretCoords`
(`src/lib/caret.ts` L64-65):

```
const x = span.offsetLeft - el.scrollLeft;
const y = span.offsetTop - el.scrollTop;
```

This bakes the textarea's `scrollTop`/`scrollLeft` **at the moment of the
call** into the returned coordinates. The `useLayoutEffect` that calls it
(`InlineWidgetLayer.tsx` L53-73) only re-runs on `[content, textarea, tick]`.
`tick` is bumped solely by a `ResizeObserver` on the textarea
(L46-51) — i.e. on pane resize, never on scroll. So: the widget's position
is measured once (on mount / content change / resize) against whatever
`scrollTop` happened to be at that instant, and then never re-measured as
the user scrolls afterward. The mirror keeps scrolling (its `scrollTop` is
puppeted every scroll event), the textarea's visible text keeps scrolling
(native), but the widget's `top` is a frozen number from the last
recompute — so it visually stays put while everything else moves under it.
That is the "sticky" behavior in #22.

This is not math-specific: canvas and the `/fsrs` tray go through the exact
same effect and the exact same stale-anchor mechanism. They are not filed
here, but share the root cause — see "Fix location" below.

## Approach

Decouple the **layout offset** (a line's pixel position within the
document — stable, only needs recomputing on content change or reflow) from
the **scroll offset** (changes continuously and cheaply on every scroll
event, no DOM re-measurement needed).

At measurement time, undo what `getCaretCoords` already subtracted to get a
scroll-independent "raw" offset:

```
rawY = measuredY + textarea.scrollTop   // at the instant of measurement
rawX = measuredX + textarea.scrollLeft
```

Store `rawX`/`rawY` per anchor instead of the scroll-adjusted values. Track
the textarea's _live_ `scrollTop`/`scrollLeft` in `InlineWidgetLayer` state,
updated on every scroll event (cheap — no DOM measurement, just reading
`el.scrollTop`). Render each widget at:

```
top: rawY - liveScrollTop
left: rawX - liveScrollLeft
```

This needs no change to `caret.ts`'s signature or its other caller (the
slash-menu positioning in `routes/index.tsx`, which already recomputes on
every keystroke and has no scroll-drift problem since it's transient UI).

**Wiring the scroll event:** `InlineWidgetLayer` already receives the
`textarea` DOM node as a prop, so it can add its own
`textarea.addEventListener("scroll", …)` in a `useLayoutEffect` local to
that file — no new prop needs to be threaded down from `routes/index.tsx`,
and the existing `onScroll` JSX handler there (which only syncs the mirror)
is untouched.

## Alternatives considered

- **CSS `position: sticky`.** Rejected — sticky pins an element to an edge
  of its scroll container; it has no notion of "track this specific
  document line," which is what's needed here. Wrong semantics.
- **Re-run the full `getCaretCoords` measurement on every scroll event**
  (treat scroll like another `tick`). Correct in principle, but re-creates
  a hidden mirror `<div>` and re-measures via `offsetLeft`/`offsetTop` on
  every scroll frame — real cost on long documents or fast wheel scroll.
  Viable as a fallback with throttling/`requestAnimationFrame` batching if
  the raw-offset approach below turns out to be awkward, but not the first
  choice.
- **Make `.ed-mirror-wrap` itself the scrolling element** (move scroll
  ownership off the native textarea). Would fix this cleanly but is a much
  bigger structural change to the textarea/mirror sync this app relies on
  for caret alignment — out of proportion for a positioning bug.

## Open questions

- Whether to fix this once, shared, in `InlineWidgetLayer` (fixing canvas
  and `/fsrs` drift as a side effect) or to scope the code change narrowly
  to only the math anchor path and leave canvas/review as-is for now. The
  root cause is identical and lives in the same file/effect, so a narrow
  fix would mean duplicating the same logic three ways — recommend fixing
  it once for all three, called out here so it isn't mistaken for scope
  creep during review.
- Confirm no perceptible jank on the "cheap arithmetic per scroll event"
  path for long documents with several open math/canvas/review widgets at
  once; if profiling shows an issue, batch the state update via
  `requestAnimationFrame`.
