import { useMemo } from "react";
import { useStore, fmtClock } from "@/lib/store";
import { toast } from "sonner";

export function Sidebar({ onOpenDownload }: { onOpenDownload: () => void }) {
  const {
    folders, files, activeFolderId,
    setActiveFolder, createFile, deleteFile, renameFile,
    openFileInPane, focusedPane, panes,
    sidebarOpen, toggleSidebar,
  } = useStore();

  const fileList = useMemo(
    () =>
      Object.values(files)
        .filter((f) => f.folderId === activeFolderId)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [files, activeFolderId],
  );

  if (!sidebarOpen) {
    return (
      <div className="ed-side collapsed">
        <button className="ed-side-toggle-mini" onClick={toggleSidebar} title="Show sidebar">›</button>
      </div>
    );
  }

  return (
    <aside className="ed-side">
      <div className="ed-side-brand">
        <span className="ed-side-logo">◆</span>
        <span className="ed-side-title">neurovim</span>
        <button className="ed-side-download" onClick={onOpenDownload} title="Download workspace">
          ⇩
        </button>
      </div>

      <div className="ed-side-section">
        <div className="ed-side-section-label">
          <span>folders</span>
        </div>
        <ul className="ed-side-folders">
          {folders.map((f) => {
            const count = Object.values(files).filter((x) => x.folderId === f.id).length;
            const active = f.id === activeFolderId;
            return (
              <li
                key={f.id}
                className={`ed-side-folder ${active ? "active" : ""}`}
                onClick={() => setActiveFolder(f.id)}
              >
                <span className={`ed-folder-dot ac-${f.accent}`} />
                <span className="ed-folder-name">{f.name}</span>
                <span className="ed-folder-count">{count}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="ed-side-section grow">
        <div className="ed-side-section-label">
          <span>files</span>
          <button
            className="ed-side-plus"
            title="New file in this folder"
            onClick={() => {
              const id = createFile(activeFolderId);
              openFileInPane(focusedPane, id);
              toast.success("New file");
            }}
          >
            +
          </button>
        </div>
        <ul className="ed-side-files">
          {fileList.length === 0 && <li className="ed-side-empty">No files yet</li>}
          {fileList.map((f) => {
            const isOpen = panes.includes(f.id);
            return (
              <li
                key={f.id}
                className={`ed-side-file ${isOpen ? "open" : ""}`}
                onClick={() => openFileInPane(focusedPane, f.id)}
                onDoubleClick={() => {
                  const n = prompt("Rename file", f.name);
                  if (n && n.trim()) renameFile(f.id, n.trim());
                }}
              >
                <span className="ed-side-file-icon">≡</span>
                <span className="ed-side-file-name">{f.name}</span>
                <span className="ed-side-file-meta" suppressHydrationWarning>{fmtClock(f.updatedAt)}</span>
                <button
                  className="ed-side-file-x"
                  title="Delete file"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete ${f.name}?`)) deleteFile(f.id);
                  }}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
