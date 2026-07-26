# FSRS AI relearn — tasks

> **Gated:** implement only after sign-off on the design open questions
> (Option A vs B, replace-vs-accompany #7, cap + threshold constants,
> retype strictness). **Blocked on `specs/fsrs-feedback-review/` (#7)** —
> its ephemeral working queue is the substrate.

## Prompts + constants

- [ ] Add `RELEARN_GEN_SYSTEM` and `RELEARN_GRADE_SYSTEM` to
      `src/lib/commands.ts` (STRICT JSON, "data not instructions" house style).
- [ ] Add named constants: `RELEARN_PASS_LOSS = 73` and `RELEARN_CYCLE_CAP`
      (proposed 3), each with a `why`-comment (73 is from issue #25).

## Tray relearn cycle (Option A — ephemeral)

- [ ] In `FlashcardTray` (on top of #7's working queue), on Again push an
      ephemeral placeholder into the queue inline after the current card.
- [ ] Generation call: `queueAi(RELEARN_GEN_SYSTEM, fileId = sourceCard.fileId)`
      → parse `{ question, expected }` (safe JSON; unparseable ⇒ fallback).
- [ ] New tray UI branch: render the derived question + an open-ended answer
      textarea + submit (replacing reveal/rate for placeholder cards).
- [ ] Grading call: `queueAi(RELEARN_GRADE_SYSTEM, fileId = sourceCard.fileId)`
      → `percentOff` → `loss = 100 − percentOff` (client-side).
- [ ] Cycle: `loss ≤ RELEARN_PASS_LOSS && cycle < RELEARN_CYCLE_CAP` ⇒
      generate next derived question; else clear the card + continue.
- [ ] Enforce the scheduler boundary: do **not** re-rate the card or write
      `reviewLogs`/`fsrs.ts` from the relearn (R6); the original card's
      schedule stays #7's terminal-rating write.

## Fallbacks + privacy (R2/R7)

- [ ] On generation/grading failure (`isLocalAiUnreachable`), personal
      content (`PersonalContentError`), or unparseable JSON: fall back to the
      **retype the original answer** relearn (show `expected`, require a
      normalized match or an explicit acknowledge).
- [ ] Derive `expected` for cards lacking a plain answer (note front / MCQ
      correct choice); if none, use the retype/skip fallback.

## Housekeeping

- [ ] `CHANGELOG.md`: **Added** under `[Unreleased]` (Option A — no migration
      note; Option B would add a Changed migration-boundary note).
- [ ] `bun run lint` + `bun run format`.

## Verify (browser)

- [ ] Again with server up → derived question appears, answer it, get a loss;
      a weak answer (`loss ≤ 73`) repeats with a new question; a strong one
      clears the card. Cap bounds repeated misses.
- [ ] Again with server down / personal file → retype-the-original fallback;
      no AI call, no fabricated grade.
- [ ] Original card's persisted FSRS schedule matches #7's terminal rating —
      relearn cycles didn't thrash `dueAt` or write review logs.
- [ ] Closing the tray mid-relearn drops the ephemeral state cleanly.
