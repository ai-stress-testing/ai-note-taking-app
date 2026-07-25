import { useRef, useState } from "react";
import { useStore, type AiModelConfig } from "@/lib/store";
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

type TestResult = { ok: boolean; msg: string };

function newModelId() {
  return `aim-${Math.random().toString(36).slice(2, 10)}`;
}

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

type SettingsView = "ai" | "sync";

function SettingsForm({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<SettingsView>("ai");
  return (
    <div className="ed-modal-overlay" onClick={onClose}>
      <div className="ed-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ed-modal-header">
          <span className="ed-modal-title">⚙ settings</span>
          <button className="ed-modal-x" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="ed-field-actions" style={{ padding: "10px 14px 0" }}>
          <button
            type="button"
            className={`ed-btn ${view === "ai" ? "primary" : "ghost"}`}
            onClick={() => setView("ai")}
          >
            AI models
          </button>
          <button
            type="button"
            className={`ed-btn ${view === "sync" ? "primary" : "ghost"}`}
            onClick={() => setView("sync")}
          >
            Sync &amp; key
          </button>
        </div>
        {view === "ai" ? <AiModelsView onClose={onClose} /> : <SyncView onClose={onClose} />}
      </div>
    </div>
  );
}

type Draft = { id: string | null; label: string; url: string; model: string; verifyModel: string };

function AiModelsView({ onClose }: { onClose: () => void }) {
  const {
    aiModels,
    activeAiModelId,
    localAiEnabled,
    setLocalAi,
    addAiModel,
    updateAiModel,
    deleteAiModel,
    setActiveAiModel,
  } = useStore();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const isHosted =
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";

  const startAdd = () => {
    setDraft({ id: null, label: "", url: "", model: "", verifyModel: "" });
    setTestResult(null);
  };
  const startEdit = (cfg: AiModelConfig) => {
    setDraft({
      id: cfg.id,
      label: cfg.label,
      url: cfg.url,
      model: cfg.model,
      verifyModel: cfg.verifyModel ?? "",
    });
    setTestResult(null);
  };
  const cancelDraft = () => {
    setDraft(null);
    setTestResult(null);
  };

  const quickAdd = (p: (typeof PRESETS)[number]) => {
    const id = newModelId();
    addAiModel({ id, label: p.label, url: p.url, model: p.model });
    if (aiModels.length === 0) setActiveAiModel(id);
    toast.success(`${p.label} added`);
  };

  const saveDraft = () => {
    if (!draft) return;
    const url = draft.url.trim();
    const model = draft.model.trim();
    const label = draft.label.trim() || model || url || "AI model";
    const verifyModel = draft.verifyModel.trim() || undefined;
    if (draft.id) {
      updateAiModel(draft.id, { label, url, model, verifyModel });
    } else {
      const id = newModelId();
      addAiModel({ id, label, url, model, verifyModel });
      if (aiModels.length === 0) setActiveAiModel(id);
    }
    setDraft(null);
    setTestResult(null);
    toast.success("Model saved");
  };

  const remove = (cfg: AiModelConfig) => {
    if (!confirm(`Delete "${cfg.label}"?`)) return;
    deleteAiModel(cfg.id);
    if (draft?.id === cfg.id) setDraft(null);
    toast.success("Model removed");
  };

  const test = async () => {
    if (!draft) return;
    setTesting(true);
    setTestResult(null);
    try {
      const { base, models } = await probeLocalAi(draft.url);
      const hasModel = models.some((id) => id === draft.model || id.startsWith(draft.model + ":"));
      setTestResult({
        ok: true,
        msg: hasModel
          ? `Connected at ${base} · ${models.length} model${models.length === 1 ? "" : "s"} · "${draft.model}" found`
          : `Connected at ${base} but "${draft.model}" wasn't in the model list — check the name.`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTestResult({ ok: false, msg: `Could not reach ${draft.url} — ${msg}` });
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <div className="ed-modal-body">
        {isHosted && (
          <div className="ed-modal-info">
            You're on a hosted instance. Your browser will connect directly to each URL below, so it
            must be reachable from this page. For a local server, start it with CORS allowed for
            this origin (e.g. for Ollama):
            <br />
            <code>
              OLLAMA_ORIGINS="
              {typeof window !== "undefined" ? window.location.origin : "https://your-app"}" ollama
              serve
            </code>
          </div>
        )}

        <label className="ed-field-inline">
          <input
            type="checkbox"
            checked={localAiEnabled}
            onChange={(e) => setLocalAi({ localAiEnabled: e.target.checked })}
          />
          <span>AI enabled (local only — no cloud fallback ships with this app)</span>
        </label>

        {aiModels.length === 0 && (
          <p className="ed-modal-lede">No AI models configured yet — add one below.</p>
        )}

        {aiModels.map((cfg) => (
          <div
            key={cfg.id}
            className={`ed-modal-opt ${cfg.id === activeAiModelId ? "active" : ""}`}
          >
            <label style={{ display: "flex", gap: 10, flex: 1, cursor: "pointer" }}>
              <input
                type="radio"
                name="active-ai-model"
                checked={cfg.id === activeAiModelId}
                onChange={() => setActiveAiModel(cfg.id)}
              />
              <div>
                <div className="ed-opt-title">{cfg.label}</div>
                <div className="ed-opt-desc">
                  {cfg.url} · {cfg.model || "(no model set)"}
                  {cfg.verifyModel ? ` · verify: ${cfg.verifyModel}` : ""}
                </div>
              </div>
            </label>
            <div className="ed-field-actions">
              <button type="button" className="ed-btn ghost" onClick={() => startEdit(cfg)}>
                edit
              </button>
              <button type="button" className="ed-btn ghost" onClick={() => remove(cfg)}>
                delete
              </button>
            </div>
          </div>
        ))}

        <div className="ed-field-actions">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="ed-btn ghost"
              onClick={() => quickAdd(p)}
            >
              + {p.label}
            </button>
          ))}
          {!draft && (
            <button type="button" className="ed-btn ghost" onClick={startAdd}>
              + custom
            </button>
          )}
        </div>

        {draft && (
          <>
            <label className="ed-field">
              <span className="ed-field-label">Label</span>
              <input
                className="ed-field-input"
                value={draft.label}
                onChange={(e) => setDraft((d) => d && { ...d, label: e.target.value })}
                placeholder="e.g. Ollama · llama3.2"
                spellCheck={false}
              />
            </label>

            <label className="ed-field">
              <span className="ed-field-label">Local server base URL</span>
              <input
                className="ed-field-input"
                value={draft.url}
                onChange={(e) => setDraft((d) => d && { ...d, url: e.target.value })}
                placeholder="http://localhost:11434"
                spellCheck={false}
              />
              <span className="ed-field-hint">
                Any OpenAI-compatible local server: Ollama, LM Studio, llama.cpp, vLLM, and most
                others all expose <code>/chat/completions</code> and <code>/models</code> under this
                base URL. With or without <code>/v1</code> both work (e.g.{" "}
                <code>http://localhost:11434</code> or <code>http://localhost:11434/v1</code>) —
                it's probed automatically.
              </span>
            </label>

            <label className="ed-field">
              <span className="ed-field-label">Model</span>
              <input
                className="ed-field-input"
                value={draft.model}
                onChange={(e) => setDraft((d) => d && { ...d, model: e.target.value })}
                placeholder="llama3.2"
                spellCheck={false}
              />
              <span className="ed-field-hint">
                Whatever model name your server reports — for Ollama, one you've pulled with{" "}
                <code>ollama pull {draft.model || "llama3.2"}</code>.
              </span>
            </label>

            <label className="ed-field">
              <span className="ed-field-label">Verification model (optional)</span>
              <input
                className="ed-field-input"
                value={draft.verifyModel}
                onChange={(e) => setDraft((d) => d && { ...d, verifyModel: e.target.value })}
                placeholder="empty = use this model"
                spellCheck={false}
              />
              <span className="ed-field-hint">
                A smaller/faster model for math correction, calc extraction, and question grading —
                e.g. <code>llama3.2:1b</code>. Same server as above.
              </span>
            </label>

            <div className="ed-field-actions">
              <button type="button" className="ed-btn ghost" onClick={test} disabled={testing}>
                {testing ? "testing…" : "test connection"}
              </button>
              {testResult && (
                <span className={`ed-test-result ${testResult.ok ? "ok" : "err"}`}>
                  {testResult.msg}
                </span>
              )}
            </div>

            <div className="ed-field-actions">
              <button type="button" className="ed-btn ghost" onClick={cancelDraft}>
                cancel
              </button>
              <button type="button" className="ed-btn primary" onClick={saveDraft}>
                {draft.id ? "save changes" : "add model"}
              </button>
            </div>
          </>
        )}
      </div>
      <div className="ed-modal-footer">
        <button className="ed-btn ghost" onClick={onClose}>
          close
        </button>
      </div>
    </>
  );
}

function SyncView({ onClose }: { onClose: () => void }) {
  const { syncEnabled, backendToken, encKeyLoaded, setSyncConfig, setSyncRuntime } = useStore();
  const [token, setToken] = useState(backendToken);
  const [wantSync, setWantSync] = useState(syncEnabled);
  const [syncTestResult, setSyncTestResult] = useState<TestResult | null>(null);
  const keyFileRef = useRef<HTMLInputElement | null>(null);

  const save = () => {
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
    <>
      <div className="ed-modal-body">
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
            ciphertext. The key lives in the downloaded file and in this tab's memory — it is never
            saved by the app or the server.{" "}
            <strong>Losing the file means the synced copy is unrecoverable.</strong> Re-load it each
            session (or on another device) to sync.
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
    </>
  );
}
