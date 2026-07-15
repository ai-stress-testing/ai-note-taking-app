import { useStore, fmtClock } from "@/lib/store";

const STATUS_LABEL: Record<string, string> = {
  queued: "queued",
  sending: "sending…",
  ok: "ok",
  error: "error",
};

export function AiQueueModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { aiQueue } = useStore();
  if (!open) return null;

  return (
    <div className="ed-modal-overlay" onClick={onClose}>
      <div className="ed-modal ed-ai-queue" onClick={(e) => e.stopPropagation()}>
        <div className="ed-modal-header">
          <span className="ed-modal-title">◷ AI queue &amp; audit</span>
          <button className="ed-modal-x" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="ed-modal-body">
          <p className="ed-modal-lede">
            Requests are sent one at a time, in order — nothing goes out while another call is still
            waiting on a response. Every call made in this browser is listed below, newest first, so
            you can see exactly what was (or is about to be) sent to your local AI server.
          </p>
          {aiQueue.length === 0 && <div className="ed-ai-queue-empty">No AI calls yet.</div>}
          {aiQueue.map((e) => (
            <div key={e.id} className={`ed-ai-queue-item ${e.status}`}>
              <div className="ed-ai-queue-item-head">
                <span className="ed-ai-queue-cmd">{e.command}</span>
                <span className={`ed-ai-queue-status ${e.status}`}>{STATUS_LABEL[e.status]}</span>
                <span className="ed-ai-queue-time">{fmtClock(e.requestedAt)}</span>
              </div>
              <pre className="ed-ai-queue-prompt">{e.prompt}</pre>
              {e.status === "ok" && e.result && (
                <pre className="ed-ai-queue-result">{e.result}</pre>
              )}
              {e.status === "error" && e.error && (
                <pre className="ed-ai-queue-error">{e.error}</pre>
              )}
            </div>
          ))}
        </div>
        <div className="ed-modal-footer">
          <button className="ed-btn ghost" onClick={onClose}>
            close
          </button>
        </div>
      </div>
    </div>
  );
}
