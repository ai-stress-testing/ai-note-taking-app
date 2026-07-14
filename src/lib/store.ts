import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Legacy type kept for callers still importing it. */
export type Archetype = "notes" | "working" | "recall";

export type FileDoc = {
  id: string;
  folderId: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

export type Folder = {
  id: string;
  name: string;
  /** Catppuccin accent token name, e.g. "blue", "peach", "green" */
  accent: string;
};

export type AiSource = "ollama" | "cloud";
export type AiStatus = "idle" | "busy" | "ok" | "err";

export type SessionEventType = "start" | "break" | "resume" | "end";
export type SessionEvent = { type: SessionEventType; at: number };

export type SessionCounts = { questions: number; vocab: number };

export type CanvasStroke = { points: { x: number; y: number; p: number }[]; color: string; width: number };
export type CanvasData = { id: string; strokes: CanvasStroke[]; width: number; height: number };


type State = {
  folders: Folder[];
  files: Record<string, FileDoc>;
  activeFolderId: string;

  /** One fileId per pane, up to 4 */
  panes: string[];
  focusedPane: number;

  sidebarOpen: boolean;
  fileSearch: string;

  aiStatus: AiStatus;
  aiSource: AiSource | null;

  ollamaEnabled: boolean;
  ollamaUrl: string;
  ollamaModel: string;

  sessionEvents: SessionEvent[];
  sessionCounts: SessionCounts;

  /** Per-file canvas blocks (inserted via /canvas). */
  canvases: Record<string, CanvasData[]>;
  setCanvas: (fileId: string, canvas: CanvasData) => void;
  deleteCanvas: (fileId: string, canvasId: string) => void;
  addCanvas: (fileId: string) => string;

  // ── file / folder actions
  createFile: (folderId: string, name?: string) => string;
  renameFile: (id: string, name: string) => void;
  deleteFile: (id: string) => void;
  setActiveFolder: (id: string) => void;
  createFolder: (name: string, accent?: string) => string;
  setFileSearch: (q: string) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // ── pane actions
  setFocusedPane: (i: number) => void;
  setPanes: (panes: string[]) => void;
  openFileInPane: (paneIdx: number, fileId: string) => void;
  closePane: (paneIdx: number) => void;

  setContent: (fileId: string, content: string) => void;
  setAiStatus: (s: AiStatus, source?: AiSource | null) => void;
  setOllama: (patch: Partial<Pick<State, "ollamaEnabled" | "ollamaUrl" | "ollamaModel">>) => void;

  logSession: (type: SessionEventType) => SessionEvent;
  incSessionCount: (k: keyof SessionCounts) => void;
  resetSession: () => void;
};

// ── Seed data ──────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function seed() {
  const notesFolder: Folder = { id: "f-notes", name: "notes", accent: "blue" };
  const workingFolder: Folder = { id: "f-working", name: "working", accent: "peach" };
  const recallFolder: Folder = { id: "f-recall", name: "recall", accent: "green" };
  const now = Date.now();
  const scratch: FileDoc = {
    id: "file-scratch",
    folderId: notesFolder.id,
    name: "scratch.md",
    content: "",
    createdAt: now,
    updatedAt: now,
  };
  return {
    folders: [notesFolder, workingFolder, recallFolder],
    files: { [scratch.id]: scratch } as Record<string, FileDoc>,
    activeFolderId: notesFolder.id,
    panes: [scratch.id],
  };
}

export const useStore = create<State>()(
  persist(
    (set, get) => {
      const s0 = seed();
      return {
        ...s0,
        focusedPane: 0,
        sidebarOpen: true,
        fileSearch: "",
        aiStatus: "idle",
        aiSource: null,
        ollamaEnabled: true,
        ollamaUrl: "http://localhost:11434",
        ollamaModel: "llama3.2",
        sessionEvents: [],
        sessionCounts: { questions: 0, vocab: 0 },
        canvases: {},

        addCanvas: (fileId) => {
          const id = `cv-${uid()}`;
          set((s) => ({
            canvases: {
              ...s.canvases,
              [fileId]: [...(s.canvases[fileId] ?? []), { id, strokes: [], width: 520, height: 220 }],
            },
          }));
          return id;
        },
        setCanvas: (fileId, canvas) =>
          set((s) => ({
            canvases: {
              ...s.canvases,
              [fileId]: (s.canvases[fileId] ?? []).map((c) => (c.id === canvas.id ? canvas : c)),
            },
          })),
        deleteCanvas: (fileId, canvasId) =>
          set((s) => ({
            canvases: {
              ...s.canvases,
              [fileId]: (s.canvases[fileId] ?? []).filter((c) => c.id !== canvasId),
            },
          })),

        createFile: (folderId, name) => {
          const id = `file-${uid()}`;
          const now = Date.now();
          const folder = get().folders.find((f) => f.id === folderId);
          const prefix = folder?.name ?? "note";
          const count = Object.values(get().files).filter((f) => f.folderId === folderId).length + 1;
          const finalName = name ?? `${prefix}-${count}.md`;
          set((s) => ({
            files: { ...s.files, [id]: { id, folderId, name: finalName, content: "", createdAt: now, updatedAt: now } },
          }));
          return id;
        },
        renameFile: (id, name) =>
          set((s) => (s.files[id] ? { files: { ...s.files, [id]: { ...s.files[id], name, updatedAt: Date.now() } } } : s)),
        deleteFile: (id) =>
          set((s) => {
            if (!s.files[id]) return s;
            const { [id]: _drop, ...rest } = s.files;
            const remainingInFolder = Object.values(rest).filter((f) => f.folderId === s.files[id].folderId);
            const replacement = remainingInFolder[0]?.id ?? Object.values(rest)[0]?.id;
            let files = rest;
            let panes = s.panes;
            if (!replacement) {
              // Never leave the app with zero files.
              const nowT = Date.now();
              const newId = `file-${uid()}`;
              files = {
                [newId]: {
                  id: newId,
                  folderId: s.files[id].folderId,
                  name: "scratch.md",
                  content: "",
                  createdAt: nowT,
                  updatedAt: nowT,
                },
              };
              panes = s.panes.map((p) => (p === id ? newId : p));
            } else {
              panes = s.panes.map((p) => (p === id ? replacement : p));
            }
            return { files, panes };
          }),
        setActiveFolder: (id) => set({ activeFolderId: id, fileSearch: "" }),
        createFolder: (name, accent = "lavender") => {
          const id = `f-${uid()}`;
          set((s) => ({ folders: [...s.folders, { id, name, accent }] }));
          return id;
        },
        setFileSearch: (q) => set({ fileSearch: q }),
        toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
        setSidebarOpen: (open) => set({ sidebarOpen: open }),

        setFocusedPane: (i) => set({ focusedPane: i }),
        setPanes: (panes) =>
          set((s) => ({ panes, focusedPane: Math.min(s.focusedPane, panes.length - 1) })),
        openFileInPane: (paneIdx, fileId) =>
          set((s) => {
            const next = [...s.panes];
            next[paneIdx] = fileId;
            return { panes: next, focusedPane: paneIdx };
          }),
        closePane: (paneIdx) =>
          set((s) => {
            if (s.panes.length <= 1) return s;
            const next = s.panes.filter((_, i) => i !== paneIdx);
            return { panes: next, focusedPane: Math.max(0, Math.min(s.focusedPane, next.length - 1)) };
          }),

        setContent: (fileId, content) =>
          set((s) =>
            s.files[fileId]
              ? { files: { ...s.files, [fileId]: { ...s.files[fileId], content, updatedAt: Date.now() } } }
              : s,
          ),
        setAiStatus: (aiStatus, aiSource) =>
          set((s) => ({ aiStatus, aiSource: aiSource === undefined ? s.aiSource : aiSource })),
        setOllama: (patch) => set((s) => ({ ...s, ...patch })),

        logSession: (type) => {
          const evt: SessionEvent = { type, at: Date.now() };
          set((s) => ({ sessionEvents: [...s.sessionEvents, evt] }));
          return evt;
        },
        incSessionCount: (k) =>
          set((s) => ({ sessionCounts: { ...s.sessionCounts, [k]: s.sessionCounts[k] + 1 } })),
        resetSession: () => set({ sessionEvents: [], sessionCounts: { questions: 0, vocab: 0 } }),
      };
    },
    {
      name: "neurovim-state-v3",
      partialize: (s) => ({
        folders: s.folders,
        files: s.files,
        activeFolderId: s.activeFolderId,
        panes: s.panes,
        focusedPane: s.focusedPane,
        sidebarOpen: s.sidebarOpen,
        ollamaEnabled: s.ollamaEnabled,
        ollamaUrl: s.ollamaUrl,
        ollamaModel: s.ollamaModel,
        sessionEvents: s.sessionEvents,
        sessionCounts: s.sessionCounts,
        canvases: s.canvases,
      }),
    },
  ),
);

// ── Session math helpers ────────────────────────────────────────
export function computeSessionStats(events: SessionEvent[], endAt: number) {
  let workingSince: number | null = null;
  let breakSince: number | null = null;
  let workMs = 0;
  let breakMs = 0;
  const workIntervals: number[] = [];

  for (const e of events) {
    if (e.type === "start" || e.type === "resume") {
      if (breakSince !== null) { breakMs += e.at - breakSince; breakSince = null; }
      workingSince = e.at;
    } else if (e.type === "break") {
      if (workingSince !== null) { const d = e.at - workingSince; workMs += d; workIntervals.push(d); workingSince = null; }
      breakSince = e.at;
    } else if (e.type === "end") {
      if (workingSince !== null) { const d = e.at - workingSince; workMs += d; workIntervals.push(d); workingSince = null; }
      if (breakSince !== null) { breakMs += e.at - breakSince; breakSince = null; }
    }
  }
  if (workingSince !== null) { const d = endAt - workingSince; workMs += d; workIntervals.push(d); }
  if (breakSince !== null) { breakMs += endAt - breakSince; }

  const avgWorkMs = workIntervals.length > 0 ? workIntervals.reduce((a, b) => a + b, 0) / workIntervals.length : 0;
  return { workMs, breakMs, avgWorkMs, workIntervals };
}

export function fmtDuration(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function fmtClock(at: number): string {
  const d = new Date(at);
  return d.toLocaleTimeString([], { hour12: false });
}
