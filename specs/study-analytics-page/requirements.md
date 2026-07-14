# User analytics page

> design.md and tasks.md deferred — this pass is requirements only.

## Problem

Focus/break time is already tracked (`sessionEvents`, `computeSessionStats`
in `src/lib/store.ts`) and shown live in the status bar during a session,
but there's no way to look back across sessions — no history, no trends,
no view of how study habits (or question/vocab performance, once graded —
see the other new specs) look over time.

## Requirements

- R1. A single dedicated page (not per-file) shows a user's aggregate
  focus/break time and study usage habits across all past sessions, not
  just the current one.
- R2. Once question grading (`specs/question-grading-and-flagging/`) and
  card review (`specs/cards-and-fsrs-review/`) exist, this page also
  surfaces the data they produce: correct/incorrect ratios, common tags,
  review-due/reviewed counts — the analytics page is the aggregate view
  over data those features generate, not a separate tracking system.
- R3. This page reads existing/synced data; it doesn't introduce new
  data collection beyond what the session timer, grading, and card
  features already produce.
- R4. Works from local-only data when the backend isn't enabled (today's
  default) — it just has less history to show (whatever's in this
  browser's `localStorage`) rather than being unavailable.

## Non-goals (this pass)

- Cross-device aggregate analytics — R4 already covers what happens
  without the backend; once the backend (`specs/backend-persistence/`) is
  enabled, this page naturally sees everything synced to it, but no new
  aggregation logic is required on the backend side for that to work.
- Exporting analytics data in a new format — the existing Download modal
  already exports full session data; this page is a _view_, not a new
  export path.
- Goal-setting / streaks-with-notifications features. Just showing the
  data, not gamifying it.

## Open questions

- Exact chart/metric set for R1 (e.g. daily/weekly focus-time trend,
  work-vs-break ratio) — a reasonable v1 could be quite minimal (totals +
  a simple time-series) without trying to cover everything at once.
- Where this page lives in navigation (a new route alongside the editor,
  most likely — needs a concrete decision at design time).
