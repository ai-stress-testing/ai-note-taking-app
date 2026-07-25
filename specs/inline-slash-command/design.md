# Inline `/command` — design

## Approach

Everything lives in `src/routes/index.tsx`; no new files, no new
dependencies. Three functions change: `detectSlash`, `insertAtRange`'s
caller in `commitCompletion`, and (for the Enter-to-commit whole-line path)
nothing — R6 keeps that path exactly as-is since it's already scoped to a
full line.

### `detectSlash`: find the token nearest the caret, not the whole line

Today:

```ts
const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
const uptoCaret = value.slice(lineStart, caret);
const m = /^(\/[a-zA-Z0-9->]*)$/.exec(uptoCaret);
```

This anchors to `lineStart` and requires the *entire* line-so-far to be the
token — which is exactly why prose before a `/` breaks it. The fix: instead
of anchoring to the line start, scan backward from the caret for the
nearest `/` that's a valid token boundary, then validate forward from there
to the caret.

```ts
function findSlashToken(value: string, caret: number): { start: number; token: string } | null {
  const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
  for (let i = caret - 1; i >= lineStart; i--) {
    const ch = value[i];
    if (ch === "/") {
      const before = i === lineStart ? "" : value[i - 1];
      // Boundary rule (R4/edge cases): a "/" only starts a command token if
      // it's at line-start or preceded by whitespace. A "/" glued to the
      // previous character (a/b, https:/) is prose/a path, not a command.
      if (before !== "" && !/\s/.test(before)) return null;
      const token = value.slice(i, caret);
      if (!/^\/[a-zA-Z0-9->]*$/.test(token)) return null;
      return { start: i, token };
    }
    if (ch !== " " && !/[a-zA-Z0-9->]/.test(ch)) return null; // hit non-token char before any "/"
    // keep scanning left through token-shaped characters and spaces? — see
    // Open questions: whether to stop the scan at the first space.
  }
  return null;
}
```

Actual `detectSlash` becomes:

```ts
const detectSlash = useCallback((el: HTMLTextAreaElement) => {
  const caret = el.selectionStart;
  const value = el.value;
  const found = findSlashToken(value, caret);
  if (!found) {
    setSlash((s) => (s.open ? CLOSED : s));
    return;
  }
  const { x, y, lineHeight } = getCaretCoords(el, found.start);
  setSlash({ open: true, query: found.token, startIdx: found.start, x, y, lineHeight, selected: 0 });
}, []);
```

`startIdx` already means "start of the token to replace" in the existing
code (it's `lineStart` today, which — for the start-of-line case — happens
to equal the token start). Renaming its meaning to "token start" rather
than "line start" is the only conceptual shift; the field itself doesn't
need to change shape. `SlashState` keeps its existing fields.

### `commitCompletion`: replace the token, not the line

Today `commitCompletion` recomputes `lineStart`/`endIdx` itself (independent
of `slash.startIdx`) and hands the whole line to `executeCommand`, which
then does `insertAtRange(lineStart, lineEnd, tpl)` — i.e. every command
template replaces the *entire line*, prefix text included. That's fine
today because a command can only ever be the entire line. Once commands can
appear mid-line, replacing the whole line would eat the prefix text R3
requires to survive.

Change: `commitCompletion` uses `slash.startIdx` (the token start, already
computed by `detectSlash`) as the replace-from position, and the caret
position as replace-to — not `lineStart`/`endIdx`:

```ts
const commitCompletion = useCallback(
  (cmd: CommandDef) => {
    const el = textareaRefs.current[focusedPane];
    if (!el) return;
    const caret = el.selectionStart;
    const value = el.value;
    const tokenStart = slash.startIdx;
    const tokenEnd = caret; // menu only stays open while caret sits at the token's end
    const line = value.slice(tokenStart, tokenEnd);
    setSlash(CLOSED);
    const m = /^(\/[a-zA-Z0-9->]+)(?:\s+(.*))?$/.exec(line);
    const argsFromLine = m?.[2]?.trim() ?? "";
    executeCommand(cmd, argsFromLine, tokenStart, tokenEnd);
  },
  [executeCommand, focusedPane, slash.startIdx],
);
```

`executeCommand`'s signature (`lineStart, lineEnd`) doesn't need to change
— it already just takes "the range to replace" and calls
`insertAtRange(lineStart, lineEnd, …)` for every `tpl:*` case. Renaming the
parameters to `from`/`to` in a follow-up pass would be a nice clarity win
but isn't required for correctness — the existing call sites already treat
them as an opaque replace range.

This is the one behavior change that needs care: **every** `tpl:*` branch
in `executeCommand` inserts a block template that assumes it's starting a
fresh line (e.g. `\n── Question ──...`). When the command is typed after
existing prose on the same line, the template needs a leading `\n` so the
block still starts on its own line rather than being glued to the prefix
text. Concretely: `insertAtRange` (unchanged) already just splices at
`(from, to)`; the fix belongs in each `tpl:*` string, which should ensure
a leading newline when the character just before `from` isn't already a
newline:

```ts
const cur = useStore.getState().files[activeFileId]?.content ?? "";
const needsLeadingNl = lineStart > 0 && cur[lineStart - 1] !== "\n";
insertAtRange(lineStart, lineEnd, (needsLeadingNl ? "\n" : "") + tpl, …);
```

Rather than repeat this in every branch, the cleanest place is a tiny
wrapper around `insertAtRange` inside `executeCommand` (or a helper next to
it) that all `tpl:*` branches call instead of `insertAtRange` directly —
one place owns "does this template need a leading newline," not fourteen
copies of the same check.

### Slash menu anchoring (R2)

Already correct by construction: `getCaretCoords(el, found.start)` (using
the token start) is exactly what start-of-line detection did too
(`lineStart` was the token start in that case). No change needed to
`SlashMenu` or `getCaretCoords` itself.

### Enter-to-commit whole-line path (R6)

`onKeyDown`'s Enter handler (the non-menu path, for a line that's *already*
a complete `/cmd args` line, e.g. pasted or typed and Enter pressed
immediately) stays scoped to `findCommand(line)` against the full line, as
today — this path is specifically "the whole line is a command," which is
unaffected by inline detection of partial tokens while typing.

## Data model changes

None. `SlashState` is unchanged in shape; `startIdx`'s *meaning* shifts
from "line start" to "token start," which happens to be the same value in
every case that worked before.

## Alternatives considered

- **Regex over the whole line, matching `(?:^|\s)(\/[a-zA-Z0-9->]*)$`
  anchored at the caret end.** Equivalent in effect to the backward-scan
  approach but harder to extend for R5 (nearest-token-wins) and R4's
  boundary rule without re-deriving the token's start index separately
  anyway — the explicit scan is more direct and easier to reason about
  for the edge cases in requirements.md.
- **Require a leading space before every inline `/` unconditionally (no
  line-start special case).** Rejected: line-start already has an implicit
  "boundary" (nothing before it), so special-casing it out would regress
  today's default UX for the common case of starting a line with a
  command.
- **Detect on token characters only, ignore whitespace boundary
  entirely (any `/` opens the menu).** Rejected: this is what breaks
  URLs/paths (R4's edge case) — `https://example.com` would pop the menu
  on every `/`. The whitespace-or-line-start boundary rule is the load-
  bearing part of this design.
- **Leave `insertAtRange`'s callers replacing the whole line and instead
  re-insert the stripped prefix text after the template.** Rejected: more
  string surgery for equivalent result, and fragile if a command's
  template itself starts with characters that could collide with
  reconstructed prefix text. Passing the correct `(from, to)` range
  directly is simpler and is already the shape `insertAtRange` expects.

## Open questions

- Exact left-scan stopping condition when there's no `/` on the line
  before hitting another line's content or a "clearly not a token"
  character (e.g. should the scan stop at the first whitespace it crosses
  once it's scanned past the immediate token, to keep the bound cheap per
  R7's edge case, or is unbounded-until-lineStart acceptable given lines
  are typically short in this editor). Leaning toward capping the scan at,
  say, 200 characters back as a defensive bound regardless of line length.
- Whether `findSlashToken` should also refuse to trigger inside characters
  that look like markdown (e.g. inside a fenced code block written in the
  buffer) — today's start-of-line detection has no such awareness either,
  so this is arguably out of scope/consistent with existing behavior
  rather than a new gap, but worth confirming isn't expected here.
- Whether the "needs leading newline" wrapper belongs as a small local
  helper in `index.tsx` next to `executeCommand`, or as a named export
  from `commands.ts` alongside `findCommand` — leaning local helper since
  it's specific to how the editor route composes templates, not command
  metadata itself.
