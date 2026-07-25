# Card flag semantics: "source may be outdated", not "come back later"

## Problem

The flag on a card (`Card.flagged`, toggled by `toggleCardFlag` in
`src/lib/store.ts`) is presented as a personal-recall bookmark:

- `src/components/FlashcardTray.tsx` tooltip: _"Flag this card to come back
  to"_ / _"come back to this later"_.
- `specs/question-grading-and-flagging/` R3 also describes it as a
  _"come back to this one"_ marker.

That is the wrong meaning. A flag does **not** mean "I want to review this
again later" — FSRS scheduling already owns _when_ a card comes back. A
flag means: **while going through the current cards, this card's SOURCE
CONTENT may be outdated or wrong**, so the user should later run a card
operation on it (edit / refresh / delete). It marks the _card as an
artifact needing maintenance_, not the _memory as needing another rep_.

Today there is nowhere to act on that signal: analytics shows a flagged
_count_ (`src/routes/analytics.tsx`, "N flagged") but offers no way to see
or operate on the flagged cards. So the flag currently means nothing
actionable regardless of which label you put on it.

## Requirements

- R1. Flag semantics are documented and surfaced as: _marks a card whose
  source content may be outdated / needs maintenance_, distinct from FSRS
  scheduling. All user-facing copy asserting "come back to this later" is
  corrected.
- R2. The flag toggle stays a manual, non-AI, instantly-reversible action
  during review (unchanged behavior; only meaning/label changes).
- R3. Flagged cards can be **found** outside of a review session — the user
  can see the set of flagged cards, not just a count, so the "act on it
  later" step is actually reachable.
- R4. From that surfaced set, the user can run card maintenance
  operations — edit, delete (and any "refresh from source" affordance) —
  on flagged cards. The operations themselves are specified by
  `specs/fsrs-card-management/` (issue #8); this spec owns only the
  _flag meaning_ and _how flagged cards surface for_ those operations, and
  cross-references rather than duplicates the CRUD design.
- R5. Copy for the flag (tooltip, any legend/label) reflects R1 wherever
  the flag appears (review tray now; management view per #8).

## Non-goals

- Building the card-management CRUD UI itself — owned by
  `specs/fsrs-card-management/`. This spec stops at "flagged cards are
  filterable/visible so that UI can list them."
- A separate "review this again" bookmark. If a distinct
  personal-recall marker is ever wanted, it is a _new_ concept, not this
  flag; not in scope here.
- Auto-detecting outdated source content (no AI staleness check). The flag
  is a manual human judgment.
- Changing the FSRS effect of flagging (there is none, and there should be
  none — flagging must not alter scheduling).

## Edge cases

- A flagged card whose source file was deleted (`fileId` dangling or
  `null`): still flaggable and still surfaced for edit/delete; "refresh
  from source" simply has no source to pull from.
- A flagged card that the user edits to fix: editing does not auto-clear
  the flag — clearing is a separate manual toggle (the user decides when
  the maintenance is done). Confirm this default at design.
- Seed/starter cards can be flagged like any other; if seed removal
  (`specs/fsrs-feedback-review/`) lands, nothing here depends on their
  existence.
- Flag state already syncs (`flagged` in `syncCardSchema`); no new sync
  behavior is introduced.
