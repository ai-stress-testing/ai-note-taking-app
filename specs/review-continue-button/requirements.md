# Review "continue" button

## Problem

When an FSRS review session finishes, the tray shows a completion banner
(reviewed count, whether you're caught up) with a single **close** button.
If more cards are still due — e.g. you reviewed the first 10 of 25 due cards
(a session is capped at 10) — the banner tells you "N still due — /fsrs for
more", but acting on that means closing the tray, returning to the editor,
and typing `/fsrs` again. For a user grinding through a due pile, that is
friction on the most common next action.

## Requirements

- The completion banner gains a **continue** button that, in one click,
  starts a fresh review session on the next batch of due cards — no closing,
  no retyping `/fsrs`.
- Continuing produces a genuinely fresh session: the progress counter,
  reviewed count, and "again" count reset for the new batch.
- The button appears only when continuing would actually do something —
  i.e. when there are still cards due now. When nothing is due, the banner
  shows its existing "caught up" state with just the close button (no
  dead/disabled continue button to click).
- Cards just rescheduled as "again" (which come back ~minutes later, not
  immediately) do **not** count as "still due now" for the purpose of
  showing continue — continue is for cards that are due right now.

## Non-goals

- No new command, no new store fields, no change to how a session is set up
  beyond reusing the existing `/fsrs` path.
- No configurable batch size — the next batch uses the same cap as `/fsrs`.
- No auto-continue / infinite loop — each continue is an explicit click.
- No change to the close button's behavior.

## Edge cases

- Exactly caught up (0 due, 0 again): existing "✓ caught up" banner, close
  only.
- Some marked "again" but 0 due now: existing informational banner ("…
  marked again"), close only — no continue (nothing is due _now_).
- More than one batch still due: continue loads the next batch; when that
  finishes the banner re-evaluates and offers continue again until the due
  pile is empty.
