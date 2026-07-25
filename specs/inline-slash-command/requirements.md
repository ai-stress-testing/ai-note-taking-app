# Inline `/command`

## Problem

A slash command is only recognized when it's the only thing on the line so
far — `detectSlash` matches `uptoCaret` (the text from the start of the
current line to the caret) against `/^(\/[a-zA-Z0-9->]*)$/`. Typing
`meeting notes /start` never opens the slash menu and Enter never commits a
command, because the regex fails the moment there's anything before the
`/`. Today's workaround is "put the command on its own line," which breaks
the natural way people write — jotting a command at the point in a
sentence or list item where it's relevant, not always at a fresh line.

Issue #14 asks for commands to be callable mid-line: type some text, then
`/command`, and have it detected/completed right there, without requiring
a newline first.

## Requirements

- R1. A slash command is detected as soon as the user types a `/` followed
  by command characters, regardless of what precedes it on the line —
  `today I reviewed /vocab` opens the slash menu on `/vocab` the same way
  a line starting with `/vocab` does today.
- R2. The slash menu (`SlashMenu`) appears anchored to the `/` itself, not
  the start of the line — same anchoring mechanism (`getCaretCoords`), just
  measured from the token's start index instead of `lineStart`.
- R3. Completing an inline command (Tab/Enter, or click, same as today)
  replaces only the command token the user typed — from the `/` through
  the caret — with the command's template/result. Text before the token on
  the same line is preserved untouched; text after the caret (if any) is
  preserved after the inserted result.
- R4. Typing a bare `/` while writing ordinary prose (a `/` that isn't
  followed by a recognized or in-progress command pattern, or one that's
  part of a larger word/token like a URL or file path) must not pop the
  slash menu open or otherwise interfere with typing. The existing
  start-of-line behavior already has this property by virtue of position;
  the inline case has to earn it some other way (see design.md).
- R5. Multiple `/`-looking tokens on one line (e.g. a path pasted earlier
  in the line, then a real command typed after it) resolve to the _nearest_
  `/` at-or-before the caret, not the first one on the line — the menu
  should reflect what the user is currently typing, not something already
  written earlier in the line.
- R6. Enter-to-commit (the non-menu path, when the whole line already looks
  like `/cmd args`) continues to work for a command that occupies a whole
  line — this is additive, not a replacement of the existing start-of-line
  path.
- R7. Existing commands, their templates, and their AI/close behavior are
  unchanged — this is purely about _where_ a command can be typed from,
  not what any individual command does.

## Non-goals

- Multiple simultaneous command tokens resolved/executed in one keystroke
  (e.g. two `/commands` on the same line both firing). Only the one
  nearest the caret is ever live at a time.
- Changing the command list, their argument parsing, or their AI-close
  (`/>`) semantics.
- A settings toggle to disable inline detection and force start-of-line
  only. If inline detection ships, it's the one behavior — no dual mode.

## Edge cases

- **Slash inside a URL/path**: `see notes at ~/docs/vocab` or
  `https://example.com/vocab` must not trigger the menu on `/docs` or
  `/vocab` — needs a rule that distinguishes "a word starting with `/`
  that's actually a path/URL segment" from "a command token," likely by
  requiring the character immediately before the `/` to be whitespace,
  line-start, or certain punctuation, not another non-space, non-slash
  character glued directly to it (design.md works out the exact rule).
- **Two slashes close together**: `a/b /vocab` — the `/` in `a/b` sits
  right after a letter (`b`) with no space, so per the above rule it's not
  a candidate; the `/vocab` after the space is.
- **Slash at the very end of a line the user is still typing**: same as
  today's behavior, just measured from the token start rather than line
  start.
- **Caret moved back into an already-typed inline command** (e.g. user
  clicks back into `foo /vocab bar` between `/` and `vocab`): the menu
  should reopen/filter based on the partial token under the caret, same as
  it does today when the caret sits inside a start-of-line partial command.
- **Deleting back through the `/`**: once the caret backspaces past the
  `/` itself, the menu must close (same as today).
- **Command with `>` in it (`/>`)**: the existing regex already allows `>`
  in the token (`[a-zA-Z0-9->]`) for the close-block command; inline
  detection must keep recognizing `/>` mid-line too, e.g. a user closing a
  block on the same line as trailing prose.
- **Very long line before the `/`**: performance of re-scanning from
  caret backward on every keystroke should stay cheap (bounded scan, not a
  full-buffer regex) — matters more here than in the start-of-line case
  since the scan-back distance is no longer capped by line start alone in
  the way `lineStart` conveniently capped it before.
