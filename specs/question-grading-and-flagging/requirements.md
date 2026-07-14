# Question grading, flagging, and session-summary integration

> design.md and tasks.md deferred — this pass is requirements only.

## Problem

`/question` today just inserts a template (`ai: false` in
`src/lib/commands.ts`) — nothing evaluates whether the student actually
got it right, and `/end`'s AI summary (`END_SESSION_SYSTEM` in the same
file) only ever sees the raw session buffer text, not any structured
signal about which questions were answered correctly or what they were
about.

## Requirements

- R1. Closing a `/question` block with `/>` sends the question (and the
  student's answer/work inside it) to be graded for correctness.
- R2. Grading produces three things, appended below the closed question
  block: a correct/incorrect boolean, a one-sentence summary of the
  underlying principle(s) the question was testing, and exactly three
  tags.
- R3. A user can flag any question (a simple manual toggle, no AI
  involved) — a lightweight "come back to this one" marker independent
  of the grading result.
- R4. `/end`'s session summary uses the collected per-question
  one-sentence summaries and tags (from R2, across every question closed
  during the session) as its input, rather than parsing the raw session
  buffer text — a more structured, more accurate basis for the summary
  than today's approach.
- R5. Same local-only AI policy as everywhere else in this app — grading
  is a local model call, no cloud fallback.
- R6. If grading fails (model unreachable/malformed output), the question
  block is left as the student wrote it, with a visible error state — no
  fabricated correct/incorrect verdict ever gets attached silently.
- R7. `/question` supports an MCQ mode: the inserted template includes 4
  empty answer-option brackets by default (e.g. `[ ] ...`), which the
  student fills in and marks one as their answer, instead of (or in
  addition to) today's free-response body.
- R8. Grading (R1/R2) handles both shapes of a closed question block —
  free-response text and MCQ bracket-selection — without the student
  needing to tell it which kind it's looking at.
- R9. Respects `specs/ai-privacy-boundary/`: a question closed inside a
  file/folder marked personal is never sent for grading (R1/R2 no-op;
  R3's manual flag still works since it isn't an AI call).

## Non-goals (this pass)

- Automated grading rubrics / partial credit — R2's boolean is binary,
  not a score.
- Retroactive grading of questions closed before this feature existed.
- Changing how flags (R3) are displayed/filtered across the whole
  workspace — that's a reasonable follow-up (e.g. a "flagged questions"
  view) but isn't required for the flag to exist and be togglable.

## Open questions

- Whether flagging (R3) needs its own persisted field per question or
  can live as plain text/marker in the buffer, same as everything else
  today (this app doesn't have per-block metadata storage yet outside of
  raw text) — the answer likely depends on how the cards/FSRR model in
  `specs/cards-and-fsrs-review/` ends up representing a "question" as a
  first-class entity, since a proper flag really wants a boolean column
  on that entity rather than more text markup.
- Whether R4 should still fall back to raw-buffer parsing when a session
  has zero closed questions (e.g. a pure free-writing session) rather
  than producing an empty/degenerate summary.
- Whether MCQ (R7) becomes the default `/question` template or an
  explicit variant (e.g. `/question mcq`) alongside today's free-response
  shape — the ask was "options for mcq," which reads as adding the
  capability, not necessarily replacing the default; needs a decision at
  design time.
- Exact bracket-marking syntax for "this is my answer" in R7/R8 (e.g.
  `[x]` vs `[ ]`, matching common Markdown checkbox conventions the
  student may already expect).
