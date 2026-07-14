import type { AiSource } from "./store";

export type AiResult = { text: string; source: AiSource };

async function chatCompletion(
  baseUrl: string,
  model: string,
  system: string,
  prompt: string,
  signal: AbortSignal,
): Promise<string> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
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
  if (!res.ok) throw new Error(`local AI server ${res.status}`);
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
}): Promise<AiResult> {
  if (!opts.localAiEnabled) {
    throw new Error("Local AI is disabled. Enable it in settings — cloud AI is not available.");
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    await fetch(`${opts.localAiUrl.replace(/\/$/, "")}/models`, { signal: ctrl.signal });
  } catch {
    clearTimeout(timer);
    throw new Error(`Local AI server unreachable at ${opts.localAiUrl}. Start it and try again.`);
  }
  clearTimeout(timer);

  const genCtrl = new AbortController();
  const genTimer = setTimeout(() => genCtrl.abort(), 60000);
  try {
    const text = await chatCompletion(
      opts.localAiUrl,
      opts.localAiModel,
      opts.system,
      opts.prompt,
      genCtrl.signal,
    );
    return { text, source: "local" };
  } finally {
    clearTimeout(genTimer);
  }
}
