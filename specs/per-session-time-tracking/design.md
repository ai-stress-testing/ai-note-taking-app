# Per-session work/break time — design

## Context

`sessionEvents: SessionEvent[]` is a flat live log of `start/break/resume/
end` timestamps; `computeSessionStats(events, now)` folds it into
`workMs/breakMs/avgWorkMs`; `/end` writes an in-note stats block then calls
`resetSession()` which clears the log. Analytics re-folds the _same live
log_ for all-time + 14-day data — so the reset is a data-loss bug. The fix
is to **finalize sessions into durable records** and point analytics at
those, while the live log keeps driving only the current session's bar.

## Approach

**1. New durable entity `Session`.**

```
type Session = {
  id: string;
  fileId: string | null;   // the note it belongs to (R3)
  startedAt: number;
  endedAt: number;
  workMs: number;
  breakMs: number;
  questions: number;       // from sessionCounts at /end
  vocab: number;
};
// store:
sessions: Session[];       // durable, persisted + synced
sessionEvents: SessionEvent[]; // stays: the LIVE current-session log
```

**2. Finalize on `/end`.** In the `/end` flow (`runEndSession` +
`resetSession`): compute stats from the current `sessionEvents` via
`computeSessionStats`, build a `Session` record (id, active `fileId` at
end, start = first event's `at`, end = the end event `at`, work/break, and
the current `sessionCounts`), **append it to `sessions`**, THEN clear the
live log (`sessionEvents`/`sessionCounts`). Prior records are untouched
(R2). The in-note stats block + AI summary are unchanged (R6).

**3. Live bar reads the live log only (R4).** The bottom bar keeps using
`computeSessionStats(sessionEvents, Date.now())` — it now naturally shows
just the current session because finalized sessions have moved out of
`sessionEvents`.

**4. Analytics reads `sessions` (R5).** Replace the analytics folding of
`sessionEvents` with aggregation over `sessions`: all-time worked/break =
sum over records; 14-day chart = bucket records by `endedAt` (or by day
spanned); add a per-note attribution view (group by `fileId` → file name).
This makes analytics durable and per-session.

**5. Dangling session (edge).** A `/start` with no `/end` before a new
`/start`: finalize the previous partial session on the new `/start` (or on
app load if events show an open session), so no work is silently dropped.
Attribution uses the active file at `/start` (simpler, stable) — documented
choice; `/end`-time file is the alternative.

## Data model changes

- Add `sessions: Session[]` to the store (+ append on `/end`, + finalize-
  dangling logic). Persist in `partialize`. Add to sync: extend
  `sync-schema.ts` + `db.ts` with a `sessions` table (plaintext durations/
  timestamps like the existing `session_events`, `fileId` reference) OR,
  simpler for MVP, keep sessions client-only and continue syncing raw
  `sessionEvents` — **design leans durable+synced** since analytics is the
  point. Record the `version`/schema bump in the changelog.
- `resetSession` semantics change: it now finalizes-then-clears rather than
  just clearing.

## Alternatives considered

- **Stop resetting `sessionEvents`; keep everything in one growing log.**
  Rejected: the log would grow unbounded and still lacks per-session
  identity, file attribution, and a clean "current session" boundary for
  the live bar. Discrete records are the right shape.
- **Derive sessions on the fly from a never-reset event log.** Rejected:
  possible, but re-deriving session boundaries on every analytics render is
  more fragile than recording a session once at `/end` when the boundary is
  known exactly.
- **Client-only sessions (don't sync).** Considered for MVP simplicity;
  rejected as the default because analytics-across-devices is a natural
  expectation and `sessionEvents` already sync — but flagged as the
  fallback if the schema change is deferred.

## Open questions

- File attribution: active file at `/start` vs at `/end` (leaning
  `/start`).
- Sync now vs later: add a `sessions` table immediately, or ship
  client-only first and sync in a follow-up. Leaning sync-now to avoid a
  second migration.
- 14-day bucketing when a session spans midnight — attribute to start day
  (matches the current chart's per-day intent).
