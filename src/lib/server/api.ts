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

/**
 * SSRF guard for the AI proxy: the target host is client-supplied, so only
 * forward to places a local AI could plausibly live and a browser can't reach
 * on its own — loopback, Docker (`*.docker.internal`, dot-less compose service
 * names), and private IPv4 ranges. A public host is refused. This is not a
 * general web proxy.
 */
export function isAllowedProxyTarget(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (host === "localhost" || host === "::1" || host === "host.docker.internal") return true;
  if (host.endsWith(".docker.internal")) return true;
  // Dot-less name = a single-label host (a Docker/compose service like "ollama").
  if (!host.includes(".") && !host.includes(":")) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if ([a, b, Number(m[3]), Number(m[4])].some((n) => n > 255)) return false;
    if (a === 127 || a === 10) return true; // loopback, private
    if (a === 192 && b === 168) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    // Link-local (169.254/16) is deliberately NOT allowed: it's the cloud
    // instance-metadata range (169.254.169.254), a classic SSRF target. The
    // Docker host is reachable by the `host.docker.internal` name above.
    return false;
  }
  return false;
}

const PROXY_TIMEOUT_MS = 65_000;

/**
 * Forward one OpenAI-compatible request to a local AI server from inside the app
 * server, so the request travels over the Docker network / to `host.docker.internal`
 * and skips browser CORS. Not gated by the sync token (AI is independent of sync)
 * — guarded by the target allowlist instead.
 */
async function handleAiProxy(request: Request): Promise<Response> {
  const raw = new URL(request.url).searchParams.get("url");
  if (!raw) return json({ error: "missing target url" }, 400);
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return json({ error: "invalid target url" }, 400);
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return json({ error: "unsupported target scheme" }, 400);
  }
  if (!isAllowedProxyTarget(target.hostname)) {
    return json({ error: "target host not allowed (local/private only)" }, 403);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROXY_TIMEOUT_MS);
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers: { "content-type": request.headers.get("content-type") ?? "application/json" },
      body:
        request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
      signal: ctrl.signal,
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return json({ error: `AI server unreachable at ${target.origin}` }, 502);
  } finally {
    clearTimeout(timer);
  }
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

  // AI passthrough is independent of sync — it forwards to a local AI, not the
  // sync store — so it runs before (and without) the sync-token check.
  if (url.pathname === "/api/ai-proxy") return handleAiProxy(request);

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
