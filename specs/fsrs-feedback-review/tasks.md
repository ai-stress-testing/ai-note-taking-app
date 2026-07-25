# FSRS feedback-loop review — tasks

> Gated: implement only after sign-off on the design's open questions
> (reviewLogs granularity, requeue placement/cap, time-budget, starter deck).

## Session queue (Option A)

- [ ] In `FlashcardTray`, hold a working queue of card ids; on "Again",
      re-append the card (spaced by N) so it must be cleared before done.
- [ ] Apply the FSRS schedule once per card on its terminal rating so
      intra-session requeues don't thrash `dueAt` (R5); decide per-attempt
      vs terminal `reviewLogs` writes (R6, per sign-off).
- [ ] Bound repeated "Again" (cap/escape hatch).
- [ ] Session completes when the working queue is empty ⇒ (10 + m)/10;
      hand the honest counts to `specs/fsrs-session-review-count/` messaging.

## Seed-card removal (R4)

- [ ] Stop seeding new profiles (`cards: {}` at init + `migrate`), keeping
      EXISTING users' cards intact.
- [ ] Add an opt-in "load starter deck" action calling `seedCards()`.
- [ ] Update README (remove "8 starter cards ship in") + fresh-profile
      empty-state copy pointing to `/card`/`/vocab`/`/question`.
- [ ] Record the fresh-profile behavior change in `CHANGELOG.md`.

## Optional (per sign-off)

- [ ] Time-budget mode (Option C) on top of the queue.

## Verify

- [ ] Browser: rate a card "Again" → it returns later in the same session
      and must be cleared; session reports (10+m)/10 honestly.
- [ ] New profile starts empty; starter-deck button loads the 8 cards;
      existing profile keeps its cards on upgrade.
- [ ] `bun run lint` + build clean.
