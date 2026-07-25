# FSRS card & vocab management — tasks

- [ ] Add `updateCard(id, patch)` to the store (`src/lib/store.ts`):
      spreads authored fields, sets `updatedAt`, leaves `fsrs` intact;
      clears `gradedCorrect`/`gradedSummary`/`gradedTags` when
      `question`/`choices` change. Add to the store type + actions.
- [ ] Build `<CardManagement>` (`src/components/CardManagement.tsx`):
      reads `cards` from the store; renders a filterable list.
- [ ] Filter chips: all / due now / flagged / question / vocab / note
      (reuse the `dueAt <= now` and `c.flagged` predicates).
- [ ] Per-row: identity (kind + text + due/flag state), flag toggle
      (`toggleCardFlag`), Edit, Delete (`deleteCard` behind a confirm).
- [ ] Kind-specific edit form (front/back/term/definition; question text +
      choices editor with correct-marking) with validation (non-empty; a
      question keeps ≥1 choice and ≥1 correct). Dispatches `updateCard`.
- [ ] Mount the section on `src/routes/analytics.tsx` below the tiles;
      keep the "computed locally · never sent to AI" posture (no AI calls).
- [ ] Edge checks: delete a card that's in an open `/fsrs` tray (drops out
      of the queue); edit does not change `fsrs.dueAt`; empty edits blocked.
- [ ] `bun run lint` + browser check: edit a card, confirm content changes
      and schedule is unchanged; delete a card, confirm it's gone and
      tombstoned.
