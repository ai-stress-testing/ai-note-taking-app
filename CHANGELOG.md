# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Convention

- **Every user-facing change** adds a line under `[Unreleased]` in the appropriate section (Added, Changed, Fixed, Removed).
- **Any change that bumps the persisted store `version` field** (`src/lib/store.ts`) or alters `src/lib/sync-schema.ts` **must add a `Changed` entry explicitly naming the migration boundary**, since these are compatibility-critical edits for users with existing data.
- On release, the `[Unreleased]` section is retitled with the new version and release date, and `package.json` is bumped to match.

## [Unreleased]

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
