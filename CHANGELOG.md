# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Convention

- **Every user-facing change** adds a line under `[Unreleased]` in the appropriate section (Added, Changed, Fixed, Removed).
- **Any change that bumps the persisted store `version` field** (`src/lib/store.ts`) or alters `src/lib/sync-schema.ts` **must add a `Changed` entry explicitly naming the migration boundary**, since these are compatibility-critical edits for users with existing data.
- On release, the `[Unreleased]` section is retitled with the new version and release date, and `package.json` is bumped to match.

## [Unreleased]

### Added

- Analytics "focus by note" view: per-note attribution of worked time, grouped from durable session records.
- `/math` results render as typeset math via bundled KaTeX instead of showing raw `$latex$` text — new `katex` dependency (~270 KB JS plus self-hosted fonts, bundled same-origin, no CDN); invalid LaTeX degrades to the raw source (#6).
- FSRS card & vocab management on the analytics page: view/edit/delete with filters (all / due / flagged / by kind); editing a card's content never resets its FSRS schedule (#8).
- Native browser spellcheck/autocorrect on the note editor (off on the highlight mirror and technical settings fields) (#3).
- Inline `/command` invocation: slash commands are detected and committed mid-line, not only at the start of a line (#14).
- `/fidget`: an ephemeral scratch pad whose content is never written to the store, localStorage, or sync (#16).
- Inline file rename affordance in the sidebar (#15).
- Inline markdown styling in the editor mirror: `>>` blockquotes, `#`/`##`/`###` headings, and `**bold**` spans render with color/weight, without hiding the raw syntax or shifting caret alignment (#21).
- "Continue" button on the FSRS review-complete banner: starts a fresh session on the next due batch in one click, without closing the tray or retyping `/fsrs`; hidden when nothing is due now (#24).
- Cards can carry an optional **encoding**: the learner's own mnemonic or connection, written alongside front/back and shown on reveal in the review tray, next to the answer (#19).
- FSRS review is now a feedback loop (#7): a card rated **again** is re-queued a few cards later in the same session and must be cleared before the session ends (bounded — after 3 "again"s it's scheduled and you move on). Completion is `(10 + m)/10` where `m` = relearns; the intra-session requeue only touches the FSRS scheduler on a card's terminal rating, so `dueAt`/reviewLogs aren't thrashed. An opt-in `loadStarterDeck` action (offered on the empty `/fsrs` prompt) brings back the 8 demo cards.

### Changed

- `/card` and `/vocab` no longer produce two different card shapes: `/vocab` is now an alias that inserts the same unified `── Card ──` block (front/back/encoding). Closing an old-style `── Vocab ──` block still works (`term`/`definition`/`example` map onto front/back/encoding) so existing notes don't silently stop making cards. Card management's kind filter and chip change from "vocab" to "card" to match (#19).
- Store `version` 7 → 8: the `vocab` card kind is merged into `card` (`CardKind` is now `"question" | "card" | "note"`). `migrate` retags every persisted `kind: "vocab"` card to `kind: "card"` in place — front/back, FSRS schedule, timestamps, and flags are untouched; nothing is re-scheduled or duplicated. The sync wire format follows a tolerant-reader (expand/contract) path: `sync-schema.ts`'s card `kind` enum and the server's `cards.kind` CHECK constraint both widen to accept `"question" | "vocab" | "card" | "note"` so an old client or an existing server row still round-trips, while the client only ever writes `"card"`; `sync.ts` normalizes any incoming `"vocab"` to `"card"` on pull. Dropping `"vocab"` from the accepted set is a follow-up once no legacy rows remain (#19).

- Store `version` 5 → 6: the flat `localAiUrl`/`localAiModel`/`verifyAiModel` fields are replaced by an `aiModels` registry (`AiModelConfig[]`) plus `activeAiModelId`. `migrate` folds any existing flat config into a single active registry entry on load, so existing users keep their configured server/model with no reconfiguration. Settings is split into "AI models" (multi-server/model registry, active selector) and "Sync & key" views. The registry stays device-local, persisted via `partialize` but excluded from the encrypted note-sync payload (`sync-schema.ts` unchanged).
- Store `version` 6 → 7: adds a durable `sessions: Session[]` field (id, `fileId`, `startedAt`/`endedAt`, `workMs`/`breakMs`, `questions`/`vocab`), persisted via `partialize`. `migrate` defaults `sessions` to `[]` and defensively re-defaults `sessionEvents`/`sessionCounts` if malformed, so an in-flight (unfinished) session on upgrade can't crash analytics. `sessions` is client-only for now (not yet part of the encrypted sync payload — `sync-schema.ts`/`db.ts` unchanged; syncing sessions is a follow-up).
- Flagging a card now means "this card's source content may be outdated" (something to review or refresh), not "come back to this later" (#12).
- New files get a collision-safe default name that is never reused after a file is deleted (#15).

### Fixed

- `/end` (`resetSession`) no longer destroys session history: it now finalizes the current `sessionEvents` log into a durable `Session` record (attributed to the active note) before clearing it, instead of just wiping it. Finalization runs whether or not the AI summary succeeds, so a session is always captured. A session left dangling by a `/start` with no matching `/end` (tab closed, etc.) is finalized on the _next_ `/start` so no worked/break time is silently dropped. The live bottom-bar timer is unaffected — it already read only the (now correctly per-session) `sessionEvents` log. The analytics page's all-time totals and 14-day focus chart now aggregate the durable `sessions` list instead of re-folding the volatile live log, so a second `/start … /end` cycle no longer erases the first's contribution (issue #10).
- Honest FSRS session completion: the review tray reports "X of Y reviewed" and only claims "caught up" when nothing is due globally and no card was rated "again"; closing the tray early reports the partial count instead of nothing (#11).
- Workspace JSON export now includes the durable `sessions` history, so a "full workspace" backup taken after `/end` is no longer missing per-session data (#10).
- `/card` and `/vocab` now land the caret at the end of the front/term value (matching `/question`'s "after `Q: `" behavior) instead of below the inserted block (#20).

## [0.4.0] - 2026-07-25

### Added

- Local-first note editor with markdown support, editable outline, and sidebar file browser.
- Slash command framework: `/question`, `/canvas`, `/card`, `/vocab`, `/start`, `/calc`, `/fsrs`, `/help` for study workflows (question generation, spaced-recall cards, session tracking, arithmetic).
- Local-only OpenAI-compatible AI pipeline: all requests routed to user-configured local LLM server (Ollama, LM Studio, llama.cpp, vLLM) with no cloud fallback; every request recorded in audit trail.
- Optional encrypted SQLite sync backend (AES-GCM, user-held key file, session-only in memory); last-write-wins with tombstones; deployable as a single unit via Docker.
- FSRS-4.5 spaced-repetition scheduler for closed flashcard/question/vocab blocks; inline review tray beneath editor.
- Analytics page with session statistics, card review history, AI request audit trail, and storage usage.
- Docker Compose setup for one-command self-hosted deployment (app + encrypted-sync backend).

### Changed

- (none — initial release at 0.4.0)

### Fixed

- (none — initial release at 0.4.0)

### Removed

- (none — initial release at 0.4.0)
