import { pushPayloadSchema } from "../sync-schema";
import { ensureBootToken, mergePush, pullWorkspace, verifyToken } from "./db";

const MAX_BODY_BYTES = 25 * 1024 * 1024;

// Fixed-window limiter on failed auth attempts. Single-user server, so a
// global window (rather than per-IP bookkeeping) is enough to blunt
// token brute-forcing without extra state.
let authFailures = 0;
let windowStart = Date.now();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILURES = 20;

function authRateLimited(): boolean {
  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    windowStart = now;
    authFailures = 0;
  }
  return authFailures >= MAX_FAILURES;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

let booted = false;
export async function bootOnce(): Promise<void> {
  if (booted) return;
  booted = true;
  const token = await ensureBootToken();
  if (token) {
    console.log(
      "\n╭──────────────────────────────────────────────────────────────╮" +
        "\n│  NeuroVim backend: first boot — your sync token (shown once) │" +
        "\n╰──────────────────────────────────────────────────────────────╯" +
        `\n\n  ${token}\n\n` +
        "  Paste it into Settings → Sync in the app.\n" +
        "  Lost it? Run: bun run token:reset\n",
    );
  } else {
    console.log("NeuroVim backend: sync token already configured (bun run token:reset to rotate).");
  }
}

/** Returns a Response for /api/* requests, or null to fall through to the app. */
export async function handleApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;

  await bootOnce();

  if (authRateLimited()) return json({ error: "too many failed auth attempts" }, 429);
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !(await verifyToken(token))) {
    authFailures++;
    return json({ error: "unauthorized" }, 401);
  }
  // A legitimate user who finally pastes the right token shouldn't stay
  // locked out by their own earlier typos; an attacker never reaches here.
  authFailures = 0;

  if (url.pathname === "/api/health" && request.method === "GET") {
    return json({ ok: true, serverTime: Date.now() });
  }

  if (url.pathname === "/api/workspace" && request.method === "GET") {
    return json(await pullWorkspace());
  }

  if (url.pathname === "/api/workspace" && request.method === "PUT") {
    const len = Number(request.headers.get("content-length") ?? 0);
    if (len > MAX_BODY_BYTES) return json({ error: "payload too large" }, 413);
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return json({ error: "invalid JSON" }, 400);
    }
    const parsed = pushPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      return json({ error: "validation failed", issues: parsed.error.issues.slice(0, 5) }, 400);
    }
    await mergePush(parsed.data);
    return json({ ok: true, serverTime: Date.now() });
  }

  return json({ error: "not found" }, 404);
}
