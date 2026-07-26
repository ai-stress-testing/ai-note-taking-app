# Card/vocab template caret placement — tasks

- [ ] In `src/routes/index.tsx`, build the `tpl:card` template from named
      pieces (`header`, front-label prefix) so lengths are measurable.
- [ ] Compute `caretOffset = header.length + frontLabel.length + args.length`
      and pass it to `insertBlockAtRange` for `tpl:card`.
- [ ] If landing before #19: apply the same offset to `tpl:vocab` (after the
      `term:` value). If after #19: `/vocab` already shares the `── Card ──`
      template, so no separate work.
- [ ] Manual: `/card` alone → caret sits right after `front:` label on the
      front line.
- [ ] Manual: `/card mitochondria` → caret sits after `mitochondria` on the
      front line.
- [ ] Manual: type `/card` mid-line after prose → caret still lands on the
      front line (leading-newline case).
- [ ] `bun run lint` clean.
