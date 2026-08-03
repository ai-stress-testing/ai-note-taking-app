import type { AiSource } from "./store";

export type AiResult = { text: string; source: AiSource };

// Resolved base per raw configured URL, so we probe /models once, not on
// every request. Cleared on a request failure so the next call re-resolves.
const resolvedBaseCache = new Map<string, string>();

/**
 * OpenAI-compatible routes live under `/v1` on most local runtimes (Ollama,
 * LM Studio, vLLM), but users routinely paste just the server root. Prefer
 * the `/v1` form, fall back to the bare base for servers that mount the API
 * at root. An explicit `/vN` in the URL is trusted as-is.
 */
export function candidateBases(raw: string): string[] {
  const base = raw.trim().replace(/\/+$/, "");
  if (/\/v\d+$/.test(base)) return [base];
  return [`${base}/v1`, base];
}

/**
 * The URL the browser actually fetches. Direct: the AI endpoint itself. Proxy:
 * the app's own `/api/ai-proxy`, which forwards to the endpoint server-side so
 * the request can travel the Docker network / reach `host.docker.internal` and
 * skip browser CORS. The absolute target rides along as a query param.
 */
function endpointUrl(target: string, proxy: boolean): string {
  return proxy ? `/api/ai-proxy?url=${encodeURIComponent(target)}` : target;
}

async function fetchModels(base: string, timeoutMs: number, proxy: boolean): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(endpointUrl(`${base}/models`, proxy), { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function modelIdsFrom(data: unknown): string[] {
  const list = (data as { data?: { id?: string }[] } | null)?.data;
  if (!Array.isArray(list)) return [];
  return list.map((m) => m?.id).filter((id): id is string => typeof id === "string");
}

/**
 * Probe the candidate bases for a live `/models` endpoint. `resolved` is true
 * only when one answered `res.ok`. If some responded but none was ok (e.g.
 * /models gated behind auth), fall back to the first candidate and let the
 * chat call surface the detailed error. Throws only when every candidate
 * threw a network error.
 */
async function probeBases(
  rawUrl: string,
  proxy: boolean,
): Promise<{ base: string; models: string[]; resolved: boolean }> {
  const candidates = candidateBases(rawUrl);
  let anyResponded = false;
  for (const base of candidates) {
    let res: Response;
    try {
      res = await fetchModels(base, 2500, proxy);
    } catch {
      continue;
    }
    anyResponded = true;
    if (res.ok) {
      let models: string[] = [];
      try {
        models = modelIdsFrom(await res.json());
      } catch {
        // Server answered /models with non-JSON; the base is still valid.
      }
      return { base, models, resolved: true };
    }
  }
  if (anyResponded) return { base: candidates[0], models: [], resolved: false };
  throw new Error(`Local AI server unreachable at ${rawUrl}. Start it and try again.`);
}

// Transport-prefixed so a direct resolution is never reused for a proxy call
// (their reachability differs).
function cacheKey(rawUrl: string, proxy: boolean): string {
  return `${proxy ? "p" : "d"}:${rawUrl}`;
}

async function resolveBase(rawUrl: string, proxy: boolean): Promise<string> {
  const key = cacheKey(rawUrl, proxy);
  const cached = resolvedBaseCache.get(key);
  if (cached) return cached;
  const { base, resolved } = await probeBases(rawUrl, proxy);
  if (resolved) resolvedBaseCache.set(key, base);
  return base;
}

/**
 * Resolve the base and return the reported model ids. Shared by the Settings
 * test button so it uses the exact same resolution as the real pipeline.
 * Throws when the server is unreachable.
 */
export async function probeLocalAi(
  rawUrl: string,
  proxy = false,
): Promise<{ base: string; models: string[] }> {
  const { base, models, resolved } = await probeBases(rawUrl, proxy);
  if (resolved) resolvedBaseCache.set(cacheKey(rawUrl, proxy), base);
  return { base, models };
}

async function chatCompletion(
  baseUrl: string,
  model: string,
  system: string,
  prompt: string,
  signal: AbortSignal,
  proxy: boolean,
): Promise<string> {
  const res = await fetch(endpointUrl(`${baseUrl}/chat/completions`, proxy), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      stream: false,
    }),
    signal,
  });
  if (!res.ok) {
    // Servers (Ollama especially) return a JSON error body even on 404 for an
    // unknown model — surface it instead of a bare status code.
    let detail = "";
    try {
      const body = await res.text();
      try {
        const parsed = JSON.parse(body) as { error?: { message?: string } | string } | null;
        const err = parsed?.error;
        detail = typeof err === "string" ? err : (err?.message ?? "");
      } catch {
        detail = body.trim().slice(0, 200);
      }
    } catch {
      // Body unreadable; fall back to the status alone.
    }
    throw new Error(`local AI server ${res.status}${detail ? ` — ${detail}` : ""}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("local AI server: empty response");
  return text;
}

/**
 * Local-only, protocol-generic. Speaks the OpenAI-compatible chat-completions
 * API that Ollama, LM Studio, llama.cpp server, vLLM, and most other local
 * LLM runtimes all expose, so any of them works behind `localAiUrl` — the
 * user picks which server and model, we don't hardcode one. No cloud
 * fallback: if disabled or unreachable, we throw so the caller can surface
 * a clear error to the user.
 */
export async function runAi(opts: {
  system: string;
  prompt: string;
  localAiEnabled: boolean;
  localAiUrl: string;
  localAiModel: string;
  /** Route through the app server (`/api/ai-proxy`) instead of a direct fetch. */
  localAiProxy?: boolean;
}): Promise<AiResult> {
  if (!opts.localAiEnabled) {
    throw new Error("Local AI is disabled. Enable it in settings — cloud AI is not available.");
  }
  const proxy = opts.localAiProxy ?? false;
  const base = await resolveBase(opts.localAiUrl, proxy);

  const genCtrl = new AbortController();
  const genTimer = setTimeout(() => genCtrl.abort(), 60000);
  try {
    const text = await chatCompletion(
      base,
      opts.localAiModel,
      opts.system,
      opts.prompt,
      genCtrl.signal,
      proxy,
    );
    return { text, source: "local" };
  } catch (e) {
    // A cached base may have gone stale (server restarted at the other form);
    // drop it so the next call re-probes.
    resolvedBaseCache.delete(cacheKey(opts.localAiUrl, proxy));
    throw e;
  } finally {
    clearTimeout(genTimer);
  }
}
