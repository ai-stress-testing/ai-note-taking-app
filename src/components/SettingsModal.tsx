import { useState } from "react";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ollamaEnabled, ollamaUrl, ollamaModel, setOllama } = useStore();
  const [url, setUrl] = useState(ollamaUrl);
  const [model, setModel] = useState(ollamaModel);
  const [enabled, setEnabled] = useState(ollamaEnabled);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | { ok: boolean; msg: string }>(null);

  if (!open) return null;

  const isHosted =
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(`${url.replace(/\/$/, "")}/api/tags`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { models?: { name: string }[] };
      const names = (data.models ?? []).map((m) => m.name);
      const hasModel = names.some((n) => n === model || n.startsWith(model + ":"));
      setTestResult({
        ok: true,
        msg: hasModel
          ? `Connected · ${names.length} model${names.length === 1 ? "" : "s"} · "${model}" found`
          : `Connected but "${model}" not pulled. Run: ollama pull ${model}`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTestResult({ ok: false, msg: `Could not reach ${url} — ${msg}` });
    } finally {
      setTesting(false);
    }
  };

  const save = () => {
    setOllama({ ollamaEnabled: enabled, ollamaUrl: url.trim(), ollamaModel: model.trim() });
    toast.success("Settings saved");
    onClose();
  };

  return (
    <div className="ed-modal-overlay" onClick={onClose}>
      <div className="ed-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ed-modal-header">
          <span className="ed-modal-title">⚙ settings · ollama</span>
          <button className="ed-modal-x" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="ed-modal-body">
          {isHosted && (
            <div className="ed-modal-info">
              You're on a hosted instance. Your browser will connect directly to the URL below, so
              it must be reachable from this page. For a local Ollama, start it with CORS allowed
              for this origin:
              <br />
              <code>
                OLLAMA_ORIGINS="
                {typeof window !== "undefined" ? window.location.origin : "https://your-app"}"
                ollama serve
              </code>
            </div>
          )}

          <label className="ed-field">
            <span className="ed-field-label">Ollama base URL</span>
            <input
              className="ed-field-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:11434"
              spellCheck={false}
            />
            <span className="ed-field-hint">
              Default: <code>http://localhost:11434</code>. For a remote box use{" "}
              <code>http://your-host:11434</code> or a tunnel URL.
            </span>
          </label>

          <label className="ed-field">
            <span className="ed-field-label">Model</span>
            <input
              className="ed-field-input"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="llama3.2"
              spellCheck={false}
            />
            <span className="ed-field-hint">
              Any model you have pulled. Pull one with <code>ollama pull llama3.2</code>.
            </span>
          </label>

          <label className="ed-field-inline">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>AI enabled (Ollama-only — no cloud fallback ships with this app)</span>
          </label>

          <div className="ed-field-actions">
            <button className="ed-btn ghost" onClick={test} disabled={testing}>
              {testing ? "testing…" : "test connection"}
            </button>
            {testResult && (
              <span className={`ed-test-result ${testResult.ok ? "ok" : "err"}`}>
                {testResult.msg}
              </span>
            )}
          </div>
        </div>
        <div className="ed-modal-footer">
          <button className="ed-btn ghost" onClick={onClose}>
            cancel
          </button>
          <button className="ed-btn primary" onClick={save}>
            save
          </button>
        </div>
      </div>
    </div>
  );
}
