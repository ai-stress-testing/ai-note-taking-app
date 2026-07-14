import { useState } from "react";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

const PRESETS = [
  { label: "Ollama", url: "http://localhost:11434/v1", model: "llama3.2" },
  { label: "LM Studio", url: "http://localhost:1234/v1", model: "" },
  { label: "llama.cpp", url: "http://localhost:8080/v1", model: "" },
] as const;

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { localAiEnabled, localAiUrl, localAiModel, setLocalAi } = useStore();
  const [url, setUrl] = useState(localAiUrl);
  const [model, setModel] = useState(localAiModel);
  const [enabled, setEnabled] = useState(localAiEnabled);
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
      const res = await fetch(`${url.replace(/\/$/, "")}/models`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { data?: { id: string }[] };
      const ids = (data.data ?? []).map((m) => m.id);
      const hasModel = ids.some((id) => id === model || id.startsWith(model + ":"));
      setTestResult({
        ok: true,
        msg: hasModel
          ? `Connected · ${ids.length} model${ids.length === 1 ? "" : "s"} · "${model}" found`
          : `Connected but "${model}" wasn't in the model list — check the name.`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTestResult({ ok: false, msg: `Could not reach ${url} — ${msg}` });
    } finally {
      setTesting(false);
    }
  };

  const save = () => {
    setLocalAi({ localAiEnabled: enabled, localAiUrl: url.trim(), localAiModel: model.trim() });
    toast.success("Settings saved");
    onClose();
  };

  return (
    <div className="ed-modal-overlay" onClick={onClose}>
      <div className="ed-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ed-modal-header">
          <span className="ed-modal-title">⚙ settings · local AI</span>
          <button className="ed-modal-x" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="ed-modal-body">
          {isHosted && (
            <div className="ed-modal-info">
              You're on a hosted instance. Your browser will connect directly to the URL below, so
              it must be reachable from this page. For a local server, start it with CORS allowed
              for this origin (e.g. for Ollama):
              <br />
              <code>
                OLLAMA_ORIGINS="
                {typeof window !== "undefined" ? window.location.origin : "https://your-app"}"
                ollama serve
              </code>
            </div>
          )}

          <div className="ed-field-actions">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="ed-btn ghost"
                onClick={() => {
                  setUrl(p.url);
                  if (p.model) setModel(p.model);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <label className="ed-field">
            <span className="ed-field-label">Local server base URL</span>
            <input
              className="ed-field-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:11434/v1"
              spellCheck={false}
            />
            <span className="ed-field-hint">
              Any OpenAI-compatible local server: Ollama, LM Studio, llama.cpp, vLLM, and most
              others all expose <code>/chat/completions</code> and <code>/models</code> under this
              base URL.
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
              Whatever model name your server reports — for Ollama, one you've pulled with{" "}
              <code>ollama pull {model || "llama3.2"}</code>.
            </span>
          </label>

          <label className="ed-field-inline">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>AI enabled (local only — no cloud fallback ships with this app)</span>
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
