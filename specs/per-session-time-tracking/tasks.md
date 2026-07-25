# Per-session work/break time — tasks

- [ ] Add `Session` type + `sessions: Session[]` to the store; persist in
      `partialize`.
- [ ] Change `/end` finalize (`runEndSession` + `resetSession`): compute
      stats from live `sessionEvents`, append a `Session` record (id,
      fileId, start/end, workMs/breakMs, questions/vocab), THEN clear the
      live log. Prior records untouched.
- [ ] Finalize a dangling session on the next `/start` (and/or on load) so
      no work is dropped.
- [ ] Keep the live bottom bar on `computeSessionStats(sessionEvents, now)`
      — verify it now shows only the current session.
- [ ] Repoint `src/routes/analytics.tsx` to aggregate `sessions`: all-time
      totals, 14-day chart (bucket by day), and a per-note attribution
      view. Remove the reliance on the wiped `sessionEvents` for history.
- [ ] Sync: add a `sessions` table to `sync-schema.ts` + `db.ts`
      (plaintext durations/timestamps + fileId), buildPush/pull + merge;
      bump store `version`/`migrate`; record in `CHANGELOG.md`.
- [ ] Browser check: run two `/start…/end` cycles → both appear in
      analytics (no wipe); live bar resets each `/start`.
- [ ] `bun run lint` + build clean.
