# Card flag semantics — design

## Context

`Card.flagged` already exists as a synced boolean (`src/lib/store.ts`,
`syncCardSchema` in `src/lib/sync-schema.ts`), with `toggleCardFlag`
already wired into the review tray. The data model is correct; what's wrong
is the _meaning attached to it in copy_ and the _absence of a place to act
on it_. So this is mostly a copy/semantics correction plus a hand-off
boundary to the management view — deliberately not a data change.

## Approach

### 1. Correct the copy (owned here)

- `src/components/FlashcardTray.tsx`: change the flag button `title` from
  "come back to" wording to source-maintenance wording, e.g.
  _"Flag: source content may be outdated"_ / _"Unflag"_. `aria-pressed`
  stays.
- `src/routes/analytics.tsx`: the "N flagged" tile label should read as
  "needs review/maintenance" rather than implying a recall queue. Keep it
  a count here; the actionable list lives in the management view (#8).
- Reconcile the stale description in
  `specs/question-grading-and-flagging/` R3 (a note/cross-reference, since
  that spec predates this clarification). Do not silently diverge — update
  the words there to point at this spec's meaning.

### 2. Surface flagged cards (boundary with #8)

The mechanism to _list and operate on_ flagged cards is the management
view specified in `specs/fsrs-card-management/`. This spec fixes only the
contract that view relies on:

- "Flagged" is a first-class filter/segment in the management view: the
  set `Object.values(cards).filter(c => c.flagged)`.
- `toggleCardFlag` is the shared clear/set action from both the review
  tray and the management view — one action, two entry points, no new
  store code needed here.

No new store action, selector abstraction, or component is introduced by
_this_ spec. If the management view wants a memoized `flaggedCards`
selector it defines it there; wrapping a one-line `.filter` in a shared
selector is below the bar the decision ladder sets.

## Data model changes

None. `flagged: boolean` on `Card` and in the sync wire format is
sufficient. No migration, no new field, no schema bump.

## Alternatives considered

- **Add a second field to separate "outdated source" from "review again".**
  Rejected: no requirement asks for two markers, and the issue is explicit
  that the existing flag _is_ the source-maintenance marker. Adding a field
  would mean a `Card` type change, a `syncCardSchema` change, and a
  migration — all to model a concept nobody asked for (YAGNI).
- **Auto-clear the flag on edit.** Rejected as the default (see edge case):
  the human decides when maintenance is complete; auto-clearing on any
  edit would silently drop the signal after a trivial typo fix.
- **Make flagging bias FSRS (e.g. resurface sooner).** Rejected: violates
  the boundary that flagging is about the _artifact_, not the _memory_;
  scheduling must stay owned by `fsrs.ts`.

## Open questions

- Final tooltip/label wording (product copy, not architecture).
- Whether "refresh from source" is in the first management cut or a later
  follow-up — decided in `specs/fsrs-card-management/`, referenced here.
- Whether analytics' flagged tile should deep-link into the management
  view's flagged filter (nice-to-have; depends on #8's route/section
  shape).
