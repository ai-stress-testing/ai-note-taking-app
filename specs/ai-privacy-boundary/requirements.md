# AI privacy boundary: personal vs. normal files

> design.md and tasks.md deferred — this pass is requirements only.

## Problem

Every AI-assisted feature in this app — `/help`, closing a `/math` or
`/calc` block (`specs/math-calc-block-verification/`), grading a
`/question` (`specs/question-grading-and-flagging/`), summarizing a
`/note` (`specs/knowledge-note-command/`), and `/end`'s session summary —
works by sending buffer content to the configured local AI server. That
server is local (no cloud fallback exists in this app by design), but
"local" isn't the same as "private from the user's own perspective on
their own content": the app has no concept of *some* content being off
limits to any AI call at all, even a local one. A user journaling
something genuinely personal alongside their study notes currently has no
way to guarantee that content never gets bundled into an AI prompt.

This is a distinct concern from `specs/backend-persistence/`'s R9
(end-to-end encryption at rest/in sync) — that spec protects content from
a compromised *backend*; this one is about whether content is ever
included in an outbound *AI request* in the first place. A file can be
fully encrypted at rest and still get sent to Ollama in plaintext the
moment a feature processes it, because AI processing requires decrypted
content to work on. Encryption and AI-eligibility are two independent
axes, not the same guarantee twice.

## Requirements

- R1. Files (and, as a bulk convenience, whole folders) can be marked
  **personal**. Content under a personal marker is never included in any
  AI request, for any current or future AI-assisted feature — enforced
  at one central chokepoint (wherever buffer content is gathered before
  being handed to `runAi`), not as a per-feature checklist that new
  features have to remember to honor.
- R2. Marking a folder personal is the default way a user protects
  everything in it; an individual file can still be marked personal (or
  explicitly un-marked) independent of its folder, for cases that don't
  fit a whole-folder boundary.
- R3. Existing files/folders default to **normal** (today's behavior:
  AI-eligible) — this is additive, not a silent behavior change for
  content that exists before this feature ships.
- R4. Study-habit/usage data (session focus/break timing, review counts,
  anything from `specs/study-analytics-page/`) is **private by default**,
  independent of R1-R3's per-file marking — it is never included in an
  AI request unless a specific future feature asks for it and the user
  has explicitly opted that feature in. This is stricter than the
  file-level default (R3) on purpose: habit data describes the *user*,
  not a note's *content*, and defaulting it to shared would be a
  meaningfully different privacy posture than defaulting note content to
  shared.
- R5. `/end`'s session summary currently sends raw counts and durations
  in its prompt (see `runEndSession` in `src/routes/index.tsx`) — under
  R4 this stops being sent by default. `/end` still works (the
  per-question summaries/tags from grading remain its primary input per
  `specs/question-grading-and-flagging/` R4); it just stops forwarding
  raw habit metrics unless the user opts in.
- R6. The UI makes a file/folder's personal/normal status visible at a
  glance (e.g. in the sidebar and the editor pane) — a user should never
  have to guess whether AI features are live in the file they're
  currently in.
- R7. Invoking an AI-triggered command inside a personal file gives
  clear, visible feedback that the AI step was skipped (not a silent
  no-op that leaves the user wondering why nothing happened) — e.g.
  `/math` still inserts its block, but closing it shows "not sent — this
  file is personal" rather than quietly doing nothing.

## Non-goals (this pass)

- Per-sentence/paragraph redaction within an otherwise-normal file — the
  boundary is file/folder-level, not finer-grained content filtering.
- Changing how encryption (`specs/backend-persistence/` R9) applies —
  personal and normal files are encrypted identically at rest; this spec
  only governs outbound AI calls.
- A way to selectively opt a *specific* habit metric into AI use (R4) —
  "the user explicitly opts a feature in" is a per-feature, not
  per-metric, decision for now.

## Open questions

- Whether "personal" should be the literal label shown in the UI, or
  something less clinical (e.g. "private") — a copy decision, not a
  behavioral one.
- Whether marking a folder personal retroactively affects files already
  inside it, or only new files created after the mark (R2 assumes
  inheritance, but the retroactive case needs a concrete answer).
- Whether R7's feedback should be inline (in the block itself) or a
  toast/status-bar message — consistent with how other AI failures are
  surfaced today (see `isLocalAiUnreachable` handling in
  `src/routes/index.tsx`).
