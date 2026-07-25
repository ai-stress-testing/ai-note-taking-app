# FSRS card & vocab management — design

## Context

The store already exposes `addCard`, `rateCard`, `setCardGrading`,
`deleteCard` (tombstoned), and `toggleCardFlag` (`src/lib/store.ts`). The
one primitive missing for this feature is a **content edit** that changes a
card's authored fields without touching its FSRS schedule (R5). Everything
else is a read-and-dispatch UI layered onto the existing analytics page
(`src/routes/analytics.tsx`), which already reads `Object.values(cards)`
for its tiles. The decision ladder stops at "add one store action + one
management section" — no new route, no new data source, no card-collection
abstraction.

## Approach

**1. New store action `updateCard(id, patch)`.** Adds the only missing
primitive:

```
updateCard: (id, patch: Partial<Pick<Card,
  "question" | "choices" | "front" | "back">>) => void
```

It spreads `patch` onto `s.cards[id]`, sets `updatedAt: Date.now()`
(R3 → sync last-write-wins), and **leaves `fsrs` untouched** (R5). It never
calls AI (R7). Guards on `s.cards[id]` existing (mirrors `rateCard`).
Editing grading fields stays out of scope — `setCardGrading` already
exists if a later spec wants it.

**2. Management section on the analytics page.** A new
`<CardManagement>` section (own component, `src/components/`) rendered on
`analytics.tsx` below the existing tiles. It:

- reads `cards`, `folders`/`files` (to resolve a card's source file name)
  from the store;
- offers filter chips — **all / due now / flagged / question / vocab /
  note** (R2). "due now" reuses the `c.fsrs.dueAt <= Date.now()` predicate
  the tiles already use; "flagged" is `c.flagged` (ties to
  `specs/card-flag-semantics/`);
- lists each card with kind, its identifying text (question/front/term),
  due state, and a flag toggle (reusing `toggleCardFlag`);
- per row: **Edit** (opens an inline form) and **Delete** (calls
  `deleteCard`, with a confirm to prevent accidental loss).

**3. Edit form.** Kind-specific fields:

- vocab/note/card → `front` (+ `back` where applicable);
- question → `question` text and a choices editor (text per choice + a
  radio/checkbox for `correct`).

On save it validates (R-edge: non-empty required fields; a question keeps
≥1 choice and ≥1 marked correct) and dispatches `updateCard`. Invalid
input is blocked with inline feedback rather than writing a broken card.

**4. Stale-grading decision (edge case).** When a question's
`question`/`choices` change and the card had AI grading, the safest honest
behavior is to **clear** `gradedCorrect`/`gradedSummary`/`gradedTags` on
content edit (the old verdict no longer describes the new content), leaving
the card visibly ungraded until re-closed in the editor. `updateCard` does
this only when question/choices are in the patch. Documented as the chosen
resolution to the requirements' open edge case.

## Data model changes

- **New action** `updateCard` (above). No new persisted fields, no
  `sync-schema.ts` change — `content` already round-trips through sync as
  the encrypted card blob, and `updatedAt` already drives LWW.
- No migration: existing cards work unchanged.

## Alternatives considered

- **Reuse `setCardGrading` / a generic `patchCard`.** Rejected: grading
  and content are different concerns; a narrow `updateCard` keyed to
  authored fields keeps the schedule-independence invariant (R5) obvious
  and prevents a caller from resetting `fsrs` by accident.
- **A dedicated `/cards` route.** Rejected per R6/YAGNI: the analytics page
  is already the "look at my study data, locally, never sent to AI"
  surface; management belongs with it, not behind new routing.
- **Bulk multi-select delete as the primary interaction.** Deferred to a
  non-goal: per-card edit/delete plus the flagged filter already lets a
  user act on the flagged set; bulk is an additive nicety, not the floor.
- **Editing resets FSRS (treat an edit as "new card").** Rejected — R5:
  fixing a typo must not make a learned card due again.

## Open questions

- Whether to show the source file per card (nice for orientation, needs a
  `fileId → name` lookup that's cheap but adds a little UI). Leaning yes,
  read-only.
- Whether delete needs an undo (toast with undo) vs a confirm dialog —
  confirm is simpler and matches the destructive-action bar elsewhere;
  undo is a possible follow-up.
- Exact placement/relationship with the flag-semantics copy so the flagged
  filter and the "source may be outdated" framing read consistently.
