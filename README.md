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

| Command                            | What it does                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `/question`                        | MCQ template — `Q:`, lettered parts, 4 `[ ]` choice brackets; mark answers `[x]`; graded on close (verified + summary + 3 tags) |
| `/vocab`, `/card`, `/note`         | term/definition, front/back, and knowledge-note capture blocks                                                                  |
| `/math`, `/calc`                   | math corrected to LaTeX on close; calculations verified by a real evaluator, never model arithmetic                             |
| `/>`                               | closes the current block — cards join the deck, AI follow-ups fire                                                              |
| `/fsrs`                            | reviews due cards inline at that line (FSRS-4.5; keyboard: space, 1–4, ⚑ flag)                                                  |
| `/help`                            | Socratic nudge block — close to send; never the answer                                                                          |
| `/start` `/break` `/resume` `/end` | session timer + AI session summary (habit metrics stay private)                                                                 |
| `/canvas` `/split` `/export`       | drawing canvas at that line, panes, backup export                                                                               |

Mark any file or folder **personal** (⊘ in the sidebar) and nothing in it
is ever included in an AI request — enforced at one central chokepoint,
with visible "not sent" feedback. The **analytics** page (◔ in the header)
shows focus history, review throughput, grading ratios, and tag frequency —
computed locally, never sent anywhere.

A starter deck of 8 cards ships in so `/fsrs` works immediately. Every
review logs full FSRS data points (elapsed time, retrievability,
stability/difficulty before and after) for future parameter optimization.

## Development

- `bun run lint` / `bun run format` — eslint + prettier
- `bun run build` — production build (`.output/`)
- See `CLAUDE.md` for architecture and `specs/` for feature specs.
