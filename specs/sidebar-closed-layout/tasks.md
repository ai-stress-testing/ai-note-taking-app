# Sidebar closed layout — tasks

- [ ] Reproduce: close the sidebar, confirm a ~28-64px rail with a `›`
      button still renders left of the editor.
- [ ] Change `.ed-app.no-side` grid-template-columns from `28px 1fr` to
      `0 1fr` in `src/styles.css`.
- [ ] Change `Sidebar` (`src/components/Sidebar.tsx`) to return `null` when
      `!sidebarOpen` instead of the `collapsed` rail markup.
- [ ] Remove the now-unused `.ed-side.collapsed` / `.ed-side-toggle-mini`
      CSS rules.
- [ ] Confirm the header's `ed-header-toggle` is the sole remaining control
      to reopen the sidebar, with correct label/title in both states.
- [ ] Verify the open→close and close→open grid-template-columns
      transition still animates smoothly (`260px ↔ 0`).
- [ ] Verify a page load with `sidebarOpen: false` already persisted
      renders the full-width collapsed layout correctly on first paint (no
      flash of the old rail).
- [ ] Verify multi-pane layouts correctly use the freed width when the
      sidebar is closed.
- [ ] Add a `CHANGELOG.md` entry under `[Unreleased] → Fixed` (#23).
