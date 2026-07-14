# NeuroVim

A local-first study workspace for a Zettelkasten-style learning loop:
**ingest** (capture in your own words) → **distill** (slash-command blocks:
questions, vocab, cards) → **check for loss** (local-LLM verification) →
**review** (FSRS spaced repetition, inline in the editor).

Everything runs on your machine. AI features use any local
OpenAI-compatible server (Ollama, LM Studio, llama.cpp, vLLM) — no cloud,
by design. Notes sync to the built-in backend end-to-end encrypted with a
key only you hold.

## Run it — one command

Dev (Bun ≥ 1.3):

```
bun install && bun start
```

Or containerized (nothing to install but Docker; identical everywhere):

```
docker compose up --build
```

Either way the app is at **http://localhost:8080**.

## Persistence & sync (optional, off by default)

Without setup, everything lives in your browser's localStorage — exactly
as before. To get durable, server-side persistence:

1. Start the app. On first boot the server prints a **sync token** to the
   terminal (once). Lost it? `bun run token:reset` (or
   `docker compose exec neurovim node scripts/token-reset.mjs`).
2. In the app: **⚙ Settings → sync & encrypted backup** → paste the token.
3. Click **generate & download key** — a 32-byte key file downloads. Keep
   it somewhere safe (password manager, USB drive). **The app and server
   never store it; losing it makes the synced copy unrecoverable.**
4. Enable sync, save. Edits now sync continuously; on another device (or
   after clearing the browser), load the same key file and your workspace
   comes back.

Notes, names, canvases, and card contents are AES-GCM-encrypted **in the
browser** before upload — the server stores ciphertext plus the plaintext
timestamps/scheduling numbers it needs to merge (last-write-wins) and
schedule reviews. The API requires the bearer token on every request.

## Study workflow

| Command                            | What it does                                                                     |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| `/question`                        | MCQ template — `Q:`, lettered parts, 4 `[ ]` choice brackets; mark answers `[x]` |
| `/vocab`, `/card`                  | term/definition and front/back capture blocks                                    |
| `/>`                               | closes the current block — Card/Vocab/Question blocks become review cards        |
| `/fsrs`                            | reviews due cards inline (FSRS-4.5 scheduler; keyboard: space, 1–4)              |
| `/help`                            | Socratic nudge from your local model, never the answer                           |
| `/start` `/break` `/resume` `/end` | session timer + AI session summary                                               |
| `/canvas` `/split` `/export`       | drawing canvas, panes, backup export                                             |

A starter deck of 8 cards ships in so `/fsrs` works immediately. Every
review logs full FSRS data points (elapsed time, retrievability,
stability/difficulty before and after) for future parameter optimization.

## Development

- `bun run lint` / `bun run format` — eslint + prettier
- `bun run build` — production build (`.output/`)
- See `CLAUDE.md` for architecture and `specs/` for feature specs.
