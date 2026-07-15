/**
 * Inline widgets (canvases, the FSRS review tray) anchor to the line where
 * their command was invoked: the command inserts a marker line followed by
 * enough blank lines to fit the widget, and the widget renders absolutely
 * positioned at the marker's measured coordinates. These helpers own the
 * marker text format so insert/measure/remove stay in one place.
 */

export const REVIEW_MARKER = "⟦review⟧";
export const CANVAS_MARKER_RE = /⟦canvas:([a-z0-9-]+)⟧/g;

/** Editor line metrics — must match .ed-mirror/.ed-textarea.overlay CSS. */
export const LINE_HEIGHT_PX = 13.5 * 1.6;

export function padLinesFor(heightPx: number): number {
  return Math.ceil((heightPx + 16) / LINE_HEIGHT_PX);
}

export function markerBlock(marker: string, heightPx: number): string {
  return `${marker}\n${"\n".repeat(padLinesFor(heightPx))}`;
}

/** Finds every canvas marker and its character index in the buffer. */
export function findCanvasMarkers(content: string): { id: string; index: number }[] {
  const out: { id: string; index: number }[] = [];
  for (const m of content.matchAll(CANVAS_MARKER_RE)) {
    out.push({ id: m[1], index: m.index });
  }
  return out;
}

/**
 * Removes a marker line plus its trailing blank-line run (the space the
 * widget reserved). If the user typed inside the reserved area the removal
 * stops at their text — nothing but blank lines is ever deleted.
 */
export function removeMarkerBlock(content: string, marker: string): string {
  const idx = content.indexOf(marker);
  if (idx === -1) return content;
  const lineStart = content.lastIndexOf("\n", idx - 1) + 1;
  let end = content.indexOf("\n", idx);
  if (end === -1) return content.slice(0, lineStart);
  end += 1;
  while (end < content.length) {
    const nl = content.indexOf("\n", end);
    const line = nl === -1 ? content.slice(end) : content.slice(end, nl);
    if (line.trim() !== "") break;
    if (nl === -1) {
      end = content.length;
      break;
    }
    end = nl + 1;
  }
  return content.slice(0, lineStart) + content.slice(end);
}

/**
 * Grows/shrinks the blank-line run after a marker so a resized widget still
 * fits. Returns the content unchanged if the marker is missing.
 */
export function resizeMarkerBlock(content: string, marker: string, heightPx: number): string {
  const idx = content.indexOf(marker);
  if (idx === -1) return content;
  let end = content.indexOf("\n", idx);
  if (end === -1) return content;
  end += 1;
  let blanks = 0;
  let scan = end;
  while (scan < content.length) {
    const nl = content.indexOf("\n", scan);
    const line = nl === -1 ? content.slice(scan) : content.slice(scan, nl);
    if (line.trim() !== "" || nl === -1) break;
    blanks += 1;
    scan = nl + 1;
  }
  const needed = padLinesFor(heightPx);
  if (needed === blanks) return content;
  return content.slice(0, end) + "\n".repeat(needed) + content.slice(scan);
}
