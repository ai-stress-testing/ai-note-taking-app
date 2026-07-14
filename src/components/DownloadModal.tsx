import { useState } from "react";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function DownloadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { files, folders, panes, focusedPane, sessionEvents, sessionCounts, canvases } = useStore();
  const [format, setFormat] = useState<"json" | "md-bundle" | "current">("json");

  if (!open) return null;

  const activeFile = files[panes[focusedPane]];

  const LOCAL_AI_README =
    `# NeuroVim workspace export\n\n` +
    `⚠️  AI COMMANDS REQUIRE A LOCAL LLM SERVER.\n\n` +
    `This workspace ships without any cloud AI provider. All /help and /end\n` +
    `AI features require a locally running, OpenAI-compatible server —\n` +
    `Ollama, LM Studio, llama.cpp server, vLLM, etc:\n\n` +
    `  1. Install one, e.g. Ollama:  https://ollama.com/download\n` +
    `  2. Pull a model:  ollama pull llama3.2\n` +
    `  3. Run:  ollama serve  (default: http://localhost:11434/v1)\n\n` +
    `If the server is unreachable the editor will surface an error — it\n` +
    `will NOT fall back to any cloud provider.\n\n` +
    `Exported at: ${new Date().toISOString()}\n`;

  const handleDownload = () => {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    if (format === "json") {
      const payload = {
        exportedAt: new Date().toISOString(),
        aiPolicy: "local-only",
        readme: LOCAL_AI_README,
        folders,
        files: Object.values(files),
        canvases,
        sessionEvents,
        sessionCounts,
      };
      download(
        new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
        `neurovim-${ts}.json`,
      );
    } else if (format === "md-bundle") {
      const parts = folders.map((folder) => {
        const items = Object.values(files).filter((f) => f.folderId === folder.id);
        const body = items
          .map(
            (f) =>
              `\n\n<!-- ${f.name} · ${new Date(f.updatedAt).toISOString()} -->\n\n${f.content}`,
          )
          .join("\n\n---\n");
        return `# ${folder.name}\n${body || "\n_(empty)_\n"}`;
      });
      const md = `${LOCAL_AI_README}\n---\n\n${parts.join("\n\n===\n\n")}`;
      download(new Blob([md], { type: "text/markdown" }), `neurovim-${ts}.md`);
    } else if (format === "current" && activeFile) {
      const md = `<!--\n${LOCAL_AI_README}-->\n\n${activeFile.content}`;
      download(new Blob([md], { type: "text/markdown" }), activeFile.name);
    }
    toast.success("Download started · local-AI-only bundle");
    onClose();
  };

  const fileCount = Object.keys(files).length;

  return (
    <div className="ed-modal-overlay" onClick={onClose}>
      <div className="ed-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ed-modal-header">
          <span className="ed-modal-title">⇩ download workspace</span>
          <button className="ed-modal-x" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="ed-modal-body">
          <p className="ed-modal-lede">
            {fileCount} file{fileCount === 1 ? "" : "s"} across {folders.length} folder
            {folders.length === 1 ? "" : "s"}.
          </p>
          <div className="ed-modal-warn">
            ⚠ Local AI server required. This bundle ships without cloud AI — /help and /end need a
            local OpenAI-compatible server (e.g. <code>ollama serve</code>) to work.
          </div>

          <label className={`ed-modal-opt ${format === "json" ? "active" : ""}`}>
            <input
              type="radio"
              name="fmt"
              checked={format === "json"}
              onChange={() => setFormat("json")}
            />
            <div>
              <div className="ed-opt-title">Full workspace · JSON</div>
              <div className="ed-opt-desc">
                Everything: files, folders, session log. Re-importable snapshot.
              </div>
            </div>
          </label>

          <label className={`ed-modal-opt ${format === "md-bundle" ? "active" : ""}`}>
            <input
              type="radio"
              name="fmt"
              checked={format === "md-bundle"}
              onChange={() => setFormat("md-bundle")}
            />
            <div>
              <div className="ed-opt-title">All files · Markdown bundle</div>
              <div className="ed-opt-desc">
                Concatenated .md grouped by folder. Great for archiving.
              </div>
            </div>
          </label>

          <label className={`ed-modal-opt ${format === "current" ? "active" : ""}`}>
            <input
              type="radio"
              name="fmt"
              checked={format === "current"}
              onChange={() => setFormat("current")}
            />
            <div>
              <div className="ed-opt-title">Current file only · {activeFile?.name ?? "—"}</div>
              <div className="ed-opt-desc">The file open in the focused pane.</div>
            </div>
          </label>
        </div>
        <div className="ed-modal-footer">
          <button className="ed-btn ghost" onClick={onClose}>
            cancel
          </button>
          <button className="ed-btn primary" onClick={handleDownload}>
            download
          </button>
        </div>
      </div>
    </div>
  );
}
