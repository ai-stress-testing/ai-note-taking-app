# FSRS card & vocab management (CRUD on the analytics page)

## Problem

Cards and vocab drive FSRS review, but once created they are effectively
write-only. The store can create (`addCard`), schedule (`rateCard`), grade
(`setCardGrading`), flag (`toggleCardFlag`), and delete (`deleteCard`) —
but there is **no way for a user to view the full set of their cards, edit
a card's content, or delete one from the UI**. The analytics page
(`src/routes/analytics.tsx`) shows aggregate counts ("N cards, M due, K
flagged") but no per-card list and no operations.

Consequences today:

- A card with a typo, a wrong answer marked correct, or outdated source
  content is stuck that way — the only "fix" is to create a duplicate.
- Flagged cards (`specs/card-flag-semantics/`, issue #12) mark
  "source may be outdated" but there is nowhere to act on that: no list,
  no edit, no delete surface.
- Seed/starter cards a user doesn't want can't be removed.

Who hits this: any user who reviews for more than a few sessions and
accumulates cards that need correction or pruning.

## Requirements

- R1. A management view lists the user's cards and vocab with enough
  identity to recognize each (kind, front/question text, due state,
  flagged state).
- R2. **View**: the list is browsable and filterable by at least: all /
  due-now / flagged (`specs/card-flag-semantics/`) / by kind
  (question / vocab / note).
- R3. **Edit**: a user can edit a card's editable content in place —
  vocab term/definition (`front`/`back`), note `front`, and question
  `question` text + `choices` (text and which is correct). Editing updates
  `updatedAt` so sync last-write-wins carries the change.
- R4. **Delete**: a user can delete a card. Deletion must tombstone for
  sync (so it doesn't resurrect from another device) — `deleteCard`
  already does this; the requirement is that the UI reaches it.
- R5. Editing a card **does not reset its FSRS schedule** — correcting a
  typo must not make a well-learned card due again. Content and schedule
  are independent.
- R6. Lives on the analytics page (a section/subview there), not a new
  top-level route, unless design finds a strong reason otherwise. It reads
  and writes the same local-first store; no backend requirement beyond the
  existing optional sync.
- R7. Operations are consistent with the local-only, no-AI posture of the
  analytics page ("computed locally · never sent to AI") — editing/
  deleting a card is never an AI call.

## Non-goals

- Bulk multi-select operations beyond what's needed to act on the flagged
  set (a per-card delete/edit is the floor; bulk delete is a possible
  design add, not a hard requirement).
- Creating cards from this view — cards are still authored via `/card`,
  `/vocab`, `/question` blocks in the editor. This view manages existing
  cards.
- Re-grading questions with AI from here (grading stays in the editor
  close-block flow). Editing `gradedCorrect`/tags by hand is out of scope
  unless trivially free from the edit form.
- A separate deck/collection abstraction (folders-of-cards). Cards remain a
  flat set keyed by id.

## Edge cases

- **Delete mid-review**: a card deleted from the management view while it
  sits in an open `/fsrs` tray queue. The tray already filters its queue
  to `ids.filter(id => cards[id])` (`FlashcardTray.tsx`), so a deleted card
  drops out; confirm rating a now-deleted card is a no-op (`rateCard`
  guards on `s.cards[id]`).
- **Edit a question's choices** so that zero remain marked correct, or the
  `correct` one is removed: the edit form must keep the card valid (at
  least one choice, and for questions a marked-correct choice) or clearly
  represent an ungraded/invalid state.
- **Edit a card that was AI-graded**: changing the question/choices makes a
  stale `gradedCorrect`/`gradedSummary`/`gradedTags` potentially wrong.
  Decide whether editing clears grading or leaves it (design question).
- **Empty/whitespace edits**: saving an empty front/term should be
  rejected, matching `card-parse.ts` which requires non-empty fields to
  create a card in the first place.
- **Deleting the last card**: allowed (unlike files, there is no "never
  zero cards" invariant); `/fsrs` already handles an empty deck with a
  toast.
