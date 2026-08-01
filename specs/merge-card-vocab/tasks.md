# Merge card & vocab into one card type — tasks

## Data model & migration (do first — everything else depends on the type)

- [x] `src/lib/store.ts`: `CardKind` → `"question" | "card" | "note"`; add
      `encoding?: string` to `Card`.
- [x] Widen `addCard` and `updateCard` field lists to include `"encoding"`.
- [x] `seedCards()`: change the four `vocab` seeds to `kind: "card"`
      (optionally add a sample `encoding`).
- [x] Bump persist `version` `7 → 8`; add the migrate step rewriting
      `kind: "vocab" → "card"` for all persisted cards.

## Parsing

- [x] `src/lib/card-parse.ts`: `── Card ` → `{ kind: "card", front, back?,
encoding? }`, reading an `encoding:` field.
- [x] Keep `── Vocab ` as an alias → `{ kind: "card", front: term,
back: definition, encoding? }` (map `example:` → encoding).
- [x] Widen `ParsedCard`'s `Pick` to include `encoding`.

## Editor templates

- [x] `src/routes/index.tsx` `tpl:card`: unified `── Card ──` block with
      `front` / `back` / `encoding` lines.
- [x] `tpl:vocab`: insert the same `── Card ──` template (alias); keep
      `incSessionCount("vocab")`.
- [x] Confirm caret placement is handled by / consistent with
      `specs/card-cursor-placement/` (#20) against the merged template.

## Review + management UI

- [x] `src/components/FlashcardTray.tsx`: render `card.encoding` on reveal
      in the non-question branch.
- [x] `src/components/CardManagement.tsx`: replace `vocab` filter chip with
      `card`; update the kind filter switch.
- [x] `EditState` + `toEditState` gain `encoding`; add the encoding field to
      the edit form; drop the `kind === "vocab"` label/save branch; save
      `encoding: encoding || undefined`.

## Sync + server (tolerant-reader boundary)

- [x] `src/lib/sync.ts`: add `encoding` to card content pack and unpack.
- [x] `src/lib/sync.ts`: normalize incoming `kind === "vocab" → "card"` on
      pull.
- [x] `src/lib/sync-schema.ts`: card `kind` enum →
      `["question","vocab","card","note"]` (tolerant).
- [x] `src/lib/server/db.ts`: card CHECK constraint accepts the same union.

## Docs & verification

- [x] `CHANGELOG.md`: **Changed** entry naming the `version 7 → 8` +
      `sync-schema` card-kind boundary; Added/Changed lines for encoding and
      the `/card` = `/vocab` unification.
- [ ] Manual: create a card via `/card` with an encoding, close with `/>`,
      review it (encoding shows on reveal), edit it in card management.
- [ ] Manual: load a profile with pre-existing `vocab` cards (or simulate a
      v7 persisted blob) → they appear as `card`, keep their schedule, and
      are not duplicated.
- [ ] Manual: close an old-style `── Vocab ──` block → still creates a card.
- [ ] `bun run lint` clean.

## Follow-up (not this change)

- [ ] Later release: contract the enums (drop `"vocab"`) + optional server
      `update cards set kind='card' where kind='vocab'`.
