# RAG for /help via Postgres + pgvector — design (ADR)

## Context

The app is local-first: notes live in a zustand store; optional sync pushes
**client-encrypted** blobs to a SQLite backend the server can't read
(`db.ts` merges on plaintext timestamps only; `crypto.ts` holds the key
client-side). `/help` (`helpNudge` → `runCloseAi` → `queueAi(HELP_SYSTEM)`)
is context-blind. AI is strictly local (`ai-client.ts`, no cloud) and gated
by `isFilePersonal` in `ai-queue.ts`. We are adding a pgvector service to
make `/help` retrieval-augmented, additive and opt-in.

## The central tension (R6): vectors vs end-to-end encryption

Semantic search needs vectors that preserve meaning; E2E sync deliberately
gives the server only opaque ciphertext. You cannot have the _same_ server
both blind to content and able to rank it by meaning. Three ways out:

- **Option A — Local-trust RAG (recommended for MVP).** The pgvector
  service is part of the user's own local/self-hosted deployment (same
  trust boundary as their local AI server and their own machine). Vectors
  and the small plaintext chunks needed to build `/note` scaffolds live in
  Postgres on that trusted host. RAG is only available when the user runs
  this local service; it is explicitly a _local-trust_ feature, decoupled
  from the _remote_ encrypted sync. Sync stays E2E and untouched; RAG does
  not push plaintext to any remote. Documented plainly: "RAG indexes run on
  a host you trust; don't point it at an untrusted server."
- **Option B — Encrypted-at-rest vectors, client-side similarity.** Store
  ciphertext chunks; compute similarity client-side after pulling
  candidates. Defeats the point of pgvector (ANN in the DB) and doesn't
  scale — rejected for MVP.
- **Option C — Blind-index / encrypted vector search.** Property-preserving
  or client-side ANN structures the server can traverse without plaintext.
  Real but heavyweight; a research-grade build. Deferred; note as the path
  if remote-untrusted RAG is ever required.

**Decision: Option A.** It ships value now, keeps the E2E-sync guarantee
exactly as-is (RAG is a separate, local-trust capability), and matches the
user's "additive Docker image" framing. The trust boundary is stated, not
hidden. Revisit C only if RAG must run on an untrusted remote.

## Architecture

- **Service (R1):** add a `pgvector` service to `docker-compose.yml`
  (`pgvector/pgvector` image) with its own volume, on the app's local
  network, opt-in (a compose profile or documented `--profile rag`). The
  Node server gains a Postgres client and a small data-access module
  `src/lib/server/rag.ts`; routes under `/api/rag/*` (bearer-authed like
  the rest of `api.ts`). Two stores coexist: SQLite for
  metadata/sync-merge (unchanged), Postgres/pgvector for embeddings — the
  design keeps them separate rather than migrating SQLite.
- **Schema:** `chunks(id, source_kind, source_id, file_id, chunk_ix,
text, embedding vector(N), updated_at)` with an ivfflat/hnsw index on
  `embedding`. `N` = the local embedding model's dimension (configurable;
  detected from a probe).
- **Embedding flow (R2, R5):** a new `queueEmbedding` path reusing
  `ai-queue`'s single-flight + **the same `isFilePersonal` gate** — a
  personal file is rejected before embedding, identically to prompting.
  Embeddings hit the local server's `/embeddings` (extend `ai-client.ts`
  with an `embed()` that posts to `{base}/embeddings`).
- **Indexing (R3):** on note change, debounce (reuse the sync
  debounce pattern in `sync.ts`), chunk (fixed-size with overlap), embed
  changed chunks, upsert into `chunks`; deletes/personal-toggles purge rows
  (R5, edge cases) — tombstone-consistent with sync.
- **RAG `/help` pipeline (R4):** `helpNudge` gains a retrieval step:
  1. embed the current question/focus (via the gated path),
  2. `POST /api/rag/search` → top-k chunks from the user's own material
     (exclude personal, exclude the current file if desired),
  3. `/split` the view (reuse `layout:split`) and insert relevant `/note`
     line-items built from the retrieved chunks (scaffolding),
  4. append the retrieved context to `HELP_SYSTEM` as reference material,
     keeping the "never give the answer" Socratic constraint,
  5. degrade gracefully if embeddings/service are unavailable (R-edge, R7).

## Phased MVP (ship the smallest useful slice first)

- **Phase 0 — plumbing:** compose service + schema + `embed()` +
  `/api/rag/*` behind auth; no UI change. Verify a note round-trips to a
  vector and back.
- **Phase 1 — retrieval-augmented nudge:** step (1),(2),(4) — `/help` uses
  retrieved context to sharpen the nudge. No `/split`/scaffold yet.
- **Phase 2 — the harness:** add (3) — `/split` + inserted `/note`
  scaffolds. This is the full issue-#9 vision.
- **Gate:** **needs sign-off before Phase 0 lands** — it adds a service, a
  dependency, and a documented trust-boundary decision.

## Data model changes

- Postgres `chunks` table (above); new `src/lib/server/rag.ts`; `embed()`
  in `ai-client.ts`; a gated `queueEmbedding` in `ai-queue.ts`; indexing
  hook in `sync.ts`/store subscription; `/api/rag/*` in `api.ts`;
  `docker-compose.yml` service. Client store: a small `ragEnabled` flag +
  index status. Record all of it (and the trust-boundary note) in the
  changelog and README. SQLite/sync-schema unchanged (Option A keeps them
  separate).

## Alternatives considered

- **chromadb** (as the issue mused): rejected by the user in favor of
  pgvector/Postgres — and pgvector reuses the existing Docker/SQL posture
  rather than adding a second storage paradigm.
- **One store (migrate everything to Postgres):** rejected — needless
  churn of the working SQLite sync/merge; keep concerns separate.
- **Embed on the server:** rejected — embeddings must go through the local
  AI server and the client-side privacy gate; the server never sees
  personal content.

## Open questions (for sign-off)

- Embedding model + dimension: require a specific local embedding model, or
  detect/probe? (Leaning: probe + configurable `N`.)
- Do cards/questions get embedded too, or notes only for MVP? (Leaning:
  notes first.)
- Exact `/note` scaffold shape inserted on `/split` — how many, how
  summarized, and whether they're editable/removable inline.
- Confirm Option A's local-trust framing is acceptable, or whether a later
  Option-C (untrusted-remote) path is required.
