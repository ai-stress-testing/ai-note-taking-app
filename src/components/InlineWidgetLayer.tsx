import { useLayoutEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { getCaretCoords } from "@/lib/caret";
import {
  CANVAS_MARKER_RE,
  LINE_HEIGHT_PX,
  REVIEW_MARKER,
  removeMarkerBlock,
  resizeMarkerBlock,
} from "@/lib/inline-widgets";
import { CanvasBlock } from "./CanvasBlock";
import { FlashcardTray } from "./FlashcardTray";

type Anchor = { x: number; y: number };

/**
 * Renders canvases and the review tray at the exact line where /canvas and
 * /fsrs were invoked: markers in the buffer reserve vertical space; this
 * layer measures each marker's pixel position (same mirror technique the
 * slash menu uses) and absolutely positions the widget over the reserved
 * lines, inside the scrolling text flow.
 */
export function InlineWidgetLayer({
  fileId,
  content,
  textarea,
  focused,
  reviewIds,
  onCloseReview,
}: {
  fileId: string;
  content: string;
  textarea: HTMLTextAreaElement | null;
  focused: boolean;
  reviewIds: string[] | null;
  onCloseReview: () => void;
}) {
  const { canvases, setCanvas, deleteCanvas, setContent } = useStore();
  const [anchors, setAnchors] = useState<Record<string, Anchor>>({});
  const [tick, setTick] = useState(0);

  useLayoutEffect(() => {
    if (!textarea) return;
    const observer = new ResizeObserver(() => setTick((t) => t + 1));
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [textarea]);

  useLayoutEffect(() => {
    if (!textarea) return;
    const next: Record<string, Anchor> = {};
    for (const m of content.matchAll(CANVAS_MARKER_RE)) {
      const { x, y } = getCaretCoords(textarea, m.index);
      next[m[1]] = { x, y: y + LINE_HEIGHT_PX + 4 };
    }
    const reviewIdx = content.indexOf(REVIEW_MARKER);
    if (reviewIdx !== -1) {
      const { x, y } = getCaretCoords(textarea, reviewIdx);
      next["review"] = { x, y: y + LINE_HEIGHT_PX + 4 };
    }
    setAnchors(next);
    // tick re-measures on pane resize (wrapping changes line positions)
  }, [content, textarea, tick]);

  const fileCanvases = canvases[fileId] ?? [];

  return (
    <>
      {fileCanvases.map((cv) => {
        const a = anchors[cv.id];
        if (!a) return null;
        return (
          <div
            key={cv.id}
            className="ed-inline-widget"
            style={{ position: "absolute", top: a.y, left: a.x, zIndex: 3 }}
          >
            <CanvasBlock
              data={cv}
              onChange={(next) => {
                setCanvas(fileId, { ...cv, ...next });
                if (next.height !== cv.height) {
                  setContent(
                    fileId,
                    resizeMarkerBlock(content, `⟦canvas:${cv.id}⟧`, next.height + 40),
                  );
                }
              }}
              onDelete={() => {
                deleteCanvas(fileId, cv.id);
                setContent(fileId, removeMarkerBlock(content, `⟦canvas:${cv.id}⟧`));
              }}
            />
          </div>
        );
      })}
      {focused && reviewIds && anchors["review"] && (
        <div
          className="ed-inline-widget ed-inline-review"
          style={{
            position: "absolute",
            top: anchors["review"].y,
            left: anchors["review"].x,
            right: "1.25rem",
            zIndex: 3,
          }}
        >
          <FlashcardTray
            ids={reviewIds}
            onClose={() => {
              setContent(fileId, removeMarkerBlock(content, REVIEW_MARKER));
              onCloseReview();
            }}
          />
        </div>
      )}
    </>
  );
}
