import type { PushPayload, PullResponse } from "../sync-schema";

/**
 * SQLite persistence with zero native dependencies: node:sqlite when the
 * server runs under Node (vite dev, the Docker image), bun:sqlite when a
 * script runs under Bun. Same file format either way. All *_ct/*_nonce
 * columns hold client-encrypted content the server cannot read; merge
 * decisions use only plaintext timestamps (last-write-wins) and tombstones.
 */

type SqliteDb = {
  run(sql: string, ...params: unknown[]): void;
  all(sql: string, ...params: unknown[]): unknown[];
  get(sql: string, ...params: unknown[]): unknown;
  exec(sql: string): void;
};

type SqlParam = string | number | null;

async function openDatabase(path: string): Promise<SqliteDb> {
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const d = new DatabaseSync(path);
    return {
      run: (sql, ...p) => void d.prepare(sql).run(...(p as SqlParam[])),
      all: (sql, ...p) => d.prepare(sql).all(...(p as SqlParam[])),
      get: (sql, ...p) => d.prepare(sql).get(...(p as SqlParam[])),
      exec: (sql) => d.exec(sql),
    };
  } catch {
    // Bun runtime (scripts): no node:sqlite yet, use its native driver.
    type BunSqlite = {
      Database: new (
        path: string,
        opts: { create: boolean },
      ) => {
        query(sql: string): {
          run(...p: SqlParam[]): unknown;
          all(...p: SqlParam[]): unknown[];
          get(...p: SqlParam[]): unknown;
        };
        run(sql: string): unknown;
      };
    };
    const { Database } = (await import("bun" + ":sqlite")) as BunSqlite;
    const d = new Database(path, { create: true });
    return {
      run: (sql, ...p) => void d.query(sql).run(...(p as SqlParam[])),
      all: (sql, ...p) => d.query(sql).all(...(p as SqlParam[])),
      get: (sql, ...p) => d.query(sql).get(...(p as SqlParam[])),
      // bun:sqlite's run() takes one statement at a time; none of our DDL
      // statements contain embedded semicolons, so a split is safe.
      exec: (sql) =>
        sql
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((s) => d.run(s)),
    };
  }
}

let db: SqliteDb | null = null;

const SCHEMA = `
create table if not exists folders (
  id text primary key,
  name_ct text not null, name_nonce text not null,
  accent text not null,
  created_at integer not null, updated_at integer not null
);
create table if not exists files (
  id text primary key,
  folder_id text not null,
  name_ct text not null, name_nonce text not null,
  content_ct text not null, content_nonce text not null,
  created_at integer not null, updated_at integer not null
);
create table if not exists canvases (
  id text primary key,
  file_id text not null,
  strokes_ct text not null, strokes_nonce text not null,
  width integer not null, height integer not null,
  updated_at integer not null
);
create table if not exists cards (
  id text primary key,
  kind text not null check (kind in ('question','vocab','note')),
  file_id text,
  part_label text,
  content_ct text not null, content_nonce text not null,
  flagged integer not null default 0,
  fsrs_stability real, fsrs_difficulty real,
  fsrs_due_at integer not null,
  fsrs_reps integer not null default 0, fsrs_lapses integer not null default 0,
  fsrs_last_reviewed_at integer,
  created_at integer not null, updated_at integer not null
);
create table if not exists card_reviews (
  id text primary key,
  card_id text not null,
  rating integer not null check (rating between 1 and 4),
  reviewed_at integer not null,
  elapsed_days real not null, scheduled_days real not null,
  retrievability real,
  stability_before real, stability_after real not null,
  difficulty_before real, difficulty_after real not null
);
create table if not exists session_events (
  type text not null check (type in ('start','break','resume','end')),
  at integer not null,
  primary key (type, at)
);
create table if not exists tombstones (
  kind text not null check (kind in ('file','folder','canvas','card')),
  id text not null,
  at integer not null,
  primary key (kind, id)
);
create table if not exists auth_tokens (
  id integer primary key autoincrement,
  token_hash text not null,
  created_at integer not null
);
create index if not exists idx_files_folder on files(folder_id);
create index if not exists idx_cards_due on cards(fsrs_due_at);
create index if not exists idx_reviews_card on card_reviews(card_id);
`;

export async function getDb(): Promise<SqliteDb> {
  if (db) return db;
  const { mkdirSync } = await import("node:fs");
  const dir = process.env.NEUROVIM_DATA_DIR ?? "./data";
  mkdirSync(dir, { recursive: true });
  const handle = await openDatabase(`${dir}/neurovim.sqlite`);
  handle.exec("pragma journal_mode = wal");
  handle.exec(SCHEMA);
  db = handle;
  return db;
}

/** Per-table LWW upsert: newer updated_at wins; tombstoned-newer rows stay dead. */
export async function mergePush(payload: PushPayload): Promise<void> {
  const d = await getDb();

  const tombAt = (kind: string, id: string): number => {
    const row = d.get("select at from tombstones where kind = ? and id = ?", kind, id) as
      { at: number } | undefined | null;
    return row?.at ?? -1;
  };
  const rowUpdatedAt = (table: string, id: string): number => {
    const row = d.get(`select updated_at from ${table} where id = ?`, id) as
      { updated_at: number } | undefined | null;
    return row?.updated_at ?? -1;
  };

  for (const t of payload.tombstones) {
    d.run(
      "insert into tombstones (kind, id, at) values (?, ?, ?) on conflict(kind, id) do update set at = max(at, excluded.at)",
      t.kind,
      t.id,
      t.at,
    );
    const table =
      t.kind === "file"
        ? "files"
        : t.kind === "folder"
          ? "folders"
          : t.kind === "canvas"
            ? "canvases"
            : "cards";
    if (t.at >= rowUpdatedAt(table, t.id)) d.run(`delete from ${table} where id = ?`, t.id);
  }

  for (const f of payload.folders) {
    if (f.updatedAt <= tombAt("folder", f.id) || f.updatedAt <= rowUpdatedAt("folders", f.id))
      continue;
    d.run(
      `insert into folders (id, name_ct, name_nonce, accent, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?)
       on conflict(id) do update set name_ct=excluded.name_ct, name_nonce=excluded.name_nonce,
         accent=excluded.accent, updated_at=excluded.updated_at`,
      f.id,
      f.name.ct,
      f.name.nonce,
      f.accent,
      f.createdAt,
      f.updatedAt,
    );
  }

  for (const f of payload.files) {
    if (f.updatedAt <= tombAt("file", f.id) || f.updatedAt <= rowUpdatedAt("files", f.id)) continue;
    d.run(
      `insert into files (id, folder_id, name_ct, name_nonce, content_ct, content_nonce, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)
       on conflict(id) do update set folder_id=excluded.folder_id, name_ct=excluded.name_ct,
         name_nonce=excluded.name_nonce, content_ct=excluded.content_ct,
         content_nonce=excluded.content_nonce, updated_at=excluded.updated_at`,
      f.id,
      f.folderId,
      f.name.ct,
      f.name.nonce,
      f.content.ct,
      f.content.nonce,
      f.createdAt,
      f.updatedAt,
    );
  }

  for (const c of payload.canvases) {
    if (c.updatedAt <= tombAt("canvas", c.id) || c.updatedAt <= rowUpdatedAt("canvases", c.id))
      continue;
    d.run(
      `insert into canvases (id, file_id, strokes_ct, strokes_nonce, width, height, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)
       on conflict(id) do update set file_id=excluded.file_id, strokes_ct=excluded.strokes_ct,
         strokes_nonce=excluded.strokes_nonce, width=excluded.width, height=excluded.height,
         updated_at=excluded.updated_at`,
      c.id,
      c.fileId,
      c.strokes.ct,
      c.strokes.nonce,
      c.width,
      c.height,
      c.updatedAt,
    );
  }

  for (const c of payload.cards) {
    if (c.updatedAt <= tombAt("card", c.id) || c.updatedAt <= rowUpdatedAt("cards", c.id)) continue;
    d.run(
      `insert into cards (id, kind, file_id, part_label, content_ct, content_nonce, flagged,
         fsrs_stability, fsrs_difficulty, fsrs_due_at, fsrs_reps, fsrs_lapses,
         fsrs_last_reviewed_at, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict(id) do update set kind=excluded.kind, file_id=excluded.file_id,
         part_label=excluded.part_label, content_ct=excluded.content_ct,
         content_nonce=excluded.content_nonce, flagged=excluded.flagged,
         fsrs_stability=excluded.fsrs_stability, fsrs_difficulty=excluded.fsrs_difficulty,
         fsrs_due_at=excluded.fsrs_due_at, fsrs_reps=excluded.fsrs_reps,
         fsrs_lapses=excluded.fsrs_lapses, fsrs_last_reviewed_at=excluded.fsrs_last_reviewed_at,
         updated_at=excluded.updated_at`,
      c.id,
      c.kind,
      c.fileId,
      c.partLabel,
      c.content.ct,
      c.content.nonce,
      c.flagged ? 1 : 0,
      c.fsrs.stability,
      c.fsrs.difficulty,
      c.fsrs.dueAt,
      c.fsrs.reps,
      c.fsrs.lapses,
      c.fsrs.lastReviewedAt,
      c.createdAt,
      c.updatedAt,
    );
  }

  for (const r of payload.reviews) {
    d.run(
      `insert into card_reviews (id, card_id, rating, reviewed_at, elapsed_days, scheduled_days,
         retrievability, stability_before, stability_after, difficulty_before, difficulty_after)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict(id) do nothing`,
      r.id,
      r.cardId,
      r.rating,
      r.reviewedAt,
      r.elapsedDays,
      r.scheduledDays,
      r.retrievability,
      r.stabilityBefore,
      r.stabilityAfter,
      r.difficultyBefore,
      r.difficultyAfter,
    );
  }

  for (const e of payload.sessionEvents) {
    d.run(
      "insert into session_events (type, at) values (?, ?) on conflict(type, at) do nothing",
      e.type,
      e.at,
    );
  }
}

export async function pullWorkspace(): Promise<PullResponse> {
  const d = await getDb();
  type Row = Record<string, string | number | null>;
  const enc = (r: Row, prefix: string) => ({
    ct: r[`${prefix}_ct`] as string,
    nonce: r[`${prefix}_nonce`] as string,
  });

  return {
    folders: (d.all("select * from folders") as Row[]).map((r) => ({
      id: r.id as string,
      name: enc(r, "name"),
      accent: r.accent as string,
      createdAt: r.created_at as number,
      updatedAt: r.updated_at as number,
    })),
    files: (d.all("select * from files") as Row[]).map((r) => ({
      id: r.id as string,
      folderId: r.folder_id as string,
      name: enc(r, "name"),
      content: enc(r, "content"),
      createdAt: r.created_at as number,
      updatedAt: r.updated_at as number,
    })),
    canvases: (d.all("select * from canvases") as Row[]).map((r) => ({
      id: r.id as string,
      fileId: r.file_id as string,
      strokes: enc(r, "strokes"),
      width: r.width as number,
      height: r.height as number,
      updatedAt: r.updated_at as number,
    })),
    cards: (d.all("select * from cards") as Row[]).map((r) => ({
      id: r.id as string,
      kind: r.kind as "question" | "vocab" | "note",
      fileId: r.file_id as string | null,
      partLabel: r.part_label as string | null,
      content: enc(r, "content"),
      flagged: r.flagged === 1,
      createdAt: r.created_at as number,
      updatedAt: r.updated_at as number,
      fsrs: {
        stability: r.fsrs_stability as number | null,
        difficulty: r.fsrs_difficulty as number | null,
        dueAt: r.fsrs_due_at as number,
        reps: r.fsrs_reps as number,
        lapses: r.fsrs_lapses as number,
        lastReviewedAt: r.fsrs_last_reviewed_at as number | null,
      },
    })),
    reviews: (d.all("select * from card_reviews") as Row[]).map((r) => ({
      id: r.id as string,
      cardId: r.card_id as string,
      rating: r.rating as number,
      reviewedAt: r.reviewed_at as number,
      elapsedDays: r.elapsed_days as number,
      scheduledDays: r.scheduled_days as number,
      retrievability: r.retrievability as number | null,
      stabilityBefore: r.stability_before as number | null,
      stabilityAfter: r.stability_after as number,
      difficultyBefore: r.difficulty_before as number | null,
      difficultyAfter: r.difficulty_after as number,
    })),
    tombstones: (d.all("select * from tombstones") as Row[]).map((r) => ({
      kind: r.kind as "file" | "folder" | "canvas" | "card",
      id: r.id as string,
      at: r.at as number,
    })),
    sessionEvents: (d.all("select * from session_events") as Row[]).map((r) => ({
      type: r.type as "start" | "break" | "resume" | "end",
      at: r.at as number,
    })),
    serverTime: Date.now(),
  };
}

// ── auth ─────────────────────────────────────────────────────

export async function ensureBootToken(): Promise<string | null> {
  const d = await getDb();
  const existing = d.get("select count(*) as n from auth_tokens") as { n: number };
  if (existing.n > 0) return null;
  const { randomBytes, createHash } = await import("node:crypto");
  const token = randomBytes(32).toString("base64url");
  d.run(
    "insert into auth_tokens (token_hash, created_at) values (?, ?)",
    createHash("sha256").update(token).digest("hex"),
    Date.now(),
  );
  return token;
}

export async function verifyToken(token: string): Promise<boolean> {
  const d = await getDb();
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const hash = createHash("sha256").update(token).digest("hex");
  const rows = d.all("select token_hash from auth_tokens") as { token_hash: string }[];
  return rows.some((r) => {
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(r.token_hash, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export async function resetToken(): Promise<string> {
  const d = await getDb();
  d.run("delete from auth_tokens");
  const token = await ensureBootToken();
  if (!token) throw new Error("token reset failed");
  return token;
}
