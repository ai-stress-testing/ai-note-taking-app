# RAG for /help via Postgres + pgvector — tasks

> Gated: needs sign-off before Phase 0 (adds a service + dependency + a
> documented trust-boundary decision). Phases are independently shippable.

## Phase 0 — plumbing

- [ ] Add a `pgvector` service to `docker-compose.yml` (opt-in profile) with
      its own volume on the app network.
- [ ] Add a Postgres client dep + `src/lib/server/rag.ts`; create the
      `chunks` table + ANN index (dimension configurable).
- [ ] Add `embed()` to `src/lib/ai-client.ts` (POST `{base}/embeddings`).
- [ ] Add a gated `queueEmbedding` in `src/lib/ai-queue.ts` reusing the
      `isFilePersonal` chokepoint (personal content never embedded).
- [ ] Add `/api/rag/*` routes (bearer-authed) in `src/lib/server/api.ts`.
- [ ] Verify a note round-trips text → vector → nearest-neighbor search.

## Phase 1 — retrieval-augmented nudge

- [ ] Debounced indexing hook (reuse the sync debounce) that chunks + embeds
      changed notes and upserts; purge on delete/personal-toggle.
- [ ] Extend `helpNudge`: embed the question/focus, `POST /api/rag/search`
      top-k, append retrieved context to `HELP_SYSTEM` (keep Socratic rule).
- [ ] Graceful degradation when embeddings/service unavailable (behaves as
      today).

## Phase 2 — the learning harness

- [ ] On `/help`, `/split` the view and insert relevant `/note` line-items
      built from retrieved chunks as scaffolding.
- [ ] Make scaffolds legible/removable; confirm they improve (not leak) the
      nudge.

## Cross-cutting

- [ ] Privacy: personal files never indexed/retrieved (test the retroactive
      purge on toggle).
- [ ] Docs: README + CHANGELOG note the opt-in service and the local-trust
      boundary vs E2E sync.
- [ ] `ragEnabled` flag + index status in the store/UI; RAG off ⇒ identical
      to today.
