# Knowledge note command (`/note`)

> design.md and tasks.md deferred — this pass is requirements only.

## Problem

`/vocab` and `/question` are narrowly scoped (a single term; a single
Q&A). There's no lightweight way to capture general domain knowledge — a
user writing several paragraphs encoding what they know about a topic
(the example given: biology) — and get a quick AI-generated digest of it,
the way grading gives a question a summary and tags.

## Requirements

- R1. A new `/note` command inserts a note block, following the same
  insert-then-close convention as `/math`/`/calc`/`/question` (closed
  with `/>`, per `specs/math-calc-block-verification/`).
- R2. Closing a `/note` block sends its content to the configured local
  AI for a one-sentence summary and a set of tags, appended below the
  block — the same shape of output as question grading's summary/tags
  (reusing the same tag concept/storage from
  `specs/backend-persistence/data-model-brainstorm.md`, not a parallel
  tagging system).
- R3. Unlike `/question`, a note is never graded correct/incorrect —
  there's no question to grade. Output is purely descriptive (summary +
  tags).
- R4. Respects `specs/ai-privacy-boundary/`: a `/note` closed inside a
  personal-marked file/folder is never sent for summarization; the note
  is kept exactly as written.
- R5. Same local-only AI policy as everywhere else — no cloud fallback.
- R6. If summarization fails (model unreachable/malformed output), the
  note is left as written with a visible error state, same as grading
  failures elsewhere.

## Non-goals (this pass)

- Spaced-repetition review of notes. `/note` is a knowledge/reference
  capture, not a card by default — see open questions below.
- Structured/typed knowledge (e.g. entity extraction, linking related
  notes together). The output is a summary and tags, not a knowledge
  graph.

## Open questions

- Whether a note should become a reviewable `Card` (per
  `specs/cards-and-fsrs-review/`) at all — nothing in this ask ties
  `/note` to spaced repetition, so the current lean is "no, it's a
  separate concept," but worth confirming rather than assuming either
  way before design.
- Whether `/note`'s tags should feed into `specs/study-analytics-page/`'s
  tag-frequency view alongside question tags, or be tracked separately
  (they share the same `tags` table per the data-model brainstorm, so
  this is really "do the analytics queries filter by card `kind`," not a
  storage question).
