# Settings split + multi-model registry — tasks

- [ ] Add `AiModelConfig` type + `aiModels`/`activeAiModelId` to the store;
      keep `localAiEnabled`. Add `activeAiModel(state)` helper.
- [ ] Add actions: `addAiModel`, `updateAiModel`, `deleteAiModel`
      (active-pointer fallback), `setActiveAiModel`.
- [ ] Bump persist `version` + `migrate`: fold flat
      `localAiUrl`/`localAiModel`/`verifyAiModel` into one active config;
      remove the flat fields. Record the migration in `CHANGELOG.md`.
- [ ] Update `partialize` to persist the registry locally; confirm it stays
      OUT of the encrypted note sync (`sync-schema.ts` unchanged).
- [ ] Repoint the pipeline reads in `src/routes/index.tsx` (and anywhere
      reading the flat fields) to the active config's url/model/verifyModel.
- [ ] Split `SettingsModal.tsx` into two views (tabs/segment): "AI models"
      (list, active selector, add/edit/delete, presets, per-config
      `probeLocalAi` test) and "Sync & key" (existing token/key controls).
- [ ] Migrate/verify existing profile loads with one active config and the
      pipeline uses it; switching configs changes outgoing requests
      (reuse the mock-server e2e pattern from the earlier AI-URL fix).
- [ ] `bun run lint` + build clean.
