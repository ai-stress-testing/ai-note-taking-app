# /fidget — ephemeral scratch area

## Problem

There is no place to "screw off on the keyboard" — type nonsense, warm up,
bang out a throwaway thought — without it becoming part of a note that gets
saved, synced, and cluttered later. Everything typed in the editor lives in
a file's `content`, which is persisted to localStorage and (optionally)
synced. Issue #16 wants a scratch surface whose entire point is that it is
**discarded on close** and never becomes durable data.

Who hits this: a user who wants a low-stakes keyboard space (fidgeting,
venting, a quick calc-pad of gibberish) without polluting their notes or
their sync history.

## Requirements

- R1. A slash command `/fidget` opens a scratch area to type freely in.
- R2. The scratch content is **never persisted** — not to the zustand
  store, not to `localStorage` (persist `partialize`), not to sync. It
  lives only in transient component memory for the life of the open
  surface.
- R3. Closing the fidget area **discards** its content immediately and
  leaves no trace in the note, the store, or storage.
- R4. It does not modify the active file's `content` (opening or closing
  must not insert leftover text into the buffer).
- R5. Consistent with the existing slash-command UX (invoked like other
  `/commands`, dismissible the way other overlays/widgets are).

## Non-goals

- Saving, exporting, or "promoting" fidget content into a real note (the
  entire feature is that it's throwaway; a save path would contradict it).
- Multiple named scratch buffers / history of past fidgets.
- Persisting fidget state across reloads (a reload is a close — content is
  gone, by design).
- Any AI involvement (fidget content is never sent anywhere).

## Edge cases

- Reload/'tab close while fidget is open: content is gone (it was never
  stored) — acceptable and intended.
- Opening `/fidget` while another widget (canvas, `/fsrs` tray) is open:
  define interaction (overlay above, or replaces) — must not corrupt the
  buffer.
- Rapidly opening/closing: no marker or residue accumulates in the file
  (contrast with `/fsrs`'s `REVIEW_MARKER`, which is cleaned up on mount —
  fidget should avoid writing any marker at all).
- Personal-file posture: irrelevant since nothing is sent or stored, but
  the feature must not accidentally route content through `ai-queue`.
