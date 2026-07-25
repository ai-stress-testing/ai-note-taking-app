# FSRS feedback-loop review — design

> Pauses for sign-off. Presents options + trade-offs; the recommendation is
> explicit but not committed until approved.

## Context

`/fsrs` builds a queue of up to 10 due cards and hands their ids to
`FlashcardTray` (`src/components/FlashcardTray.tsx`), which walks them once,
calling `rateCard(id, rating)` per card. `rateCard` runs `reviewCard`
(`src/lib/fsrs.ts`) — rating 1 ("Again") gets `MIN_INTERVAL_DAYS` (~10 min)
and the card leaves the tray. Seed data: `seedCards()` returns 8 starter
cards, gated by `cardsSeeded`, injected at store init and in `migrate`.

The key architectural boundary: **the FSRS scheduler decides *persisted*
scheduling; the session queue decides *what the user sees next this
sitting*.** #7 changes the session queue, not the scheduler.

## Approach — the session queue (three options)

**Option A — ephemeral in-tray relearn (recommended MVP).** Keep the
requeue entirely inside `FlashcardTray` session state:
- The tray holds a working queue (array of card ids). On "Again", the card
  is **re-appended** (e.g. after N intervening cards, or to the end) and
  the user must clear it before the session completes.
- Persisted scheduling: write the FSRS result **once per card, on its
  terminal rating** (the rating that isn't "Again", or the last attempt),
  so intermediate "again"s don't thrash `dueAt` (R5). Alternatively, log
  each attempt to `reviewLogs` but only apply the terminal schedule — an R6
  decision.
- Completion is when the working queue (base + requeues) is empty ⇒
  attempts = 10 + m naturally (R2), and `specs/fsrs-session-review-count/`
  reports it honestly (R3).
- Bounded relearn: cap requeues per card (e.g. surface after 3 "again"s as
  "keep practicing" and allow moving on) to avoid an infinite loop.

**Option B — persisted learning-steps queue in the store.** Model Anki
learning steps as store state (a `learning` queue with step timers). More
faithful to Anki, survives reload mid-session, but adds persisted state,
migration, and sync surface for a within-sitting concern. Heavier than the
problem needs for MVP.

**Option C — time-budget session.** User sets a duration; `/fsrs` keeps
serving due + requeued cards until time elapses or the queue clears.
Composes with A (A defines requeue; C defines the stop condition). Good as
an *option on top of* A, not a replacement.

**Recommendation:** **A now, C as an optional mode later.** A delivers the
feedback loop (R1/R2) with no new persisted state, keeping the scheduler
untouched (R5) and reusing the tray. B is deferred unless mid-session
persistence becomes a requirement.

## Seed-card removal (R4)

- Stop seeding new profiles: `cards: seedCards()` → `cards: {}` and
  `cardsSeeded` handling in store init + `migrate` so **existing** users
  keep their cards (only new profiles start empty).
- Offer an **opt-in starter deck**: a button ("load starter deck") that
  calls `seedCards()` on demand, so the demo cards remain available without
  being forced. Keep `seedCards()` for that purpose.
- Update README (it advertises "8 starter cards ship in") and the
  fresh-profile empty-state copy to point at `/card`/`/vocab`/`/question`.

## Data model changes

- **Option A: none persisted** — the working/requeue state is tray-local
  `useState`. `reviewLogs`/`cards` write through the existing `rateCard`
  path (possibly adjusted for terminal-only scheduling, R5/R6).
- Seed removal changes store init + `migrate` defaults (record the change
  in `CHANGELOG.md`; it's a fresh-profile behavior change, not a migration
  that touches existing data).
- If Option B/C are later adopted, they add store state + a `version` bump.

## Alternatives considered

- **Change the scheduler so "Again" stays due immediately** and re-pull
  from the store mid-session. Rejected: couples the persisted schedule to
  the session UI, thrashes `dueAt`, and violates the scheduler/queue
  boundary (R5). The requeue belongs in the session layer.
- **Keep the fixed-10 model, just re-add missed cards at the end.**
  Partial; doesn't give the Anki "relearn until it sticks" feel and still
  reports a misleading completion. A's interleaved requeue is closer to the
  intent.
- **Delete seed cards from existing users on upgrade.** Rejected — never
  destroy a user's data; only change what new profiles get.

## Open questions (for sign-off)

- **reviewLogs granularity (R6):** log every attempt (richer analytics,
  more rows) vs only the terminal rating (cleaner, matches persisted
  schedule). Affects the analytics ratings chart.
- **Requeue placement:** end-of-queue vs after-N-cards (spaced) vs a small
  learning-steps timer. Leaning after-N (spaced) for better relearning.
- **Requeue cap / escape hatch** to bound repeated "Again".
- **Time-budget mode (Option C):** include in this pass or defer?
- **Starter deck:** opt-in button vs first-run prompt vs nothing.
