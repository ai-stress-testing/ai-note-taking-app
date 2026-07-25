# FSRS feedback-loop review (Anki-style)

> **Large change — pauses for human sign-off after design.** This reworks
> the review loop's session model. It layers on the FSRS-4.5 scheduler
> (`src/lib/fsrs.ts`); it does not change the scheduler math.

## Problem

The `/fsrs` review is **feedforward**, not feedback. It pulls the first 10
due cards (`tpl:fsrs`, `.slice(0,10)`), the user rates each once, and the
session ends at exactly 10/10 — regardless of how many the user actually
understood. Issue #7:

1. A card rated "Again" (rating 1) gets the ~10-minute minimum interval
   (`MIN_INTERVAL_DAYS`) and leaves the session; the user never re-attempts
   it _now_, so a missed card isn't actually relearned this sitting.
2. Completion is guaranteed 10/10 when it should be **(10 + m)/10** where
   `m` = cards misunderstood — missed cards should add work, not vanish.
3. The deck ships **8 boilerplate seed cards** (`seedCards()`,
   `cardsSeeded`) that clutter a real user's deck.
4. The session should feel like Anki — you leave when you've _properly
   reviewed_, driven by the queue (and optionally time), not by a fixed
   count.

## Requirements

- R1. A card rated "Again" during a session is **re-queued within the same
  session** and must be re-attempted before the session is complete
  (intra-session relearning).
- R2. Session completion is **queue/time-driven**, not a fixed 10: the
  session ends when the working queue (base cards + requeues) is cleared
  (and/or an optional time budget elapses), so total attempts reflect
  (10 + m)/10.
- R3. Honest accounting: the session reports attempts, cards that needed a
  requeue, and true completion (ties to `specs/fsrs-session-review-count/`,
  which fixes the _messaging_; this spec provides the _behavior_ behind it).
- R4. **Remove the boilerplate seed cards** so new profiles start with an
  empty (or explicitly opt-in) deck; existing users' real cards are
  untouched.
- R5. The FSRS scheduler math (`fsrs.ts` intervals/stability/difficulty)
  stays authoritative for _persisted_ scheduling — intra-session requeue is
  an ephemeral session-queue concern, not a mutation of the scheduler.
- R6. Review logging remains coherent for analytics (decide whether each
  attempt or only the terminal rating writes to `reviewLogs`).

## Non-goals

- Reimplementing Anki's full learning-steps configuration (multiple custom
  steps, per-deck options). MVP is "again ⇒ relearn now," not a steps
  editor.
- Changing FSRS-4.5 parameters or the interval formula.
- The messaging fix itself (covered by `specs/fsrs-session-review-count/`) —
  this spec supplies the behavior it reports on.
- A new review route/UI paradigm — keep the inline `/fsrs` tray.

## Edge cases

- A card rated "Again" repeatedly: bounded relearn (avoid an infinite loop
  — cap requeues or require an eventual pass; design decides).
- Removing seed cards for users who already have them: don't delete a user's
  existing cards on upgrade; only stop seeding NEW profiles (and offer an
  opt-in starter deck).
- Empty deck after seed removal: `/fsrs` already handles "no cards" with a
  toast; the fresh-profile onboarding should point users to `/card`,
  `/vocab`, `/question`.
- Time-budget mode (if included): ending on time with cards still queued
  must report honestly (not "caught up").
- Requeued card's persisted `dueAt`: only the terminal FSRS result is
  written; intermediate "again" attempts don't thrash the schedule (R5).
