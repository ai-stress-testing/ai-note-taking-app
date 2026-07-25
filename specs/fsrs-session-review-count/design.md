# Honest FSRS session-completion reporting — design

## Context

The dishonest line is entirely local to `src/components/FlashcardTray.tsx`.
The tray already holds everything needed to fix it; the fix is a small
component change with no store, schema, or scheduler impact. The decision
ladder stops early here: this needs to exist (R1–R4 are a correctness fix,
not a feature), it reuses existing state, and it is close to a one-liner's
worth of new logic.

## Approach

Three signals, all derivable inside the tray:

1. **How many were rated.** `FlashcardTray` currently derives `queue` from
   `ids` and tracks `index`. Every advance goes through `rate()` (there is
   no skip), so at completion `min(index, queue.length)` is the rated
   count, and on early close it is the current `index`. Track a small
   `ratedCount` (or read `index`) rather than reporting `queue.length`.
2. **How many were rated "again".** Add a counter incremented in `rate()`
   when `rating === 1`. Needed for R3's framing and to explain why the
   user is not caught up even though the tray queue emptied.
3. **Whether anything remains due globally.** At render time in the `done`
   branch, read the store and compute
   `Object.values(cards).filter(c => c.fsrs.dueAt <= Date.now()).length`.
   This is the authoritative "caught up" test (R2), and it already
   reflects the ~10-min requeue of "again" cards because `rateCard` wrote
   their new `dueAt` through the scheduler. The analytics page computes
   `dueNow` exactly this way (`src/routes/analytics.tsx`), so this is the
   established, boring pattern — reuse it, don't invent a new one.

Completion copy (illustrative, final wording at implementation):

- `dueRemaining === 0` and none rated again →
  `✓ caught up · {rated} reviewed`
- `dueRemaining > 0` →
  `{rated} of {sessionSize} reviewed · {dueRemaining} still due — /fsrs for more`
- early close →
  `{rated} of {sessionSize} reviewed` (+ still-due tail if any)

`sessionSize` is the queue length the session began with. "Still due"
already includes any "again" cards, so a separate "m missed" clause is
optional; R3 is satisfied as long as "caught up" is gated on
`dueRemaining === 0`.

## Data model changes

None. No store fields, no actions, no `sync-schema` changes, no migration.
`ratedCount`/`againCount` are component-local `useState` (or a small
reducer over ratings). The global due count is read, not stored.

## Alternatives considered

- **Compute the count in the `/fsrs` handler / store and pass it in.**
  Rejected: the completion state lives in the tray; threading a callback
  back up to `index.tsx` to compute a message is more coupling than the
  problem needs, and the tray already knows everything.
- **Persist a "session review summary" entity.** Rejected as YAGNI. The
  analytics page already aggregates per-card and per-review data from
  `reviewLogs`; a per-session summary object is a second source of truth
  for something no requirement asks to persist.
- **Only fix the wording, keep counting `queue.length`.** Rejected: R1/R4
  require the count to reflect what actually happened (early close, rated
  count), so the count — not just the adjective — has to change.

## Open questions

- Exact final copy and whether to show an explicit "m still due" vs a
  generic "more due" — a wording decision, not an architectural one.
- Whether "caught up" should also require the session to have started with
  ≤10 due (so the tray never implies it cleared a backlog it never saw).
  The `dueRemaining === 0` test already handles this correctly, so this is
  likely redundant — confirm at implementation.
