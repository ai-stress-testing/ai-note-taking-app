# Merge card & vocab into one card type (with encoding)

## Problem

`/card` and `/vocab` produce two nearly-identical study cards. A `/vocab`
entry is a term + definition + an "example" line; a `/card` entry is a
front + back. In practice these are the same object — a two-sided
recall card — split across two commands, two block templates, and (in the
data model) two different `kind`s. The duplication shows up everywhere:
two templates in the editor, two `card-parse.ts` branches, two chips and
two edit-form shapes in card management, two labels in the review tray.

Worse, the one thing that _did_ differ — vocab's "example" line — is never
persisted. `parseBlockToCards` reads `term` and `definition` from a
`── Vocab ──` block and throws the example away. So the field that was
meant to make vocab distinctive is dead weight.

The issue's insight (#19): the example is valuable, but not as an
"example". The act of writing your _own_ encoding — a mnemonic, a hook, a
sentence that forces you to connect the term to something you already know
— is what makes a card stick. So: keep that field, rename its intent from
"example" to **encoding**, make it a real persisted field, and fold vocab
and card into a single card type that has it. Vocabulary _is_ a card.

## Requirements

- There is **one** two-sided study card. It has three authored fields:
  - **front** — the term / prompt / question side.
  - **back** — the definition / answer side.
  - **encoding** — the learner's own mnemonic or connection. Optional.
- `/card` inserts this unified template, including an encoding line.
- `/vocab` continues to work (muscle memory, existing docs) but inserts the
  same unified template — it is an alias, not a second shape.
- Closing the block with `/>` creates one unified card. The encoding, if
  written, is captured and persisted (unlike today's discarded example).
- Existing cards survive the change:
  - Every card a user already has from `/vocab` still exists, still has its
    term and definition, and still reviews on its existing FSRS schedule.
  - Every card from `/card` likewise survives unchanged.
  - No card is duplicated, dropped, or reset to "new/due" by the migration.
- The review tray shows the encoding when the back is revealed (it is a
  recall aid, so it belongs with the answer, not the prompt).
- Card management shows the unified card with an editable encoding field and
  a single card filter/segment (not separate card and vocab segments).
- Sync keeps working across the change: a device on the new version and the
  server (and, as far as practical, an older device) do not corrupt or
  reject each other's cards.

## Non-goals

- No change to `question` cards — they remain a separate kind.
- No change to one-sided statement cards (today's front-only `note` cards,
  e.g. the seeded "learning loop" cards). They are a genuinely different
  shape (no back) and are out of scope here. Whether they eventually fold in
  is a separate question (see design open questions).
- No AI involvement in creating, encoding, or grading these cards.
- No bulk "convert my old cards" UI — migration is automatic and invisible.
- Not redesigning FSRS, review flow, or the analytics tiles.

## Edge cases

- A `/vocab` block with a term but no definition, or a `/card` with a front
  but no back: same permissiveness as today (front alone is enough to make a
  card; back optional). Encoding is always optional.
- Old note files that still literally contain a `── Vocab ──` block: closing
  such a block must still create a card (the parser keeps a `── Vocab ──`
  alias), so re-opening an old file doesn't silently fail to make cards.
- A user who edits a card's front/back later: encoding is untouched (it is
  their own aid, not derived from the other fields).
- Sync round-trip: a card created before the change (no encoding) pulls back
  with encoding simply absent, not as an empty string that looks authored.
