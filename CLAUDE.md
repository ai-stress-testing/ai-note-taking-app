# ai-note-taking-app (NeuroVim)

A local-first, education-focused note/study editor. Long-term direction: grow
toward an Affine-like general knowledge base (richer blocks, more surfaces)
while keeping the study-specific workflow (slash commands, session timer,
spaced-recall stubs) that differentiates it from a generic notes app.

Currently **no backend** — all state lives in the browser (zustand persisted
to `localStorage`). AI features require a local, OpenAI-compatible LLM server
(Ollama, LM Studio, llama.cpp server, vLLM, etc. — user's choice); there is no
cloud AI fallback by design.

## Stack

TanStack Start (React 19) + Vite + Nitro (build-only server bundling) +
Zustand + Tailwind v4. Package manager: Bun.

## Commands

- `bun install` — install deps
- `bun run dev` — dev server on :8080
- `bun run build` — production build (`.output/`)
- `bun run lint` — eslint (includes prettier as a lint rule)
- `bun run format` — prettier --write

## Architecture

- `src/routes/index.tsx` — the main editor route; owns pane layout, keybinds,
  and wires slash commands to the store.
- `src/lib/store.ts` — single Zustand store (folders, files, panes, session
  tracking, canvases). No slicing — keep it one store unless it grows past
  a few hundred lines of actions.
- `src/lib/commands.ts` — slash-command definitions (`/question`, `/canvas`,
  `/start`, `/help`, etc.) and their text-block templates.
- `src/lib/ai-client.ts` — the low-level AI call (`runAi`), local-only.
  Speaks the OpenAI-compatible chat-completions protocol so any local
  server (Ollama, LM Studio, llama.cpp, vLLM) works behind the configured
  URL/model — don't hardcode a specific provider here. Don't add a cloud
  provider path without discussing it first — the local-only design is
  intentional (see comments in that file).
- `src/lib/ai-queue.ts` — `queueAi`, the entry point app code should
  actually call (not `runAi` directly). Serializes every call behind one
  promise chain so only one request is ever in flight, and records each
  one into the store's `aiQueue` — the same list backs both the pending
  queue and the audit trail shown in the AI status button's modal.
- `src/lib/prompt.ts` — prompt-injection/control-char sanitization before any
  note content is sent to the model.
- `src/lib/ai-queue.ts` is also the AI privacy chokepoint: pass `fileId` and
  personal files/folders are rejected before any request is built. Never
  call `runAi` directly from app code.
- `src/lib/calc-eval.ts` — safe arithmetic evaluator behind /calc: the model
  extracts the expression, this evaluates it. No eval, allowlisted grammar.
- `src/lib/fsrs.ts` — FSRS-4.5 scheduler, pure functions. `src/lib/card-parse.ts`
  turns closed /card, /vocab, /question blocks into cards;
  `src/components/FlashcardTray.tsx` is the inline review UI behind `/fsrs`.
- `src/lib/sync.ts` + `src/lib/crypto.ts` + `src/lib/sync-schema.ts` — optional
  encrypted sync: AES-GCM in the browser (user-held key file, session-only in
  memory), zod-validated wire format, last-write-wins with tombstones.
- `src/lib/server/` — the persistence backend (SQLite via node:sqlite/bun:sqlite
  adapter, bearer-token auth), mounted as `/api/*` in `src/server.ts`. Same
  origin as the app; one deployable unit (see Dockerfile/docker-compose.yml).
- `src/components/` — hand-rolled UI (no shadcn components are wired in
  currently). `components.json` is kept so `npx shadcn add <name>` still
  works if a feature needs a primitive — add components on demand, not in
  bulk.

## Conventions

- Before writing new code, run through the decision ladder: does this
  need to exist at all? Already in this codebase? In the standard
  library or a native platform feature (e.g. Web Crypto, `bun:sqlite`)?
  Already an installed dependency? A one-line solution? Only then a
  minimal implementation. Don't add a dependency or an abstraction the
  ladder would have skipped.
- No comments unless they explain a non-obvious _why_ (see existing files
  for the bar to clear).
- Prettier formatting is enforced via `eslint-plugin-prettier`; run
  `bun run format` before committing.
- Path alias `@/*` → `src/*`.
- Don't reintroduce Lovable-platform-specific code (error reporting hooks,
  cloud AI gateway, sandbox-only vite plugins) — this repo was deliberately
  ejected from that tooling to be a plain, portable Vite/TanStack app.

## Spec-driven development

Before implementing any non-trivial feature (new slash command family, a new
route, a data-model change, backend/sync work), write a spec first under
`specs/<feature-slug>/`:

1. `requirements.md` — what the feature must do and why, as user-facing
   behavior. No implementation detail.
2. `design.md` — the technical approach: data model changes, new
   files/modules, how it fits the existing store/command/route structure,
   trade-offs considered.
3. `tasks.md` — an ordered checklist of concrete implementation steps,
   checked off as they land.

Small fixes, refactors, or one-off bug fixes don't need a spec. Use
judgment: if you can hold the whole change in your head, skip the ceremony.
See `specs/README.md` and `specs/_template/` for the exact format.
