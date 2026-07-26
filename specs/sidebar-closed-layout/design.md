# Sidebar closed layout — design

## Root cause

Two things compound to produce the residual column, both easy to point to:

1. **`src/styles.css` L70-79** — the app shell is a 2-column CSS grid:

   ```css
   .ed-app {
     grid-template-columns: 260px 1fr;
     transition: grid-template-columns 160ms ease;
   }
   .ed-app.no-side {
     grid-template-columns: 28px 1fr;
   }
   ```

   Closing the sidebar (`no-side` class, driven by `sidebarOpen` at
   `routes/index.tsx` L882) shrinks the first column from `260px` to
   `28px` — it does **not** collapse it to `0`. A real, reserved column
   survives the "close."

2. **`src/components/Sidebar.tsx` L34-42** — when `!sidebarOpen`, the
   component doesn't render nothing; it renders a collapsed rail:

   ```tsx
   if (!sidebarOpen) {
     return (
       <div className="ed-side collapsed">
         <button className="ed-side-toggle-mini" onClick={toggleSidebar} title="Show sidebar">
           ›
         </button>
       </div>
     );
   }
   ```

   This fills that reserved 28px column with a visible rail and its own
   reopen button (`ed-side-toggle-mini`).

That second point is what makes this a _duplicate_ control, not just a
narrow gap: `routes/index.tsx` L886-893 already renders a header toggle
that is present regardless of `sidebarOpen` and already flips label
(`‹`/`›`) and title text for both states:

```tsx
<button
  className="ed-header-toggle"
  onClick={toggleSidebar}
  title={sidebarOpen ? "Hide sidebar (⌘B)" : "Show sidebar (⌘B)"}
>
  {sidebarOpen ? "‹" : "›"}
</button>
```

That button lives inside `.ed-header`, which is part of `.ed-main` (the
grid's `1fr` column) — so it's already visible and functional when the
sidebar is closed, with no need for `Sidebar` to render its own copy. The
28px column (plus the mini button's own padding/hit-target box, which is
likely where the reported "~64px" estimate comes from) is the visible gap
described in the ticket.

## Approach

- Change `.ed-app.no-side` to collapse the first column to `0`:
  ```css
  .ed-app.no-side {
    grid-template-columns: 0 1fr;
  }
  ```
- Change `Sidebar` to render `null` when `!sidebarOpen` instead of the
  `collapsed` rail markup, removing the duplicate `ed-side-toggle-mini`
  button. The header's `ed-header-toggle` becomes the sole reopen control
  in both states.
- Remove the now-dead `.ed-side.collapsed` / `.ed-side-toggle-mini` CSS
  rules (styles.css L104-121) once nothing renders them, per the repo's
  general lint/dead-code hygiene — small cleanup, not required for the fix
  to work but avoids leaving orphaned styles.
- Re-check the existing `160ms` grid-template-columns transition
  (styles.css L75) still reads as a smooth collapse at `260px ↔ 0` (a
  bigger jump than the previous `260px ↔ 28px`) — expected to still look
  fine given it's the same transition already in place, but worth a visual
  pass.

## Alternatives considered

- **Keep the 28px sliver as an intentional "always show a hint of the
  sidebar" affordance**, and only dedupe the button. Rejected — the ticket
  explicitly asks for the editor at 100% width when closed, not a
  permanent sliver.
- **Keep both toggle buttons but restyle to look less duplicated.**
  Rejected — the ticket asks for a single, non-duplicate way to reopen, not
  a visual tweak to two controls doing the same thing.
- **Add a new floating/hover-reveal reopen affordance** positioned over the
  now-full-width editor instead of relying on the header toggle. Rejected
  as unneeded complexity — the header toggle already exists, is already
  state-aware (`‹`/`›`, title text), and remains reachable in the closed
  layout without any change.

## Open questions

- Should the closed state keep any sliver/hover-reveal hint that a sidebar
  exists (some editors show a 4-8px edge strip), or should it be a hard
  `0px` exactly as the ticket asks ("100% left-to-right")? The ticket
  wording favors hard `0px` — proceeding on that basis unless
  design/ux-architect pushes back.
- Whether the collapse transition's duration/easing should change now that
  the delta is larger (`260→0` vs the old `260→28`) — flagged as a visual
  QA check, not expected to need a code change.
