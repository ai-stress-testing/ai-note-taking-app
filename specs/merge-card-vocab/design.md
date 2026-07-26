# Merge card & vocab into one card type — design

This is a **data-model change**. It touches the `Card` shape, the persisted
store `version`/`migrate`, the sync wire enum (`sync-schema.ts`), and the
server CHECK constraint (`src/lib/server/db.ts`). Treated as an ADR below,
because the migration path — not the UI — is the load-bearing decision.

## Context: what exists today

Grounded in the actual code:

- `src/lib/store.ts`
  - `type CardKind = "question" | "vocab" | "note"`.
  - `Card` has `question`/`partLabel`/`choices` (question cards) and
    `front`/`back` (everything else). There is **no** `encoding` field.
  - `seedCards()` seeds four `kind: "vocab"` cards (front/back) and two
    `kind: "note"` cards (front only), plus two `question` cards.
  - `addCard` / `updateCard` already accept `front`/`back`; `updateCard`
    persists `front`/`back` patches and clears AI grading only when
    `question`/`choices` change.
  - persist config: `name: "neurovim-state-v4"`, `version: 7`, with a
    stacked `migrate`.
- `src/lib/card-parse.ts`
  - `── Card ` → `{ kind: "note", front, back? }` ← note, **not** a "card".
  - `── Vocab ` → `{ kind: "vocab", front: term, back: definition }` — the
    `example` line is read by nobody.
  - `── Question ` → one `question` card per Part.
- `src/routes/index.tsx`
  - `tpl:card` inserts `── Card ──\n  front: …\n  back:  \n`.
  - `tpl:vocab` inserts `── Vocab ──\n  term: …\n  definition: \n  example:    \n`
    and calls `incSessionCount("vocab")`.
- `src/components/FlashcardTray.tsx` — `CardFront` renders question cards
  specially; every other kind falls through to `front` + (on reveal) `back`.
  The head shows `card.kind` as a raw label.
- `src/components/CardManagement.tsx` — `FilterKey` includes `"vocab"` and
  `"note"`; `saveEdit` branches on `card.kind === "vocab"` for term/def
  labels; the edit form has exactly two text fields (front, back).
- `src/lib/sync.ts` — packs card `content` as encrypted JSON
  `{ question, choices, front, back }` (pack ~L108, unpack `Pick<…>` ~L131).
  `kind` travels **plaintext** alongside the ciphertext.
- `src/lib/sync-schema.ts` — `syncCardSchema.kind = z.enum(["question","vocab","note"])`.
- `src/lib/server/db.ts` — `cards.kind text ... check (kind in ('question','vocab','note'))`.

Two facts drive the whole design:

1. **`encoding` is free to add.** Authored card fields ride _inside the
   encrypted `content` blob_ (`sync.ts`), which the server stores opaquely.
   Adding `encoding` to that JSON needs **no** server-schema change and
   **no** `sync-schema.ts` change — only the pack/unpack in `sync.ts` and
   the `Card` type. Because it is optional, it needs no migration code
   either (old cards simply lack it).

2. **The `kind` consolidation is the expensive part.** `kind` is a
   plaintext, enumerated column. It appears in **three** enums that must
   agree: the `CardKind` type, `syncCardSchema`, and the db CHECK
   constraint. Changing it is the real boundary crossing.

## ADR: how the two kinds merge

### Decision

- Introduce a unified kind **`"card"`**. The `CardKind` union becomes
  `"question" | "card" | "note"`. `"vocab"` is **removed** from the client
  type.
- Add **`encoding?: string`** to `Card`.
- **Migrate `vocab` → `card`** in the store's `migrate` (version `7 → 8`):
  every persisted card with `kind === "vocab"` is rewritten to
  `kind: "card"`. `front`/`back`/`fsrs`/timestamps/flags are untouched;
  `encoding` is left absent. Nothing is re-scheduled, duplicated, or reset.
- **Leave `note` cards alone.** Today's front-only statement cards stay
  `note`. (See "vocab is a card, why not note too?" below.)
- The `── Card ──` template and parser own the encoding line. `── Vocab ──`
  is kept as a **parse alias** that also yields `kind: "card"`, mapping the
  old field names (`term`→front, `definition`→back, `example`→encoding).

### Why this framing

- The issue's own words are "vocabulary _is_ card" — the merged object is a
  **card**, so the kind is named `"card"`, matching the user's mental model
  rather than reusing the incidental `"note"` tag that `/card` happens to
  emit today.
- Migrating only `vocab → card` is a **pure rename of a tag** on records
  whose _shape already matches_ (front/back). It reinterprets no content and
  cannot mislabel anything. That is the safest possible data migration:
  a `kind` string swap with every other field fixed.

### Tolerant-reader boundary (the part that's easy to get wrong)

The server already holds rows with `kind = 'vocab'`. A CHECK constraint gates
**writes**, not existing rows, but the moment a migrated client pushes a card
as `kind='card'`, the constraint must accept `'card'`; and any not-yet-migrated
client/older row is still `'vocab'`. To avoid a lock-step client+server
deploy:

- `sync-schema.ts` enum and the db CHECK constraint accept the **union**
  during the transition: `["question","vocab","card","note"]`. Readers
  tolerate `vocab`; the client only ever _writes_ `card`.
- On pull, the sync client normalizes any incoming `kind === "vocab"` to
  `"card"` (same one-line map as the store migration), so an old device's
  `vocab` card lands correctly on a new device.
- Optional server-side one-shot `update cards set kind='card' where kind='vocab'`
  can retire the legacy value later; not required for correctness because
  readers already tolerate it. `'vocab'` can be dropped from the accepted
  enums in a subsequent release once no legacy rows remain (a follow-up, not
  this change).

This is the classic **expand/contract** migration: expand the accepted set,
migrate data lazily on read/write, contract later. The cost named explicitly:
the enums carry a dead `"vocab"` value for one release cycle. That is cheaper
than a coordinated client+server cutover, and reversible.

## Changes by file

### Data model — `src/lib/store.ts`

- `CardKind` → `"question" | "card" | "note"`.
- `Card` gains `encoding?: string`.
- `addCard` / `updateCard` signatures widen to accept `encoding` (add
  `"encoding"` to the `Partial<Pick<…>>` field lists). `updateCard`'s
  grading-clear logic is unchanged (encoding is not a question field).
- `seedCards()`: the four `kind: "vocab"` seeds become `kind: "card"`. (Seed
  timestamps stay at `SEED_TS`; ids unchanged so LWW still prefers real
  data.) A short encoding may be added to a seed or two as living examples —
  optional, cosmetic.
- persist `version: 7 → 8`; append a migrate step:
  ```
  // v7 → v8: /card and /vocab unified into one `card` kind with an
  // optional `encoding` field. Existing vocab cards are the same
  // shape (front/back) — only the tag changes; schedules untouched.
  if (s.cards && typeof s.cards === "object") {
    for (const c of Object.values(s.cards as Record<string, {kind?: string}>)) {
      if (c.kind === "vocab") c.kind = "card";
    }
  }
  ```
  `encoding` needs no migration (optional, absent on old cards).

### Parsing — `src/lib/card-parse.ts`

- `── Card ` branch → `{ kind: "card", front, back?, encoding? }`, reading a
  new `encoding:` field via the existing `fieldValue` helper.
- `── Vocab ` branch (kept as alias) → `{ kind: "card", front: term,
back: definition, encoding? }`, now also reading the old `example:` line
  into `encoding` (so historical blocks lose nothing on close).
- `ParsedCard` type already derives from `Card`; widen its `Pick` to include
  `encoding`.

### Editor templates — `src/routes/index.tsx`

- `tpl:card` template becomes the unified three-field block:
  ```
  ── Card ──────────────────────────────────────────
    front:    <args>
    back:
    encoding:
  ```
  (Label widths aligned; see #20 for exact caret placement.)
- `tpl:vocab` inserts the **same** `── Card ──` template (alias). Keep the
  `incSessionCount("vocab")` call — the session counter key is internal and
  unrelated to card kind; renaming it is out of scope (a `sessionCounts`
  shape change would be its own migration for no user benefit).
- **Coordination with #20 (caret placement):** the caret offset must land
  after the `front:` value of _this_ template. #20 is specced against this
  merged block; it should land after #19 (or, if it lands first, fix both
  `── Card ──` and `── Vocab ──` templates and then collapse to one here).

### Review UI — `src/components/FlashcardTray.tsx`

- `CardFront`'s non-question branch renders `card.encoding` on reveal, below
  `back` (e.g. a muted "encoding: …" line). It is a recall aid, shown with
  the answer.
- The head label `card.kind` now reads "card" for merged cards — acceptable;
  no code change needed beyond the kind values existing.

### Card management — `src/components/CardManagement.tsx`

- `FilterKey` / `FILTERS`: replace the `"vocab"` chip with `"card"`; keep
  `"note"`. The `case "question": case "vocab": case "note":` kind filter
  becomes `case "question": case "card": case "note":`.
- `EditState` gains `encoding`; `toEditState` reads `card.encoding ?? ""`.
- The non-question edit form gains a third **encoding (optional)** field and
  labels front/back plainly (drop the `kind === "vocab" ? "term" : "front"`
  split — one card shape, one set of labels). `saveEdit` for the card branch
  writes `{ front, back: back || undefined, encoding: encoding || undefined }`;
  the old `card.kind === "vocab"` branch is removed.
- `cardText` is unchanged (uses `front`).

### Sync — `src/lib/sync.ts` + `src/lib/sync-schema.ts`

- `sync.ts` pack: add `encoding: c.encoding` to the content JSON.
- `sync.ts` unpack: add `"encoding"` to the decoded `Pick<…>`.
- `sync.ts` pull: normalize `kind === "vocab" → "card"` when reconstructing
  local cards.
- `sync-schema.ts`: `kind` enum → `["question","vocab","card","note"]`
  (tolerant reader; `vocab` retired later).

### Server — `src/lib/server/db.ts`

- `cards.kind` CHECK constraint → `check (kind in ('question','vocab','card','note'))`.
  Same tolerant-reader rationale. Existing `vocab` rows keep validating;
  new writes use `card`. `content_ct`/`content_nonce` are opaque, so the
  encoding field needs no column.

### Changelog

- `CHANGELOG.md` **Changed** entry naming the migration boundary explicitly:
  store `version 7 → 8` and the `sync-schema.ts` card-kind enum widening
  (per the CLAUDE.md changelog convention for version/schema bumps). A
  separate **Added** line for the encoding field / **Changed** line for the
  `/vocab` = `/card` unification.

## Alternatives considered

- **Reuse `note` as the merged kind (migrate `vocab → note`).** `note` can
  already hold front/back, so no new enum value. Rejected: it conflates the
  two-sided study card with the one-sided statement card under one tag,
  making "note" mean two shapes — the exact ambiguity that made the current
  model confusing. It also fights the issue's language ("vocabulary is
  _card_").
- **Also migrate two-sided `note` cards (from old `/card`) into `card`.**
  Tempting for consistency, but `kind` alone can't distinguish a `/card`
  note (two-sided) from a statement note that happens to have a `back`.
  Reclassifying by "has a back" is a heuristic that could mislabel data.
  Rejected as the default; left as an open question with the risk named.
- **Keep `vocab` and `card` as separate kinds, just add `encoding` to
  both.** Rejected: it's the duplication the issue is explicitly about; two
  templates/parsers/filters/edit-forms remain forever.
- **Make `encoding` a first-class plaintext sync column.** Rejected:
  encoding is authored free text and belongs inside the encrypted `content`
  blob with front/back; a plaintext column would leak content to the server
  and needs a real schema migration for zero benefit.
- **Lock-step client+server enum cutover (only `card`, drop `vocab`
  immediately).** Rejected: forces a coordinated deploy and rejects/By
  breaks any device or server row still on `vocab`. The tolerant-reader
  expand/contract path is reversible and deploy-order-independent.

## Open questions

- Should one or two seed cards ship with a sample `encoding` to teach the
  concept, or stay blank? (Leaning: one, as a living example.)
- Do we ever fold one-sided `note` cards in? If so it needs a real content
  heuristic or a UI prompt, not a silent migration — deferred.
- Exact review-tray styling for the encoding line (muted caption vs. its own
  row) — product/CSS, not architecture.
- When to run the **contract** step (drop `"vocab"` from the enums + optional
  server `UPDATE`): a later release once telemetry/experience says no legacy
  rows remain. Tracked as a follow-up, not this change.
- Keep `/vocab` as a permanent alias or eventually deprecate it from the
  command palette? (Leaning: keep — it's free and matches user vocabulary.)
