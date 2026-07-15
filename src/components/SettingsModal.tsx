import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { probeLocalAi } from "@/lib/ai-client";
import { toast } from "sonner";
import {
  generateAndDownloadKey,
  keyIsLoaded,
  loadKeyFromFile,
  pullNow,
  testConnection,
} from "@/lib/sync";

const PRESETS = [
  { label: "Ollama", url: "http://localhost:11434/v1", model: "llama3.2" },
  { label: "LM Studio", url: "http://localhost:1234/v1", model: "" },
  { label: "llama.cpp", url: "http://localhost:8080/v1", model: "" },
] as const;

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  // The form must mount fresh on every open: its useState initializers
  // snapshot the store, and a snapshot taken while closed goes stale — the
  // app's very first render even predates persist rehydration (React serves
  // useSyncExternalStore's getInitialState during hydration), so a
  // component-lifetime snapshot is the built-in defaults, and saving it
  // would silently revert the user's real AI/sync settings.
  if (!open) return null;
  return <SettingsForm onClose={onClose} />;
}

function SettingsForm({ onClose }: { onClose: () => void }) {
  const {
    localAiEnabled,
    localAiUrl,
    localAiModel,
    verifyAiModel,
    setLocalAi,
    syncEnabled,
    backendToken,
    encKeyLoaded,
    setSyncConfig,
    setSyncRuntime,
  } = useStore();
  const [url, setUrl] = useState(localAiUrl);
  const [model, setModel] = useState(localAiModel);
  const [verifyModel, setVerifyModel] = useState(verifyAiModel);
  const [enabled, setEnabled] = useState(localAiEnabled);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | { ok: boolean; msg: string }>(null);
  const [token, setToken] = useState(backendToken);
  const [wantSync, setWantSync] = useState(syncEnabled);
  const [syncTestResult, setSyncTestResult] = useState<null | { ok: boolean; msg: string }>(null);
  const keyFileRef = useRef<HTMLInputElement | null>(null);

  const isHosted =
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { base, models } = await probeLocalAi(url);
      const hasModel = models.some((id) => id === model || id.startsWith(model + ":"));
      setTestResult({
        ok: true,
        msg: hasModel
          ? `Connected at ${base} · ${models.length} model${models.length === 1 ? "" : "s"} · "${model}" found`
          : `Connected at ${base} but "${model}" wasn't in the model list — check the name.`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTestResult({ ok: false, msg: `Could not reach ${url} — ${msg}` });
    } finally {
      setTesting(false);
    }
  };

  const save = () => {
    setLocalAi({
      localAiEnabled: enabled,
      localAiUrl: url.trim(),
      localAiModel: model.trim(),
      verifyAiModel: verifyModel.trim(),
    });
    setSyncConfig({ syncEnabled: wantSync, backendToken: token.trim() });
    setSyncRuntime({
      syncStatus: wantSync ? (keyIsLoaded() ? "idle" : "no-key") : "off",
      encKeyLoaded: keyIsLoaded(),
    });
    if (wantSync && keyIsLoaded() && token.trim()) void pullNow();
    toast.success("Settings saved");
    onClose();
  };

  const onKeyFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      await loadKeyFromFile(file);
      toast.success("Encryption key loaded (this session only)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read key file");
    }
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
              placeholder="http://localhost:11434"
              spellCheck={false}
            />
            <span className="ed-field-hint">
              Any OpenAI-compatible local server: Ollama, LM Studio, llama.cpp, vLLM, and most
              others all expose <code>/chat/completions</code> and <code>/models</code> under this
              base URL. With or without <code>/v1</code> both work (e.g.{" "}
              <code>http://localhost:11434</code> or <code>http://localhost:11434/v1</code>) — it's
              probed automatically.
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

          <label className="ed-field">
            <span className="ed-field-label">Verification model (optional)</span>
            <input
              className="ed-field-input"
              value={verifyModel}
              onChange={(e) => setVerifyModel(e.target.value)}
              placeholder="empty = use the main model"
              spellCheck={false}
            />
            <span className="ed-field-hint">
              A smaller/faster model for math correction, calc extraction, and question grading —
              e.g. <code>llama3.2:1b</code>. Same server as above.
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

          <div className="ed-settings-divider">sync &amp; encrypted backup</div>

          <label className="ed-field-inline">
            <input
              type="checkbox"
              checked={wantSync}
              onChange={(e) => setWantSync(e.target.checked)}
            />
            <span>Sync this workspace to the server it's served from</span>
          </label>

          <label className="ed-field">
            <span className="ed-field-label">Sync token</span>
            <input
              className="ed-field-input"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="printed by the server on first boot"
              spellCheck={false}
            />
            <span className="ed-field-hint">
              Shown once in the server terminal on first start. Lost it? Run{" "}
              <code>bun run token:reset</code>.
            </span>
          </label>

          <div className="ed-field">
            <span className="ed-field-label">
              Encryption key {encKeyLoaded ? "· loaded ✓" : "· not loaded"}
            </span>
            <div className="ed-field-actions">
              <button
                className="ed-btn ghost"
                onClick={() => {
                  void generateAndDownloadKey().then(() =>
                    toast.success("Key generated and downloaded — keep that file safe"),
                  );
                }}
              >
                generate &amp; download key
              </button>
              <button className="ed-btn ghost" onClick={() => keyFileRef.current?.click()}>
                load key file
              </button>
              <input
                ref={keyFileRef}
                type="file"
                style={{ display: "none" }}
                onChange={(e) => void onKeyFile(e.target.files?.[0])}
              />
            </div>
            <span className="ed-field-hint">
              Notes are encrypted in your browser before upload; the server only ever stores
              ciphertext. The key lives in the downloaded file and in this tab's memory — it is
              never saved by the app or the server.{" "}
              <strong>Losing the file means the synced copy is unrecoverable.</strong> Re-load it
              each session (or on another device) to sync.
            </span>
          </div>

          <div className="ed-field-actions">
            <button
              className="ed-btn ghost"
              onClick={() => {
                setSyncTestResult(null);
                void testConnection(token.trim()).then(setSyncTestResult);
              }}
            >
              test sync
            </button>
            {syncTestResult && (
              <span className={`ed-test-result ${syncTestResult.ok ? "ok" : "err"}`}>
                {syncTestResult.msg}
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
