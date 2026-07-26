# Review "continue" button — tasks

- [ ] `src/routes/index.tsx`: factor the `tpl:fsrs` due-selection + marker +
      `setReviewIds` into a reusable `startReview(lineStart, lineEnd)`;
      `tpl:fsrs` calls it.
- [ ] Add a route-local `reviewSeq` counter; bump it whenever a session is
      set up (start and continue).
- [ ] Add `continueReview()`: recompute due (same cap), if none return; else
      bump `reviewSeq` and `setReviewIds(newDue)` (reuse existing marker
      anchor — no re-insert).
- [ ] Thread `reviewSeq` and an `onContinue` callback through
      `InlineWidgetLayer` to `FlashcardTray`; use `reviewSeq` as the tray's
      React `key` so continue remounts it with fresh counters.
- [ ] `src/components/FlashcardTray.tsx`: add optional `onContinue` prop;
      in the `done` branch render a **continue** button only when
      `dueRemaining > 0`, beside the existing close button.
- [ ] Manual: review a batch with >10 cards due → banner shows continue →
      click loads the next batch with reset counters.
- [ ] Manual: finish with exactly 0 due → "✓ caught up", no continue button.
- [ ] Manual: finish with only "again" cards (0 due now) → no continue
      button; existing "marked again" copy shows.
- [ ] `CHANGELOG.md`: **Added** line for the continue button in the review
      banner.
- [ ] `bun run lint` clean.
