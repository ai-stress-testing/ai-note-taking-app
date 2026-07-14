import { useStore } from "@/lib/store";

export function OllamaAlert({
  open,
  message,
  onClose,
  onOpenSettings,
}: {
  open: boolean;
  message: string;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const { ollamaUrl, ollamaModel } = useStore();
  if (!open) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-app";
  const isHosted =
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";

  return (
    <div className="ed-modal-overlay" onClick={onClose}>
      <div className="ed-modal ed-alert" onClick={(e) => e.stopPropagation()}>
        <div className="ed-modal-header alert">
          <span className="ed-modal-title">⚠ ollama unreachable</span>
          <button className="ed-modal-x" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="ed-modal-body">
          <p className="ed-alert-msg">{message}</p>

          <div className="ed-alert-block">
            <div className="ed-alert-block-title">Current config</div>
            <div className="ed-kv">
              <span>URL</span>
              <code>{ollamaUrl}</code>
            </div>
            <div className="ed-kv">
              <span>Model</span>
              <code>{ollamaModel}</code>
            </div>
          </div>

          <div className="ed-alert-block">
            <div className="ed-alert-block-title">Fix it — local Ollama</div>
            <ol className="ed-steps">
              <li>
                Install:{" "}
                <a href="https://ollama.com/download" target="_blank" rel="noreferrer">
                  ollama.com/download
                </a>
              </li>
              <li>
                Pull the model: <code>ollama pull {ollamaModel}</code>
              </li>
              <li>
                Run: <code>ollama serve</code>
              </li>
              <li>
                Confirm: <code>curl {ollamaUrl}/api/tags</code>
              </li>
            </ol>
          </div>

          {isHosted && (
            <div className="ed-alert-block warn">
              <div className="ed-alert-block-title">You're on a hosted instance</div>
              <p>
                Your browser talks to Ollama directly. It won't reach <code>localhost</code> unless
                Ollama is running on <em>your machine</em> AND started with CORS allowed for this
                origin:
              </p>
              <pre className="ed-alert-code">OLLAMA_ORIGINS="{origin}" ollama serve</pre>
              <p>
                Or point Settings at a remote Ollama reachable from your browser (e.g. a tunnel like{" "}
                <code>https://your-tunnel.trycloudflare.com</code>).
              </p>
            </div>
          )}

          {!isHosted && (
            <div className="ed-alert-block">
              <div className="ed-alert-block-title">Downloaded the codebase?</div>
              <p>
                Point the app at your Ollama server in Settings. Default is{" "}
                <code>http://localhost:11434</code>. Any OpenAI-style Ollama-compatible URL works.
              </p>
            </div>
          )}
        </div>
        <div className="ed-modal-footer">
          <button className="ed-btn ghost" onClick={onClose}>
            dismiss
          </button>
          <button className="ed-btn primary" onClick={onOpenSettings}>
            open settings
          </button>
        </div>
      </div>
    </div>
  );
}
