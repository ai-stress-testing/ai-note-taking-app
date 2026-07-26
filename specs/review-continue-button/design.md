# Review "continue" button — design

## Context

The review session setup lives in `src/routes/index.tsx`, in the
`case "tpl:fsrs"` branch of `executeCommand`:

```js
const all = Object.values(useStore.getState().cards);
const now = Date.now();
const due = all
  .filter((c) => c.fsrs.dueAt <= now)
  .sort((a, b) => a.fsrs.dueAt - b.fsrs.dueAt)
  .slice(0, 10);
if (due.length === 0) {
  /* toast "no cards due", return */
}
// clean any stale marker, insert a fresh REVIEW_MARKER block, then:
setReviewIds(due.map((c) => c.id));
```

`reviewIds` is `useState<string[] | null>` in the route. It flows:
route → `InlineWidgetLayer` (`reviewIds`, `onCloseReview`) → `FlashcardTray`
(`ids`, `onClose`). The tray anchors to the `REVIEW_MARKER` already sitting
in the buffer; `onClose` strips the marker and calls `onCloseReview`
(`setReviewIds(null)`).

The completion banner is the `done` branch of
`src/components/FlashcardTray.tsx`. It already computes everything the
continue affordance needs:

```js
const dueRemaining = useMemo(
  () => Object.values(cards).filter((c) => c.fsrs.dueAt <= Date.now()).length,
  [cards],
);
const caughtUp = dueRemaining === 0 && againCount === 0;
```

Two facts make this small:

1. `dueRemaining` is exactly the "should continue be offered?" predicate:
   `dueRemaining > 0`. It already excludes "again" cards (rescheduled into
   the future, so `dueAt > now`), satisfying the requirement that "again"
   cards don't trigger continue.
2. The tray's per-session counters (`index`, `ratedCount`, `againCount`,
   and `sessionSize` — a `useState(() => queue.length)` captured once) only
   reset on **remount**. So a fresh session must remount the tray, not just
   swap its `ids` prop.

## Approach

### 1. Extract the fsrs-setup so it can be reused (not duplicated)

Pull the "compute due → (clean+insert marker) → `setReviewIds`" logic out of
the `tpl:fsrs` case into one route-level callback, e.g.
`startReview(lineStart, lineEnd)` returning whether it started. `tpl:fsrs`
calls it as today. This honors the task's "reuse the existing fsrs-setup
path rather than duplicating it."

For **continue**, the tray is already anchored — a `REVIEW_MARKER` block is
present in the buffer. So continue does not need to re-insert a marker; it
only needs to recompute due cards and re-point `reviewIds`. A thin
`continueReview()` callback:

```js
const continueReview = useCallback(() => {
  const all = Object.values(useStore.getState().cards);
  const now = Date.now();
  const due = all
    .filter((c) => c.fsrs.dueAt <= now)
    .sort((a, b) => a.fsrs.dueAt - b.fsrs.dueAt)
    .slice(0, 10);
  if (due.length === 0) return; // button is hidden in this case
  setReviewSeq((n) => n + 1); // force remount (see §3)
  setReviewIds(due.map((c) => c.id));
}, []);
```

(The exact factoring — whether `startReview` and `continueReview` share a
`pickDue()` helper — is an implementation detail; the point is one
due-selection expression, reused.)

### 2. Thread an `onContinue` prop to the banner

`FlashcardTray` gains an optional `onContinue?: () => void`;
`InlineWidgetLayer` passes it through alongside `onClose` (same wiring as the
existing `onCloseReview` → `onClose`). In the route, `onContinue` is
`continueReview`.

In the `done` branch, render the continue button **only when
`dueRemaining > 0`**, next to the existing close button:

```jsx
{
  dueRemaining > 0 && (
    <button className="ed-btn primary" onClick={onContinue}>
      continue
    </button>
  );
}
<button className="ed-btn ghost" onClick={onClose}>
  close
</button>;
```

The existing banner copy stays; when `dueRemaining > 0` the "— /fsrs for
more" tail becomes redundant with a visible button, so it can be dropped or
kept (product copy). When `dueRemaining === 0`, no continue button — the
caught-up / "marked again" states are unchanged.

### 3. Remount for a fresh session

Because the tray's counters are captured on mount, continuing must remount
it. Add a `reviewSeq` counter in the route (bumped by `startReview` and
`continueReview`) and use it as the React `key` on `<FlashcardTray>` in
`InlineWidgetLayer` (thread `reviewSeq` down, or key on `reviewIds`
reference identity — a new array each session already changes identity, but
an explicit seq is clearer and robust to same-ids batches). On continue,
`setReviewIds(newDue)` + bumped key → the tray remounts with fresh
`index`/`ratedCount`/`againCount`/`sessionSize`.

## Data model changes

None. No store fields, no schema, no migration. `reviewSeq` is route-local
`useState`. Everything reuses existing store reads (`cards`, `rateCard`) and
the existing `REVIEW_MARKER` anchor.

## Alternatives considered

- **Reset the tray's internal state via props instead of remounting.**
  Rejected: `sessionSize` is intentionally captured once; adding effect-based
  resets re-introduces the bug class (`useState` initializer vs. prop drift).
  A `key` bump is the idiomatic "new logical instance" signal.
- **Have continue re-run the full `tpl:fsrs` (re-insert the marker).**
  Rejected: the marker is already in the buffer and correctly anchored;
  re-inserting risks marker churn/scroll jumps for no gain. Continue reuses
  the anchor and only swaps ids.
- **Gate continue on `!caughtUp` instead of `dueRemaining > 0`.** Rejected:
  `!caughtUp` is true when `againCount > 0` even with 0 cards due now —
  continue would then find nothing and no-op, showing a button that does
  nothing. `dueRemaining > 0` is the precise predicate.
- **Auto-advance into the next batch without a click.** Rejected (non-goal):
  removes the natural stopping point; the user should choose to keep going.

## Open questions

- Copy when continuing is available: keep "N still due" text plus the button,
  or let the button speak for itself? (Product copy.)
- Whether `startReview`/`continueReview` share a small `pickDue()` helper or
  inline the one-line filter twice — trivial, decide at implementation.
