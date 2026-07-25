# Honest FSRS session-completion reporting

## Problem

When an inline `/fsrs` review finishes, the tray shows a fixed line:
`✓ all caught up — {N} cards reviewed` (`src/components/FlashcardTray.tsx`,
the `done` branch). That statement is false in two independent ways:

1. **"all caught up" is a global claim the tray can't back up.** `/fsrs`
   only ever pulls the first 10 due cards
   (`src/routes/index.tsx`, `tpl:fsrs`, `.slice(0, 10)`). If 15 cards were
   due, finishing the 10 in the tray still leaves 5 due — the user is not
   caught up, but the tray says they are.
2. **A card rated "again" is not reviewed-and-done.** `reviewCard` gives
   rating 1 the minimum interval (~10 minutes, `MIN_INTERVAL_DAYS` in
   `src/lib/fsrs.ts`), so it is due again almost immediately. Counting it
   toward "reviewed" and declaring the user "caught up" misrepresents what
   happened.

The count `{N}` is `queue.length` — the number of cards shown, not a count
that reflects how the session actually went.

Who hits this: anyone who runs `/fsrs` and rates at least one card "again",
or who has more than 10 cards due. That is the common case, not an edge.

## Requirements

- R1. The completion line reports how many cards were **actually rated**
  this session out of how many the session set out to review — an honest
  "X of Y" when they differ, not a bare celebratory count.
- R2. The line distinguishes **caught up** from **partial**:
  - "caught up" may only be shown when zero cards remain due globally at
    completion (not merely when the 10-card tray queue is exhausted).
  - Otherwise the line states that cards remain (e.g. still-due count, or
    "more due — run /fsrs again").
- R3. Cards rated "again" are not counted as successfully reviewed in the
  headline framing. Whether they are separately surfaced ("m still due")
  is a display choice, but they must not inflate a "caught up" claim.
- R4. Closing the tray early (before the queue is exhausted) reports the
  honest partial count of what was rated, not the full queue size.
- R5. No new data collection or persisted fields — this is a messaging
  correction computed from state that already exists (`cards`, their
  `fsrs.dueAt`, and what was rated this session).

## Non-goals

- Re-inserting missed ("again") cards into the same session. That is the
  feedback-loop redesign in `specs/fsrs-feedback-review/`; this spec only
  makes the *reporting* honest for the current feedforward flow, and is
  intentionally scoped so it can ship before that larger change.
- Changing how many cards `/fsrs` pulls, or the FSRS math.
- Any analytics-page copy (that page reports totals, not per-session).

## Edge cases

- Session of 1 card rated "good": "1 of 1 reviewed", caught up only if no
  other cards are due.
- All cards rated "again": zero successfully reviewed; must not say
  "caught up".
- User closes after rating 3 of 10: "3 of 10 reviewed", not caught up.
- Exactly 10 due, all rated good, none newly due: legitimately "caught
  up · 10 reviewed".
- More than 10 due at start: even a clean 10/10 is "10 reviewed · N still
  due", never "caught up".
