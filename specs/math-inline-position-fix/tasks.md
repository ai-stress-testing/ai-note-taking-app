# Math inline position fix — tasks

- [ ] Reproduce: `/math` output below the fold, scroll via wheel/`PageDown`/
      arrow keys, confirm the KaTeX block stays visually fixed while text
      scrolls past it.
- [ ] In `InlineWidgetLayer.tsx`, store each anchor's scroll-independent raw
      offset (`measuredY + textarea.scrollTop` / `measuredX +
    textarea.scrollLeft`) instead of the already-scroll-adjusted value
      `getCaretCoords` returns.
- [ ] Track the textarea's live `scrollTop`/`scrollLeft` in local state,
      updated via a scroll listener added directly to the `textarea` prop
      (no new prop plumbing through `routes/index.tsx`).
- [ ] Render canvas, review-tray, and math widget `top`/`left` as
      `raw - liveScroll` instead of the stored anchor directly.
- [ ] Verify the math block now tracks its anchor line at various scroll
      positions, after pane resize, and after content edits above/below the
      marker.
- [ ] Spot-check that `/canvas` and the `/fsrs` tray (same code path) also
      now track scroll correctly and are not regressed.
- [ ] Confirm the slash-menu's separate use of `getCaretCoords`
      (`routes/index.tsx`) is unaffected — no signature change needed there.
- [ ] Add a `CHANGELOG.md` entry under `[Unreleased] → Fixed` (#22).
