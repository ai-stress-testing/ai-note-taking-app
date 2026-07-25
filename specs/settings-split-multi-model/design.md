# Settings split + multi-model registry — design

## Context

Today: `localAiEnabled`, `localAiUrl`, `localAiModel`, `verifyAiModel` are
flat store fields, read directly by the pipeline (`queueAi` args built in
`src/routes/index.tsx`) and by `SettingsModal.tsx`. The AI base-URL
resolution already lives in `probeLocalAi`/`runAi` (`src/lib/ai-client.ts`)
and works with or without `/v1`. The change is a data-shape upgrade (one
config → a registry) plus a UI split; the pipeline's read sites change from
reading two fields to reading "the active config's" two fields.

## Approach

**1. Data model — a small registry.**

```
type AiModelConfig = {
  id: string;        // stable, for the active pointer
  label: string;     // "Ollama · llama3.2"
  url: string;       // base URL (with/without /v1, resolved by probeLocalAi)
  model: string;     // model name
  verifyModel?: string; // optional per-config verifier (R3)
};
// store:
aiModels: AiModelConfig[];
activeAiModelId: string;
localAiEnabled: boolean;   // unchanged, global on/off
```

Derive the effective values with a selector/helper
`activeAiModel(state)` → the `AiModelConfig` whose `id === activeAiModelId`
(fallback to the first, or a safe empty). Replace the pipeline's reads of
`localAiUrl`/`localAiModel`/`verifyAiModel` with reads off the active
config. Keep `localAiEnabled` as the global toggle.

**2. Migration (R5).** `migrate` bump in the persist config: build a single
`AiModelConfig` from the old flat fields (`id: uid()`, `label` derived from
url/model, `url`, `model`, `verifyModel: verifyAiModel`), set it active,
drop the flat fields. Note the migration + store `version` bump in the
changelog (`specs/changelog-versioning/`). This is exactly the kind of
persisted-shape change #2 wants recorded.

**3. Store actions.** `addAiModel(cfg)`, `updateAiModel(id, patch)`,
`deleteAiModel(id)` (with active-pointer fallback per edge case),
`setActiveAiModel(id)`. All device-local; keep them OUT of the note sync
`partialize`/sync-schema (R6 — AI config is not encrypted note content;
matches today, where these fields are persisted locally but not synced).

**4. UI split (R4).** `SettingsModal` becomes two views behind a simple
tab/segment: **"AI models"** and **"Sync & key"**. The AI view shows the
config list (label · url · model), an active selector (radio), add/edit/
delete, the presets (Ollama/LM Studio/llama.cpp) as quick-add, and the
existing per-config "test connection" (`probeLocalAi`). The Sync view holds
the token + generate/load key + enable-sync controls already present. The
form still mounts fresh on open (the existing fix stays).

## Data model changes

- Add `aiModels: AiModelConfig[]` + `activeAiModelId`; remove flat
  `localAiUrl`/`localAiModel`/`verifyAiModel` (migrated). `localAiEnabled`
  stays. New actions above. `persist` `version` bump + `migrate`.
- `partialize`: persist `aiModels` + `activeAiModelId` locally; do not add
  them to the encrypted note-sync payload (`sync-schema.ts` unchanged).

## Alternatives considered

- **Keep the flat fields, just add a few "saved presets" you copy from.**
  Rejected: that's still one live config; R1/R2 want the active model to
  _be_ a selected registry entry, not a copy-paste source.
- **Sync the model registry across devices.** Rejected for MVP: servers/
  models are device-specific (localhost URLs differ per machine); syncing
  them would push a laptop's `localhost:11434` onto a phone. Device-local
  is correct here.
- **Per-file/per-command model routing.** Rejected (non-goal): one active
  model + an optional verifier is the requested granularity.

## Open questions

- Verify model as a per-config field vs a registry entry flagged
  `role: "verify"`. Leaning per-config `verifyModel?` (simplest, matches
  today's single `verifyAiModel`), but a shared verifier across configs is
  also reasonable — confirm.
- Tabs vs two stacked sections for the split — a UX call; tabs keep each
  view uncluttered.
- Whether "test connection" should auto-populate a model picker from the
  probe's model list (nice-to-have, not required).
