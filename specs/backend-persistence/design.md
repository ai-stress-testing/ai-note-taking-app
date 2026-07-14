# Backend persistence — design

## Decision in one paragraph

Build **one** backend — SQLite for structured data, a content-addressed
filesystem blob store for binary data, exposed as server routes on the
*existing* TanStack Start app (no separate service) — and offer it through
**two** optional distribution wrappers around that same code: a Docker
image for self-hosting, and a Tauri desktop shell that runs the identical
backend as a local sidecar with no network port at all. `localStorage`-only
mode remains the default; nothing here changes behavior unless a user opts
in.

## Why "one backend, two wrappers" instead of picking Docker *or* Tauri

The prompt asked to weigh a Tauri app against a Docker backend, but they
aren't actually alternatives to each other — they answer different
questions:

- **Docker** answers "where does the persistence layer *run*?" (someone
  else's/your own always-on machine, reachable over a network).
- **Tauri** answers "how is the *client* distributed?" (a native binary
  instead of a browser tab).

A Tauri app still needs somewhere to persist data. If we wrote the backend
as Rust `tauri::command`s directly, we'd be building and maintaining a
second implementation of the same CRUD/blob logic in a second language —
real ongoing cost for a solo/small project, and a classic case of
"speculative architecture" the project's own conventions warn against.

Instead: write the backend once, in the stack the project already uses
(Bun + TanStack Start server functions + `bun:sqlite`, which ships with Bun
— no native-binding install step). Then:

- **Docker distribution**: run that server standalone, bind to a port, put
  a data volume under it. For LAN/remote/multi-device access.
- **Tauri distribution**: bundle the same Bun server as a sidecar binary
  inside the Tauri shell (Tauri's documented "sidecar" pattern for bundling
  an external process). The desktop app talks to `127.0.0.1:<ephemeral
  port>` that nothing outside the OS process tree can reach — no auth
  token even strictly required in that mode, though we keep the same
  token check for code-path uniformity.

One codebase, two ways to run it. A user picks Docker if they want
cross-device sync reachable over their network; Tauri if they want a
single native app with zero listening sockets and don't need multi-device
sync (or want *both*: a Tauri app on the laptop pointed at a separately
hosted Docker backend for sync — the two aren't exclusive).

### Tradeoffs, made explicit

| | Docker (self-hosted server) | Tauri (native desktop) |
|---|---|---|
| Reuses existing TS/Bun code | Yes, directly | Yes, via sidecar (no Rust rewrite) |
| Multi-device sync | Yes — that's the point | Only if also pointed at a Docker backend |
| Network attack surface | Real — a listening service that needs auth, TLS, binding discipline | None — no port reachable outside the OS |
| Operational burden on the user | Must run/update a container, manage a volume | Just install an app; auto-update is the app's own concern |
| New build/release pipeline | No — same container image regardless of client OS | Yes — per-OS bundles, code signing, Tauri toolchain in CI |
| Fits "student/personal tool" audience | Only for the subset willing to self-host | Yes, closer to zero-setup |

Recommendation: build the backend and Docker packaging first (it's the
smaller lift and the thing multi-device sync actually requires). Treat
Tauri as a later, optional packaging task — genuinely useful, but nothing
about it is blocking, and it shouldn't be started until the backend's data
model has proven itself via Docker use.

## Data model (SQLite)

Mirrors the existing Zustand `State` shape (`src/lib/store.ts`) closely on
purpose — the sync layer's job is to keep two copies of *that* shape
consistent, not to invent a new one.

```sql
create table folders (
  id text primary key,
  name text not null,
  accent text not null,
  created_at integer not null,
  updated_at integer not null
);

create table files (
  id text primary key,
  folder_id text not null references folders(id),
  name text not null,
  content text not null default '',
  created_at integer not null,
  updated_at integer not null
);

create table canvases (
  id text primary key,
  file_id text not null references files(id),
  width integer not null,
  height integer not null,
  strokes_json text not null,  -- small; stays inline like today's store
  updated_at integer not null
);

create table session_events (
  id integer primary key autoincrement,
  type text not null,          -- start | break | resume | end
  at integer not null
);

create table blobs (
  hash text primary key,       -- sha256 of the bytes, hex
  mime_type text not null,
  size_bytes integer not null,
  ref_count integer not null default 1,
  created_at integer not null
);

create table auth_tokens (
  id integer primary key autoincrement,
  token_hash text not null,    -- never store the raw token
  label text,
  created_at integer not null
);
```

No `workspaces` or `users` table in v1 — one backend instance is one
person's one workspace (matches R8/non-goals). Adding multi-workspace or
multi-user later means adding a foreign key and a `where` clause, not a
rewrite, but that's future work, not now.

`content` stays as plain `TEXT`, not blob-referenced — notes are small
text, and keeping them queryable/greppable in SQLite directly is more
useful than forcing everything through the blob path. "Blobs" here means
genuinely binary, potentially-large content: canvas *snapshots* (a
rendered PNG, if we add export-as-image later), exported bundle archives,
and future pasted images/attachments — not the note text itself.

## Blob storage

Content-addressed, like Git: `sha256(bytes)` is the key. Stored on disk at
`blobs/<hash[0:2]>/<hash>` under a configurable data directory (a Docker
named volume in the container case). Benefits: automatic dedup of
identical content, cache-friendly (immutable once written — a hash never
changes), and no user-controlled filenames ever touch the filesystem
(closes the obvious path-traversal footgun by construction).

Interface kept narrow so the local-filesystem implementation can be
swapped for S3-compatible storage later without touching callers:

```ts
interface BlobStore {
  put(bytes: Uint8Array, mimeType: string): Promise<{ hash: string }>;
  get(hash: string): Promise<{ bytes: Uint8Array; mimeType: string } | null>;
  delete(hash: string): Promise<void>;
}
```

Only a filesystem implementation ships in v1 — an S3 backend is a
plausible future need (e.g. hosting on a platform without persistent
local disk) but nothing here requires it yet; adding it later is just a
second class implementing the same three methods.

Cleanup: `ref_count` on the `blobs` row, decremented whenever the last
referencing file/canvas is deleted, swept (rows at `ref_count <= 0`
deleted from disk and the table) via a manual admin endpoint/CLI command
in v1. A scheduled sweep is a v2 nicety, not required to ship this
correctly.

## API surface

Plain REST on the existing TanStack Start server (new routes/server
functions alongside `src/lib/*.server.ts` — same pattern already used in
this codebase, just with real logic instead of the example scaffold that
was removed in cleanup). No GraphQL/tRPC — the data shape is small and the
operations map directly onto the Zustand store's own actions, so a bigger
query layer would be solving a problem this app doesn't have.

```
GET    /api/workspace          full snapshot (folders, files, canvases, session log)
PATCH  /api/files/:id          partial update (content, name, folderId)
POST   /api/files              create
DELETE /api/files/:id          delete
PATCH  /api/folders/:id
POST   /api/folders
POST   /api/session-events     append-only log
POST   /api/blobs              multipart upload -> { hash }
GET    /api/blobs/:hash        binary fetch, sets long-lived cache headers (content is immutable)
```

Every route requires `Authorization: Bearer <token>`, checked against
`auth_tokens.token_hash` (the token itself is never stored — only its
hash, same posture as a password). A token is generated on first boot,
printed once to the server log, and never re-displayed in full again
(matches R4 and standard secret-handling practice).

## Sync strategy

Last-write-wins by `updated_at`, matching the field the store already
tracks on every file/folder. On the client:

1. On app load (if backend configured and reachable): `GET
   /api/workspace`, merge into local Zustand state — for each entity, keep
   whichever side has the newer `updated_at`.
2. On every local mutation: apply optimistically to local state
   immediately (today's UX, unchanged), then fire-and-forget the
   corresponding PATCH/POST/DELETE to the backend.
3. A small retry queue (in-memory, flushed on an interval and on
   reconnect) covers requests that failed while the backend was
   unreachable — this is what makes "offline edits, then reconnect" in
   requirements.md work without the user noticing anything.

This deliberately does **not** use a CRDT (e.g. Yjs, which is what
AFFiNE's own real-time multi-user collaboration is built on). AFFiNE needs
CRDT because multiple people can type into the same document at the same
time; this app's stated use case is one person's notes across their own
devices, which last-write-wins handles correctly and is an order of
magnitude simpler to build, reason about, and debug. If true concurrent
multi-user editing ever becomes an actual requirement, that's a
significant follow-up spec of its own — not something to build speculatively now.

Implementation-wise, this should land as a thin sync layer that observes
the existing store's actions (or wraps `setContent`/`createFile`/etc.)
rather than a rewrite of `store.ts` — the goal is additive, not a
restructuring of code that already works.

## Security

- **Opt-in, off by default.** No backend calls happen at all unless a
  user explicitly configures one in Settings — same pattern already
  established for local AI.
- **Bind to `127.0.0.1` by default**, even inside the Docker container
  (i.e. the container's internal bind is localhost-only; exposing it
  beyond that is a docker-compose port-mapping decision the user makes
  explicitly, same shape as how Ollama defaults safe).
- **No bundled TLS.** Document that anyone exposing the backend beyond
  their own LAN should put a reverse proxy (Caddy/Traefik/nginx) in front
  for TLS termination, rather than growing our own TLS handling — this is
  standard practice for small self-hosted services and keeps the backend
  itself simple.
- **Bearer token auth on every route**, token hash only in the DB, token
  shown once at first boot.
- **Blob upload limits**: max size per upload (config, sane default e.g.
  25MB), and no execution or inline-rendering trust implied by a stored
  blob — the client decides how to render a fetched blob (e.g. never
  render an uploaded SVG/HTML blob as live markup) since the backend
  itself doesn't interpret blob content at all, it just stores bytes.
- **Rate limiting**: a simple fixed-window limiter on auth failures to
  blunt token brute-forcing, cheap to add, meaningfully raises the bar.
- **File permissions**: SQLite file and token secrets written with `0600`
  perms; documented in the Docker README, not just assumed.
- **Backups**: document a `sqlite3 <path> ".backup <dest>"` cron snippet
  and note that the blob directory should be backed up alongside the DB
  (a blob hash referenced by a DB row with no corresponding file on disk
  is a real failure mode worth calling out).
- **Encryption at rest**: not in v1. Documented as a follow-up (e.g.
  SQLCipher, or relying on the host's disk encryption) rather than
  built now — the threat model for a personal self-hosted note backend
  is "don't expose it to the internet without a token/TLS," not "protect
  against someone with root on the box," and conflating those would add
  real complexity for a threat most users in scope don't face.

## Alternatives considered

- **Separate Node/Express (or similar) microservice** instead of routes on
  the existing TanStack Start app. Rejected: doubles the number of things
  to deploy/version/keep in sync for no benefit at this scale — the
  existing app already runs on Nitro (a real server runtime), adding
  routes to it is strictly less moving parts.
- **Postgres instead of SQLite.** Rejected for v1: single-user/personal
  scale doesn't need a client-server DB, and SQLite (via `bun:sqlite`,
  already available with zero extra install) matches the project's
  "boring, minimal dependencies" bias. Worth revisiting only if a genuine
  multi-user/team requirement shows up later.
- **Yjs/CRDT sync** (AFFiNE's actual approach). Rejected for v1 per the
  non-goals — real-time multi-user co-editing isn't a stated requirement,
  and building/maintaining a CRDT layer is a large, ongoing cost that
  isn't justified by "sync my own two devices."
- **S3-only blob storage** (no local filesystem option). Rejected as the
  *only* option for v1 — most self-hosters running a single Docker
  container want a bind-mounted directory, not a separate object-storage
  account; the `BlobStore` interface leaves room to add S3 later without
  forcing it on everyone now.

## Open questions

- Exact token-recovery UX when a user loses their token (regenerate via a
  CLI flag on the container, most likely — needs a concrete decision
  before implementation, not before planning).
- Whether canvas snapshots should actually render to a PNG blob in v1, or
  whether the JSON stroke data staying inline (as today) is good enough
  until there's a real export/thumbnail use case driving it.
- Where the sync retry queue's state should live if the browser tab
  closes mid-retry (acceptable to lose and re-derive from local state on
  next load, most likely, but worth confirming against R2's expectations).
