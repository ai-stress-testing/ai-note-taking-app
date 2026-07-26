# Card/vocab template caret placement — design

## Context

In `src/routes/index.tsx`, `insertBlockAtRange(from, to, tpl, caretOffset?)`
already supports an optional `caretOffset`: the caret index _within the
template_ to land on (it internally adds the leading-newline compensation
via `moveTo = prefix.length + caretOffset`). `insertAtRange` does the actual
`setSelectionRange`.

`tpl:question` already uses this to good effect:

```js
const caretOffset = args
  ? (header + partHeader + FIRST_CHOICE_PREFIX).length // into first choice
  : header.length - 1; // right after "Q: "
insertBlockAtRange(lineStart, lineEnd, tpl, caretOffset);
```

The bug: `tpl:card` and `tpl:vocab` call `insertBlockAtRange(lineStart,
lineEnd, tpl)` with **no** `caretOffset`, so `insertAtRange` falls back to
`from + text.length` — the very end of the inserted block, below every line.

## Approach

Pass a `caretOffset` that points at the end of the front/term value on the
first field line, mirroring the `/question` "after `Q: `" case.

For the unified template from `#19`:

```
── Card ──────────────────────────────────────────
  front:    <args>
  back:
  encoding:
```

Let `header` be the marker line through the newline, and `frontLabel` be the
literal `"  front:    "` prefix (whatever exact spacing the template uses).
Then:

```js
const caretOffset = header.length + frontLabel.length + (args ? args.length : 0);
```

i.e. land right after the inserted `args` on the front line (end of that
line's value), regardless of whether `args` is empty. Build the template
from these same pieces so the offset can't drift from the literal string —
the same discipline `tpl:question` uses (it composes `header`,
`partHeader`, `FIRST_CHOICE_PREFIX` and measures their lengths rather than
hardcoding a number).

`insertBlockAtRange` already compensates for a mid-line leading newline, so
the mid-line edge case needs no extra handling here — pass the same
`caretOffset` and it is shifted by `prefix.length` internally.

## Coordination with #19

This spec targets the **merged** `── Card ──` template (front/back/encoding)
from `specs/merge-card-vocab/`, and `/vocab` there becomes an alias that
inserts that same template. So the natural order is: **#19 lands first**,
then this is a one-template fix (compute `frontLabel` from the merged
template, land after `front:`).

If this lands **before** #19, apply the same offset logic to _both_ current
templates — `tpl:card` (`front:` line) and `tpl:vocab` (`term:` line) —
landing after the first field's value in each; #19 then collapses them into
one and the offset math carries over unchanged (it always targets "the first
field's value line").

Either ordering converges on the same rule: **caret at the end of the first
authored field's value.**

## Data model changes

None. Pure caret math in the `tpl:card` / `tpl:vocab` branches of
`executeCommand`.

## Alternatives considered

- **Hardcode a numeric offset.** Rejected: brittle against any spacing/label
  change in the template (and #19 changes the template). Composing the
  offset from the same substrings used to build `tpl` keeps them in lockstep,
  matching the existing `/question` pattern.
- **Land in the `back`/second field instead.** Rejected: you author the
  front first; `/question` establishes the precedent of landing on the first
  thing you fill in.

## Open questions

- Exact label spacing in the merged template (`front:    ` vs `front: `) is
  settled by #19; this spec just measures whatever that literal is.
