# Settings split + multi-model registry

## Problem

Two issues bundled in #5:

1. **Single-model lock-in.** The store holds one flat AI config —
   `localAiUrl` + `localAiModel` (+ `verifyAiModel`) in `src/lib/store.ts`.
   To use a different model the user must retype the URL/model in settings
   every time; there is no way to keep several configured servers/models
   and switch between them. The user reported "the AI pipeline is still
   isolated to one model."
2. **One overloaded settings modal.** `SettingsModal.tsx` mixes two
   unrelated concerns in one scroll: local-AI configuration and the sync /
   encryption-key management. #5 asks to split these into two views.

(Note: an earlier stale-snapshot save bug that reverted settings on reload
has already been fixed — the form now mounts fresh on open. This spec is
about the _registry_ and the _view split_, not that bug.)

## Requirements

- R1. The user can define **multiple AI configurations** — each a
  `{ label, url, model }` — save them, and pick which one is active. The
  active config is what the pipeline uses.
- R2. Switching the active config takes effect for subsequent AI calls
  with no retyping (the pipeline reads the active config reactively, as it
  already reads `localAiUrl`/`localAiModel`).
- R3. The optional per-purpose **verification model** still works,
  expressed against the new model (either a per-config verify model, or a
  registry entry marked as the verifier — design decides).
- R4. Settings is split into **two views**: (a) AI models, (b) sync &
  encryption key (mount/dismount). Both reachable, clearly separated (tabs
  or two panes).
- R5. Existing saved settings **migrate** into the new shape (the current
  flat `localAiUrl`/`localAiModel`/`verifyAiModel` becomes the first,
  active config) — no user reconfiguration on upgrade.
- R6. The active config persists and (where appropriate) participates in
  the persist `partialize`; the AI settings are device-local config, not
  synced note content (confirm they stay out of the encrypted note sync,
  matching today).

## Non-goals

- Cloud AI providers or provider-specific auth (local-only design stands;
  configs point at local OpenAI-compatible servers).
- Per-file or per-command model routing (one active model for the app;
  the verify model is the only purpose-split).
- Auto-discovery of installed models beyond the existing "test connection"
  probe (which can _inform_ a picker but isn't required to populate it).
- Secrets management (local servers here don't need API keys; don't build a
  key vault).

## Edge cases

- Deleting the active config: fall back to another config or a safe empty
  state; never leave the pipeline pointing at a deleted config.
- Migrating a profile whose flat fields are empty/default: becomes a single
  default config, still valid.
- A config with a URL that doesn't resolve: the existing `probeLocalAi`
  reachability + error surfacing still applies per-config.
- Duplicate labels: allowed or disambiguated (design decides), but the
  active pointer must be by stable id, not label.
