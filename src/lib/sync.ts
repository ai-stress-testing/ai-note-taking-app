import {
  decryptText,
  downloadKeyFile,
  encryptText,
  generateKeyBytes,
  importKeyBytes,
} from "./crypto";
import type { PullResponse, PushPayload, SyncCard } from "./sync-schema";
import {
  useStore,
  type Card,
  type CanvasData,
  type FileDoc,
  type Folder,
  type ReviewLog,
  type Tombstone,
} from "./store";

/**
 * Sync engine: full-snapshot push (debounced on store changes) + pull/merge
 * on startup, last-write-wins per entity by updatedAt, deletions carried by
 * tombstones. Content is encrypted before it leaves this module and
 * decrypted when it returns — the key lives here, in memory, session-only.
 */

let key: CryptoKey | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushing = false;
let dirtyWhilePushing = false;
let started = false;

export function keyIsLoaded(): boolean {
  return key !== null;
}

export async function generateAndDownloadKey(): Promise<void> {
  const bytes = await generateKeyBytes();
  downloadKeyFile(bytes);
  key = await importKeyBytes(bytes);
  useStore.getState().setSyncRuntime({ encKeyLoaded: true });
}

export async function loadKeyFromFile(file: File): Promise<void> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  key = await importKeyBytes(bytes);
  useStore.getState().setSyncRuntime({ encKeyLoaded: true });
}

function authHeaders(): Record<string, string> {
  return {
    authorization: `Bearer ${useStore.getState().backendToken}`,
    "content-type": "application/json",
  };
}

function canSync(): boolean {
  const s = useStore.getState();
  return s.syncEnabled && s.backendToken.length > 0 && key !== null;
}

// ── store ⟷ wire ────────────────────────────────────────────

async function buildPush(): Promise<PushPayload> {
  const k = key!;
  const s = useStore.getState();
  return {
    folders: await Promise.all(
      s.folders.map(async (f) => ({
        id: f.id,
        name: await encryptText(k, f.name),
        accent: f.accent,
        personal: f.personal ?? false,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      })),
    ),
    files: await Promise.all(
      Object.values(s.files).map(async (f) => ({
        id: f.id,
        folderId: f.folderId,
        name: await encryptText(k, f.name),
        content: await encryptText(k, f.content),
        personal: f.personal ?? null,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      })),
    ),
    canvases: await Promise.all(
      Object.entries(s.canvases).flatMap(([fileId, list]) =>
        list.map(async (c) => ({
          id: c.id,
          fileId,
          strokes: await encryptText(k, JSON.stringify(c.strokes)),
          width: c.width,
          height: c.height,
          updatedAt: c.updatedAt,
        })),
      ),
    ),
    cards: await Promise.all(
      Object.values(s.cards).map(async (c) => ({
        id: c.id,
        kind: c.kind,
        fileId: c.fileId,
        partLabel: c.partLabel ?? null,
        content: await encryptText(
          k,
          JSON.stringify({
            question: c.question,
            choices: c.choices,
            front: c.front,
            back: c.back,
            gradedCorrect: c.gradedCorrect,
            gradedSummary: c.gradedSummary,
            gradedTags: c.gradedTags,
          }),
        ),
        flagged: c.flagged,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        fsrs: c.fsrs,
      })),
    ),
    reviews: s.reviewLogs.map((r) => ({ ...r })),
    tombstones: s.tombstones.map((t) => ({ ...t })),
    sessionEvents: s.sessionEvents.map((e) => ({ ...e })),
  };
}

async function decryptCard(k: CryptoKey, c: SyncCard): Promise<Card> {
  const content = JSON.parse(await decryptText(k, c.content)) as Pick<
    Card,
    "question" | "choices" | "front" | "back" | "gradedCorrect" | "gradedSummary" | "gradedTags"
  >;
  return {
    id: c.id,
    kind: c.kind,
    fileId: c.fileId,
    partLabel: c.partLabel ?? undefined,
    ...content,
    flagged: c.flagged,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    fsrs: c.fsrs,
  };
}

async function applyPull(remote: PullResponse): Promise<void> {
  const k = key!;

  const remoteFolders = await Promise.all(
    remote.folders.map(async (f) => ({
      id: f.id,
      name: await decryptText(k, f.name),
      accent: f.accent,
      personal: f.personal ?? false,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    })),
  );
  const remoteFiles = await Promise.all(
    remote.files.map(async (f) => ({
      id: f.id,
      folderId: f.folderId,
      name: await decryptText(k, f.name),
      content: await decryptText(k, f.content),
      personal: f.personal ?? undefined,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    })),
  );
  const remoteCanvases = await Promise.all(
    remote.canvases.map(async (c) => ({
      fileId: c.fileId,
      canvas: {
        id: c.id,
        strokes: JSON.parse(await decryptText(k, c.strokes)) as CanvasData["strokes"],
        width: c.width,
        height: c.height,
        updatedAt: c.updatedAt,
      } satisfies CanvasData,
    })),
  );
  const remoteCards = await Promise.all(remote.cards.map((c) => decryptCard(k, c)));

  useStore.setState((s) => {
    const tombAt = (kind: Tombstone["kind"], id: string): number => {
      let at = -1;
      for (const t of s.tombstones) if (t.kind === kind && t.id === id && t.at > at) at = t.at;
      for (const t of remote.tombstones) if (t.kind === kind && t.id === id && t.at > at) at = t.at;
      return at;
    };

    const folders = new Map<string, Folder>(s.folders.map((f) => [f.id, f]));
    for (const rf of remoteFolders) {
      if (rf.updatedAt <= tombAt("folder", rf.id)) continue;
      const local = folders.get(rf.id);
      if (!local || rf.updatedAt > local.updatedAt) folders.set(rf.id, rf);
    }
    for (const id of [...folders.keys()]) {
      if (tombAt("folder", id) >= folders.get(id)!.updatedAt) folders.delete(id);
    }

    const files: Record<string, FileDoc> = { ...s.files };
    for (const rf of remoteFiles) {
      if (rf.updatedAt <= tombAt("file", rf.id)) continue;
      const local = files[rf.id];
      if (!local || rf.updatedAt > local.updatedAt) files[rf.id] = rf;
    }
    for (const id of Object.keys(files)) {
      if (tombAt("file", id) >= files[id].updatedAt) delete files[id];
    }

    const canvases: Record<string, CanvasData[]> = Object.fromEntries(
      Object.entries(s.canvases).map(([fid, list]) => [fid, [...list]]),
    );
    for (const { fileId, canvas } of remoteCanvases) {
      if (canvas.updatedAt <= tombAt("canvas", canvas.id)) continue;
      const list = canvases[fileId] ?? [];
      const idx = list.findIndex((c) => c.id === canvas.id);
      if (idx === -1) list.push(canvas);
      else if (canvas.updatedAt > list[idx].updatedAt) list[idx] = canvas;
      canvases[fileId] = list;
    }
    for (const fid of Object.keys(canvases)) {
      canvases[fid] = canvases[fid].filter((c) => tombAt("canvas", c.id) < c.updatedAt);
    }

    const cards: Record<string, Card> = { ...s.cards };
    for (const rc of remoteCards) {
      if (rc.updatedAt <= tombAt("card", rc.id)) continue;
      const local = cards[rc.id];
      if (!local || rc.updatedAt > local.updatedAt) cards[rc.id] = rc;
    }
    for (const id of Object.keys(cards)) {
      if (tombAt("card", id) >= cards[id].updatedAt) delete cards[id];
    }

    const seenReviews = new Set(s.reviewLogs.map((r) => r.id));
    const reviewLogs: ReviewLog[] = [
      ...s.reviewLogs,
      ...remote.reviews
        .filter((r) => !seenReviews.has(r.id))
        .map((r) => ({ ...r, rating: r.rating as ReviewLog["rating"] })),
    ];

    const seenEvents = new Set(s.sessionEvents.map((e) => `${e.type}:${e.at}`));
    const sessionEvents = [
      ...s.sessionEvents,
      ...remote.sessionEvents.filter((e) => !seenEvents.has(`${e.type}:${e.at}`)),
    ].sort((a, b) => a.at - b.at);

    const tombKeys = new Set(s.tombstones.map((t) => `${t.kind}:${t.id}`));
    const tombstones = [
      ...s.tombstones,
      ...remote.tombstones.filter((t) => !tombKeys.has(`${t.kind}:${t.id}`)),
    ].slice(-5_000);

    // Never leave panes pointing at files deleted remotely.
    let fileIds = Object.keys(files);
    if (fileIds.length === 0) {
      const now = Date.now();
      const scratch: FileDoc = {
        id: `file-${Math.random().toString(36).slice(2, 10)}`,
        folderId: [...folders.keys()][0] ?? "f-notes",
        name: "scratch.md",
        content: "",
        createdAt: now,
        updatedAt: now,
      };
      files[scratch.id] = scratch;
      fileIds = [scratch.id];
    }
    const panes = s.panes.map((p) => (files[p] ? p : fileIds[0]));

    return {
      folders: [...folders.values()],
      files,
      canvases,
      cards,
      reviewLogs,
      sessionEvents,
      tombstones,
      panes,
    };
  });
}

// ── engine ──────────────────────────────────────────────────

async function push(): Promise<void> {
  if (!canSync() || pushing) {
    dirtyWhilePushing = pushing;
    return;
  }
  pushing = true;
  const { setSyncRuntime } = useStore.getState();
  setSyncRuntime({ syncStatus: "syncing" });
  try {
    const payload = await buildPush();
    const res = await fetch("/api/workspace", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`push failed: HTTP ${res.status}`);
    setSyncRuntime({ syncStatus: "idle", lastSyncAt: Date.now() });
  } catch {
    setSyncRuntime({ syncStatus: "error" });
  } finally {
    pushing = false;
    if (dirtyWhilePushing) {
      dirtyWhilePushing = false;
      schedulePush();
    }
  }
}

function schedulePush(): void {
  if (!canSync()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void push();
  }, 1200);
}

export async function pullNow(): Promise<void> {
  if (!canSync()) return;
  const { setSyncRuntime } = useStore.getState();
  setSyncRuntime({ syncStatus: "syncing" });
  try {
    const res = await fetch("/api/workspace", { headers: authHeaders() });
    if (!res.ok) throw new Error(`pull failed: HTTP ${res.status}`);
    const remote = (await res.json()) as PullResponse;
    await applyPull(remote);
    setSyncRuntime({ syncStatus: "idle", lastSyncAt: Date.now() });
    // Send anything local-only (or local-newer) straight back.
    void push();
  } catch {
    setSyncRuntime({ syncStatus: "error" });
  }
}

export async function testConnection(token: string): Promise<{ ok: boolean; msg: string }> {
  try {
    const res = await fetch("/api/health", { headers: { authorization: `Bearer ${token}` } });
    if (res.status === 401)
      return { ok: false, msg: "Server reachable, but the token was rejected." };
    if (!res.ok) return { ok: false, msg: `Server error: HTTP ${res.status}` };
    return { ok: true, msg: "Connected — token accepted." };
  } catch (e) {
    return {
      ok: false,
      msg: `Could not reach this app's server: ${e instanceof Error ? e.message : e}`,
    };
  }
}

export function initSync(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  useStore.subscribe((s, prev) => {
    const changed =
      s.files !== prev.files ||
      s.folders !== prev.folders ||
      s.canvases !== prev.canvases ||
      s.cards !== prev.cards ||
      s.reviewLogs !== prev.reviewLogs ||
      s.tombstones !== prev.tombstones ||
      s.sessionEvents !== prev.sessionEvents;
    if (changed) schedulePush();
  });

  const s = useStore.getState();
  if (s.syncEnabled && !key) s.setSyncRuntime({ syncStatus: "no-key" });
  if (canSync()) void pullNow();
}
