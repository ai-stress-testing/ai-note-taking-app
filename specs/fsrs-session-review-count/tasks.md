# Honest FSRS session-completion reporting — tasks

- [ ] In `FlashcardTray.tsx`, capture the session's starting queue size
      (the initial `queue.length`) so it survives the queue emptying.
- [ ] Track `ratedCount` (rated cards) and `againCount` (rating === 1) as
      component state, incremented in `rate()`.
- [ ] In the `done` branch, read `cards` from the store and compute
      `dueRemaining = count of cards with fsrs.dueAt <= Date.now()`.
- [ ] Replace the fixed "all caught up — N cards reviewed" line with the
      three-case message: caught-up (only when `dueRemaining === 0`),
      partial-with-still-due, and honest counts (`X of Y`).
- [ ] Ensure early close (the `onClose`/× path) reports the rated count,
      not the full queue — surface the same honest count if a summary is
      shown on close, or leave close silent by design.
- [ ] Manually verify the edge cases in requirements.md (all-again,
      partial close, >10 due, clean caught-up).
- [ ] `bun run lint` and `bun run format`.
