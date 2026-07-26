# Conversational /help — tasks

> Additive; no persisted-state change. One reversible call (Decision 2,
> `/>` flush-then-close) — confirm at review, not blocking to start.

## Command + grammar

- [ ] Add an `/ask` `CommandDef` in `src/lib/commands.ts`
      (`localHint: "help:ask"`, description "Ask another help question —
      keeps the conversation open").
- [ ] In `executeCommand`, add `case "help:ask"`: guard that the caret is
      inside an open `── Help ` block (`parseEnclosingBlock`); if not, no-op.

## Transcript assembly

- [ ] Add a pure helper (`src/lib/prompt.ts` or new `help-thread.ts`) that
      parses an open Help block into an ordered `{ role, text }[]` transcript
      (`» ` ⇒ coach, non-empty plain line ⇒ student; drop `» /help ─ …`
      header lines).
- [ ] Bound history to the last K turns (start K=6) and clamp the assembled
      transcript through `sanitizeForPrompt(..., ~2000)` (keeps the tail).
- [ ] Build the user message: fenced `question` context
      (`extractCurrentQuestion`) + fenced `conversation` transcript + a
      "nudge the LATEST turn, never the answer" instruction. Keep
      `HELP_SYSTEM` verbatim.

## Turn execution (reuse close plumbing)

- [ ] Refactor `helpNudge` to accept the assembled transcript and append a
      turn (insert `thinking…` placeholder at the open block's end → `queueAi`
      with `fileId` → replace with `renderBlock("/help", source, nudge)`),
      reusing `runCloseAi`'s success/failure/placeholder semantics.
- [ ] `/ask` calls that path and leaves the block **open** (no close rule).

## Close semantics (Decision 2 — confirm at review)

- [ ] In `tpl:close`'s `── Help ` branch: if a pending (unsent) query exists,
      flush it as a final turn, then insert `CLOSE_RULE_TEXT` and finalize.
      (Alternative per sign-off: `/>` purely closes.)

## Housekeeping

- [ ] `CHANGELOG.md`: **Added** line under `[Unreleased]` (no migration note
      — nothing persisted changes).
- [ ] `bun run lint` + `bun run format`.

## Verify (browser)

- [ ] `/help`, type a query, `/ask` → nudge appended, block stays open;
      second `/ask` → nudge references the earlier exchange; `/>` closes.
- [ ] One-shot habit still works: `/help`, type, `/>` → single nudge, closed.
- [ ] Server down → turn fails with the local-AI alert; typed queries intact;
      block still open to retry.
- [ ] Help block in a personal file → "this file is personal", nothing sent.
- [ ] Long conversation → prompt stays bounded (history window holds).
