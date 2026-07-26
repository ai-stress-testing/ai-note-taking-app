# Sidebar closed layout — requirements

## Problem

Issue #23. Closing the sidebar (`⌘B` or the header toggle) does not give the
editor the full window width. A residual column remains between the left
edge of the app and the editor/canvas area, containing a second "open
sidebar" button that duplicates the one already in the header.

**Observed:** with the sidebar closed, a narrow column (reported as ~64px)
still occupies the left edge of the window, containing its own reopen
button. The editor does not span the full width.

**Expected:** with the sidebar closed, the editor/canvas area spans 100% of
the window's left-to-right width — no residual column, no padding gap. A
single, unambiguous control remains to reopen the sidebar.

**Who hits it:** any user who collapses the sidebar. `sidebarOpen` defaults
to `true` and is persisted, so this is any returning user who has ever
closed it.

## Requirements

- When the sidebar is closed, no dead column/rail occupies space between the
  window's left edge and the editor.
- The editor/canvas pane visually spans the full width of the window when
  the sidebar is closed.
- Exactly one control exists to reopen the sidebar while it is closed (the
  existing header toggle) — no duplicate button.
- The `⌘B` keyboard shortcut continues to toggle the sidebar as today.

## Non-goals

- No redesign of the sidebar's open-state contents or layout.
- No change to the open ↔ closed keyboard shortcut or its behavior.
- No change to multi-pane editor layout logic.

## Edge cases

- Toggling the sidebar closed then immediately resizing the window.
- Rapidly toggling open/close (the existing 160ms grid-column transition
  must still animate cleanly at the new width values, not jump-cut).
- A fresh page load where `sidebarOpen: false` was already persisted from a
  previous session — the collapsed (full-width) layout must render
  correctly on first paint/hydration, not just after a manual toggle click.
- Multi-pane editors (2+ open panes) with the sidebar closed — the freed
  width should be available to the pane grid like any other layout change.
