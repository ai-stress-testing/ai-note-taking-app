# Backend persistence (optional, self-hosted)

## Problem

Today all state lives in one browser's `localStorage`. That means:

- No access to your notes from a second device or browser.
- No durable backup — clearing browser data or losing the machine loses
  everything (the manual JSON/Markdown export in the Download modal is the
  only safety net, and it's a manual, point-in-time action).
- No good place to put binary content (canvas snapshots, pasted images,
  future file attachments) — `localStorage` has a practical size ceiling
  (~5–10MB depending on browser) that inline binary data would blow through
  fast.

This app is local-first by design and should stay that way for anyone who
wants zero setup. But some users want their notes to durably survive a
lost laptop or follow them to a second machine, without giving up local-
first defaults or handing their notes to a third-party cloud service.

## Requirements

- R1. A user can optionally turn on a personal backend that durably stores
  their workspace (folders, files, canvases, session history).
- R2. Once enabled, edits made on one device/browser show up on another
  device/browser pointed at the same backend, without a manual
  export/import step.
- R3. The backend is fully optional. Anyone who doesn't enable it gets
  today's exact behavior — nothing changes for them, nothing is silently
  sent anywhere.
- R4. Every request to the backend requires a per-install auth token.
  Nothing about a user's notes is readable by anyone without it.
- R5. Binary content (canvas snapshots, exported bundles, and future
  pasted images/attachments) is stored as content-addressed blobs, not
  duplicated inline in every sync payload.
- R6. A user can self-host the backend as a single Docker container
  pointed at a data directory they control (their NAS, home server, VPS).
- R7. A user who wants a fully offline, zero-network desktop experience
  can install a native app (Tauri) instead of running Docker anywhere —
  same backend, same data model, no exposed network port at all.
- R8. Existing local-only users are unaffected. No forced migration, no
  nag screens.
- R9. Note content, canvases, and blobs are encrypted before they ever
  leave the browser, using a key the user supplies from their own
  filesystem — not a key the app generates or stores for them. The
  backend stores and syncs ciphertext; it never has the key and never
  sees plaintext, even if the server itself were fully compromised.
- R10. Folders are user-created and user-named (not a fixed built-in
  set) and must sync like everything else in R2 — the existing
  create/rename/delete-folder behavior extends to the backend, it isn't
  a new client feature by itself.

## Non-goals (v1)

- Real-time collaborative multi-user editing. No CRDT/Yjs merge engine.
  Sync is last-write-wins between a user's own devices, not concurrent
  co-editing with other people.
- Multi-tenant accounts. One backend instance serves one person's
  workspace, not a team of separate users with separate logins.
- Public sharing / read-only links to a note.
- Automatic conflict resolution beyond last-write-wins-by-timestamp.
- Key recovery. Losing the key file means losing access to everything
  encrypted with it — by construction (see R9) there is no "reset my
  encryption key" path that doesn't involve re-encrypting from a
  plaintext copy the user kept elsewhere.

## Edge cases

- **Offline edits, then reconnect**: a device that edited a file while the
  backend was unreachable must reconcile on reconnect without silently
  discarding either side's changes when timestamps are ambiguous.
- **Two devices edit the same file while both offline**: last-write-wins
  by `updatedAt` is the resolution strategy. This can lose data — that
  trade-off must be visible to the user (e.g. in docs/UI copy), not a
  silent surprise.
- **Token loss**: if a user loses their auth token, there must be a
  documented recovery path (re-derive/reset from the machine running the
  backend) that doesn't require wiping their data.
- **Encryption key loss**: unrecoverable by design (see non-goals). The
  UI must make this consequence unmistakable at the point the user first
  sets up their key, not bury it in docs.
- **New device, first connection**: a second device pointed at an
  existing backend has no way to decrypt the synced ciphertext until the
  user supplies the same key file on that device too — the UI must
  explain this clearly rather than silently showing unreadable/failed
  content.
- **Blob growth**: content-addressed blobs referenced by nothing (e.g.
  after a file/canvas delete) shouldn't grow storage unbounded forever —
  needs a cleanup story, even if it's a manual admin action in v1.
- **Backend briefly down**: the client must keep working entirely off its
  local copy (this is already true today) and just resume syncing when the
  backend is reachable again.
