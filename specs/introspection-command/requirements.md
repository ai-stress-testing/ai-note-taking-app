# /introspection — folder-scoped session-opening insights

> Issue #18. A `/introspection` command that captures a student's
> session-opening insight as a "child of the folder," surfaced gracefully by
> `/start`, and aggregated by an AI folder summary.

## Problem

There's nowhere to capture the "why am I sitting down to study" insight a
student states at the start of a session. `/start` today
(`session:start` in `src/routes/index.tsx`) only logs a timestamp event and
inserts `[start HH:MM:SS]`. The session model (`sessionEvents`, durable
`Session` records — "children of the note," #10) tracks *time*, not
*intent*. A student's recurring intentions across a folder ("I keep
struggling with limits," "focus on proofs today") are never recorded and
never reflected back. Issue #18 wants introspections captured per **folder**
(a "child of the folder," paralleling sessions as children of the note),
surfaced when a session starts, and summarized by AI across the folder.

## Requirements

- R1. `/introspection` **captures a short insight** and stores it scoped to
  the **folder** the student is working in (a folder-scoped artifact — a
  "child of the folder," not a per-note block).
- R2. `/start` **surfaces** the folder's introspection context gracefully:
  if introspections exist it makes them available at session open; if none
  exist, `/start` behaves **exactly as today** — no error, no empty AI call,
  no changed output.
- R3. An **AI summary aggregates all introspections in the folder** into a
  short recurring-themes summary, routed through `queueAi`.
- R4. The AI summary respects the **personal-folder privacy gate**: a
  personal folder's introspections are **never sent** — the summary degrades
  to showing the raw list locally.
- R5. `/start` must remain **offline-safe**: surfacing/summarizing
  introspections must never block or break session start when the local
  server is down or AI is disabled.
- R6. Same local-only AI policy — the summary is a local model call, no
  cloud fallback.
- R7. Capturing an introspection **never requires AI** (it's just stored);
  only the summary (R3) is an AI call.

## Non-goals

- A cross-folder / workspace-wide introspection view or analytics — scope is
  one folder.
- Editing/threading introspections into a rich timeline UI — MVP is capture,
  surface at `/start`, and summarize.
- Making `/start` *depend* on introspections — it must work identically with
  zero of them (R2).
- Turning introspections into review cards or feeding them to `/end` — those
  are separate flows.

## Edge cases

- **No introspections yet** in the folder: `/start` unchanged (R2); an AI
  summary trigger with nothing to summarize gives a gentle "add one first"
  notice, not an empty model call.
- **Personal folder:** introspections captured normally (no AI), but the AI
  summary is skipped (R4) — raw list shown locally instead.
- **Folder deleted:** its introspections are cleaned up alongside the
  folder's files/canvases (no orphaned data, consistent with `deleteFolder`
  tombstoning).
- **Which folder** an introspection attaches to: the folder of the file the
  student is typing in, vs the sidebar's `activeFolderId` selection — must be
  pinned down (design; leaning the active file's folder).
- **Many introspections** in one folder: the summary prompt must be bounded
  (char budget / cap) so it doesn't grow unbounded against a small local
  model.
- **Server unreachable during summary:** the dedicated local-AI alert fires;
  the captured introspections are untouched and still viewable (R5).
- **Empty `/introspection`** (no text, none stored): prompt the student to
  write one; no store write, no AI call.
