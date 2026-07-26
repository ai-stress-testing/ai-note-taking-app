# FSRS AI relearn — follow-up question on "Again"

> **Large change — pauses for human sign-off after design.** It layers an
> AI-driven relearn loop on top of the review session and does **not** touch
> the FSRS-4.5 scheduler math (`src/lib/fsrs.ts`).
>
> **Depends on `specs/fsrs-feedback-review/` (#7).** #7 introduces the
> intra-session working queue and the "Again ⇒ relearn now" behavior. This
> spec (#25) is the AI relearn *content* that fills that requeue. #7's
> ephemeral working-queue (its recommended Option A) is the substrate this
> builds on — land #7 first, or co-design the queue with this.

## Problem

In the review tray (`FlashcardTray.tsx`), rating a card **Again** (rating 1)
today just reschedules it ~10 min out (`MIN_INTERVAL_DAYS`) and the card
leaves the session — the student never actually *relearns* the missed
material this sitting. #7 fixes the requeue mechanic (the card comes back).
But re-showing the *same* card is weak relearning: the student may just
recognize the answer they were shown. Issue #25 wants an **active,
episodic** relearn — on Again, the app constructs a *new* question derived
from the missed one, has the student answer it open-ended, and grades how
much was lost, repeating until the concept sticks. The goal is
episodic-memory construction: building a fresh recall event around the fact,
not re-exposing the same card face.

## Requirements

- R1. When the student rates a card **Again**, a **blank ephemeral
  placeholder card** is inserted into the session's working queue (the #7
  queue) and the local AI is queried to build the relearn turn.
- R2. **Server unreachable (or content is personal):** fall back to a
  no-AI relearn — the student must **type the original answer** to clear the
  card from the session. No AI, no loss score, no fabricated grade.
- R3. **Server reachable:** the student is shown a **new question derived
  from the missed one** (different angle, same underlying concept), answers
  it **open-ended** (free text), and the answer is **graded for loss**.
- R4. **Loss rubric:** `loss = 100% − %off`, where `%off` is how far the
  answer is from correct (0% = perfect). If `loss ≤ 73%` the cycle
  **repeats** with another derived question; otherwise the card is
  considered relearned and clears the queue.
- R5. **Bounded:** the repeat cycle must not loop forever. After a capped
  number of cycles, surface "keep practicing" and let the student move on;
  the original card's FSRS schedule (from its Again rating) stands.
- R6. **Scheduler boundary:** this is a session-layer / AI concern. The
  persisted FSRS result for the original card is whatever #7 writes on its
  terminal rating. Relearn cycles never mutate `fsrs.ts` math and (MVP)
  never write to `cards` or `reviewLogs`.
- R7. Every AI call goes through `queueAi` — single-flight, and privacy-
  gated by the source card's `fileId`. A card whose source file/folder is
  personal is never sent (⇒ R2 fallback).
- R8. Same local-only policy as the rest of the app — no cloud fallback for
  either the question-generation or the grading call.

## Non-goals

- Changing FSRS-4.5 parameters, intervals, stability/difficulty, or
  `MIN_INTERVAL_DAYS`. The Again schedule is #7's business.
- Persisting the relearn episodes as durable analytics data in the MVP
  (a considered Option B; deferred — see design).
- Reworking `#7`'s requeue placement/counting — this spec supplies the
  *content* shown when a requeued Again card comes up, not the queue policy.
- A separate practice route/UI — relearn happens inline in the existing
  tray.
- Semantic answer-similarity scoring in code — "%off" is the model's
  judgment (client only owns the `≤73%` threshold and the cycle cap).

## Edge cases

- **Cards with no natural expected answer** (e.g. a note-kind card with only
  a front, or an MCQ where "answer" is the marked choice): derive the
  expected answer from `back` / the `correct` choice text; if none exists,
  fall back to R2 (retype) or skip relearn.
- **Unparseable model output** (bad JSON from generation or grading):
  treat as a generation failure for that cycle → R2 fallback; never
  fabricate a loss or a verdict (mirrors the `/question` grading rule).
- **Repeated low scores:** the R5 cap bounds an endless `loss ≤ 73%` loop.
- **Multiple Again cards in one session:** each spawns its own relearn cycle
  when that card is reached in the queue.
- **Personal source file:** never sent (R7); R2 retype fallback instead.
- **Student closes the tray (×) mid-relearn:** the ephemeral placeholder and
  cycle state are dropped (they were never persisted); the original card's
  schedule already reflects the Again rating.
- **Does relearn replace or accompany #7's plain requeue?** — resolve in
  design (leaning: the AI relearn *is* the requeue when AI is reachable;
  #7's plain re-show is the offline path).
