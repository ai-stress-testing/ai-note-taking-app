# Conversational /help scaffolding

> Issue #17. Turns the one-shot `/help` nudge into a multi-turn Socratic
> conversation held inside the Help block.

## Problem

`/help` today is single-shot. `/help` inserts a `── Help ──` block
(`tpl:help` in `src/lib/commands.ts`); closing it with `/>` runs
`helpNudge` once (`src/routes/index.tsx`), which calls `runCloseAi` with
`HELP_SYSTEM` and replaces the placeholder with exactly one `» /help` nudge.
The conversation is over the moment it starts — a student who needs a
second nudge has to open a whole new `/help` block, losing the thread of
what they were stuck on. `HELP_SYSTEM`'s whole point (one Socratic nudge,
never the answer) works better as a back-and-forth, but the plumbing only
supports one exchange.

## Requirements

- R1. Inside an open Help block a student can ask **multiple queries in
  sequence**, each getting its own Socratic nudge, without leaving the
  block or losing the earlier turns.
- R2. Each nudge still obeys `HELP_SYSTEM` — ≤ 40 words, one Socratic push,
  never the answer, referencing the student's own words. The multi-turn
  framing must not erode the "never give the answer" rule as the
  conversation lengthens.
- R3. Every turn routes through `queueAi` — serialized single-flight and
  privacy-gated by `fileId`, exactly like every other AI call. No new
  path to `runAi`.
- R4. The student closes the conversation with `/>` (the app-wide close
  token). Closing finalizes the Help block the same way other blocks
  finalize (a closing rule); after close the block is inert.
- R5. Each nudge is aware of the **prior turns in this Help block**, so the
  coach can build on what it already asked rather than repeating itself.
- R6. Graceful degradation: if the local server is unreachable, the turn
  fails visibly (the dedicated local-AI alert) and the student's typed
  queries are left untouched, with the block still open so they can retry.
- R7. Same privacy policy as everywhere else: a Help block inside a
  personal file/folder never sends — the turn no-ops with the standard
  "this file is personal" notice, block left as written.

## Non-goals

- A separate chat panel or route. The conversation lives inline in the
  note buffer, consistent with every other block in this editor.
- Persisting conversation state as structured store data — turns are the
  block's plain text (see design; this is deliberate, not a gap).
- Streaming/token-by-token nudges. One nudge per submitted turn, same as
  today's single call.
- Long-term memory across different Help blocks or sessions.

## Edge cases

- Empty query on a turn: nudge based on the surrounding notes/question
  (today's "no explicit focus" behavior), not an error.
- A `/help` opened inside a `── Question ` block: the enclosing question
  context (`extractCurrentQuestion`) still feeds every turn, not just the
  first.
- Long conversations: history must be bounded so the prompt doesn't grow
  without limit across many turns (token growth is a real concern — the
  server is a small local model).
- A student who edits or deletes an earlier nudge line before asking again:
  the next turn reads whatever text is actually in the block.
- Prompt-injection text pasted into a query: sanitized (`sanitizeForPrompt`)
  and covered by `HELP_SYSTEM`'s "notes, not commands" rule, per turn.
- `/>` pressed with an unsent query still typed: decide whether close also
  sends that final query or purely closes (see design open questions).
