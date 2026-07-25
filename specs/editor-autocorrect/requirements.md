# Editor autocorrect / spellcheck

## Problem

The main note textarea (`src/routes/index.tsx`) sets `spellCheck={false}`
unconditionally, so misspellings never get the red squiggly underline or
right-click suggestions a browser would otherwise offer, and nothing
autocapitalizes or autocorrects as the user types. For an education/study
tool where users are typing prose, vocabulary definitions, and study notes
by hand, that's a real gap (issue #3: "No autocorrect").

The four other `spellCheck={false}` textareas, in `SettingsModal.tsx`, are
a different situation entirely — they're a server URL, a model name, and an
auth token, none of which are prose. Any fix has to distinguish "the note
body, where a user is writing English" from "structured/technical fields,
where spellcheck actively gets in the way" rather than flipping the
attribute everywhere.

## Requirements

- R1. The main note-editing textarea gets native browser spellcheck: red
  squiggly underlines under likely misspellings, using the browser's own
  dictionary and right-click "did you mean" suggestions — no app code
  involved in flagging or suggesting corrections.
- R2. Mobile/soft-keyboard autocorrect and autocapitalize (where the
  platform provides them) are enabled for the same note-editing surface,
  so this isn't a desktop-only fix.
- R3. Surfaces that are not prose keep spellcheck/autocorrect off:
  Settings fields for server URL, model name, verification model name, and
  sync token (`SettingsModal.tsx`) — these are technical values where
  underlines would be noise (a model name like `llama3.2:1b` or a
  `localhost` URL will always look "misspelled").
- R4. Within the note textarea itself, content the user is actively typing
  as a command, math, or calculation should not fight with autocorrect
  mid-token: while a slash-command menu is open (`slash.open` in
  `index.tsx`), or while typing inside a line that is command
  syntax/shorthand (e.g. `a^2 + b*b`), the browser's spellcheck should not
  visually flag that shorthand as misspelled prose. See design.md for how
  much of this the native attribute can address versus what's simply an
  acceptable cosmetic side effect.
- R5. Nothing here changes what's actually stored — spellcheck/autocorrect
  is a browser-rendered affordance and, where the platform autocorrects
  text as typed (R2), that already lands in the DOM value the existing
  `onChange` reads; no new store field, no new persisted state.
- R6. No new dependency. If native spellcheck/autocorrect (R1/R2) fully
  satisfies the issue, that's the entire fix — see design.md for why a
  heavier custom-correction layer isn't justified as a first pass.

## Non-goals

- A custom typo-correction engine (app-level dictionary, fuzzy-match
  replace-as-you-type) as the initial fix. Framed as an optional future
  layer in design.md, not built here.
- Grammar checking, style suggestions, or anything beyond spelling —
  out of scope for this issue.
- Per-file or per-folder spellcheck toggles. The split in R3 is by
  *surface* (note body vs. settings field), a fixed decision per input,
  not a user-facing preference to manage per file.
- Custom dictionaries / adding study/vocab terms so they stop being
  flagged. Native browser spellcheck has no API this app can hook to add
  words; living with false-positive squiggles on jargon is an accepted
  trade-off of choosing the native path (see design.md).

## Edge cases

- **Code-like or symbol-heavy lines** (`/math`, `/calc` bodies, e.g.
  `a^2 + b*b = c_1^2`): native spellcheck will likely flag tokens here as
  "misspelled" since they aren't dictionary words. This is treated as
  cosmetic noise, not a bug — the browser has no concept of "this run of
  characters is math, not prose," and building that awareness ourselves is
  exactly the custom layer explicitly deferred as a non-goal.
- **Command names in the buffer** (`/vocab`, `/question`, etc., once
  committed as literal text is rare since they get replaced by templates,
  but partial/in-progress typing is visible while the slash menu is open):
  same as above, cosmetic only.
- **Multi-pane editing**: every pane shares the same textarea component,
  so the spellcheck attribute change applies uniformly across all open
  panes — no per-pane setting.
- **First-load hydration**: the textarea's `value` is empty until
  `hydrated` flips true (existing pattern in `index.tsx`); the
  `spellCheck`/`autoCorrect`/`autoCapitalize` attributes are static props
  and don't depend on hydration state, so no special-casing needed there.
- **Personal files**: spellcheck is a local browser rendering feature, not
  a network call — it has no interaction with the AI-privacy boundary
  (`isFilePersonal`) and needs none.
