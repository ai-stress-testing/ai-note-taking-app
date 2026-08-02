# AI server-side proxy — tasks

- [x] Add `proxy?: boolean` to `AiModelConfig` (`src/lib/store.ts`).
- [x] Add `/api/ai-proxy` route + `isAllowedProxyTarget` SSRF guard to
      `src/lib/server/api.ts`, handled before the sync auth block. (Link-local
      169.254/16 excluded — cloud metadata SSRF target.)
- [x] Thread `proxy` through `ai-client.ts` (`endpointUrl`, `probeBases`,
      `resolveBase`, `probeLocalAi`, `runAi`) and prefix the base cache key by
      transport.
- [x] Add `localAiProxy` to `queueAi` and pass it from the three call sites in
      `routes/index.tsx`.
- [x] Settings UI: per-model proxy checkbox, transport-aware test, list badge
      (`src/components/SettingsModal.tsx`).
- [x] CHANGELOG `Added` entry.
- [x] Verify: build/lint + Playwright against a mock server exercising both
      transports and the SSRF rejection. 14/14 pass (server route forwarding for
      GET/POST, SSRF 403 for public + metadata IP, upstream-status passthrough,
      not-gated-by-sync-token, auth still enforced on other routes; browser both
      transports via the test button, badge, persisted flag, browser POST chat).
