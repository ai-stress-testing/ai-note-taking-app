# Math inline position fix — requirements

## Problem

Issue #22, a regression in the math rendering shipped under #6 (see
`specs/math-rendered-display/`). Rendered `/math` output (a KaTeX block laid
over a `⟦math:…⟧` marker via `InlineWidgetLayer`) does not scroll with the
note. Once a note is scrolled past a math block's anchor line, the rendered
block stays fixed at its last on-screen position instead of moving up with
the text around it — visually "stuck" over the wrong line, or off in empty
space, while the surrounding text scrolls normally underneath it.

**Observed:** scroll the editor (wheel, `PageDown`, arrow keys past the
visible area) in a note containing `/math` output below the fold. The
rendered math block does not track its anchor line — it stays visually
static while the mirrored text and caret scroll past it.

**Expected:** the rendered math block scrolls in lockstep with its anchor
line, exactly like the surrounding plain text — indistinguishable in scroll
behavior from any other line in the note.

**Who hits it:** any user who uses `/math` in a note long enough to scroll,
which is the common case (math blocks are rarely the only content in a
note).

## Requirements

- The rendered math block's on-screen position must track its anchor line
  continuously as the user scrolls the editor, by any means (mouse wheel,
  trackpad, `PageUp`/`PageDown`, arrow-key caret movement past the visible
  area, dragging a scrollbar).
- This must hold immediately after a scroll input — no visible lag,
  snapping, or a stale frame where the block is at the wrong position.
- Existing behavior must be preserved: the block still repositions correctly
  when content above it changes (line count shifts), and when the pane is
  resized (wrapping changes line positions).

## Non-goals

- No change to KaTeX rendering, the marker text format (`⟦math:id:latex⟧`),
  or the `/math` command itself.
- No change to how canvases or the `/fsrs` tray are invoked or what they
  render — see design.md for why the fix naturally touches their shared
  anchoring code, but this ticket is scoped to the math regression.
- No structural rewrite of the textarea/mirror scroll-sync mechanism.

## Edge cases

- Scrolling while the pane is also being resized (both a content-position
  change and a scroll change in close succession).
- Very fast scroll (large wheel deltas, "fling" scrolling) — the fix must
  not lag behind or drop frames noticeably.
- A note with multiple math blocks at different scroll positions — all must
  track correctly, not just the first/last.
- Switching focus between panes/tabs while scrolled, then returning.
- A math block anchored right at the top or bottom edge of the visible
  viewport (position at exactly 0 or at the last visible line).
