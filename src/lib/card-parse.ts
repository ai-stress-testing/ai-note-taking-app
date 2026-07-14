import type { Card, CardChoice } from "./store";

/**
 * Turns the block enclosing the caret (inserted by /card, /vocab, or
 * /question) into card data when the user closes it with `/>`. Pure
 * string-in, data-out — the store write happens at the call site.
 */

export type ParsedCard = Pick<Card, "kind"> &
  Partial<Pick<Card, "question" | "partLabel" | "choices" | "front" | "back">>;

const MARKERS = [
  "── Card ",
  "── Vocab ",
  "── Question ",
  "── Note ",
  "── Math ",
  "── Calc ",
  "── Help ",
] as const;
const CLOSE_RULE = "──────────────────────────────────────────────────";

export type BlockMarker = (typeof MARKERS)[number];

/** The nearest unclosed block marker above the caret, with its body text. */
export function parseEnclosingBlock(
  buffer: string,
  caret: number,
): { marker: BlockMarker; body: string } | null {
  const before = buffer.slice(0, caret);
  let markerIdx = -1;
  let marker: BlockMarker | null = null;
  for (const m of MARKERS) {
    const idx = before.lastIndexOf(m);
    if (idx > markerIdx) {
      markerIdx = idx;
      marker = m;
    }
  }
  if (marker === null) return null;
  if (before.slice(markerIdx + marker.length).includes(CLOSE_RULE)) return null;
  const firstLineEnd = buffer.indexOf("\n", markerIdx);
  if (firstLineEnd === -1 || firstLineEnd >= caret) return null;
  return { marker, body: buffer.slice(firstLineEnd + 1, caret).trim() };
}

function fieldValue(block: string, field: string): string {
  const m = new RegExp(`^\\s*${field}:\\s*(.*)$`, "m").exec(block);
  return m ? m[1].trim() : "";
}

/** Body of the unclosed ── Note ── block enclosing the caret, if any. */
export function parseNoteBlock(buffer: string, caret: number): string | null {
  const block = parseEnclosingBlock(buffer, caret);
  return block?.marker === "── Note " && block.body ? block.body : null;
}

export function parseBlockToCards(buffer: string, caret: number): ParsedCard[] {
  const before = buffer.slice(0, caret);
  let markerIdx = -1;
  let marker: (typeof MARKERS)[number] | null = null;
  for (const m of MARKERS) {
    const idx = before.lastIndexOf(m);
    if (idx > markerIdx) {
      markerIdx = idx;
      marker = m;
    }
  }
  if (marker === null) return [];
  // Already-closed blocks don't produce cards twice.
  if (before.slice(markerIdx + marker.length).includes(CLOSE_RULE)) return [];
  // Notes/math/calc/help aren't cards — their close paths are AI/tool driven.
  if (
    marker === "── Note " ||
    marker === "── Math " ||
    marker === "── Calc " ||
    marker === "── Help "
  )
    return [];
  const block = buffer.slice(markerIdx, caret);

  if (marker === "── Card ") {
    const front = fieldValue(block, "front");
    const back = fieldValue(block, "back");
    return front ? [{ kind: "note", front, back: back || undefined }] : [];
  }

  if (marker === "── Vocab ") {
    const term = fieldValue(block, "term");
    const definition = fieldValue(block, "definition");
    return term && definition ? [{ kind: "vocab", front: term, back: definition }] : [];
  }

  const question = fieldValue(block, "Q");
  if (!question) return [];
  const cards: ParsedCard[] = [];
  const partRe = /^Part ([a-z]):[^\n]*\n((?:\s*\[[x ]\][^\n]*\n?)*)/gm;
  let match: RegExpExecArray | null;
  while ((match = partRe.exec(block)) !== null) {
    const choices: CardChoice[] = [];
    for (const line of match[2].split("\n")) {
      const c = /^\s*\[([x ])\]\s*(.+)$/.exec(line);
      if (c && c[2].trim()) choices.push({ text: c[2].trim(), correct: c[1] === "x" });
    }
    if (choices.length > 0) {
      cards.push({ kind: "question", question, partLabel: match[1], choices });
    }
  }
  return cards;
}
