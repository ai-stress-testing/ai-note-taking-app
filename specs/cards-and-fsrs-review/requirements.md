# Cards as a first-class entity + FSRS review sessions

> design.md and tasks.md deferred — this pass is requirements only.
> **Depends on `specs/backend-persistence/`** — this genuinely needs
> durable, queryable storage (due dates, review history per card), which
> plain `localStorage` text buffers don't give us. Don't start
> implementation before that lands.

## Problem

`/vocab`, `/card`, and `/fsrs` today are inert text templates (`src/lib/
commands.ts`) — there's no actual spaced-repetition scheduling, no
concept of a review session, and no shared identity between "a question
I asked myself" and "a vocab term" even though both are, conceptually,
the same kind of thing: something you might want to be quizzed on again
later.

## Requirements

- R1. **Card** is the general concept. A Question is a card. A Vocab
  entry is a card. Not every card is a Question (vocab cards aren't
  questions; other card types may exist later) — the data model must
  reflect Card as the base concept with Question/Vocab as specific kinds
  of it, not treat "question" as the default and vocab as a special case
  bolted on.
- R2. Every card carries FSRS scheduling state (at minimum: stability,
  difficulty, due date, and review history) so "due for review" is a real
  computed property, not a manual list.
- R3. Invoking `/fsrs` inserts due cards directly into the current
  session/buffer for review, rather than an empty template the user fills
  in by hand — the user reviews whatever the algorithm says is due, right
  where they're working.
- R4. Reviewing a card in that inserted block captures a rating (again /
  hard / good / easy) and updates that card's FSRS state accordingly.
- R5. Cards created via `/question` (once graded — see
  `specs/question-grading-and-flagging/`) and `/vocab` both become
  reviewable cards under R1-R4 without the user doing anything extra to
  "convert" them.

## Non-goals (this pass)

- A dedicated flashcard-deck browsing/management UI — R3's "insert due
  cards into the session" is the only review entry point for now.
- Custom/user-defined FSRS parameters (retention target, custom weights)
  — use sane library defaults.
- Cross-device review-state conflicts beyond what `specs/
  backend-persistence/`'s last-write-wins sync already handles — this
  spec doesn't add a second conflict-resolution mechanism.

## Open questions

- What exactly counts as a "card-worthy" question — every closed/graded
  `/question`, or only ones the user explicitly marks (e.g. via the flag
  from the grading spec, repurposed as "add to review deck")?
- How many due cards `/fsrs` inserts at once, and whether that's
  configurable.
- Whether an incorrect answer during grading (see the grading spec)
  should automatically bias that card's next FSRS interval, or whether
  FSRS state only updates from explicit `/fsrs` review ratings (R4) and
  the two systems stay independent.
