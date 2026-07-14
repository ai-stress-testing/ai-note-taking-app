import { create } from "zustand";
import { persist } from "zustand/middleware";
import { newFsrsState, reviewCard, type FsrsRating, type FsrsState } from "./fsrs";

export type FileDoc = {
  id: string;
  folderId: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  /** AI privacy: true/false overrides the folder; undefined inherits it. */
  personal?: boolean;
};

export type Folder = {
  id: string;
  name: string;
  /** Catppuccin accent token name, e.g. "blue", "peach", "green" */
  accent: string;
  createdAt: number;
  updatedAt: number;
  /** AI privacy: content in this folder is never sent to the local AI. */
  personal?: boolean;
};

export type AiSource = "local";
export type AiStatus = "idle" | "busy" | "ok" | "err";

export type SessionEventType = "start" | "break" | "resume" | "end";
export type SessionEvent = { type: SessionEventType; at: number };

export type SessionCounts = { questions: number; vocab: number };

export type CanvasStroke = {
  points: { x: number; y: number; p: number }[];
  color: string;
  width: number;
};
export type CanvasData = {
  id: string;
  strokes: CanvasStroke[];
  width: number;
  height: number;
  updatedAt: number;
};

// ── Cards / spaced repetition ───────────────────────────────
export type CardKind = "question" | "vocab" | "note";
export type CardChoice = { text: string; correct: boolean };
export type Card = {
  id: string;
  kind: CardKind;
  fileId: string | null;
  /** kind = "question": shared prompt + lettered part + choices. */
  question?: string;
  partLabel?: string;
  choices?: CardChoice[];
  /** kind = "vocab" (term/definition) or "note" (front only). */
  front?: string;
  back?: string;
  createdAt: number;
  updatedAt: number;
  fsrs: FsrsState;
  flagged: boolean;
  /** AI grading (question cards): did the model agree the marked answers are right? */
  gradedCorrect?: boolean;
  gradedSummary?: string;
  gradedTags?: string[];
};

/** Full per-review data points — enough for future FSRS parameter optimization. */
export type ReviewLog = {
  id: string;
  cardId: string;
  rating: FsrsRating;
  reviewedAt: number;
  elapsedDays: number;
  scheduledDays: number;
  retrievability: number | null;
  stabilityBefore: number | null;
  stabilityAfter: number;
  difficultyBefore: number | null;
  difficultyAfter: number;
};

/** Deletion markers so sync can propagate removals instead of resurrecting rows. */
export type Tombstone = { kind: "file" | "folder" | "canvas" | "card"; id: string; at: number };

export type SyncStatus = "off" | "no-key" | "idle" | "syncing" | "error";

/**
 * One entry per AI call, from the moment it's queued through its result.
 * This list *is* the queue (entries with status "queued"/"sending") and
 * the audit trail (everything else) — same array, so there's one place
 * to look for "what's about to be sent" and "what already was."
 */
export type AiQueueStatus = "queued" | "sending" | "ok" | "error";
export type AiQueueEntry = {
  id: string;
  command: string;
  system: string;
  prompt: string;
  status: AiQueueStatus;
  requestedAt: number;
  respondedAt?: number;
  result?: string;
  error?: string;
};
const AI_QUEUE_MAX = 50;

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

  /** Any OpenAI-compatible local server: Ollama, LM Studio, llama.cpp, vLLM, etc. */
  localAiEnabled: boolean;
  localAiUrl: string;
  localAiModel: string;
  /** Optional smaller/faster model for math/calc/grading verification ("" = use primary). */
  verifyAiModel: string;

  sessionEvents: SessionEvent[];
  sessionCounts: SessionCounts;

  /** Queued/in-flight/completed AI calls, newest first, capped at AI_QUEUE_MAX. */
  aiQueue: AiQueueEntry[];
  enqueueAiEntry: (command: string, system: string, prompt: string) => string;
  updateAiEntry: (id: string, patch: Partial<AiQueueEntry>) => void;

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
  renameFolder: (id: string, name: string) => void;
  /** Deletes the folder and everything in it (files, canvases), tombstoned for sync. */
  deleteFolder: (id: string) => void;
  toggleFilePersonal: (id: string) => void;
  toggleFolderPersonal: (id: string) => void;
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
  setLocalAi: (
    patch: Partial<Pick<State, "localAiEnabled" | "localAiUrl" | "localAiModel" | "verifyAiModel">>,
  ) => void;

  logSession: (type: SessionEventType) => SessionEvent;
  incSessionCount: (k: keyof SessionCounts) => void;
  resetSession: () => void;

  // ── cards / spaced repetition
  cards: Record<string, Card>;
  reviewLogs: ReviewLog[];
  cardsSeeded: boolean;
  addCard: (
    card: Pick<Card, "kind" | "fileId"> &
      Partial<Pick<Card, "question" | "partLabel" | "choices" | "front" | "back">>,
  ) => string;
  rateCard: (id: string, rating: FsrsRating) => void;
  setCardGrading: (
    id: string,
    grading: { gradedCorrect: boolean; gradedSummary: string; gradedTags: string[] },
  ) => void;
  deleteCard: (id: string) => void;
  toggleCardFlag: (id: string) => void;

  // ── sync / persistence backend
  tombstones: Tombstone[];
  syncEnabled: boolean;
  backendToken: string;
  syncStatus: SyncStatus;
  lastSyncAt: number | null;
  encKeyLoaded: boolean;
  setSyncConfig: (patch: Partial<Pick<State, "syncEnabled" | "backendToken">>) => void;
  setSyncRuntime: (
    patch: Partial<Pick<State, "syncStatus" | "lastSyncAt" | "encKeyLoaded">>,
  ) => void;
};

// ── Seed data ──────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Seed rows use fixed ids and are re-created by every fresh browser profile.
// Their timestamps sit at epoch so last-write-wins sync always prefers real
// synced data over a brand-new seed — a fresh device can never clobber the
// server copy with empty defaults.
const SEED_TS = 0;

function seed() {
  const now = SEED_TS;
  const notesFolder: Folder = {
    id: "f-notes",
    name: "notes",
    accent: "blue",
    createdAt: now,
    updatedAt: now,
  };
  const workingFolder: Folder = {
    id: "f-working",
    name: "working",
    accent: "peach",
    createdAt: now,
    updatedAt: now,
  };
  const recallFolder: Folder = {
    id: "f-recall",
    name: "recall",
    accent: "green",
    createdAt: now,
    updatedAt: now,
  };
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

/** Starter deck: immediately-due cards so /fsrs works out of the box. */
function seedCards(): Record<string, Card> {
  const mk = (id: string, partial: Partial<Card> & Pick<Card, "kind">): Card => ({
    id,
    fileId: null,
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
    fsrs: newFsrsState(SEED_TS),
    flagged: false,
    ...partial,
  });
  const deck: Card[] = [
    mk("seed-zettel-1", {
      kind: "vocab",
      front: "permanent note",
      back: "A note rewritten in your own words, one idea per note, linked into the Zettelkasten — written for your future self, not copied from the source.",
    }),
    mk("seed-zettel-2", {
      kind: "vocab",
      front: "literature note",
      back: "A brief capture of what a source says, in your own words, with a citation — raw material that later becomes permanent notes.",
    }),
    mk("seed-fsrs-1", {
      kind: "vocab",
      front: "retrievability",
      back: "The probability you can recall a card right now; decays with time since the last review and is what spaced repetition schedules against.",
    }),
    mk("seed-fsrs-2", {
      kind: "vocab",
      front: "stability (FSRS)",
      back: "How long a memory lasts: the number of days for retrievability to fall from 100% to 90%. Grows with each successful review.",
    }),
    mk("seed-q-1", {
      kind: "question",
      question: "In a Zettelkasten, when should you link two notes?",
      partLabel: "a",
      choices: [
        {
          text: "Whenever the connection would surprise or inform your future self",
          correct: true,
        },
        { text: "Only when both notes share a tag", correct: false },
        { text: "Only within the same folder", correct: false },
        { text: "Links should be avoided to keep notes independent", correct: false },
      ],
    }),
    mk("seed-q-2", {
      kind: "question",
      question: "Why review a distilled note instead of the original source?",
      partLabel: "a",
      choices: [
        { text: "Testing your own compression exposes what was lost in ingestion", correct: true },
        { text: "Original sources are usually wrong", correct: false },
        { text: "It is faster, and speed is the goal", correct: false },
        { text: "Distilled notes never contain errors", correct: false },
      ],
    }),
    mk("seed-note-1", {
      kind: "note",
      front:
        "Learning loop: ingest (capture in your own words) → distill (compress to the essential claim) → check for loss (can you reconstruct the original argument?) → review on an expanding schedule.",
    }),
    mk("seed-note-2", {
      kind: "note",
      front:
        "A lapse is information, not failure — FSRS collapses the interval so the memory is rebuilt while the cost of relearning is still low.",
    }),
  ];
  return Object.fromEntries(deck.map((c) => [c.id, c]));
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
        localAiEnabled: true,
        localAiUrl: "http://localhost:11434/v1",
        localAiModel: "llama3.2",
        verifyAiModel: "",
        sessionEvents: [],
        sessionCounts: { questions: 0, vocab: 0 },
        aiQueue: [],
        canvases: {},
        cards: seedCards(),
        reviewLogs: [],
        cardsSeeded: true,
        tombstones: [],
        syncEnabled: false,
        backendToken: "",
        syncStatus: "off" as SyncStatus,
        lastSyncAt: null,
        encKeyLoaded: false,

        addCard: (partial) => {
          const id = `card-${uid()}`;
          const now = Date.now();
          const card: Card = {
            id,
            createdAt: now,
            updatedAt: now,
            fsrs: newFsrsState(now),
            flagged: false,
            ...partial,
          };
          set((s) => ({ cards: { ...s.cards, [id]: card } }));
          return id;
        },
        rateCard: (id, rating) =>
          set((s) => {
            const card = s.cards[id];
            if (!card) return s;
            const now = Date.now();
            const { state: fsrs, log } = reviewCard(card.fsrs, rating, now);
            const entry: ReviewLog = { id: `rev-${uid()}`, cardId: id, ...log };
            return {
              cards: { ...s.cards, [id]: { ...card, fsrs, updatedAt: now } },
              reviewLogs: [...s.reviewLogs, entry],
            };
          }),
        setCardGrading: (id, grading) =>
          set((s) =>
            s.cards[id]
              ? {
                  cards: {
                    ...s.cards,
                    [id]: { ...s.cards[id], ...grading, updatedAt: Date.now() },
                  },
                }
              : s,
          ),
        deleteCard: (id) =>
          set((s) => {
            if (!s.cards[id]) return s;
            const { [id]: _drop, ...cards } = s.cards;
            return {
              cards,
              tombstones: [...s.tombstones, { kind: "card" as const, id, at: Date.now() }],
            };
          }),
        toggleCardFlag: (id) =>
          set((s) =>
            s.cards[id]
              ? {
                  cards: {
                    ...s.cards,
                    [id]: { ...s.cards[id], flagged: !s.cards[id].flagged, updatedAt: Date.now() },
                  },
                }
              : s,
          ),

        setSyncConfig: (patch) => set((s) => ({ ...s, ...patch })),
        setSyncRuntime: (patch) => set((s) => ({ ...s, ...patch })),

        enqueueAiEntry: (command, system, prompt) => {
          const id = `aiq-${uid()}`;
          const entry: AiQueueEntry = {
            id,
            command,
            system,
            prompt,
            status: "queued",
            requestedAt: Date.now(),
          };
          set((s) => ({ aiQueue: [entry, ...s.aiQueue].slice(0, AI_QUEUE_MAX) }));
          return id;
        },
        updateAiEntry: (id, patch) =>
          set((s) => ({
            aiQueue: s.aiQueue.map((e) => (e.id === id ? { ...e, ...patch } : e)),
          })),

        addCanvas: (fileId) => {
          const id = `cv-${uid()}`;
          set((s) => ({
            canvases: {
              ...s.canvases,
              [fileId]: [
                ...(s.canvases[fileId] ?? []),
                { id, strokes: [], width: 520, height: 220, updatedAt: Date.now() },
              ],
            },
          }));
          return id;
        },
        setCanvas: (fileId, canvas) =>
          set((s) => ({
            canvases: {
              ...s.canvases,
              [fileId]: (s.canvases[fileId] ?? []).map((c) =>
                c.id === canvas.id ? { ...canvas, updatedAt: Date.now() } : c,
              ),
            },
          })),
        deleteCanvas: (fileId, canvasId) =>
          set((s) => ({
            canvases: {
              ...s.canvases,
              [fileId]: (s.canvases[fileId] ?? []).filter((c) => c.id !== canvasId),
            },
            tombstones: [
              ...s.tombstones,
              { kind: "canvas" as const, id: canvasId, at: Date.now() },
            ],
          })),

        createFile: (folderId, name) => {
          const id = `file-${uid()}`;
          const now = Date.now();
          const folder = get().folders.find((f) => f.id === folderId);
          const prefix = folder?.name ?? "note";
          const count =
            Object.values(get().files).filter((f) => f.folderId === folderId).length + 1;
          const finalName = name ?? `${prefix}-${count}.md`;
          set((s) => ({
            files: {
              ...s.files,
              [id]: { id, folderId, name: finalName, content: "", createdAt: now, updatedAt: now },
            },
          }));
          return id;
        },
        renameFile: (id, name) =>
          set((s) =>
            s.files[id]
              ? { files: { ...s.files, [id]: { ...s.files[id], name, updatedAt: Date.now() } } }
              : s,
          ),
        deleteFile: (id) =>
          set((s) => {
            if (!s.files[id]) return s;
            const { [id]: _drop, ...rest } = s.files;
            const remainingInFolder = Object.values(rest).filter(
              (f) => f.folderId === s.files[id].folderId,
            );
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
            return {
              files,
              panes,
              tombstones: [...s.tombstones, { kind: "file" as const, id, at: Date.now() }],
            };
          }),
        setActiveFolder: (id) => set({ activeFolderId: id, fileSearch: "" }),
        createFolder: (name, accent = "lavender") => {
          const id = `f-${uid()}`;
          const now = Date.now();
          set((s) => ({
            folders: [...s.folders, { id, name, accent, createdAt: now, updatedAt: now }],
          }));
          return id;
        },
        toggleFilePersonal: (id) =>
          set((s) =>
            s.files[id]
              ? {
                  files: {
                    ...s.files,
                    [id]: {
                      ...s.files[id],
                      // Cycle: inherit -> personal -> normal -> inherit.
                      personal:
                        s.files[id].personal === undefined
                          ? true
                          : s.files[id].personal
                            ? false
                            : undefined,
                      updatedAt: Date.now(),
                    },
                  },
                }
              : s,
          ),
        toggleFolderPersonal: (id) =>
          set((s) => ({
            folders: s.folders.map((f) =>
              f.id === id ? { ...f, personal: !f.personal, updatedAt: Date.now() } : f,
            ),
          })),
        renameFolder: (id, name) =>
          set((s) => ({
            folders: s.folders.map((f) =>
              f.id === id ? { ...f, name, updatedAt: Date.now() } : f,
            ),
          })),
        deleteFolder: (id) =>
          set((s) => {
            if (s.folders.length <= 1 || !s.folders.some((f) => f.id === id)) return s;
            const now = Date.now();
            const tombstones = [...s.tombstones, { kind: "folder" as const, id, at: now }];
            const files: Record<string, FileDoc> = {};
            for (const [fid, f] of Object.entries(s.files)) {
              if (f.folderId === id) tombstones.push({ kind: "file", id: fid, at: now });
              else files[fid] = f;
            }
            const canvases: Record<string, CanvasData[]> = {};
            for (const [fid, list] of Object.entries(s.canvases)) {
              if (files[fid]) canvases[fid] = list;
              else for (const c of list) tombstones.push({ kind: "canvas", id: c.id, at: now });
            }
            const folders = s.folders.filter((f) => f.id !== id);
            let fileIds = Object.keys(files);
            if (fileIds.length === 0) {
              const newId = `file-${uid()}`;
              files[newId] = {
                id: newId,
                folderId: folders[0].id,
                name: "scratch.md",
                content: "",
                createdAt: now,
                updatedAt: now,
              };
              fileIds = [newId];
            }
            const panes = s.panes.map((p) => (files[p] ? p : fileIds[0]));
            return {
              folders,
              files,
              canvases,
              panes,
              tombstones,
              activeFolderId: s.activeFolderId === id ? folders[0].id : s.activeFolderId,
            };
          }),
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
            return {
              panes: next,
              focusedPane: Math.max(0, Math.min(s.focusedPane, next.length - 1)),
            };
          }),

        setContent: (fileId, content) =>
          set((s) =>
            s.files[fileId]
              ? {
                  files: {
                    ...s.files,
                    [fileId]: { ...s.files[fileId], content, updatedAt: Date.now() },
                  },
                }
              : s,
          ),
        setAiStatus: (aiStatus, aiSource) =>
          set((s) => ({ aiStatus, aiSource: aiSource === undefined ? s.aiSource : aiSource })),
        setLocalAi: (patch) => set((s) => ({ ...s, ...patch })),

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
      name: "neurovim-state-v4",
      version: 5,
      migrate: (persisted) => {
        // v4 (version 0) → v5: entity timestamps + cards/sync fields.
        const s = persisted as Record<string, unknown>;
        const now = Date.now();
        if (Array.isArray(s.folders)) {
          s.folders = (s.folders as Partial<Folder>[]).map((f) => ({
            ...f,
            createdAt: f.createdAt ?? now,
            updatedAt: f.updatedAt ?? now,
          }));
        }
        if (s.canvases && typeof s.canvases === "object") {
          const patched: Record<string, CanvasData[]> = {};
          for (const [fileId, list] of Object.entries(
            s.canvases as Record<string, Partial<CanvasData>[]>,
          )) {
            patched[fileId] = list.map((c) => ({
              ...(c as CanvasData),
              updatedAt: c.updatedAt ?? now,
            }));
          }
          s.canvases = patched;
        }
        if (!s.cards) {
          s.cards = seedCards();
          s.cardsSeeded = true;
        }
        s.reviewLogs = s.reviewLogs ?? [];
        s.tombstones = s.tombstones ?? [];
        s.syncEnabled = s.syncEnabled ?? false;
        s.backendToken = s.backendToken ?? "";
        s.verifyAiModel = s.verifyAiModel ?? "";
        if (Array.isArray(s.panes) && typeof s.focusedPane === "number") {
          s.focusedPane = Math.max(0, Math.min(s.focusedPane, s.panes.length - 1));
        }
        return s;
      },
      partialize: (s) => ({
        folders: s.folders,
        files: s.files,
        activeFolderId: s.activeFolderId,
        panes: s.panes,
        focusedPane: s.focusedPane,
        sidebarOpen: s.sidebarOpen,
        localAiEnabled: s.localAiEnabled,
        localAiUrl: s.localAiUrl,
        localAiModel: s.localAiModel,
        verifyAiModel: s.verifyAiModel,
        sessionEvents: s.sessionEvents,
        sessionCounts: s.sessionCounts,
        aiQueue: s.aiQueue,
        canvases: s.canvases,
        cards: s.cards,
        reviewLogs: s.reviewLogs,
        cardsSeeded: s.cardsSeeded,
        tombstones: s.tombstones,
        syncEnabled: s.syncEnabled,
        backendToken: s.backendToken,
      }),
    },
  ),
);

/**
 * The AI privacy boundary's single source of truth: a file is personal if
 * it says so itself, or (when it doesn't say) if its folder is marked.
 */
export function isFilePersonal(
  fileId: string | null | undefined,
  files: Record<string, FileDoc>,
  folders: Folder[],
): boolean {
  if (!fileId) return false;
  const file = files[fileId];
  if (!file) return false;
  if (file.personal !== undefined) return file.personal;
  return folders.find((f) => f.id === file.folderId)?.personal ?? false;
}

// ── Session math helpers ────────────────────────────────────────
export function computeSessionStats(events: SessionEvent[], endAt: number) {
  let workingSince: number | null = null;
  let breakSince: number | null = null;
  let workMs = 0;
  let breakMs = 0;
  const workIntervals: number[] = [];

  for (const e of events) {
    if (e.type === "start" || e.type === "resume") {
      if (breakSince !== null) {
        breakMs += e.at - breakSince;
        breakSince = null;
      }
      workingSince = e.at;
    } else if (e.type === "break") {
      if (workingSince !== null) {
        const d = e.at - workingSince;
        workMs += d;
        workIntervals.push(d);
        workingSince = null;
      }
      breakSince = e.at;
    } else if (e.type === "end") {
      if (workingSince !== null) {
        const d = e.at - workingSince;
        workMs += d;
        workIntervals.push(d);
        workingSince = null;
      }
      if (breakSince !== null) {
        breakMs += e.at - breakSince;
        breakSince = null;
      }
    }
  }
  if (workingSince !== null) {
    const d = endAt - workingSince;
    workMs += d;
    workIntervals.push(d);
  }
  if (breakSince !== null) {
    breakMs += endAt - breakSince;
  }

  const avgWorkMs =
    workIntervals.length > 0 ? workIntervals.reduce((a, b) => a + b, 0) / workIntervals.length : 0;
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
