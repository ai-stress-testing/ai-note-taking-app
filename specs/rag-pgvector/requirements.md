# RAG for /help via Postgres + pgvector

## Problem

The app has all the raw material for retrieval-augmented study — notes,
cards, questions, a local embedding-capable AI server — but `/help` is
context-blind. `helpNudge` (`src/routes/index.tsx`) builds a Socratic nudge
from only the current question + focus text (`HELP_SYSTEM`,
`src/lib/commands.ts`); it never draws on the user's own prior notes.
Issue #9: give the system embedding intelligence (pgvector, additive to the
current workflow) and turn `/help` into a learning harness — when a user
calls `/help`, retrieve their most relevant notes, `/split` the view, and
insert relevant `/note` line-items as scaffolding, feeding those retrieved
notes back into the nudge to improve it.

## Constraints already decided by the user

- **pgvector on Postgres** (a Docker image), **additive** to the existing
  stack — NOT chromadb, NOT replacing SQLite/localStorage.
- Embeddings come from the user's existing **local OpenAI-compatible
  server** (`/embeddings`); no cloud embedding provider (local-only AI is a
  hard rule).
- Issue #13 (in-browser model) is scrapped/closed — not a path here.

## Requirements

- R1. A pgvector-backed vector store runs as an optional Docker service,
  additive to the current single-container app (opt-in, like sync).
- R2. Notes (and optionally cards) are chunked and embedded via the local
  server's `/embeddings` endpoint, routed through the existing AI privacy
  chokepoint (`ai-queue`), and indexed as vectors keyed to their source id.
- R3. Indexing happens incrementally on note change (debounced, like sync),
  not as a blocking operation.
- R4. `/help` becomes retrieval-augmented: embed the current question/
  focus, retrieve top-k relevant chunks from the user's own material,
  `/split` the view, insert relevant `/note` line-items as scaffolding, and
  add the retrieved context to the `HELP_SYSTEM` prompt to sharpen the
  nudge — without giving away the answer (the Socratic rule stands).
- R5. **Privacy invariant preserved**: personal-marked files/folders are
  never embedded, never indexed, never retrieved into a prompt (the
  `isFilePersonal` chokepoint governs indexing as well as prompting).
- R6. **E2E-encryption invariant addressed**: today the sync server stores
  only client-encrypted ciphertext and cannot read notes. A vector index is
  in tension with that — the design must resolve how embeddings/retrieval
  coexist with (or explicitly opt out of) end-to-end encryption, without
  silently weakening it.
- R7. Everything stays local-first and opt-in: with RAG off, the app
  behaves exactly as today.

## Non-goals

- A cloud vector DB or cloud embeddings.
- Replacing the SQLite metadata/sync store with Postgres wholesale.
- Full chat-over-your-notes / general RAG Q&A — scope is the `/help`
  learning harness (retrieve → scaffold → sharpen the nudge).
- Cross-user / multi-tenant retrieval (single-user app).
- Re-ranking models, hybrid BM25+vector, or eval harnesses beyond a basic
  relevance sanity check (later, if warranted).

## Edge cases

- Local server lacks an `/embeddings` endpoint / model → RAG degrades to
  today's context-blind `/help` with a clear "embeddings unavailable" note.
- A note edited/deleted → its vectors are updated/removed (no stale
  retrieval; tombstone-consistent with sync).
- Personal file toggled after indexing → its vectors are purged (R5 must
  hold retroactively).
- pgvector service down → `/help` falls back gracefully; indexing queues or
  no-ops, never blocks editing.
- Large note → chunking with overlap; token/size caps on what's embedded.
