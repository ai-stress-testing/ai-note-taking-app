import type { AiSource } from "./store";

export type AiResult = { text: string; source: AiSource };

async function tryOllama(
  url: string,
  model: string,
  system: string,
  prompt: string,
  signal: AbortSignal,
): Promise<string> {
  const res = await fetch(`${url.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, system, prompt, stream: false }),
    signal,
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const data = (await res.json()) as { response?: string };
  if (!data.response) throw new Error("ollama: empty response");
  return data.response;
}

/**
 * Ollama-only. No cloud fallback: this app requires a local Ollama server.
 * If the /ollamaEnabled flag is off or the server is unreachable, we throw
 * so the caller can surface a clear error to the user.
 */
export async function runAi(opts: {
  system: string;
  prompt: string;
  ollamaEnabled: boolean;
  ollamaUrl: string;
  ollamaModel: string;
}): Promise<AiResult> {
  if (!opts.ollamaEnabled) {
    throw new Error("Ollama is disabled. Enable it in settings — cloud AI is not available.");
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    await fetch(`${opts.ollamaUrl.replace(/\/$/, "")}/api/tags`, { signal: ctrl.signal });
  } catch {
    clearTimeout(timer);
    throw new Error(`Ollama unreachable at ${opts.ollamaUrl}. Start ollama and try again.`);
  }
  clearTimeout(timer);

  const genCtrl = new AbortController();
  const genTimer = setTimeout(() => genCtrl.abort(), 60000);
  try {
    const text = await tryOllama(
      opts.ollamaUrl,
      opts.ollamaModel,
      opts.system,
      opts.prompt,
      genCtrl.signal,
    );
    return { text, source: "ollama" };
  } finally {
    clearTimeout(genTimer);
  }
}
