/**
 * Sanitize free-form user text before shipping it into an LLM prompt.
 *
 * We are not doing "AI safety" here — just defending against the practical
 * failure modes we see in an editor buffer:
 *   - control characters that confuse JSON/model tokenizers
 *   - obvious prompt-injection lines the student may have pasted in
 *   - runaway length (a 200KB note should not become a 200KB prompt)
 *
 * The output is safe to embed inside a fenced "user notes" block in a system
 * prompt. It is NOT trusted markdown, do not render it as HTML.
 */
export function sanitizeForPrompt(input: string, maxLen = 4000): string {
  if (!input) return "";
  let s = input;
  // Strip control chars except tab / LF.
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // Strip zero-width / bidi override chars often used to smuggle instructions.
  s = s.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "");
  // Neutralize triple backticks so we can safely wrap in a fence.
  s = s.replace(/```/g, "``\u200B`");
  // Line-level filter for classic prompt-injection openers.
  const INJECT = /^\s*(please\s+)?(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/i;
  const ROLE = /^\s*(system|assistant)\s*[:>]/i;
  s = s
    .split("\n")
    .map((line) => (INJECT.test(line) || ROLE.test(line) ? `[filtered] ${line.slice(0, 80)}` : line))
    .join("\n");
  // Clamp length; keep the tail (most recent thought) rather than the head.
  if (s.length > maxLen) s = "…\n" + s.slice(s.length - maxLen);
  return s.trim();
}

/**
 * Grab the Question block that contains the caret. A Question block starts
 * with the "── Question " rule inserted by /question and ends at the closing
 * rule inserted by /> (or EOF / next Question).
 */
export function extractCurrentQuestion(content: string, caret: number): string | null {
  const before = content.slice(0, caret);
  const startIdx = before.lastIndexOf("── Question ");
  if (startIdx === -1) return null;
  const after = content.slice(startIdx);
  const closeRule = "──────────────────────────────────────────────────";
  const nextQ = after.indexOf("── Question ", 1);
  const closeIdx = after.indexOf(closeRule, 1);
  const candidates = [nextQ, closeIdx].filter((i) => i > 0);
  const end = candidates.length ? startIdx + Math.min(...candidates) : content.length;
  return content.slice(startIdx, end).trim();
}

/**
 * Detect the "ollama unreachable" class of error so the caller can pop the
 * dedicated alert modal instead of a generic toast.
 */
export function isOllamaUnreachable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /ollama/i.test(msg) && /(unreachable|disabled|failed to fetch|network|abort)/i.test(msg);
}
