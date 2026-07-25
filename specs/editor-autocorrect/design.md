# Editor autocorrect / spellcheck — design

## Approach

Ladder check first: does a dependency need to exist here at all? No —
every major browser already implements spellcheck and (on platforms with
software keyboards) autocorrect/autocapitalize natively, exposed on plain
HTML form elements via standard attributes:

- `spellCheck` (boolean prop in React, `spellcheck` attribute in HTML) —
  underlines likely misspellings using the browser/OS dictionary, and
  wires up the native right-click "Spelling and Grammar" / suggestion
  context menu. Already used (as `false`) in this codebase, so the
  mechanism is already wired — this is a value flip, not new plumbing.
- `autoCorrect="on"` — Safari/WebKit's attribute for inline autocorrect on
  text inputs/textareas (also respected by some mobile WebViews). Not a
  standard HTML attribute outside WebKit, but harmless where unsupported
  (browsers ignore unknown attributes).
- `autoCapitalize="sentences"` — capitalizes the first letter after
  sentence-ending punctuation on platforms that support it (notably
  mobile/soft-keyboard browsers); desktop Chrome/Firefox largely ignore it
  on textareas today but it costs nothing to set and matches R2's "not
  desktop-only" intent for the platforms that do honor it.

This clears the ladder at rung 3 (native platform feature) — no new
dependency, no new abstraction, a one-line prop change per surface (R6).

### R1/R2 — the note textarea

In `src/routes/index.tsx`, the `<textarea className="ed-textarea overlay">`
(around the line currently reading `spellCheck={false}`) changes to:

```tsx
spellCheck;
autoCorrect = "on";
autoCapitalize = "sentences";
```

(`spellCheck` with no value is the same as `spellCheck={true}` in JSX —
matches the existing terse style of nearby boolean props in this file.)

### R3 — Settings fields stay off

The four `spellCheck={false}` textareas/inputs in `SettingsModal.tsx`
(server URL, model, verification model, sync token) are left exactly as
they are. They were already correctly set to `false` — this issue doesn't
touch them; requirements.md calls them out explicitly so a future pass
doesn't "fix" them by mistake in the name of consistency.

### R4 — command/math shorthand fighting with spellcheck

There is no native attribute for "spellcheck this region, but not that
one" within a single textarea — spellcheck is an all-or-nothing property
of the element. Three options, in order of how much they cost:

1. **Do nothing beyond R1/R2, accept the cosmetic noise.** A misspelled-
   looking squiggle under `a^2` or `b*b` is visually harmless — it doesn't
   block typing, doesn't corrupt content, and disappears the moment the
   block is closed and replaced by a rendered result (math/calc blocks are
   replaced with AI-corrected output on `/>`, per
   `specs/math-calc-block-verification/`). This is the recommended
   default and satisfies R4 as "acceptable side effect," not "solved."
2. **Toggle `spellCheck` off only while `slash.open` is true** (the slash
   menu is open, i.e. the user is mid-command-token). Technically
   possible (`spellCheck` is a controlled prop, `slash.open` is already
   tracked state) but only covers the moment of typing the command name
   itself, not the body of a `/math`/`/calc` block afterward — narrow
   benefit for the added state-dependent prop.
3. **Toggle `spellCheck` off for the whole textarea while the caret sits
   inside a `── Math ──`/`── Calc ──` block** (using
   `parseEnclosingBlock`, already used for `/>` handling in
   `executeCommand`). This fully addresses R4's math/calc case but adds a
   render-path dependency on caret position + block parsing purely for a
   cosmetic concern, which is more machinery than the actual problem
   (squiggly lines under shorthand math) warrants.

Recommendation: ship option 1 as the MVP. Options 2/3 are documented here
as available follow-ups, not built now — the ladder's "does this need to
exist" question answers "not yet" until someone reports the squiggles as
an actual usability complaint rather than a theoretical one.

### Richer autocorrect layer (optional, explicitly not MVP)

If native spellcheck alone doesn't satisfy the issue in practice (e.g.
users want actual replace-as-you-type correction, not just underlines),
the next-cheapest step — before reaching for a dependency — is a small
allowlist-style replace table (`teh` → `the`, common transpositions) run
on word-boundary in `onChange`, similar in spirit to `calc-eval.ts`'s
allowlisted-grammar philosophy elsewhere in this codebase. Trade-offs if
this is ever pursued:

- Pro: no dependency, fully local, same "boring and explicit" posture as
  the rest of the app.
- Con: a hand-maintained typo list is inherently limited (nowhere near a
  real spellchecker's dictionary) and adds an `onChange` transform that
  has to be careful not to fight the slash-command detection or caret
  position logic already in that handler.
- A real fuzzy-correction library (e.g. a Hunspell-in-WASM port) would be
  the alternative if this list-based approach proves too limited — but
  that's a genuine new dependency and, per CLAUDE.md, needs to be raised
  and agreed on separately before adding it. Nothing in this issue's
  request requires reaching for that; native spellcheck is the ask this
  spec fulfills.

## Data model changes

None. This is a static prop change on existing DOM elements.

## Alternatives considered

- **A per-file "spellcheck on/off" toggle in the store**, mirroring the
  personal-file toggle pattern. Rejected: no user need was expressed for
  per-file control, and it would add persisted state for a purely
  cosmetic, browser-rendered feature — against the ladder's "does this
  need to exist" gate.
- **contentEditable-based rich text with a JS spellchecker overlay.**
  Rejected outright: the editor is deliberately a plain `<textarea>` with
  a syntax-highlighting mirror underneath (`ed-mirror`) for exact caret
  alignment; contentEditable would be a much larger rewrite unrelated to
  this issue's scope (fixing spellcheck), and isn't what's being asked.
- **A typo-correction dependency (e.g. WASM spellchecker) as the first
  pass.** Rejected for now per the ladder — native attributes solve the
  stated problem (issue #3 literally says "no autocorrect," and the
  browser already provides one) with zero new code or install footprint.

## Open questions

- Whether `autoCorrect="on"` is worth setting given it's WebKit-only and
  has no effect in Chromium/Firefox desktop — leaning yes anyway since
  it's a no-cost no-op elsewhere and does something real on Safari/iOS,
  matching R2's "not desktop-only" intent for the platforms it does apply
  to.
- Whether option 2 or 3 (from R4's numbered list) should actually be
  scheduled as a fast-follow rather than left purely as an idea — depends
  on how noisy the math/calc squiggles turn out to be in practice, which
  is easiest to judge after R1/R2 ship and get used for a bit.
