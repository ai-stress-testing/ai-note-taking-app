# Backend persistence — tasks

Ordered by dependency. Nothing here is started yet — this is the plan this
spec exists to produce, to be picked up as its own follow-up work.

## Phase 1 — schema + local CRUD (no networking yet)

- [ ] Add `bun:sqlite` schema/migration for `folders`, `files`, `canvases`,
      `session_events`, `blobs`, `auth_tokens` (design.md § Data model).
- [ ] Add TanStack Start server functions for workspace CRUD
      (`GET /api/workspace`, file/folder create/update/delete).
- [ ] Unit-test the CRUD layer directly against a throwaway SQLite file —
      no client wiring yet.

## Phase 2 — blob store

- [ ] Implement the filesystem `BlobStore` (content-addressed, `sha256`
      keying, directory sharding).
- [ ] Add upload/fetch routes (`POST /api/blobs`, `GET /api/blobs/:hash`)
      with size-limit enforcement.
- [ ] Add the manual ref-count sweep (admin CLI command or route, gated
      behind the same auth token).

## Phase 3 — auth + security hardening

- [ ] First-boot token generation, logged once, hashed in storage.
- [ ] Bearer-token middleware on every route.
- [ ] Fixed-window rate limiting on auth failures.
- [ ] Bind-to-localhost default; document the reverse-proxy pattern for
      anyone exposing beyond localhost.

## Phase 4 — client sync layer

- [ ] Settings UI: backend URL + token fields (mirrors the existing local
      AI settings pattern), off by default.
- [ ] On-load snapshot fetch + last-write-wins merge into the Zustand
      store.
- [ ] Fire-and-forget sync on store mutations, with an in-memory retry
      queue for requests made while offline.
- [ ] Manual test: two browser sessions against one backend instance,
      confirm edits propagate and offline-then-reconnect doesn't drop
      changes.

## Phase 5 — Docker packaging

- [ ] `Dockerfile` for the existing app + new backend routes (single
      image, no separate service).
- [ ] `docker-compose.yml` example: app container + named volume for the
      SQLite file and blob directory.
- [ ] README: first-boot token retrieval, backup snippet, reverse-proxy
      example for non-LAN exposure.

## Phase 6 — Tauri packaging (optional, after Phase 5 proves the model)

- [ ] Bundle the backend as a Tauri sidecar binary; confirm it binds only
      to an ephemeral localhost port.
- [ ] Point the bundled frontend at the sidecar by default; confirm the
      "point at a remote Docker backend instead" path still works for
      users who want both a native app and cross-device sync.
- [ ] Per-OS build/sign/release pipeline (separate concern from the web
      app's existing build).
