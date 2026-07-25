import { useEffect, useState } from "react";

/**
 * Ephemeral scratch pad behind `/fidget`. Content is component-local
 * `useState` only — never read from or written to the store, localStorage,
 * or sync. Closing (✕ or Esc) unmounts this component, which discards the
 * text with zero cleanup logic; there is nothing to clean up on purpose.
 */
export function FidgetPad({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ed-modal-overlay" onClick={onClose}>
      <div className="ed-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ed-modal-header">
          <span className="ed-modal-title">✎ fidget — scratch pad, never saved</span>
          <button className="ed-modal-x" onClick={onClose} aria-label="Close fidget pad">
            ×
          </button>
        </div>
        <div className="ed-modal-body">
          <textarea
            className="ed-textarea"
            style={{ minHeight: "50vh", padding: "0.75rem" }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type anything. Closing this pad discards it — never saved, synced, or sent anywhere."
            autoFocus
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
