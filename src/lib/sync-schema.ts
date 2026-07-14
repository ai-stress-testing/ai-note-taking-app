import { z } from "zod";

/**
 * Wire format shared by the browser sync client and the server API.
 * The server validates every request body against these schemas before
 * touching the database — nothing unvalidated crosses the boundary.
 *
 * All free-text content travels as AES-GCM ciphertext (`Enc`); the server
 * never sees plaintext and never holds the key. Numbers/enums/foreign keys
 * stay plaintext so the server can do last-write-wins merging and (later)
 * aggregate queries without decrypting anything.
 */

const b64 = /^[A-Za-z0-9+/]*={0,2}$/;
export const encSchema = z.object({
  ct: z.string().max(2_000_000).regex(b64),
  nonce: z.string().min(8).max(64).regex(b64),
});
export type Enc = z.infer<typeof encSchema>;

const id = z.string().min(1).max(64);
const ts = z.number().int().nonnegative();

export const syncFolderSchema = z.object({
  id,
  name: encSchema,
  accent: z.string().max(32),
  personal: z.boolean().optional(),
  createdAt: ts,
  updatedAt: ts,
});

export const syncFileSchema = z.object({
  id,
  folderId: id,
  name: encSchema,
  content: encSchema,
  personal: z.boolean().nullable().optional(),
  createdAt: ts,
  updatedAt: ts,
});

export const syncCanvasSchema = z.object({
  id,
  fileId: id,
  strokes: encSchema,
  width: z.number().int().positive().max(10_000),
  height: z.number().int().positive().max(10_000),
  updatedAt: ts,
});

export const syncCardSchema = z.object({
  id,
  kind: z.enum(["question", "vocab", "note"]),
  fileId: id.nullable(),
  partLabel: z.string().max(8).nullable(),
  /** question/front/back/choices bundled into one encrypted JSON payload. */
  content: encSchema,
  flagged: z.boolean(),
  createdAt: ts,
  updatedAt: ts,
  fsrs: z.object({
    stability: z.number().nullable(),
    difficulty: z.number().nullable(),
    dueAt: ts,
    reps: z.number().int().nonnegative(),
    lapses: z.number().int().nonnegative(),
    lastReviewedAt: ts.nullable(),
  }),
});

export const syncReviewSchema = z.object({
  id,
  cardId: id,
  rating: z.number().int().min(1).max(4),
  reviewedAt: ts,
  elapsedDays: z.number().nonnegative(),
  scheduledDays: z.number().nonnegative(),
  retrievability: z.number().min(0).max(1).nullable(),
  stabilityBefore: z.number().nullable(),
  stabilityAfter: z.number(),
  difficultyBefore: z.number().nullable(),
  difficultyAfter: z.number(),
});

export const tombstoneSchema = z.object({
  kind: z.enum(["file", "folder", "canvas", "card"]),
  id,
  at: ts,
});

export const sessionEventSchema = z.object({
  type: z.enum(["start", "break", "resume", "end"]),
  at: ts,
});

export const pushPayloadSchema = z.object({
  folders: z.array(syncFolderSchema).max(1_000),
  files: z.array(syncFileSchema).max(10_000),
  canvases: z.array(syncCanvasSchema).max(10_000),
  cards: z.array(syncCardSchema).max(50_000),
  reviews: z.array(syncReviewSchema).max(200_000),
  tombstones: z.array(tombstoneSchema).max(50_000),
  sessionEvents: z.array(sessionEventSchema).max(100_000),
});

export type PushPayload = z.infer<typeof pushPayloadSchema>;
export type SyncFolder = z.infer<typeof syncFolderSchema>;
export type SyncFile = z.infer<typeof syncFileSchema>;
export type SyncCanvas = z.infer<typeof syncCanvasSchema>;
export type SyncCard = z.infer<typeof syncCardSchema>;
export type SyncReview = z.infer<typeof syncReviewSchema>;

export type PullResponse = PushPayload & { serverTime: number };
