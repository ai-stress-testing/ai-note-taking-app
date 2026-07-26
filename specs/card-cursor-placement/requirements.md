# Card/vocab template caret placement

## Problem

When you run `/card` (or `/vocab`), the block template is inserted and the
caret is left **below** the template — after the last line — so you have to
click or arrow back up to the `front`/`term` line before you can type. Every
other authoring command that has an obvious "type here next" spot puts you
there automatically: `/question` lands the caret right after `Q: ` (or in
the first choice bracket when the question text is supplied). Card and vocab
are the outliers.

## Requirements

- Immediately after inserting a `/card` (or `/vocab`) block, the caret is
  positioned at the **end of the front/term line**, right after the label,
  ready to type the term.
- If the command was invoked with argument text (e.g. `/card mitochondria`),
  that text is already placed on the front line and the caret sits at the
  end of it, ready to continue or tab onward — not below the block.
- This is purely a caret-position fix. The inserted text, the fields, and
  the block layout are unchanged (beyond whatever `#19` changes about the
  template itself).

## Non-goals

- No tab-between-fields behavior, no multi-stop caret cycling — just the
  initial landing spot.
- No change to `/question`, `/part`, `/note`, `/calc`, `/math` caret
  handling (they already behave).
- Not changing what fields the card template has — that is `#19`.

## Edge cases

- Empty argument (`/card` alone): caret lands right after the `front:` label
  with nothing after it.
- Mid-line invocation (command typed after existing prose, so the template
  gets a leading newline): the caret still lands on the front line, offset
  correctly for that inserted newline.
