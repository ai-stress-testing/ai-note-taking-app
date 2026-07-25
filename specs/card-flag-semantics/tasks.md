# Card flag semantics — tasks

- [ ] Update flag button `title` copy in `src/components/FlashcardTray.tsx`
      to source-maintenance wording (set + unset states).
- [ ] Update the "flagged" tile label/tooltip in `src/routes/analytics.tsx`
      to reflect maintenance semantics (not "come back to review").
- [ ] Update `specs/question-grading-and-flagging/requirements.md` R3 note
      to cross-reference this spec's flag meaning instead of "come back to
      this one".
- [ ] Confirm the management view (`specs/fsrs-card-management/`) exposes a
      "flagged" filter over `cards` and reuses `toggleCardFlag` for
      clear/set — no new store action added here.
- [ ] Verify flagging still has zero effect on FSRS scheduling.
- [ ] `bun run lint` and `bun run format`.
