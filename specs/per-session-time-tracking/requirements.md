# Per-session work/break time

## Problem

The work-vs-break time shown at the bottom of the editor is a single
running total, and — worse — it is **destroyed on every `/end`**.
`resetSession()` (`src/lib/store.ts`) clears `sessionEvents`, and the
analytics page (`src/routes/analytics.tsx`) computes its all-time totals
and 14-day focus chart by folding `sessionEvents`. So each `/end` wipes the
history the analytics page depends on: the data is neither per-session nor
durable. Issue #10: "current work-to-break data is static and not per
session"; it wants time worked / on break isolated **per session** and
framed as "children of the note itself," then submitted to analytics.

Who hits this: anyone who runs more than one `/start … /end` cycle — the
second session's `/end` has already erased the first's contribution to
analytics.

## Requirements

- R1. Each work session is captured as its **own record** with its own
  worked time and break time (not a single global total).
- R2. A session record is **durable** — finalizing a session (`/end`) must
  not destroy prior sessions' data (fixes the `resetSession` data loss).
- R3. A session is associated with the note/file it happened in ("children
  of the note," per #10) so analytics can attribute focus to material.
- R4. The live bottom-bar timer reflects the **current** session only
  (in-progress worked/break), starting fresh each `/start`.
- R5. The analytics page aggregates over the **historical session records**
  (all-time totals, 14-day chart, per-note attribution), not the volatile
  live event list.
- R6. Existing behavior preserved: `/start /break /resume /end` still work;
  `/end` still writes its in-note stats block and AI summary.

## Non-goals

- Real-time cross-device session merging semantics beyond the existing
  last-write-wins sync (session records append; they don't need CRDT
  merge).
- Pomodoro rules, goals, or notifications — just accurate per-session
  accounting.
- Retroactively reconstructing sessions already lost to prior `/end`
  wipes (seed forward from this change).
- Changing the `/end` in-note stats block format (only its data source).

## Edge cases

- `/start` without `/end` (user leaves): an unfinalized session — the live
  bar shows it; it becomes a record only when ended (or on next `/start`,
  design decides how to finalize a dangling session).
- Multiple `/break`/`/resume` within one session: worked and break
  intervals accumulate correctly into that one record (reuse
  `computeSessionStats`).
- A session spanning two notes (user switches files mid-session): decide
  attribution (session's active file at `/start`, or the file at `/end`) —
  design question.
- Sync: session records must round-trip (they are study data; today's
  `sessionEvents` already sync — the new records replace/augment that).
- Migration: current in-flight `sessionEvents` shouldn't crash analytics
  during upgrade.
